import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { ShareErrorCode } from "@modules/domain/share"
import type { InvitationService, InvitationView } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AcceptInvitationCommand } from "./accept-invitation.command"
import { AcceptInvitationHandler } from "./accept-invitation.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "ann", roles: ["member"] }
const accepted: InvitationView = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "accepted",
    sentAt: AT,
    acceptedAt: AT,
    revokedAt: null,
    personId: "ann",
}

const build = (
    outcome: Awaited<ReturnType<InvitationService["accept"]>>,
): { handler: AcceptInvitationHandler; invitations: InvitationService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const invitations = mock<InvitationService>({ accept: jest.fn().mockResolvedValue(outcome) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new AcceptInvitationHandler(mock<Logger>(), entityManager, new FakeClock(AT), invitations), invitations, inner }
}

describe("AcceptInvitationHandler", () => {
    it("accepts for the caller inside one transaction at the stamped instant and answers the active role", async () => {
        const { handler, invitations, inner } = build({ kind: "ok", value: accepted })
        const result = await handler.execute(
            new AcceptInvitationCommand({ request: { invitationId: "i1", email: "ann@example.com" }, principal }),
        )
        expect(result).toEqual({ kind: "ok", value: { invitationId: "i1", role: "editor", status: "accepted" } })
        expect(invitations.accept).toHaveBeenCalledWith({
            manager: inner,
            actorId: "ann",
            invitationId: "i1",
            email: "ann@example.com",
            at: AT,
        })
    })

    it("hands a refusal back untouched", async () => {
        const refusal = { kind: "refused", code: ShareErrorCode.EmailMismatch, params: { invitationId: "i1" } } as const
        const { handler } = build(refusal)
        const result = await handler.execute(
            new AcceptInvitationCommand({ request: { invitationId: "i1", email: "bob@example.com" }, principal }),
        )
        expect(result).toEqual(refusal)
    })
})
