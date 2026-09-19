#!/usr/bin/env bash
# Live proof for the audit feature (fr.audit.log.append, fr.audit.erasure.request,
# fr.audit.erasure.complete, fr.audit.export), run against the real Keycloak/Postgres dev stack on this
# lane's own port and database (never fakes). Exits non-zero on the first mismatch, naming the step that
# failed. Structured exactly like scripts/live-proof.sh: GraphQL operations via curl against one
# endpoint, the outcome read from the JSON body (errors[] vs data.<op>), never the HTTP status code.
#
# Usage:
#   API_URL=http://localhost:3104 scripts/live-proof-audit.sh
#   DEMO_EMAIL=... DEMO_PASSWORD=... scripts/live-proof-audit.sh
#
# Prerequisites: the dev compose stack is up (postgres, keycloak) and this lane's own api is running on
# its own port against its own database (DATABASE_URL pointing at todo_audit). This script only talks
# HTTP to the running api; it does not start or stop anything itself.
set -euo pipefail

API_URL=${API_URL:-http://localhost:3104}
DEMO_EMAIL=${DEMO_EMAIL:-demo@todo.dev}
DEMO_PASSWORD=${DEMO_PASSWORD:-todo-demo-pass}

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

step() {
  STEP="$1"
  echo "-- $STEP"
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "   ok"
}

SIGN_IN='mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }'
CREATE_TASK='mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }'
AUDIT_LOG='query { auditLog { at action target } }'
EXPORT_MY_DATA='query { exportMyData { at action target } }'
REQUEST_ERASURE='mutation { requestErasure { requestId state } }'
COMPLETE_ERASURE='mutation CompleteErasure($requestId: ID!) { completeErasure(requestId: $requestId) { requestId state } }'

### fr.audit.log.append (via event.login.signed-in): signing in appends a login.signed-in line
step "signIn demo -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO_EMAIL" "$DEMO_PASSWORD")"
assert_success
TOKEN=$(data_field signIn sessionToken)
[ -n "$TOKEN" ] || fail "no sessionToken in response: $BODY"
pass

step "auditLog (own lines) contains a login.signed-in line (fr.audit.log.append)"
graphql "$AUDIT_LOG" '{}' "x-session-token: $TOKEN"
assert_success
case "$BODY" in *'"action":"login.signed-in"'*) ;; *) fail "no login.signed-in line in auditLog: $BODY" ;; esac
pass

### fr.audit.log.append (via event.task.created): creating a task appends a task.created line
step "createTask -> taskId"
graphql "$CREATE_TASK" '{"input":{"title":"live-proof audit task"}}' "x-session-token: $TOKEN"
assert_success
TASK_ID=$(data_field createTask taskId)
[ -n "$TASK_ID" ] || fail "no taskId in response: $BODY"
pass

step "auditLog now contains a task.created line naming that task (fr.audit.log.append)"
graphql "$AUDIT_LOG" '{}' "x-session-token: $TOKEN"
assert_success
case "$BODY" in *"\"action\":\"task.created\",\"target\":\"$TASK_ID\""*) ;; *) fail "no matching task.created line: $BODY" ;; esac
pass

### fr.audit.export: before erasure, export returns this person's lines
step "exportMyData returns this person's own lines before erasure (fr.audit.export)"
graphql "$EXPORT_MY_DATA" '{}' "x-session-token: $TOKEN"
assert_success
case "$BODY" in *'"action":"login.signed-in"'*) ;; *) fail "exportMyData missing expected line before erasure: $BODY" ;; esac
pass

### fr.audit.erasure.request: request -> verified (session already proves identity)
step "requestErasure -> state verified (fr.audit.erasure.request)"
graphql "$REQUEST_ERASURE" '{}' "x-session-token: $TOKEN"
assert_success
REQUEST_ID=$(data_field requestErasure requestId)
[ -n "$REQUEST_ID" ] || fail "no requestId in response: $BODY"
[ "$(data_field requestErasure state)" = "verified" ] || fail "expected state verified: $BODY"
pass

### fr.audit.erasure.complete: complete -> destroys the key, appends the completed line
step "completeErasure -> state complete (fr.audit.erasure.complete)"
graphql "$COMPLETE_ERASURE" "$(node -e 'console.log(JSON.stringify({requestId:process.argv[1]}))' "$REQUEST_ID")" "x-session-token: $TOKEN"
assert_success
[ "$(data_field completeErasure state)" = "complete" ] || fail "expected state complete: $BODY"
pass

### fr.audit.export exceptionFlow: once the key is destroyed, export returns nothing
step "exportMyData now returns nothing for the erased person (fr.audit.export exceptionFlow)"
graphql "$EXPORT_MY_DATA" '{}' "x-session-token: $TOKEN"
assert_success
case "$BODY" in *'"exportMyData":[]'*) ;; *) fail "expected an empty exportMyData after erasure: $BODY" ;; esac
pass

### ac.audit.erasure.right.identifying-fields-unreadable: auditLog agrees (same keyId lookup)
step "auditLog also returns nothing for the erased person (ac.audit.erasure.right.identifying-fields-unreadable)"
graphql "$AUDIT_LOG" '{}' "x-session-token: $TOKEN"
assert_success
case "$BODY" in *'"auditLog":[]'*) ;; *) fail "expected an empty auditLog after erasure: $BODY" ;; esac
pass

echo
echo "live-proof-audit: $PASS_COUNT/$PASS_COUNT steps passed"
