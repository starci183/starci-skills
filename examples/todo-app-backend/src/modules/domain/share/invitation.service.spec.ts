import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { TaskService } from "@modules/domain/task"
import type { TaskView } from "@modules/domain/task"
import { CLOCK } from "@modules/platform/clock"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShareErrorCode } from "./errors/share.error"
import { InvitationService } from "./invitation.service"
import { InvitationEntity } from "./persistence/entities/invitation.entity"

const NOW = "2026-09-10T10:00:00.000Z"
const at = new Date(NOW)

const task: TaskView = { id: "t-1", owner: "owner-1", title: "Write", complete: false, completedAt: null }

const row = (overrides: Partial<InvitationEntity> = {}): InvitationEntity => ({
    id: "i-1",
    taskId: "t-1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "pending",
    sentAt: new Date("2026-09-01T10:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
    personId: null,
    ...overrides,
})

const expired = row({ sentAt: new Date("2026-08-01T10:00:00.000Z") })

const build = async (em = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const tasks = mock<TaskService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvitationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: TaskService, useValue: tasks },
        ],
    }).compile()
    return { service: moduleRef.get(InvitationService), em: tx.em, tx, tasks }
}

describe("InvitationService", () => {
    describe("invite", () => {
        const request = { ownerId: "owner-1", taskId: "t-1", email: "  Ann@Example.com ", role: "editor" }

        it("refuses an unknown task without opening a transaction", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(null)

            await expect(service.invite(request)).resolves.toBeRefused({ code: ShareErrorCode.Forbidden, params: { taskId: "t-1" } })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses somebody else's task", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(task)

            await expect(service.invite({ ...request, ownerId: "intruder" })).resolves.toBeRefused(ShareErrorCode.Forbidden)
            expect(tx.outcomes).toEqual([])
        })

        it("refuses a malformed email", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(task)

            await expect(service.invite({ ...request, email: "nope" })).resolves.toBeRefused({
                code: ShareErrorCode.InvalidEmail,
                params: { email: "nope" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses a role that is neither viewer nor editor", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(task)

            await expect(service.invite({ ...request, role: "admin" })).resolves.toBeRefused({
                code: ShareErrorCode.InvalidRole,
                params: { role: "admin" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("creates a pending invitation for the normalized email, stamped with the clock", async () => {
            const saved = row({ sentAt: at })
            const { service, em, tx, tasks } = await build(mockEntityManager({ findOne: [InvitationEntity, null], save: [InvitationEntity, saved] }))
            tasks.find.mockResolvedValue(task)

            await expect(service.invite(request)).resolves.toSucceedWith({
                invitationId: "i-1",
                taskId: "t-1",
                email: "ann@example.com",
                role: "editor",
                status: "pending",
            })

            expect(em.findOne).toHaveBeenCalledWith(InvitationEntity, {
                where: { taskId: "t-1", email: "ann@example.com" },
                lock: { mode: "pessimistic_write" },
            })
            expect(em.save).toHaveBeenCalledWith(InvitationEntity, {
                id: expect.any(String),
                taskId: "t-1",
                ownerId: "owner-1",
                email: "ann@example.com",
                role: "editor",
                status: "pending",
                sentAt: at,
                acceptedAt: null,
                revokedAt: null,
                personId: null,
            })
            expect(tx.commits).toBe(1)
        })

        it.each([
            ["pending", row()],
            ["accepted", row({ status: "accepted", personId: "ann" })],
        ])("refuses inviting an address that already has a %s invitation, and saves nothing", async (_status, existing) => {
            const { service, em, tasks } = await build(mockEntityManager({ findOne: [InvitationEntity, existing] }))
            tasks.find.mockResolvedValue(task)

            await expect(service.invite(request)).resolves.toBeRefused({
                code: ShareErrorCode.InvitationAlreadyExists,
                params: { taskId: "t-1", email: "ann@example.com" },
            })
            expect(em.save).not.toHaveBeenCalled()
        })

        it.each([
            ["expired", expired],
            ["revoked", row({ status: "revoked", revokedAt: new Date("2026-09-03T10:00:00.000Z") })],
        ])("re-opens an %s invitation of the same pair, keeping its id", async (_status, existing) => {
            const reopened = row({ role: "viewer", sentAt: at })
            const { service, em, tasks } = await build(mockEntityManager({ findOne: [InvitationEntity, existing], save: [InvitationEntity, reopened] }))
            tasks.find.mockResolvedValue(task)

            await expect(service.invite({ ...request, role: "viewer" })).resolves.toSucceedWith({
                invitationId: "i-1",
                taskId: "t-1",
                email: "ann@example.com",
                role: "viewer",
                status: "pending",
            })
            expect(em.save).toHaveBeenCalledWith(
                InvitationEntity,
                expect.objectContaining({ id: "i-1", role: "viewer", status: "pending", sentAt: at, acceptedAt: null, revokedAt: null, personId: null }),
            )
        })
    })

    describe("accept", () => {
        const request = { actorId: "ann", invitationId: "i-1", email: "ANN@example.com" }

        it("refuses an unknown invitation", async () => {
            const { service, em } = await build(mockEntityManager({ findOne: [InvitationEntity, null] }))

            await expect(service.accept(request)).resolves.toBeRefused({
                code: ShareErrorCode.InvitationNotFound,
                params: { invitationId: "i-1" },
            })
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses an invitation addressed to another email", async () => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, row()] }))

            await expect(service.accept({ ...request, email: "bob@example.com" })).resolves.toBeRefused(ShareErrorCode.EmailMismatch)
        })

        it("refuses an invitation past its window", async () => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, expired] }))

            await expect(service.accept(request)).resolves.toBeRefused(ShareErrorCode.InvitationExpired)
        })

        it("refuses a revoked invitation", async () => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, row({ status: "revoked" })] }))

            await expect(service.accept(request)).resolves.toBeRefused(ShareErrorCode.InvitationRevoked)
        })

        it("answers the same success when the same person accepts again, and saves nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOne: [InvitationEntity, row({ status: "accepted", personId: "ann" })] }))

            await expect(service.accept(request)).resolves.toSucceedWith({ invitationId: "i-1", role: "editor", status: "accepted" })
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses an invitation already accepted by somebody else", async () => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, row({ status: "accepted", personId: "someone" })] }))

            await expect(service.accept(request)).resolves.toBeRefused(ShareErrorCode.InvitationAlreadyClosed)
        })

        it("binds the accepting person to a pending invitation at the instant of the clock", async () => {
            const saved = row({ status: "accepted", acceptedAt: at, personId: "ann" })
            const { service, em } = await build(mockEntityManager({ findOne: [InvitationEntity, row()], save: [InvitationEntity, saved] }))

            await expect(service.accept(request)).resolves.toSucceedWith({ invitationId: "i-1", role: "editor", status: "accepted" })
            expect(em.save).toHaveBeenCalledWith(
                InvitationEntity,
                expect.objectContaining({ id: "i-1", status: "accepted", acceptedAt: at, personId: "ann" }),
            )
        })
    })

    describe("revoke", () => {
        const request = { ownerId: "owner-1", invitationId: "i-1" }

        it("refuses an unknown invitation", async () => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, null] }))

            await expect(service.revoke(request)).resolves.toBeRefused(ShareErrorCode.InvitationNotFound)
        })

        it("refuses somebody who does not own the invitation, and saves nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOne: [InvitationEntity, row()] }))

            await expect(service.revoke({ ...request, ownerId: "intruder" })).resolves.toBeRefused(ShareErrorCode.Forbidden)
            expect(em.save).not.toHaveBeenCalled()
        })

        it.each([
            ["expired", expired],
            ["revoked", row({ status: "revoked" })],
        ])("refuses an %s invitation as closed", async (_status, existing) => {
            const { service } = await build(mockEntityManager({ findOne: [InvitationEntity, existing] }))

            await expect(service.revoke(request)).resolves.toBeRefused(ShareErrorCode.InvitationAlreadyClosed)
        })

        it.each([
            ["pending", row()],
            ["accepted", row({ status: "accepted", personId: "ann" })],
        ])("revokes a %s invitation at the instant of the clock", async (_status, existing) => {
            const saved = row({ status: "revoked", revokedAt: at })
            const { service, em } = await build(mockEntityManager({ findOne: [InvitationEntity, existing], save: [InvitationEntity, saved] }))

            await expect(service.revoke(request)).resolves.toSucceedWith({ invitationId: "i-1", status: "revoked" })
            expect(em.save).toHaveBeenCalledWith(InvitationEntity, expect.objectContaining({ status: "revoked", revokedAt: at }))
        })
    })

    describe("listFor", () => {
        const rows = [row(), row({ id: "i-2", email: "bob@example.com", status: "accepted", personId: "bob" }), row({ id: "i-3", sentAt: new Date("2026-08-01T10:00:00.000Z") })]

        it("lists every invitation of the task for its owner, with live statuses", async () => {
            const { service, em } = await build(mockEntityManager({ find: [InvitationEntity, rows] }))

            await expect(service.listFor({ actorId: "owner-1", taskId: "t-1" })).resolves.toEqual({
                collaborators: [
                    { invitationId: "i-1", email: "ann@example.com", role: "editor", status: "pending" },
                    { invitationId: "i-2", email: "bob@example.com", role: "editor", status: "accepted" },
                    { invitationId: "i-3", email: "ann@example.com", role: "editor", status: "expired" },
                ],
            })
            expect(em.find).toHaveBeenCalledWith(InvitationEntity, { where: { taskId: "t-1" }, take: LIST_ROWS_MAX })
        })

        it("lists the invitations for a bound collaborator", async () => {
            const { service } = await build(mockEntityManager({ find: [InvitationEntity, rows] }))

            const listed = await service.listFor({ actorId: "bob", taskId: "t-1" })

            expect(listed.collaborators).toHaveLength(3)
        })

        it("lists nothing for a stranger", async () => {
            const { service } = await build(mockEntityManager({ find: [InvitationEntity, rows] }))

            await expect(service.listFor({ actorId: "stranger", taskId: "t-1" })).resolves.toEqual({ collaborators: [] })
        })
    })
})
