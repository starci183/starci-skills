import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    AcceptInvitationData,
    CollaboratorsData,
    CompleteTaskData,
    CreateTaskData,
    InviteData,
    ReopenTaskData,
    RevokeCollaboratorData,
    TasksData,
} from "../setup/e2e-views.contracts"

/**
 * fr.share.* as one A->Z journey over the run-owned stack: the owner invites a collaborator, who before accepting is a
 * stranger (sees nothing, cannot touch the task); on accept the editor role is live in the same call (access is decided by a
 * database read at every action, with no cache in front of it), so the collaborator sees the invitation and completes the
 * owner task; on revoke the very next transition attempt is refused, br.share.revoke.on-read: immediately, not by a sweep.
 * The Postgres read at the end is out-of-band verification only.
 */
describe("share journey (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("share/share-journey")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("invite -> accept -> collaborator sees and edits the task -> revoke -> access gone", async () => {
        const { graphql, auth, database } = world
        const run = `e2e-share-${randomUUID()}`
        const owner = await auth.persona("owner")
        const collaborator = await auth.persona("other")
        const collaboratorEmail = auth.personaEmail("other")
        const asOwner = graphql.client(owner.sessionToken)
        const asCollaborator = graphql.client(collaborator.sessionToken)

        const created = await asOwner.mutate<CreateTaskData>("createTask", { variables: { input: { title: `${run}-shared` } } })
        const taskId = present(created.data, "createTask data").createTask.taskId

        // Invite: pending row, addressed to the collaborator sign-in email, editor role.
        const invited = await asOwner.mutate<InviteData>("invite", { variables: { input: { taskId, email: collaboratorEmail, role: "editor" } } })
        expect(invited.errorCode).toBeNull()
        const invitation = present(invited.data, "invite data").invite
        expect(invitation).toMatchObject({ taskId, email: collaboratorEmail, role: "editor", status: "pending" })

        // Not yet accepted: the invitee is still a stranger: no collaborator rows, no completion.
        const beforeAccept = await asCollaborator.read<CollaboratorsData>("collaborators", { variables: { input: { taskId } } })
        expect(beforeAccept.errorCode).toBeNull()
        expect(beforeAccept.data?.collaborators).toEqual([])
        const refusedBeforeAccept = await asCollaborator.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(refusedBeforeAccept.errorCode).toBe("TASK_FORBIDDEN")

        // Accept: the invitee names its own email, binding the personId to the row.
        const accepted = await asCollaborator.mutate<AcceptInvitationData>("acceptInvitation", {
            variables: { input: { invitationId: invitation.invitationId, email: collaboratorEmail } },
        })
        expect(accepted.errorCode).toBeNull()
        expect(accepted.data?.acceptInvitation).toMatchObject({ invitationId: invitation.invitationId, role: "editor", status: "accepted" })

        // Sees: a bound collaborator reads the invitation list of the task.
        const seen = await asCollaborator.read<CollaboratorsData>("collaborators", { variables: { input: { taskId } } })
        expect(seen.data?.collaborators).toEqual([
            expect.objectContaining({ invitationId: invitation.invitationId, email: collaboratorEmail, role: "editor", status: "accepted" }),
        ])

        // Edits: an accepted editor may complete the owner task; the owner observes the result.
        const completed = await asCollaborator.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(completed.errorCode).toBeNull()
        expect(completed.data?.completeTask).toEqual({ taskId, complete: true })
        const ownerTasks = await asOwner.read<TasksData>("tasks")
        expect(ownerTasks.data?.tasks.find((row) => row.taskId === taskId)).toMatchObject({ complete: true })

        // Sharing never widens ownership: the task still does not appear in the collaborator own list.
        const collaboratorTasks = await asCollaborator.read<TasksData>("tasks")
        expect(collaboratorTasks.data?.tasks.map((row) => row.taskId)).not.toContain(taskId)

        // Revoke: the owner flips the row.
        const revoked = await asOwner.mutate<RevokeCollaboratorData>("revokeCollaborator", { variables: { input: { invitationId: invitation.invitationId } } })
        expect(revoked.errorCode).toBeNull()
        expect(revoked.data?.revokeCollaborator).toMatchObject({ invitationId: invitation.invitationId, status: "revoked" })

        // Access gone, immediately: the very next transition attempt by the ex-collaborator is refused.
        const refusedAfterRevoke = await asCollaborator.mutate<ReopenTaskData>("reopenTask", { variables: { input: { id: taskId } } })
        expect(refusedAfterRevoke.errorCode).toBe("TASK_FORBIDDEN")
        expect(refusedAfterRevoke.data).toBeNull()

        // Out-of-band verify: the row persisted as revoked, personId intact (only a fresh invite for the same pair clears
        // it), revoked_at stamped.
        const rows = await database.invitationById(invitation.invitationId)
        expect(rows).toHaveLength(1)
        expect(rows[0]?.status).toBe("revoked")
        expect(rows[0]?.person_id).toBe(collaborator.personId)
        expect(rows[0]?.revoked_at).toBeTruthy()
    })
})
