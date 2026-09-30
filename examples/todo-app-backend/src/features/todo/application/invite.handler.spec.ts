import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { ShareErrorCode } from "@modules/domain/share"
import type { InvitationService, InvitationView } from "@modules/domain/share"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { InviteCommand } from "./invite.command"
import { InviteHandler } from "./invite.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const task: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }
const pending: InvitationView = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "pending",
    sentAt: AT,
    acceptedAt: null,
    revokedAt: null,
    personId: null,
}
const request = { taskId: "t1", email: "Ann@Example.com", role: "editor" }

const build = (
    parts: { found?: TaskView | null; outcome?: Awaited<ReturnType<InvitationService["invite"]>> } = {},
): { handler: InviteHandler; invitations: InvitationService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const tasks = mock<TaskService>({ find: jest.fn().mockResolvedValue(parts.found === undefined ? task : parts.found) })
    const invitations = mock<InvitationService>({
        invite: jest.fn().mockResolvedValue(parts.outcome ?? { kind: "ok", value: pending }),
    })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new InviteHandler(mock<Logger>(), entityManager, new FakeClock(AT), tasks, invitations), invitations, inner }
}

describe("InviteHandler", () => {
    it("invites for the owner of the task and answers the pending invitation", async () => {
        const { handler, invitations, inner } = build()
        const result = await handler.execute(new InviteCommand({ request, principal }))
        expect(result).toEqual({
            kind: "ok",
            value: { invitationId: "i1", taskId: "t1", email: "ann@example.com", role: "editor", status: "pending" },
        })
        expect(invitations.invite).toHaveBeenCalledWith({
            manager: inner,
            ownerId: "owner-1",
            taskId: "t1",
            email: "Ann@Example.com",
            role: "editor",
            at: AT,
        })
    })

    it("refuses an unknown task and a task of somebody else the same way, and invites nobody", async () => {
        for (const found of [null, { ...task, owner: "somebody-else" }]) {
            const { handler, invitations } = build({ found })
            const result = await handler.execute(new InviteCommand({ request, principal }))
            expect(result).toMatchObject({ kind: "refused", code: ShareErrorCode.Forbidden, params: { taskId: "t1" } })
            expect(invitations.invite).not.toHaveBeenCalled()
        }
    })

    it("hands a refusal of the share capability back untouched", async () => {
        const refusal = { kind: "refused", code: ShareErrorCode.InvalidRole, params: { role: "boss" } } as const
        const { handler } = build({ outcome: refusal })
        const result = await handler.execute(new InviteCommand({ request: { ...request, role: "boss" }, principal }))
        expect(result).toEqual(refusal)
    })
})
