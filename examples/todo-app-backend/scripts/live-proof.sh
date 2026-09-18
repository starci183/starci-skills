#!/usr/bin/env bash
# Live proof for the todo-app-backend example, run against the real Keycloak/Postgres dev stack
# (never fakes). Exits non-zero on the first mismatch, naming the step that failed. This is the
# evidence source for: integration.login.keycloak, integration.login.postgres,
# br.login.password.sign-in, br.task.complete.once, br.task.delete.final, br.task.list.owned.
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

# Runs curl, capturing status code and body separately without tripping `set -e` on a non-2xx
# response (this script decides pass/fail itself, per step). Sets globals STATUS and BODY.
http() {
  local method="$1" path="$2" extra_header="${3:-}" data="${4:-}"
  local url="${API_URL}${path}"
  local args=(-s -w '\n%{http_code}' -X "$method" "$url")
  if [ -n "$extra_header" ]; then
    args+=(-H "$extra_header")
  fi
  if [ -n "$data" ]; then
    args+=(-H "Content-Type: application/json" -d "$data")
  fi
  local response
  response=$(curl "${args[@]}")
  STATUS=$(printf '%s' "$response" | tail -n1)
  BODY=$(printf '%s' "$response" | sed '$d')
}

# Extracts a field from the last BODY via node, so this script needs no jq dependency.
json_field() {
  node -e '
    let s = "";
    process.stdin.on("data", c => (s += c));
    process.stdin.on("end", () => {
      const value = JSON.parse(s)[process.argv[1]];
      process.stdout.write(value === undefined ? "" : String(value));
    });
  ' "$1" <<<"$BODY"
}

assert_status() {
  local expected="$1"
  [ "$STATUS" = "$expected" ] || fail "expected HTTP $expected, got $STATUS, body: $BODY"
}

step() {
  STEP="$1"
  echo "-- $STEP"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "   ok"
}

### 1. sign-in: correct password succeeds
step "sign-in demo (correct password) -> 201"
http POST /auth/sign-in "" "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
assert_status 201
TOKEN1=$(json_field sessionToken)
[ -n "$TOKEN1" ] || fail "no sessionToken in response: $BODY"
pass

### 2. br.login.password.sign-in: wrong password and unknown email refuse identically
step "sign-in wrong password -> 401"
http POST /auth/sign-in "" "{\"email\":\"$DEMO_EMAIL\",\"password\":\"wrong-password-xyz\"}"
assert_status 401
WRONG_PASSWORD_BODY="$BODY"
pass

step "sign-in unknown email -> 401, identical to wrong password"
http POST /auth/sign-in "" "{\"email\":\"nobody-$$@todo.dev\",\"password\":\"whatever\"}"
assert_status 401
[ "$BODY" = "$WRONG_PASSWORD_BODY" ] || fail "unknown-email body differs from wrong-password body: '$BODY' vs '$WRONG_PASSWORD_BODY'"
pass

### 3. task CRUD
step "create task -> 201"
http POST /tasks "x-session-token: $TOKEN1" '{"title":"live-proof task"}'
assert_status 201
TASK_ID=$(json_field taskId)
[ -n "$TASK_ID" ] || fail "no taskId in response: $BODY"
pass

step "list tasks contains the created task"
http GET /tasks "x-session-token: $TOKEN1"
assert_status 200
case "$BODY" in *"$TASK_ID"*) ;; *) fail "created task not in list: $BODY" ;; esac
pass

### 4. br.task.complete.once: completing twice is idempotent
step "complete task (first time) -> complete:true"
http POST "/tasks/$TASK_ID/complete" "x-session-token: $TOKEN1"
assert_status 201
FIRST_COMPLETE_BODY="$BODY"
case "$BODY" in *'"complete":true'*) ;; *) fail "complete:true not in body: $BODY" ;; esac
pass

step "complete task (again) -> identical body (br.task.complete.once)"
http POST "/tasks/$TASK_ID/complete" "x-session-token: $TOKEN1"
assert_status 201
[ "$BODY" = "$FIRST_COMPLETE_BODY" ] || fail "second complete body differs: '$BODY' vs '$FIRST_COMPLETE_BODY'"
pass

step "reopen task -> complete:false"
http POST "/tasks/$TASK_ID/reopen" "x-session-token: $TOKEN1"
assert_status 201
case "$BODY" in *'"complete":false'*) ;; *) fail "complete:false not in body: $BODY" ;; esac
pass

### 5. br.task.delete.final
step "delete task -> 200 deleted:true"
http DELETE "/tasks/$TASK_ID" "x-session-token: $TOKEN1"
assert_status 200
case "$BODY" in *'"deleted":true'*) ;; *) fail "deleted:true not in body: $BODY" ;; esac
pass

step "list tasks no longer contains the deleted task (br.task.delete.final)"
http GET /tasks "x-session-token: $TOKEN1"
assert_status 200
case "$BODY" in *"$TASK_ID"*) fail "deleted task still listed: $BODY" ;; esac
pass

### 6. br.task.list.owned: a second identity's task never appears in the first identity's list
step "sign-in demo2 -> 201"
http POST /auth/sign-in "" "{\"email\":\"$DEMO2_EMAIL\",\"password\":\"$DEMO2_PASSWORD\"}"
assert_status 201
TOKEN2=$(json_field sessionToken)
[ -n "$TOKEN2" ] || fail "no sessionToken in response: $BODY"
pass

step "demo2 creates a task -> 201"
http POST /tasks "x-session-token: $TOKEN2" '{"title":"demo2 private task"}'
assert_status 201
TASK2_ID=$(json_field taskId)
[ -n "$TASK2_ID" ] || fail "no taskId in response: $BODY"
pass

step "demo1 list does not contain demo2's task (br.task.list.owned)"
http GET /tasks "x-session-token: $TOKEN1"
assert_status 200
case "$BODY" in *"$TASK2_ID"*) fail "demo1 can see demo2's task: $BODY" ;; esac
pass

step "cleanup: demo2 deletes its own task"
http DELETE "/tasks/$TASK2_ID" "x-session-token: $TOKEN2"
assert_status 200
pass

### 7. CORS
step "OPTIONS preflight from $ORIGIN carries Access-Control-Allow-Origin"
CORS_HEADERS=$(curl -s -D - -o /dev/null -X OPTIONS "$API_URL/tasks" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: x-session-token")
echo "$CORS_HEADERS" | grep -qi "^Access-Control-Allow-Origin: $ORIGIN" \
  || fail "no Access-Control-Allow-Origin header on OPTIONS: $CORS_HEADERS"
pass

step "GET from $ORIGIN carries Access-Control-Allow-Origin"
CORS_HEADERS=$(curl -s -D - -o /dev/null "$API_URL/tasks" -H "Origin: $ORIGIN" -H "x-session-token: $TOKEN1")
echo "$CORS_HEADERS" | grep -qi "^Access-Control-Allow-Origin: $ORIGIN" \
  || fail "no Access-Control-Allow-Origin header on GET: $CORS_HEADERS"
pass

### 8. sign-out revokes the session
step "sign-out demo1 -> 201 signedOut:true"
http POST /auth/sign-out "" "{\"sessionToken\":\"$TOKEN1\"}"
assert_status 201
case "$BODY" in *'"signedOut":true'*) ;; *) fail "signedOut:true not in body: $BODY" ;; esac
pass

step "task call after sign-out -> 401"
http GET /tasks "x-session-token: $TOKEN1"
assert_status 401
pass

echo
echo "live-proof: $PASS_COUNT/$PASS_COUNT steps passed"
