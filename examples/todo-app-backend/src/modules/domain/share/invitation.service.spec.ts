import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { ShareErrorCode } from "./errors/share.error"
import { InvitationService } from "./invitation.service"
import { InvitationEntity } from "./persistence/entities/invitation.entity"

const DAY = 24 * 60 * 60 * 1000
const SENT = new Date("2026-09-01T10:00:00.000Z")
const SOON = new Date(SENT.getTime() + 13 * DAY)
const LATE = new Date(SENT.getTime() + 15 * DAY)

const pending: InvitationEntity = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "pending",
    sentAt: SENT,
    acceptedAt: null,
    revokedAt: null,
    personId: null,
}
const accepted: InvitationEntity = { ...pending, status: "accepted", acceptedAt: SOON, personId: "ann" }
const revoked: InvitationEntity = { ...pending, status: "revoked", revokedAt: SOON }

const echoSave = (): jest.Mock =>
    jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

const withRow = (row: InvitationEntity | null): ReturnType<typeof mockEntityManager> =>
    mockEntityManager({ findOne: jest.fn().mockResolvedValue(row), save: echoSave() })

const service = (): InvitationService => new InvitationService(mockEntityManager())

describe("InvitationService.invite", () => {
    it("creates a pending invitation bound to the task, the normalized email and the role", async () => {
        const manager = withRow(null)
        const outcome = await service().invite({
            manager,
            ownerId: "owner-1",
            taskId: "t1",
            email: "  Ann@Example.com ",
            role: "editor",
            at: SENT,
        })
        expect(outcome).toMatchObject({
            kind: "ok",
            value: { taskId: "t1", ownerId: "owner-1", email: "ann@example.com", role: "editor", status: "pending" },
        })
        expect(manager.findOne).toHaveBeenCalledWith(
            InvitationEntity,
            expect.objectContaining({ where: { taskId: "t1", email: "ann@example.com" } }),
        )
        expect(manager.save).toHaveBeenCalledWith(
            InvitationEntity,
            expect.objectContaining({ sentAt: SENT, acceptedAt: null, personId: null }),
        )
    })

    it("refuses an email that is not well formed and writes nothing", async () => {
        const manager = withRow(null)
        const outcome = await service().invite({ manager, ownerId: "o", taskId: "t1", email: "nope", role: "viewer", at: SENT })
        expect(outcome).toMatchObject({ kind: "refused", code: ShareErrorCode.InvalidEmail, params: { email: "nope" } })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("refuses a role other than viewer or editor and writes nothing", async () => {
        const manager = withRow(null)
        const outcome = await service().invite({ manager, ownerId: "o", taskId: "t1", email: "a@b.co", role: "boss", at: SENT })
        expect(outcome).toMatchObject({ kind: "refused", code: ShareErrorCode.InvalidRole, params: { role: "boss" } })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("refuses a second invite over a pending pair and over an accepted pair", async () => {
        for (const row of [pending, accepted]) {
            const manager = withRow(row)
            const outcome = await service().invite({ manager, ownerId: "owner-1", taskId: "t1", email: row.email, role: "viewer", at: SOON })
            expect(outcome).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationAlreadyExists })
            expect(manager.save).not.toHaveBeenCalled()
        }
    })

    it("re-opens an expired row as one pending row and clears the stale person binding", async () => {
        const manager = withRow({ ...accepted, status: "pending", personId: "ann" })
        const outcome = await service().invite({ manager, ownerId: "owner-1", taskId: "t1", email: "ann@example.com", role: "viewer", at: LATE })
        expect(outcome).toMatchObject({ kind: "ok", value: { id: "i1", role: "viewer", status: "pending", personId: null } })
        expect(manager.save).toHaveBeenCalledWith(InvitationEntity, expect.objectContaining({ id: "i1", sentAt: LATE, personId: null }))
    })

    it("re-opens a revoked row pending", async () => {
        const manager = withRow(revoked)
        const outcome = await service().invite({ manager, ownerId: "owner-1", taskId: "t1", email: "ann@example.com", role: "editor", at: SOON })
        expect(outcome).toMatchObject({ kind: "ok", value: { id: "i1", status: "pending", revokedAt: null } })
    })
})

describe("InvitationService.accept", () => {
    it("binds the accepting person and activates the role at once", async () => {
        const manager = withRow(pending)
        const outcome = await service().accept({ manager, actorId: "ann", invitationId: "i1", email: "ANN@example.com", at: SOON })
        expect(outcome).toMatchObject({ kind: "ok", value: { status: "accepted", personId: "ann", role: "editor", acceptedAt: SOON } })
        expect(manager.save).toHaveBeenCalledWith(
            InvitationEntity,
            expect.objectContaining({ status: "accepted", personId: "ann", acceptedAt: SOON }),
        )
    })

    it("accepts thirteen days in but refuses fifteen days in as expired", async () => {
        const early = await service().accept({ manager: withRow(pending), actorId: "ann", invitationId: "i1", email: "ann@example.com", at: SOON })
        expect(early.kind).toBe("ok")
        const manager = withRow(pending)
        const late = await service().accept({ manager, actorId: "ann", invitationId: "i1", email: "ann@example.com", at: LATE })
        expect(late).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationExpired })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("refuses another email, a revoked invitation and an unknown id", async () => {
        const mismatch = await service().accept({ manager: withRow(pending), actorId: "bob", invitationId: "i1", email: "bob@example.com", at: SOON })
        expect(mismatch).toMatchObject({ kind: "refused", code: ShareErrorCode.EmailMismatch })
        const gone = await service().accept({ manager: withRow(revoked), actorId: "ann", invitationId: "i1", email: "ann@example.com", at: SOON })
        expect(gone).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationRevoked })
        const unknown = await service().accept({ manager: withRow(null), actorId: "ann", invitationId: "nope", email: "ann@example.com", at: SOON })
        expect(unknown).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationNotFound, params: { invitationId: "nope" } })
    })

    it("answers the same person accepting twice with the row untouched, and refuses a different person as closed", async () => {
        const manager = withRow(accepted)
        const again = await service().accept({ manager, actorId: "ann", invitationId: "i1", email: "ann@example.com", at: LATE })
        expect(again).toMatchObject({ kind: "ok", value: { status: "accepted", personId: "ann" } })
        expect(manager.save).not.toHaveBeenCalled()
        const other = await service().accept({ manager: withRow(accepted), actorId: "bob", invitationId: "i1", email: "ann@example.com", at: LATE })
        expect(other).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationAlreadyClosed })
    })
})

describe("InvitationService.revoke", () => {
    it("lets the owner revoke a pending or an accepted invitation", async () => {
        for (const row of [pending, accepted]) {
            const manager = withRow(row)
            const outcome = await service().revoke({ manager, ownerId: "owner-1", invitationId: "i1", at: SOON })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "revoked", revokedAt: SOON } })
            expect(manager.save).toHaveBeenCalledWith(InvitationEntity, expect.objectContaining({ status: "revoked" }))
        }
    })

    it("refuses anyone but the owner and writes nothing", async () => {
        const manager = withRow(pending)
        const outcome = await service().revoke({ manager, ownerId: "mallory", invitationId: "i1", at: SOON })
        expect(outcome).toMatchObject({ kind: "refused", code: ShareErrorCode.Forbidden })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("refuses an already revoked, an already expired and an unknown invitation", async () => {
        const closedRevoked = await service().revoke({ manager: withRow(revoked), ownerId: "owner-1", invitationId: "i1", at: SOON })
        expect(closedRevoked).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationAlreadyClosed })
        const closedExpired = await service().revoke({ manager: withRow(pending), ownerId: "owner-1", invitationId: "i1", at: LATE })
        expect(closedExpired).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationAlreadyClosed })
        const unknown = await service().revoke({ manager: withRow(null), ownerId: "owner-1", invitationId: "nope", at: SOON })
        expect(unknown).toMatchObject({ kind: "refused", code: ShareErrorCode.InvitationNotFound })
    })
})

describe("InvitationService.listFor", () => {
    const listing = (rows: Array<InvitationEntity>): { svc: InvitationService; manager: ReturnType<typeof mockEntityManager> } => {
        const manager = mockEntityManager({ find: jest.fn().mockResolvedValue(rows) })
        return { svc: new InvitationService(manager), manager }
    }

    it("shows the owner every row with its live status, bounded", async () => {
        const { svc, manager } = listing([pending, accepted])
        const views = await svc.listFor({ actorId: "owner-1", taskId: "t1", at: LATE })
        expect(views.map((view) => view.status)).toEqual(["expired", "accepted"])
        expect(manager.find).toHaveBeenCalledWith(InvitationEntity, { where: { taskId: "t1" }, take: LIST_ROWS_MAX })
    })

    it("shows a bound collaborator the list too", async () => {
        const { svc } = listing([pending, accepted])
        await expect(svc.listFor({ actorId: "ann", taskId: "t1", at: SOON })).resolves.toHaveLength(2)
    })

    it("shows a stranger, and a task with no rows, nothing", async () => {
        const { svc } = listing([pending, accepted])
        await expect(svc.listFor({ actorId: "stranger", taskId: "t1", at: SOON })).resolves.toEqual([])
        const empty = listing([])
        await expect(empty.svc.listFor({ actorId: "owner-1", taskId: "t9", at: SOON })).resolves.toEqual([])
    })
})
