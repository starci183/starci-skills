import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { ShareErrorCode } from "@modules/domain/share"
import type { InvitationService, InvitationView } from "@modules/domain/share"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { RevokeCollaboratorCommand } from "./revoke-collaborator.command"
import { RevokeCollaboratorHandler } from "./revoke-collaborator.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const revoked: InvitationView = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "revoked",
    sentAt: AT,
    acceptedAt: AT,
    revokedAt: AT,
    personId: "ann",
}

const build = (
    outcome: Awaited<ReturnType<InvitationService["revoke"]>>,
): { handler: RevokeCollaboratorHandler; invitations: InvitationService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const invitations = mock<InvitationService>({ revoke: jest.fn().mockResolvedValue(outcome) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new RevokeCollaboratorHandler(mock<Logger>(), entityManager, new FakeClock(AT), invitations), invitations, inner }
}

describe("RevokeCollaboratorHandler", () => {
    it("revokes as the caller, who is taken as the owner, inside one transaction", async () => {
        const { handler, invitations, inner } = build({ kind: "ok", value: revoked })
        const result = await handler.execute(new RevokeCollaboratorCommand({ request: { invitationId: "i1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { invitationId: "i1", status: "revoked" } })
        expect(invitations.revoke).toHaveBeenCalledWith({ manager: inner, ownerId: "owner-1", invitationId: "i1", at: AT })
    })

    it("hands the refusal of a non-owner back untouched", async () => {
        const refusal = { kind: "refused", code: ShareErrorCode.Forbidden, params: { invitationId: "i1" } } as const
        const { handler } = build(refusal)
        const result = await handler.execute(new RevokeCollaboratorCommand({ request: { invitationId: "i1" }, principal }))
        expect(result).toEqual(refusal)
    })
})
