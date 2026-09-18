#!/usr/bin/env bash
# Live proof for the `share` feature, run against the real Postgres/Keycloak dev stack (never fakes).
# Exits non-zero on the first mismatch, naming the step that failed. This is the evidence source for:
# fr.share.invite, fr.share.accept, fr.share.revoke, fr.share.list, br.share.invite.expiry (the
# non-expiry half - the fourteen-day boundary itself is proven by invitation.service.spec.ts, since
# waiting fourteen real days is not a live-proof this script can honestly run), br.share.revoke.on-read,
# br.share.role.permissions, br.share.editor.no-delete and contract.share.completion-guard-for-task.
#
# Same GraphQL-over-HTTP shape as scripts/live-proof.sh: every call is a POST to $API_URL/graphql with a
# {query, variables} body, and a resolver-thrown refusal answers HTTP 200 with `errors[]` populated - the
# outcome lives in the JSON body, never in the status code.
#
# Usage:
#   scripts/live-proof-share.sh
#   API_URL=http://localhost:3101 scripts/live-proof-share.sh
#
# Prerequisites: the dev compose stack is up (postgres, keycloak) and this lane's own api is running on
# its own port against its own database (PORT=3101 DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_share
# KEYCLOAK_TOKEN_URL=http://localhost:8089/realms/todo/protocol/openid-connect/token npx ts-node-dev ... src/main.ts).
# This script only talks HTTP to that running api; it does not start or stop anything itself.
set -euo pipefail

API_URL=${API_URL:-http://localhost:3101}
OWNER_EMAIL=${OWNER_EMAIL:-demo@todo.dev}
OWNER_PASSWORD=${OWNER_PASSWORD:-todo-demo-pass}
COLLAB_EMAIL=${COLLAB_EMAIL:-demo2@todo.dev}
COLLAB_PASSWORD=${COLLAB_PASSWORD:-todo-demo-pass-2}

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
COMPLETE_TASK='mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }'
DELETE_TASK='mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }'
INVITE='mutation Invite($input: InviteInput!) { invite(input: $input) { invitationId taskId email role status } }'
ACCEPT='mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { invitationId role status } }'
REVOKE='mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(input: $input) { invitationId status } }'
COLLABORATORS='query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email role status } }'

### sign in both identities
step "signIn owner ($OWNER_EMAIL) -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$OWNER_EMAIL" "$OWNER_PASSWORD")"
assert_success
OWNER_TOKEN=$(data_field signIn sessionToken)
[ -n "$OWNER_TOKEN" ] || fail "no sessionToken: $BODY"
pass

step "signIn collaborator ($COLLAB_EMAIL) -> sessionToken"
graphql "$SIGN_IN" "$(node -e 'console.log(JSON.stringify({input:{email:process.argv[1],password:process.argv[2]}}))' "$COLLAB_EMAIL" "$COLLAB_PASSWORD")"
assert_success
COLLAB_TOKEN=$(data_field signIn sessionToken)
[ -n "$COLLAB_TOKEN" ] || fail "no sessionToken: $BODY"
pass

### fr.share.invite / fr.share.accept / br.share.role.permissions.editor-can-complete
step "owner createTask (task A) -> taskId"
graphql "$CREATE_TASK" '{"input":{"title":"share live-proof task A"}}' "x-session-token: $OWNER_TOKEN"
assert_success
TASK_A=$(data_field createTask taskId)
[ -n "$TASK_A" ] || fail "no taskId: $BODY"
pass

step "fr.share.invite exceptionFlows: an invalid email is refused"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:"not-an-email",role:"editor"}}))' "$TASK_A")" "x-session-token: $OWNER_TOKEN"
assert_refused SHARE_INVALID_EMAIL
pass

step "fr.share.invite exceptionFlows: a role other than viewer/editor is refused"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:process.argv[2],role:"admin"}}))' "$TASK_A" "$COLLAB_EMAIL")" "x-session-token: $OWNER_TOKEN"
assert_refused SHARE_INVALID_ROLE
pass

step "owner invites collaborator as editor on task A -> pending"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:process.argv[2],role:"editor"}}))' "$TASK_A" "$COLLAB_EMAIL")" "x-session-token: $OWNER_TOKEN"
assert_success
[ "$(data_field invite status)" = "pending" ] || fail "expected pending: $BODY"
INVITATION_A=$(data_field invite invitationId)
[ -n "$INVITATION_A" ] || fail "no invitationId: $BODY"
pass

step "data.share.invitation invariant: a second invite to the same pending pair is refused"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:process.argv[2],role:"viewer"}}))' "$TASK_A" "$COLLAB_EMAIL")" "x-session-token: $OWNER_TOKEN"
assert_refused SHARE_INVITATION_ALREADY_EXISTS
pass

step "fr.share.accept exceptionFlows: accepting with a mismatched email is refused"
graphql "$ACCEPT" "$(node -e 'console.log(JSON.stringify({input:{invitationId:process.argv[1],email:"somebody-else@example.com"}}))' "$INVITATION_A")" "x-session-token: $COLLAB_TOKEN"
assert_refused SHARE_EMAIL_MISMATCH
pass

step "collaborator accepts the invitation on task A -> accepted editor"
graphql "$ACCEPT" "$(node -e 'console.log(JSON.stringify({input:{invitationId:process.argv[1],email:process.argv[2]}}))' "$INVITATION_A" "$COLLAB_EMAIL")" "x-session-token: $COLLAB_TOKEN"
assert_success
[ "$(data_field acceptInvitation status)" = "accepted" ] || fail "expected accepted: $BODY"
[ "$(data_field acceptInvitation role)" = "editor" ] || fail "expected role editor: $BODY"
pass

step "ac.share.role.permissions.editor-can-complete: the accepted editor completes task A"
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_A\"}" "x-session-token: $COLLAB_TOKEN"
assert_success
[ "$(data_field completeTask complete)" = "true" ] || fail "expected complete:true: $BODY"
pass

step "ac.share.editor.no-delete.delete-refused-for-editor: the accepted editor may not delete task A"
graphql "$DELETE_TASK" "{\"id\":\"$TASK_A\"}" "x-session-token: $COLLAB_TOKEN"
assert_refused TASK_FORBIDDEN
pass

step "fr.share.list: the owner sees the accepted editor on task A"
graphql "$COLLABORATORS" "{\"taskId\":\"$TASK_A\"}" "x-session-token: $OWNER_TOKEN"
assert_success
case "$BODY" in *"\"role\":\"editor\""*"\"status\":\"accepted\""*) ;; *"\"status\":\"accepted\""*"\"role\":\"editor\""*) ;; *) fail "accepted editor not in collaborators list: $BODY" ;; esac
pass

step "fr.share.list exceptionFlows: a stranger reading collaborators for an unrelated task sees nothing"
graphql "$CREATE_TASK" '{"input":{"title":"share live-proof stranger task"}}' "x-session-token: $COLLAB_TOKEN"
assert_success
STRANGER_TASK=$(data_field createTask taskId)
graphql "$COLLABORATORS" "{\"taskId\":\"$STRANGER_TASK\"}" "x-session-token: $OWNER_TOKEN"
assert_success
[ "$(node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const b=JSON.parse(s);process.stdout.write(String((b.data?.collaborators??[]).length))})' <<<"$BODY")" = "0" ] || fail "expected an empty list: $BODY"
pass

### br.share.revoke.on-read
step "owner revokes the collaborator on task A"
graphql "$REVOKE" "{\"input\":{\"invitationId\":\"$INVITATION_A\"}}" "x-session-token: $OWNER_TOKEN"
assert_success
[ "$(data_field revokeCollaborator status)" = "revoked" ] || fail "expected revoked: $BODY"
pass

step "ac.share.revoke.on-read.removed-loses-access-next-read: the revoked collaborator's next completion attempt is refused, with no wait"
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_A\"}" "x-session-token: $COLLAB_TOKEN"
assert_refused TASK_FORBIDDEN
pass

step "fr.share.revoke exceptionFlows: revoking the already-revoked invitation again is refused"
graphql "$REVOKE" "{\"input\":{\"invitationId\":\"$INVITATION_A\"}}" "x-session-token: $OWNER_TOKEN"
assert_refused SHARE_INVITATION_ALREADY_CLOSED
pass

step "fr.share.revoke: a non-owner may not revoke"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:"another@example.com",role:"viewer"}}))' "$TASK_A")" "x-session-token: $OWNER_TOKEN"
assert_success
SECOND_INVITATION=$(data_field invite invitationId)
graphql "$REVOKE" "{\"input\":{\"invitationId\":\"$SECOND_INVITATION\"}}" "x-session-token: $COLLAB_TOKEN"
assert_refused SHARE_FORBIDDEN
pass

### br.share.role.permissions.viewer-read-only, on a second task so the (taskId, email) pair is fresh
step "owner createTask (task B) -> taskId"
graphql "$CREATE_TASK" '{"input":{"title":"share live-proof task B"}}' "x-session-token: $OWNER_TOKEN"
assert_success
TASK_B=$(data_field createTask taskId)
pass

step "owner invites collaborator as viewer on task B"
graphql "$INVITE" "$(node -e 'console.log(JSON.stringify({input:{taskId:process.argv[1],email:process.argv[2],role:"viewer"}}))' "$TASK_B" "$COLLAB_EMAIL")" "x-session-token: $OWNER_TOKEN"
assert_success
INVITATION_B=$(data_field invite invitationId)
pass

step "collaborator accepts the viewer invitation on task B"
graphql "$ACCEPT" "$(node -e 'console.log(JSON.stringify({input:{invitationId:process.argv[1],email:process.argv[2]}}))' "$INVITATION_B" "$COLLAB_EMAIL")" "x-session-token: $COLLAB_TOKEN"
assert_success
[ "$(data_field acceptInvitation role)" = "viewer" ] || fail "expected role viewer: $BODY"
pass

step "ac.share.role.permissions.viewer-read-only: the accepted viewer may not complete task B"
graphql "$COMPLETE_TASK" "{\"id\":\"$TASK_B\"}" "x-session-token: $COLLAB_TOKEN"
assert_refused TASK_FORBIDDEN
pass

### cleanup: owner deletes both tasks it still owns
step "cleanup: owner deletes task A"
graphql "$DELETE_TASK" "{\"id\":\"$TASK_A\"}" "x-session-token: $OWNER_TOKEN"
assert_success
pass

step "cleanup: owner deletes task B"
graphql "$DELETE_TASK" "{\"id\":\"$TASK_B\"}" "x-session-token: $OWNER_TOKEN"
assert_success
pass

step "cleanup: collaborator deletes its own stranger-check task"
graphql "$DELETE_TASK" "{\"id\":\"$STRANGER_TASK\"}" "x-session-token: $COLLAB_TOKEN"
assert_success
pass

echo
echo "live-proof-share: $PASS_COUNT/$PASS_COUNT steps passed"
