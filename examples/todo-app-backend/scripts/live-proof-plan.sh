#!/usr/bin/env bash
# Live proof for the plan feature, run against the real Keycloak/Postgres dev stack (never fakes).
# Exits non-zero on the first mismatch, naming the step that failed. This is the evidence source for:
# br.plan.caps.limit, br.plan.active-scope, br.plan.downgrade.freeze, fr.plan.usage.view (backend half),
# gap.plan.cap-guard-not-wired, contract.plan.create-precondition (the real create path).
#
# integration.plan.sepay stays todo (gap.plan.sepay-not-reachable): SEPAY_API_KEY_FILE decrypts to a
# DEMO-ONLY placeholder (see .starcistacks/dev/runtime/env/KEYS.md), never a real SePay sandbox
# credential, so this script probes the upgradePlan mutation's real create-intent call as a best-effort,
# NON-FATAL step that only reports whether SePay was actually reachable - it never asserts success or
# failure there, and never fakes a live pass for that leg. fr.plan.upgrade/reconcile's live proof stays
# unrun for that reason; see the lane's final report.
#
# Usage:
#   scripts/live-proof-plan.sh
#   API_URL=http://localhost:3103 scripts/live-proof-plan.sh
#   DEMO_EMAIL=... DEMO_PASSWORD=... scripts/live-proof-plan.sh
#
# Prerequisites: the dev compose stack is up (postgres, keycloak) - reused read-only from another lane
# if already running - and this lane's own api is up on its own port against its own database
# (PORT=3103 DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_plan ... npm run start:dev).
set -euo pipefail

API_URL=${API_URL:-http://localhost:3103}
DEMO_EMAIL=${DEMO_EMAIL:-plan-demo@todo.dev}
DEMO_PASSWORD=${DEMO_PASSWORD:-todo-demo-pass}

STEP=""
PASS_COUNT=0
CREATED_TASK_IDS=()

fail() {
  echo "FAIL [$STEP]: $*" >&2
  exit 1
}

# $1=query/mutation document, $2=JSON variables object (or '{}'), $3=optional extra header.
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

assert_success() { [ "$HAS_ERRORS" = "0" ] || fail "expected success, got errors: $BODY"; }
assert_refused() {
  local expected_code="$1"
  [ "$HAS_ERRORS" = "1" ] || fail "expected a refusal (code $expected_code), got success: $BODY"
  [ "$ERROR_CODE" = "$expected_code" ] || fail "expected error code $expected_code, got $ERROR_CODE: $BODY"
}
step() { STEP="$1"; echo "-- $STEP"; }
pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo "   ok"; }

SIGN_IN='mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }'
CREATE_TASK='mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }'
DELETE_TASK='mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }'
PLAN_USAGE='query { planUsage { plan cap activeCount } }'
UPGRADE_PLAN='mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }'
DOWNGRADE_PLAN='mutation { downgradePlan { subscriptionId plan status } }'

cleanup() {
  if [ -n "${TOKEN:-}" ]; then
    for id in "${CREATED_TASK_IDS[@]:-}"; do
      [ -n "$id" ] && graphql "$DELETE_TASK" "{\"id\":\"$id\"}" "x-session-token: $TOKEN" || true
    done
  fi
}
trap cleanup EXIT

### 1. sign-in
step "signIn plan-demo -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$DEMO_EMAIL" "$DEMO_PASSWORD")"
assert_success
TOKEN=$(data_field signIn sessionToken)
[ -n "$TOKEN" ] || fail "no sessionToken in response: $BODY"
pass

### 2. fr.plan.usage.view (backend half): a fresh person reads free, cap 20
step "planUsage before any tasks -> free, cap 20"
graphql "$PLAN_USAGE" '{}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field planUsage plan)" = "free" ] || fail "expected plan free: $BODY"
[ "$(data_field planUsage cap)" = "20" ] || fail "expected cap 20: $BODY"
pass

### 3. br.plan.caps.limit / br.plan.active-scope: create 20 tasks, the 21st is refused
step "creating 20 active tasks"
for i in $(seq 1 20); do
  graphql "$CREATE_TASK" "{\"input\":{\"title\":\"plan live-proof task $i\"}}" "x-session-token: $TOKEN"
  assert_success
  CREATED_TASK_IDS+=("$(data_field createTask taskId)")
done
pass

step "planUsage at 20 -> activeCount 20"
graphql "$PLAN_USAGE" '{}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field planUsage activeCount)" = "20" ] || fail "expected activeCount 20: $BODY"
pass

step "ac.plan.caps.limit.refuses-over-cap: creating a 21st task is refused, naming the cap and the upgrade path"
graphql "$CREATE_TASK" '{"input":{"title":"the 21st task"}}' "x-session-token: $TOKEN"
assert_refused PLAN_CAP_EXCEEDED
REFUSAL_MESSAGE=$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const b=JSON.parse(s);process.stdout.write(b.errors[0].message)})' <<<"$BODY")
case "$REFUSAL_MESSAGE" in *"20"*"Upgrade"*) ;; *) fail "refusal does not name the cap and the upgrade path: $REFUSAL_MESSAGE" ;; esac
pass

### 4. contract.plan.create-precondition: nothing was written by the refused create
step "tasks query still shows exactly 20 (nothing written by the refused create)"
graphql 'query { tasks { taskId } }' '{}' "x-session-token: $TOKEN"
assert_success
TASK_COUNT=$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const b=JSON.parse(s);process.stdout.write(String(b.data.tasks.length))})' <<<"$BODY")
[ "$TASK_COUNT" = "20" ] || fail "expected exactly 20 tasks, got $TASK_COUNT: $BODY"
pass

### 5. best-effort, NON-FATAL: probe SePay reachability through the real upgradePlan mutation.
### integration.plan.sepay / gap.plan.sepay-not-reachable: SEPAY_API_KEY_FILE is a DEMO-ONLY placeholder
### (.starcistacks/dev/runtime/env/KEYS.md), so this call is expected to fail from this dev box. It is
### never asserted pass/fail; only its outcome is reported, so this script never fakes a live pass for
### the integration and never blocks the rest of the proof on it.
step "upgradePlan (best-effort probe of the real SePay sandbox call, non-fatal)"
set +e
graphql "$UPGRADE_PLAN" '{}' "x-session-token: $TOKEN"
set -e
if [ "$HAS_ERRORS" = "0" ]; then
  echo "   SEPAY REACHABLE: upgradePlan succeeded for real: $BODY"
else
  echo "   sepay not reachable from this host (expected - demo-only placeholder key): $BODY"
fi

### 6. br.plan.downgrade.freeze / decision.plan.downgrade.policy: downgrade is accepted immediately
### (idempotent no-op here: this person never activated a paid subscription, so it stays free - proves
### t-downgrade's own no-op path on an already-free person, unit-proven for the active/past-due paths
### that need a paid subscription this live run cannot create without a reachable gateway).
step "downgradePlan -> accepted immediately, subscription stays free"
graphql "$DOWNGRADE_PLAN" '{}' "x-session-token: $TOKEN"
assert_success
[ "$(data_field downgradePlan status)" = "free" ] || fail "expected status free: $BODY"
pass

### 7. cleanup: complete one task so the count drops back under the cap, then delete the rest via trap
step "completing one task frees a slot under the cap (br.plan.active-scope is re-checked live, not cached)"
FIRST_ID="${CREATED_TASK_IDS[0]}"
graphql 'mutation CompleteTask($id: ID!) { completeTask(id: $id) { complete } }' "{\"id\":\"$FIRST_ID\"}" "x-session-token: $TOKEN"
assert_success
graphql "$CREATE_TASK" '{"input":{"title":"the 21st task, now allowed"}}' "x-session-token: $TOKEN"
assert_success
CREATED_TASK_IDS+=("$(data_field createTask taskId)")
pass

echo
echo "live-proof-plan: $PASS_COUNT/$PASS_COUNT asserted steps passed"
