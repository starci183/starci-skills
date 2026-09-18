#!/usr/bin/env bash
# Live proof for the todo-app-backend example, run against the real Keycloak/Postgres dev stack
# (never fakes). Exits non-zero on the first mismatch, naming the step that failed. This is the
# evidence source for: integration.login.keycloak, integration.login.postgres,
# br.login.password.sign-in, br.task.complete.once, br.task.delete.final, br.task.list.owned.
#
# Rewritten for GraphQL (ex-nivo-shape): the transport moved from REST (POST /auth/sign-in, POST
# /tasks, ...) to one GraphQL endpoint. Every call here is a POST to $API_URL/graphql with a
# {query, variables} body. Apollo's default HTTP mapping answers 200 for a resolver-thrown business
# refusal (INVALID_CREDENTIALS, TASK_FORBIDDEN, SESSION_NOT_FOUND, ...) exactly as it does for a
# success - the outcome lives in the JSON body (`errors[]` present vs `data.<op>` present), never in
# the HTTP status code, so every assertion below reads the body's shape instead of the old REST
# script's `assert_status`.
#
# Usage:
#   scripts/live-proof.sh
#   API_URL=http://localhost:3001 scripts/live-proof.sh
#   DEMO_EMAIL=... DEMO_PASSWORD=... DEMO2_EMAIL=... DEMO2_PASSWORD=... scripts/live-proof.sh
#
# Prerequisites: the dev compose stack is up (postgres, keycloak, redis, minio, prometheus) and
# the api is running on the host (PORT=3001 ./scripts/with-dev-secrets.sh npm run start). This
# script only talks HTTP to the running api; it does not start or stop anything itself, so it can
# be run standalone or wrapped: ./scripts/with-dev-secrets.sh scripts/live-proof.sh (the wrapper
# is only needed if a future revision reads demo credentials out of a decrypted secret instead of
# the defaults below, which mirror the plaintext DEMO-ONLY users already committed in
# .starcistacks/dev/infra/compose/realm-todo.json).
set -euo pipefail

API_URL=${API_URL:-http://localhost:3001}
DEMO_EMAIL=${DEMO_EMAIL:-demo@todo.dev}
DEMO_PASSWORD=${DEMO_PASSWORD:-todo-demo-pass}
DEMO2_EMAIL=${DEMO2_EMAIL:-demo2@todo.dev}
DEMO2_PASSWORD=${DEMO2_PASSWORD:-todo-demo-pass-2}
ORIGIN=${ORIGIN:-http://localhost:3000}

STEP=""
PASS_COUNT=0

fail() {
  echo "FAIL [$STEP]: $*" >&2
  exit 1
}

# Runs one GraphQL operation. Sets globals BODY (raw response text), HAS_ERRORS (0/1) and
# ERROR_CODE (the first error's extensions.code, or empty). $1=query/mutation document, $2=JSON
# variables object (or '{}'), $3=optional extra header ("x-session-token: ...").
graphql() {
  local doc="$1" vars="$2" extra_header="${3:-}"
  if [ -z "$vars" ]; then
    vars='{}'
  fi
  local args=(-s -X POST "$API_URL/graphql" -H "Content-Type: application/json")
  if [ -n "$extra_header" ]; then
    args+=(-H "$extra_header")
  fi
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

# Extracts data.<opName>.<field> from the last BODY.
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

assert_refused() {
  local expected_code="$1"
  [ "$HAS_ERRORS" = "1" ] || fail "expected a refusal (code $expected_code), got success: $BODY"
  [ "$ERROR_CODE" = "$expected_code" ] || fail "expected error code $expected_code, got $ERROR_CODE: $BODY"
}

step() {
  STEP="$1"
  echo "-- $STEP"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "   ok"
}

SIGN_IN='mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }'
SIGN_OUT='mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }'
CREATE_TASK='mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }'
LIST_TASKS='query { tasks { taskId title complete } }'
COMPLETE_TASK='mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }'
REOPEN_TASK='mutation ReopenTask($id: ID!) { reopenTask(id: $id) { taskId complete } }'
DELETE_TASK='mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }'

### 1. sign-in: correct password succeeds
step "signIn demo (correct password) -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO_EMAIL" "$DEMO_PASSWORD")"
assert_success
TOKEN1=$(data_field signIn sessionToken)
[ -n "$TOKEN1" ] || fail "no sessionToken in response: $BODY"
pass

### 2. br.login.password.sign-in: wrong password and unknown email refuse identically
step "signIn wrong password -> INVALID_CREDENTIALS"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:"wrong-password-xyz"}}))' "$DEMO_EMAIL")"
assert_refused INVALID_CREDENTIALS
WRONG_PASSWORD_BODY="$BODY"
pass

step "signIn unknown email -> INVALID_CREDENTIALS, identical to wrong password"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:"nobody-"+process.pid+"@todo.dev",password:"whatever"}}))')"
assert_refused INVALID_CREDENTIALS
[ "$BODY" = "$WRONG_PASSWORD_BODY" ] || fail "unknown-email body differs from wrong-password body: '$BODY' vs '$WRONG_PASSWORD_BODY'"
pass

### 3. task CRUD
step "createTask -> taskId"
graphql "$CREATE_TASK" '{"input":{"title":"live-proof task"}}' "x-session-token: $TOKEN1"
assert_success
TASK_ID=$(data_field createTask taskId)
[ -n "$TASK_ID" ] || fail "no taskId in response: $BODY"
pass

step "tasks query contains the created task"
graphql "$LIST_TASKS" '{}' "x-session-token: $TOKEN1"
assert_success
case "$BODY" in *"$TASK_ID"*) ;; *) fail "created task not in list: $BODY" ;; esac
pass

### 4. br.task.complete.once: completing twice is idempotent
step "completeTask (first time) -> complete:true"
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_ID\"}" "x-session-token: $TOKEN1"
assert_success
FIRST_COMPLETE_BODY="$BODY"
[ "$(data_field completeTask complete)" = "true" ] || fail "complete:true not in body: $BODY"
pass

step "completeTask (again) -> identical body (br.task.complete.once)"
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_ID\"}" "x-session-token: $TOKEN1"
assert_success
[ "$BODY" = "$FIRST_COMPLETE_BODY" ] || fail "second complete body differs: '$BODY' vs '$FIRST_COMPLETE_BODY'"
pass

step "reopenTask -> complete:false"
graphql "$REOPEN_TASK" "{\"id\":\"$TASK_ID\"}" "x-session-token: $TOKEN1"
assert_success
[ "$(data_field reopenTask complete)" = "false" ] || fail "complete:false not in body: $BODY"
pass

### 5. br.task.delete.final
step "deleteTask -> deleted:true"
graphql "$DELETE_TASK" "{\"id\":\"$TASK_ID\"}" "x-session-token: $TOKEN1"
assert_success
[ "$(data_field deleteTask deleted)" = "true" ] || fail "deleted:true not in body: $BODY"
pass

step "tasks query no longer contains the deleted task (br.task.delete.final)"
graphql "$LIST_TASKS" '{}' "x-session-token: $TOKEN1"
assert_success
case "$BODY" in *"$TASK_ID"*) fail "deleted task still listed: $BODY" ;; esac
pass

### 6. br.task.list.owned: a second identity's task never appears in the first identity's list
step "signIn demo2 -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO2_EMAIL" "$DEMO2_PASSWORD")"
assert_success
TOKEN2=$(data_field signIn sessionToken)
[ -n "$TOKEN2" ] || fail "no sessionToken in response: $BODY"
pass

step "demo2 creates a task -> taskId"
graphql "$CREATE_TASK" '{"input":{"title":"demo2 private task"}}' "x-session-token: $TOKEN2"
assert_success
TASK2_ID=$(data_field createTask taskId)
[ -n "$TASK2_ID" ] || fail "no taskId in response: $BODY"
pass

step "demo1 list does not contain demo2's task (br.task.list.owned)"
graphql "$LIST_TASKS" '{}' "x-session-token: $TOKEN1"
assert_success
case "$BODY" in *"$TASK2_ID"*) fail "demo1 can see demo2's task: $BODY" ;; esac
pass

step "cleanup: demo2 deletes its own task"
graphql "$DELETE_TASK" "{\"id\":\"$TASK2_ID\"}" "x-session-token: $TOKEN2"
assert_success
pass

### 7. CORS (transport-level; the GraphQL endpoint answers a preflight the same way /tasks used to)
step "OPTIONS preflight from $ORIGIN carries Access-Control-Allow-Origin"
CORS_HEADERS=$(curl -s -D - -o /dev/null -X OPTIONS "$API_URL/graphql" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-session-token,content-type")
echo "$CORS_HEADERS" | grep -qi "^Access-Control-Allow-Origin: $ORIGIN" \
  || fail "no Access-Control-Allow-Origin header on OPTIONS: $CORS_HEADERS"
pass

step "POST from $ORIGIN carries Access-Control-Allow-Origin"
CORS_HEADERS=$(curl -s -D - -o /dev/null -X POST "$API_URL/graphql" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" -H "x-session-token: $TOKEN1" \
  -d "$(node -e 'console.log(JSON.stringify({query:process.argv[1],variables:{}}))' "$LIST_TASKS")")
echo "$CORS_HEADERS" | grep -qi "^Access-Control-Allow-Origin: $ORIGIN" \
  || fail "no Access-Control-Allow-Origin header on POST: $CORS_HEADERS"
pass

### 8. sign-out revokes the session
step "signOut demo1 -> signedOut:true"
graphql "$SIGN_OUT" "{\"input\":{\"sessionToken\":\"$TOKEN1\"}}"
assert_success
[ "$(data_field signOut signedOut)" = "true" ] || fail "signedOut:true not in body: $BODY"
pass

step "tasks query after sign-out -> SESSION_NOT_FOUND"
graphql "$LIST_TASKS" '{}' "x-session-token: $TOKEN1"
assert_refused SESSION_NOT_FOUND
pass

### 9. health (the one surviving HTTP door)
step "GET /health -> status:ok"
HEALTH_BODY=$(curl -s "$API_URL/health")
case "$HEALTH_BODY" in *'"status":"ok"'*) ;; *) fail "health endpoint did not report ok: $HEALTH_BODY" ;; esac
pass

echo
echo "live-proof: $PASS_COUNT/$PASS_COUNT steps passed"
