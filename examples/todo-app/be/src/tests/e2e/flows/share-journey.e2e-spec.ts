import { randomUUID } from "node:crypto"
import { TaskErrorCode } from "@modules/domain/task"
import { INVITATION_BY_ID } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { InvitationRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    AcceptInvitationData,
    CollaboratorsData,
    CompleteTaskData,
    CreateTaskData,
    InviteData,
    ReopenTaskData,
    RevokeCollaboratorData,
    TasksData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"

/**
 * fr.share.* as one A->Z journey over the real api: the owner invites a collaborator, who before accepting is a stranger
 * (sees nothing, cannot touch the task); on accept the editor role is live in the same call (access is decided by a
 * database read at every action, with no cache in front of it), so the collaborator sees the invitation and completes the
 * owner task; on revoke the very next transition attempt is refused, br.share.revoke.on-read: immediately, not by a sweep.
 * The stored row at the end is read through the shared entity manager.
 */
describe("share journey (e2e)", () => {
    const world = useTestWorld({ apps: ["todo"] })

    it("invite -> accept -> collaborator sees and edits the task -> revoke -> access gone", async () => {
        const run = `e2e-share-${randomUUID()}`
        const owner = await world.signedInPerson("share-owner")
        const collaborator = await world.signedInPerson("share-collaborator")
        const asOwner = owner.caller
        const asCollaborator = collaborator.caller

        const created = await asOwner.graphql<CreateTaskData>("createTask", { input: { title: `${run}-shared` } })
        const taskId = created.data?.createTask.taskId ?? ""

        // Invite: pending row, addressed to the collaborator sign-in email, editor role.
        const invited = await asOwner.graphql<InviteData>("invite", {
            input: { taskId, email: collaborator.email, role: "editor" },
        })
        expect(invited.errorCode).toBeNull()
        const invitation = invited.data?.invite
        expect(invitation).toMatchObject({ taskId, email: collaborator.email, role: "editor", status: "pending" })
        const invitationId = invitation?.invitationId ?? ""

        // Not yet accepted: the invitee is still a stranger: no collaborator rows, no completion.
        const beforeAccept = await asCollaborator.graphql<CollaboratorsData>("collaborators", { input: { taskId } })
        expect(beforeAccept.errorCode).toBeNull()
        expect(beforeAccept.data?.collaborators).toEqual([])
        const refusedBeforeAccept = await asCollaborator.graphql<CompleteTaskData>("completeTask", {
            input: { id: taskId },
        })
        expect(refusedBeforeAccept.errorCode).toBe(TaskErrorCode.Forbidden)

        // Accept: the invitee names its own email, binding the personId to the row.
        const accepted = await asCollaborator.graphql<AcceptInvitationData>("acceptInvitation", {
            input: { invitationId, email: collaborator.email },
        })
        expect(accepted.errorCode).toBeNull()
        expect(accepted.data?.acceptInvitation).toMatchObject({ invitationId, role: "editor", status: "accepted" })

        // Sees: a bound collaborator reads the invitation list of the task.
        const seen = await asCollaborator.graphql<CollaboratorsData>("collaborators", { input: { taskId } })
        expect(seen.data?.collaborators).toEqual([
            expect.objectContaining({ invitationId, email: collaborator.email, role: "editor", status: "accepted" }),
        ])

        // Edits: an accepted editor may complete the owner task; the owner observes the result.
        const completed = await asCollaborator.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
        expect(completed.errorCode).toBeNull()
        expect(completed.data?.completeTask).toEqual({ taskId, complete: true })
        const ownerTasks = await asOwner.graphql<TasksData>("tasks")
        expect(ownerTasks.data?.tasks.find((row) => row.taskId === taskId)).toMatchObject({ complete: true })

        // Sharing never widens ownership: the task still does not appear in the collaborator own list.
        const collaboratorTasks = await asCollaborator.graphql<TasksData>("tasks")
        expect(collaboratorTasks.data?.tasks.map((row) => row.taskId)).not.toContain(taskId)

        // Revoke: the owner flips the row.
        const revoked = await asOwner.graphql<RevokeCollaboratorData>("revokeCollaborator", { input: { invitationId } })
        expect(revoked.errorCode).toBeNull()
        expect(revoked.data?.revokeCollaborator).toMatchObject({ invitationId, status: "revoked" })

        // Access gone, immediately: the very next transition attempt by the ex-collaborator is refused.
        const refusedAfterRevoke = await asCollaborator.graphql<ReopenTaskData>("reopenTask", { input: { id: taskId } })
        expect(refusedAfterRevoke.errorCode).toBe(TaskErrorCode.Forbidden)
        expect(refusedAfterRevoke.data).toBeNull()

        // The row persisted as revoked, personId intact (only a fresh invite for the same pair clears it), revoked_at stamped.
        const rows: Array<InvitationRow> = await world.db.primary.query(INVITATION_BY_ID, [invitationId])
        expect(rows).toHaveLength(1)
        expect(rows[0]?.status).toBe("revoked")
        expect(rows[0]?.person_id).toBe(collaborator.personId)
        expect(rows[0]?.revoked_at).toBeTruthy()
    })
})
