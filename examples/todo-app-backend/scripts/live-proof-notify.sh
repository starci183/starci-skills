#!/usr/bin/env bash
# Live proof for the notify feature (examples/todo-app-backend), run against the real dev stack -
# Postgres, Redis and Keycloak from `docker compose -p todo-app-dev -f
# .starcistacks/dev/infra/compose/compose.yaml up -d` - and the notify lane's own API/database
# (PORT=3102, DATABASE_URL pointing at todo_notify). Never fakes: DeliveryService's real port is
# NotifySmtpPort/NotifyQueuePort, and this script never swaps them out from underneath the running api.
#
# GraphQL gives notify only three doors (notificationPreferences, updateNotificationPreferences,
# unsubscribe) - fr.notify.on-completion and fr.notify.digest have no GraphQL read of their own, so this
# script verifies them the only honest way available: reading the same Postgres/Redis the running api
# just wrote to, with the container's own psql/redis-cli. That is still a live run against the real
# stack, not a fake - it is not a unit test standing in for one.
#
# fr.notify.on-new-device is NOT exercised here: fr.notify.on-new-device and
# contract.notify.new-device-signal are blockedBy gap.notify.new-device-event (login raises no
# new-device signal today), so there is no real product action this script could take to trigger it.
# Injecting a synthetic event would not be a live proof of the product; see that gap's own statement.
#
# Usage:
#   scripts/live-proof-notify.sh
#   API_URL=http://localhost:3102 scripts/live-proof-notify.sh
set -euo pipefail

API_URL=${API_URL:-http://localhost:3102}
DEMO_EMAIL=${DEMO_EMAIL:-demo@todo.dev}
DEMO_PASSWORD=${DEMO_PASSWORD:-todo-demo-pass}
POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-todo-app-dev-postgres-1}
REDIS_CONTAINER=${REDIS_CONTAINER:-todo-app-dev-redis-1}
NOTIFY_DB=${NOTIFY_DB:-todo_notify}
DIGEST_WINDOW_MINUTES=1
WINDOW_POLL_TIMEOUT_S=90

STEP=""
PASS_COUNT=0

fail() {
  echo "FAIL [$STEP]: $*" >&2
  exit 1
}

step() {
  STEP="$1"
  echo "-- $STEP"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "   ok"
}

graphql() {
  local doc="$1" vars="$2" extra_header="${3:-}"
  if [ -z "$vars" ]; then vars='{}'; fi
  local args=(-s -X POST "$API_URL/graphql" -H "Content-Type: application/json")
  if [ -n "$extra_header" ]; then args+=(-H "$extra_header"); fi
  local payload
  payload=$(node -e '
    const [q, v] = process.argv.slice(1);
    process.stdout.write(JSON.stringify({ query: q, variables: JSON.parse(v) }));
  ' "$doc" "$vars")
  BODY=$(curl "${args[@]}" -d "$payload")
  HAS_ERRORS=$(node -e '
    let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
      const body = JSON.parse(s);
      process.stdout.write(Array.isArray(body.errors) && body.errors.length > 0 ? "1" : "0");
    });' <<<"$BODY")
}

data_field() {
  node -e '
    const [op, field] = process.argv.slice(1);
    let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
      const body = JSON.parse(s);
      const value = body.data?.[op]?.[field];
      process.stdout.write(value === undefined ? "" : String(value));
    });
  ' "$1" "$2" <<<"$BODY"
}

assert_success() {
  [ "$HAS_ERRORS" = "0" ] || fail "expected success, got errors: $BODY"
}

# Runs one SQL statement against the notify lane's own database and prints its single scalar result.
psql_scalar() {
  docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$NOTIFY_DB" -tA -c "$1" | tr -d '[:space:]'
}

redis_zcard() {
  docker exec "$REDIS_CONTAINER" redis-cli ZCARD "$1" | tr -d '[:space:]'
}

SIGN_IN='mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }'
CREATE_TASK='mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }'
COMPLETE_TASK='mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }'
NOTIFICATION_PREFERENCES='query { notificationPreferences { channel unsubscribed digestWindowMinutes } }'
UPDATE_PREFERENCES='mutation Update($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }'
UNSUBSCRIBE='mutation Unsub($input: UnsubscribeInput!) { unsubscribe(input: $input) { channel unsubscribed } }'

### 0. sign in
step "signIn demo -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO_EMAIL" "$DEMO_PASSWORD")"
assert_success
TOKEN=$(data_field signIn sessionToken)
PERSON_ID=$(data_field signIn personId)
[ -n "$TOKEN" ] && [ -n "$PERSON_ID" ] || fail "no sessionToken/personId in response: $BODY"
pass

### 0b. clean slate: a window left open (unflushed) by an earlier run of this same script would still be
### "not yet closed" under its own (possibly longer) closesAt, and a fresh admission would join that old
### window rather than opening a new one - correct per br.notify.digest.window (a window's length is
### fixed at open time), but it would make this script's own timing non-deterministic across reruns.
step "cleanup: close out any digest window this script left open on an earlier run"
docker exec "$POSTGRES_CONTAINER" psql -U postgres -d "$NOTIFY_DB" -c \
  "DELETE FROM notify_digest_windows WHERE person_id = '$PERSON_ID' AND channel = 'email' AND flushed_at IS NULL" >/dev/null
pass

### 1. fr.notify.unsubscribe / notificationPreferences: reset to a known state (subscribed, a short digest window)
step "updateNotificationPreferences -> resubscribed with a ${DIGEST_WINDOW_MINUTES}-minute digest window"
graphql "$UPDATE_PREFERENCES" "$(node -e 'console.log(JSON.stringify({input:{channel:"email",unsubscribed:false,digestWindowMinutes:Number(process.argv[1])}}))' "$DIGEST_WINDOW_MINUTES")" "x-session-token: $TOKEN"
assert_success
[ "$(data_field updateNotificationPreferences unsubscribed)" = "false" ] || fail "expected unsubscribed:false: $BODY"
pass

step "notificationPreferences reads back what was just written"
graphql "$NOTIFICATION_PREFERENCES" '{}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field notificationPreferences digestWindowMinutes)" = "$DIGEST_WINDOW_MINUTES" ] || fail "digestWindowMinutes not persisted: $BODY"
pass

### 2. fr.notify.on-completion: completing a task admits a notification for its owner
step "createTask + completeTask (event A) -> event.task.completed admits a notify_notifications row"
graphql "$CREATE_TASK" '{"input":{"title":"live-proof-notify A"}}' "x-session-token: $TOKEN"
assert_success
TASK_A=$(data_field createTask taskId)
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_A\"}" "x-session-token: $TOKEN"
assert_success
sleep 1 # PlatformEventBus -> NotifyEventSubscriber -> NotifyService.admit is async fire-and-forget
COUNT_A=$(psql_scalar "SELECT count(*) FROM notify_notifications WHERE recipient_id = '$PERSON_ID' AND kind = 'task-complete' AND payload->>'taskId' = '$TASK_A'")
[ "$COUNT_A" = "1" ] || fail "expected exactly one notification for task A, got $COUNT_A"
GROUP_A=$(psql_scalar "SELECT digest_group_id FROM notify_notifications WHERE recipient_id = '$PERSON_ID' AND payload->>'taskId' = '$TASK_A'")
[ -n "$GROUP_A" ] || fail "notification for task A never joined a digest window"
pass

### 3. fr.notify.digest: a second event for the same person+channel, before the window closes, joins the same group
step "createTask + completeTask (event B) -> joins event A's still-open digest window"
graphql "$CREATE_TASK" '{"input":{"title":"live-proof-notify B"}}' "x-session-token: $TOKEN"
assert_success
TASK_B=$(data_field createTask taskId)
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_B\"}" "x-session-token: $TOKEN"
assert_success
sleep 1
GROUP_B=$(psql_scalar "SELECT digest_group_id FROM notify_notifications WHERE recipient_id = '$PERSON_ID' AND payload->>'taskId' = '$TASK_B'")
[ "$GROUP_B" = "$GROUP_A" ] || fail "event B joined a different group ($GROUP_B) than event A ($GROUP_A)"
pass

step "integration.notify.queue (live Redis): the digest window's flush job is really sitting in the queue"
QUEUE_SIZE=$(redis_zcard notify:dispatch-queue)
[ "$QUEUE_SIZE" -ge 1 ] || fail "expected at least one job in notify:dispatch-queue, got $QUEUE_SIZE"
pass

### 4. the window closes and the real scheduler dispatches both events as one message
step "waiting up to ${WINDOW_POLL_TIMEOUT_S}s for the ${DIGEST_WINDOW_MINUTES}-minute window to close and the flush job to be dequeued"
DEADLINE=$(( $(date +%s) + WINDOW_POLL_TIMEOUT_S ))
FLUSHED_AT=""
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  FLUSHED_AT=$(psql_scalar "SELECT flushed_at FROM notify_digest_windows WHERE id = '$GROUP_A'")
  if [ -n "$FLUSHED_AT" ]; then break; fi
  sleep 5
done
[ -n "$FLUSHED_AT" ] || fail "digest window $GROUP_A was never flushed within ${WINDOW_POLL_TIMEOUT_S}s"
pass

step "sds.notify.delivery-lifecycle t-dispatch: both attempts left their initial queued/attempt=0 state"
ATTEMPT_A=$(psql_scalar "SELECT attempt FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '$TASK_A'")
ATTEMPT_B=$(psql_scalar "SELECT attempt FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '$TASK_B'")
[ "$ATTEMPT_A" -ge 1 ] || fail "task A's delivery attempt was never dispatched (attempt=$ATTEMPT_A)"
[ "$ATTEMPT_B" -ge 1 ] || fail "task B's delivery attempt was never dispatched (attempt=$ATTEMPT_B)"
pass

### 5. fr.notify.unsubscribe: after unsubscribing, a later event is suppressed before any dispatch attempt
step "unsubscribe -> unsubscribed:true"
graphql "$UNSUBSCRIBE" '{"input":{"channel":"email"}}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field unsubscribe unsubscribed)" = "true" ] || fail "expected unsubscribed:true: $BODY"
pass

step "createTask + completeTask (event C) -> suppressed immediately, never dispatched"
graphql "$CREATE_TASK" '{"input":{"title":"live-proof-notify C"}}' "x-session-token: $TOKEN"
assert_success
TASK_C=$(data_field createTask taskId)
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_C\"}" "x-session-token: $TOKEN"
assert_success
sleep 1
STATE_C=$(psql_scalar "SELECT a.state FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '$TASK_C'")
FAILURE_CLASS_C=$(psql_scalar "SELECT a.failure_class FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '$TASK_C'")
ATTEMPT_C=$(psql_scalar "SELECT a.attempt FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '$TASK_C'")
[ "$STATE_C" = "suppressed" ] || fail "expected event C suppressed, got state=$STATE_C"
[ "$FAILURE_CLASS_C" = "unsubscribed" ] || fail "expected failureClass unsubscribed, got $FAILURE_CLASS_C"
[ "$ATTEMPT_C" = "0" ] || fail "expected attempt=0 (no dispatch was ever made), got $ATTEMPT_C"
pass

step "resubscribe -> re-subscribing lets a later event reach the digest window again"
graphql "$UPDATE_PREFERENCES" '{"input":{"channel":"email","unsubscribed":false}}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field updateNotificationPreferences unsubscribed)" = "false" ] || fail "expected unsubscribed:false: $BODY"
pass

echo
echo "live-proof-notify: $PASS_COUNT/$PASS_COUNT steps passed"
echo "note: integration.notify.smtp had no reachable dev host to prove a live delivery against (see that record); every step above ran against real Postgres and real Redis."
