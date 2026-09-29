// Live proof for the `share` feature, run against the real Postgres/Keycloak dev stack (never fakes).
// Exits non-zero on the first mismatch, naming the step that failed. This is the evidence source for:
// fr.share.invite, fr.share.accept, fr.share.revoke, fr.share.list, br.share.invite.expiry (the
// non-expiry half - the fourteen-day boundary itself is proven by invitation.service.spec.ts, since
// waiting fourteen real days is not a live proof this script can honestly run), br.share.revoke.on-read,
// br.share.role.permissions, br.share.editor.no-delete and contract.share.completion-guard-for-task.
//
// Same GraphQL-over-HTTP shape as scripts/live-proof.mjs: a resolver-thrown refusal answers HTTP 200 with
// `errors[]` populated - the outcome lives in the JSON body, never in the status code.
//
// Usage:
//   node scripts/live-proof-share.mjs
//   API_URL=http://localhost:3101 node scripts/live-proof-share.mjs
//
// Prerequisites: the dev compose stack is up (postgres, keycloak) and this lane's own api is running on
// its own port against its own database (PORT=3101 DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_share
// KEYCLOAK_TOKEN_URL=http://localhost:8089/realms/todo/protocol/openid-connect/token npm run start:dev).
// This script only talks HTTP to that running api; it does not start or stop anything itself.
import {
    COMPLETE_TASK, CREATE_TASK, DELETE_TASK, createProof, env, run,
} from "./live-proof-lib.mjs"

const INVITE = "mutation Invite($input: InviteInput!) { invite(request: $input) { invitationId taskId email role status } }"
const ACCEPT = "mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(request: $input) { invitationId role status } }"
const REVOKE = "mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(request: $input) { invitationId status } }"
const COLLABORATORS = "query Collaborators($input: CollaboratorsRequest!) { collaborators(request: $input) { invitationId email role status } }"

const apiUrl = env("API_URL", "http://localhost:3101")
const ownerEmail = env("OWNER_EMAIL", "demo@todo.dev")
const ownerPassword = env("OWNER_PASSWORD", "todo-demo-pass")
const collabEmail = env("COLLAB_EMAIL", "demo2@todo.dev")
const collabPassword = env("COLLAB_PASSWORD", "todo-demo-pass-2")

await run(async () => {
    const proof = createProof("live-proof-share", apiUrl)
    const { graphql, step, pass, assertSuccess, assertRefused, assert } = proof

    step(`signIn owner (${ownerEmail}) -> sessionToken`)
    const ownerToken = await proof.signIn(ownerEmail, ownerPassword)
    pass()

    step(`signIn collaborator (${collabEmail}) -> sessionToken`)
    const collabToken = await proof.signIn(collabEmail, collabPassword)
    pass()

    /** Creates a task as the given person and returns its id. */
    const createTask = async (token, title) => {
        const created = await graphql(CREATE_TASK, { input: { title } }, token)
        assertSuccess(created)
        const taskId = created.field("createTask", "taskId")
        assert(taskId, `no taskId: ${created.text}`)
        return taskId
    }

    // fr.share.invite / fr.share.accept / br.share.role.permissions.editor-can-complete
    step("owner createTask (task A) -> taskId")
    const taskA = await createTask(ownerToken, "share live-proof task A")
    pass()

    step("fr.share.invite exceptionFlows: an invalid email is refused")
    assertRefused(await graphql(INVITE, { input: { taskId: taskA, email: "not-an-email", role: "editor" } }, ownerToken), "SHARE_INVALID_EMAIL")
    pass()

    step("fr.share.invite exceptionFlows: a role other than viewer/editor is refused")
    assertRefused(await graphql(INVITE, { input: { taskId: taskA, email: collabEmail, role: "admin" } }, ownerToken), "SHARE_INVALID_ROLE")
    pass()

    step("owner invites collaborator as editor on task A -> pending")
    const inviteA = await graphql(INVITE, { input: { taskId: taskA, email: collabEmail, role: "editor" } }, ownerToken)
    assertSuccess(inviteA)
    assert(inviteA.field("invite", "status") === "pending", `expected pending: ${inviteA.text}`)
    const invitationA = inviteA.field("invite", "invitationId")
    assert(invitationA, `no invitationId: ${inviteA.text}`)
    pass()

    step("data.share.invitation invariant: a second invite to the same pending pair is refused")
    assertRefused(await graphql(INVITE, { input: { taskId: taskA, email: collabEmail, role: "viewer" } }, ownerToken), "SHARE_INVITATION_ALREADY_EXISTS")
    pass()

    step("fr.share.accept exceptionFlows: accepting with a mismatched email is refused")
    assertRefused(await graphql(ACCEPT, { input: { invitationId: invitationA, email: "somebody-else@example.com" } }, collabToken), "SHARE_EMAIL_MISMATCH")
    pass()

    step("collaborator accepts the invitation on task A -> accepted editor")
    const acceptedA = await graphql(ACCEPT, { input: { invitationId: invitationA, email: collabEmail } }, collabToken)
    assertSuccess(acceptedA)
    assert(acceptedA.field("acceptInvitation", "status") === "accepted", `expected accepted: ${acceptedA.text}`)
    assert(acceptedA.field("acceptInvitation", "role") === "editor", `expected role editor: ${acceptedA.text}`)
    pass()

    step("ac.share.role.permissions.editor-can-complete: the accepted editor completes task A")
    const completedA = await graphql(COMPLETE_TASK, { id: taskA }, collabToken)
    assertSuccess(completedA)
    assert(completedA.field("completeTask", "complete") === "true", `expected complete:true: ${completedA.text}`)
    pass()

    step("ac.share.editor.no-delete.delete-refused-for-editor: the accepted editor may not delete task A")
    assertRefused(await graphql(DELETE_TASK, { id: taskA }, collabToken), "TASK_FORBIDDEN")
    pass()

    step("fr.share.list: the owner sees the accepted editor on task A")
    const listed = await graphql(COLLABORATORS, { input: { taskId: taskA } }, ownerToken)
    assertSuccess(listed)
    assert(listed.body.data.collaborators.some((entry) => entry.role === "editor" && entry.status === "accepted"), `accepted editor not in collaborators list: ${listed.text}`)
    pass()

    step("fr.share.list exceptionFlows: a stranger reading collaborators for an unrelated task sees nothing")
    const strangerTask = await createTask(collabToken, "share live-proof stranger task")
    const strangerList = await graphql(COLLABORATORS, { input: { taskId: strangerTask } }, ownerToken)
    assertSuccess(strangerList)
    assert((strangerList.body.data?.collaborators ?? []).length === 0, `expected an empty list: ${strangerList.text}`)
    pass()

    // br.share.revoke.on-read
    step("owner revokes the collaborator on task A")
    const revoked = await graphql(REVOKE, { input: { invitationId: invitationA } }, ownerToken)
    assertSuccess(revoked)
    assert(revoked.field("revokeCollaborator", "status") === "revoked", `expected revoked: ${revoked.text}`)
    pass()

    step("ac.share.revoke.on-read.removed-loses-access-next-read: the revoked collaborator's next completion attempt is refused, with no wait")
    assertRefused(await graphql(COMPLETE_TASK, { id: taskA }, collabToken), "TASK_FORBIDDEN")
    pass()

    step("fr.share.revoke exceptionFlows: revoking the already-revoked invitation again is refused")
    assertRefused(await graphql(REVOKE, { input: { invitationId: invitationA } }, ownerToken), "SHARE_INVITATION_ALREADY_CLOSED")
    pass()

    step("fr.share.revoke: a non-owner may not revoke")
    const second = await graphql(INVITE, { input: { taskId: taskA, email: "another@example.com", role: "viewer" } }, ownerToken)
    assertSuccess(second)
    const secondInvitation = second.field("invite", "invitationId")
    assertRefused(await graphql(REVOKE, { input: { invitationId: secondInvitation } }, collabToken), "SHARE_FORBIDDEN")
    pass()

    // br.share.role.permissions.viewer-read-only, on a second task so the (taskId, email) pair is fresh
    step("owner createTask (task B) -> taskId")
    const taskB = await createTask(ownerToken, "share live-proof task B")
    pass()

    step("owner invites collaborator as viewer on task B")
    const inviteB = await graphql(INVITE, { input: { taskId: taskB, email: collabEmail, role: "viewer" } }, ownerToken)
    assertSuccess(inviteB)
    const invitationB = inviteB.field("invite", "invitationId")
    pass()

    step("collaborator accepts the viewer invitation on task B")
    const acceptedB = await graphql(ACCEPT, { input: { invitationId: invitationB, email: collabEmail } }, collabToken)
    assertSuccess(acceptedB)
    assert(acceptedB.field("acceptInvitation", "role") === "viewer", `expected role viewer: ${acceptedB.text}`)
    pass()

    step("ac.share.role.permissions.viewer-read-only: the accepted viewer may not complete task B")
    assertRefused(await graphql(COMPLETE_TASK, { id: taskB }, collabToken), "TASK_FORBIDDEN")
    pass()

    // cleanup: each person deletes the tasks it still owns
    step("cleanup: owner deletes task A")
    assertSuccess(await graphql(DELETE_TASK, { id: taskA }, ownerToken))
    pass()

    step("cleanup: owner deletes task B")
    assertSuccess(await graphql(DELETE_TASK, { id: taskB }, ownerToken))
    pass()

    step("cleanup: collaborator deletes its own stranger-check task")
    assertSuccess(await graphql(DELETE_TASK, { id: strangerTask }, collabToken))
    pass()

    proof.finish()
})
