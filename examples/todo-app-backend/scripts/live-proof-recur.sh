#!/usr/bin/env bash
# Live proof for the recur feature, run against the real dev stack (Postgres + Keycloak) and the real
# API - never fakes. Exits non-zero on the first mismatch, naming the step that failed. This is the
# evidence source for: fr.recur.make-recurring, fr.recur.edit-rule, fr.recur.end-rule,
# fr.recur.see-upcoming, and (the materialisation step) integration.recur.scheduler's own live tick.
#
# Usage:
#   API_URL=http://localhost:3105 scripts/live-proof-recur.sh
#   DEMO_EMAIL=... DEMO_PASSWORD=... DEMO2_EMAIL=... DEMO2_PASSWORD=... scripts/live-proof-recur.sh
#
# Prerequisites: the dev compose stack is up (postgres, keycloak) and this feature's own API instance is
# running on its own lane port against its own database, e.g.:
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_recur PORT=3105 \
#     RECUR_TICK_CRON='*/5 * * * * *' node dist/main.js
# RECUR_TICK_CRON is only set for this proof so integration.recur.scheduler's own tick fires every 5
# seconds instead of every 5 minutes (the endpoint integration.recur.scheduler declares,
# AppConfigService's own default) - this script waits for a *real* tick to materialise a real occurrence,
# never a manually invoked stand-in for one, so a fast tick is what makes that wait practical here.
set -euo pipefail

API_URL=${API_URL:-http://localhost:3105}
DEMO_EMAIL=${DEMO_EMAIL:-demo@todo.dev}
DEMO_PASSWORD=${DEMO_PASSWORD:-todo-demo-pass}
DEMO2_EMAIL=${DEMO2_EMAIL:-demo2@todo.dev}
DEMO2_PASSWORD=${DEMO2_PASSWORD:-todo-demo-pass-2}
TICK_TIMEOUT_SECONDS=${TICK_TIMEOUT_SECONDS:-90}

STEP=""
PASS_COUNT=0

fail() {
  echo "FAIL [$STEP]: $*" >&2
  exit 1
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
  ERROR_CODE=$(node -e '
    let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
      const body = JSON.parse(s);
      const code = body.errors?.[0]?.extensions?.code;
      process.stdout.write(code === undefined ? "" : String(code));
    });' <<<"$BODY")
}

data_json() {
  # Extracts data.<op> (a JSON object/array) from the last BODY, as compact JSON text.
  node -e '
    const op = process.argv[1];
    let s = ""; process.stdin.on("data", c => s += c).on("end", () => {
      const body = JSON.parse(s);
      process.stdout.write(JSON.stringify(body.data?.[op] ?? null));
    });
  ' "$1" <<<"$BODY"
}

field() {
  node -e '
    const [json, path] = process.argv.slice(1);
    const value = path.split(".").reduce((v, key) => (v === null || v === undefined ? v : v[key]), JSON.parse(json));
    process.stdout.write(value === undefined || value === null ? "" : String(value));
  ' "$1" "$2"
}

assert_success() {
  [ "$HAS_ERRORS" = "0" ] || fail "expected success, got errors: $BODY"
}

assert_refused() {
  local expected_code="$1"
  [ "$HAS_ERRORS" = "1" ] || fail "expected a refusal (code $expected_code), got success: $BODY"
  [ "$ERROR_CODE" = "$expected_code" ] || fail "expected error code $expected_code, got $ERROR_CODE: $BODY"
}

step() { STEP="$1"; echo "-- $STEP"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "   ok"; }

TODAY=$(node -e 'process.stdout.write(new Date().toISOString().slice(0, 10))')

SIGN_IN='mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }'
MAKE_RECURRING='mutation M($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }'
EDIT_RECURRENCE='mutation M($input: EditRecurrenceInput!) { editRecurrence(input: $input) { ruleId frequency timeZone time } }'
END_RECURRENCE='mutation M($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }'
UPCOMING='query Q($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate status } previewDates } }'

### 1. sign in as both demo identities
step "signIn demo -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO_EMAIL" "$DEMO_PASSWORD")"
assert_success
TOKEN1=$(field "$(data_json signIn)" sessionToken)
[ -n "$TOKEN1" ] || fail "no sessionToken in response: $BODY"
pass

step "signIn demo2 -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO2_EMAIL" "$DEMO2_PASSWORD")"
assert_success
TOKEN2=$(field "$(data_json signIn)" sessionToken)
[ -n "$TOKEN2" ] || fail "no sessionToken in response: $BODY"
pass

### 2. fr.recur.make-recurring
step "makeRecurring (every-weekday, Europe/Berlin, 09:00, startDate=$TODAY) -> ruleId"
graphql "$MAKE_RECURRING" "$(node -e 'console.log(JSON.stringify({input:{title:"live-proof recur rule",frequency:"EveryWeekday",timeZone:"Europe/Berlin",time:"09:00",startDate:process.argv[1]}}))' "$TODAY")" "x-session-token: $TOKEN1"
assert_success
RULE_ID=$(field "$(data_json makeRecurring)" ruleId)
[ -n "$RULE_ID" ] || fail "no ruleId in response: $BODY"
pass

### 3. fr.recur.see-upcoming (before generation): the preview never lands on a weekend
step "upcomingOccurrences before generation -> previewDates has no weekend date"
graphql "$UPCOMING" "$(node -e 'console.log(JSON.stringify({ruleId:process.argv[1]}))' "$RULE_ID")" "x-session-token: $TOKEN1"
assert_success
WEEKEND_PREVIEW=$(node -e '
  const dates = JSON.parse(process.argv[1]).data.upcomingOccurrences.previewDates;
  const isWeekend = d => [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay());
  process.stdout.write(dates.some(isWeekend) ? "1" : "0");
' "$BODY")
[ "$WEEKEND_PREVIEW" = "0" ] || fail "previewDates contains a weekend date: $BODY"
pass

### 4. exceptionFlows: someone who is not the rule's owner may not edit it (br.recur.occurrence.owned-by-rule-owner's own shape, applied to the rule)
step "demo2 attempts editRecurrence on demo's rule -> RECUR_RULE_FORBIDDEN"
graphql "$EDIT_RECURRENCE" "$(node -e 'console.log(JSON.stringify({input:{ruleId:process.argv[1],time:"11:00"}}))' "$RULE_ID")" "x-session-token: $TOKEN2"
assert_refused RECUR_RULE_FORBIDDEN
pass

### 5. integration.recur.scheduler: wait for a REAL tick to materialise today's occurrence (never a
### manually invoked stand-in) - requires the API to have been started with a short RECUR_TICK_CRON.
step "waiting up to ${TICK_TIMEOUT_SECONDS}s for a real scheduler tick to materialise today's occurrence"
MATERIALISED=""
ELAPSED=0
while [ "$ELAPSED" -lt "$TICK_TIMEOUT_SECONDS" ]; do
  graphql "$UPCOMING" "$(node -e 'console.log(JSON.stringify({ruleId:process.argv[1]}))' "$RULE_ID")" "x-session-token: $TOKEN1"
  assert_success
  MATERIALISED=$(node -e '
    const occ = JSON.parse(process.argv[1]).data.upcomingOccurrences.materialised;
    const today = process.argv[2];
    const found = occ.find(o => o.localDate === today);
    process.stdout.write(found ? JSON.stringify(found) : "");
  ' "$BODY" "$TODAY")
  [ -n "$MATERIALISED" ] && break
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
[ -n "$MATERIALISED" ] || fail "no occurrence materialised for $TODAY within ${TICK_TIMEOUT_SECONDS}s - is the API running with a short RECUR_TICK_CRON?"
[ "$(field "$MATERIALISED" status)" = "materialised" ] || fail "materialised occurrence has unexpected status: $MATERIALISED"
pass

### 6. fr.recur.edit-rule
step "editRecurrence (owner) -> new time"
graphql "$EDIT_RECURRENCE" "$(node -e 'console.log(JSON.stringify({input:{ruleId:process.argv[1],time:"10:30"}}))' "$RULE_ID")" "x-session-token: $TOKEN1"
assert_success
[ "$(field "$(data_json editRecurrence)" time)" = "10:30" ] || fail "time was not updated: $BODY"
pass

### 7. fr.recur.end-rule / br.recur.ending.preserves-history
step "endRecurrence effective $TODAY (owner) -> endedAt, orphanedCount >= 1"
graphql "$END_RECURRENCE" "$(node -e 'console.log(JSON.stringify({input:{ruleId:process.argv[1],endedAt:process.argv[2]}}))' "$RULE_ID" "$TODAY")" "x-session-token: $TOKEN1"
assert_success
[ "$(field "$(data_json endRecurrence)" endedAt)" = "$TODAY" ] || fail "endedAt was not set: $BODY"
ORPHANED_COUNT=$(field "$(data_json endRecurrence)" orphanedCount)
[ "$ORPHANED_COUNT" -ge 1 ] || fail "expected at least one orphaned occurrence, got $ORPHANED_COUNT: $BODY"
pass

step "upcomingOccurrences after ending -> no preview, history kept as orphaned"
graphql "$UPCOMING" "$(node -e 'console.log(JSON.stringify({ruleId:process.argv[1]}))' "$RULE_ID")" "x-session-token: $TOKEN1"
assert_success
PREVIEW_LEN=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).data.upcomingOccurrences.previewDates.length))' "$BODY")
[ "$PREVIEW_LEN" = "0" ] || fail "an ended rule must show no upcoming preview: $BODY"
case "$BODY" in *'"status":"orphaned"'*) ;; *) fail "expected the today occurrence to read orphaned: $BODY" ;; esac
pass

echo
echo "live-proof-recur: $PASS_COUNT/$PASS_COUNT steps passed"
