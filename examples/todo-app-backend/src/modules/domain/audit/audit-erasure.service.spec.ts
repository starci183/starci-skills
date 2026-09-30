import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OUTBOX } from "@modules/platform/outbox"
import { AUDIT_APPEND_QUEUE } from "./audit-append.policy"
import { AuditErasureService } from "./audit-erasure.service"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditAction, SYSTEM_ACTOR_ID } from "./audit.contracts"
import { AuditErrorCode } from "./errors/audit.error"
import { AuditErasureRequestEntity } from "./persistence/entities/audit-erasure-request.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const LATER = new Date("2026-09-30T11:00:00.000Z")
const KEY = Buffer.alloc(32, 3)

const row = (overrides: Partial<AuditErasureRequestEntity> = {}): AuditErasureRequestEntity => ({
    requestId: "r1",
    personId: "p1",
    state: "requested",
    requestedAt: AT,
    verifiedAt: null,
    refusedAt: null,
    executingAt: null,
    completedAt: null,
    ...overrides,
})

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const clock = new FakeClock(LATER)
    const outbox = recordingOutbox()
    const keystore = mock<AuditKeystoreService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuditErasureService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: OUTBOX, useValue: outbox },
            { provide: AuditKeystoreService, useValue: keystore },
        ],
    }).compile()
    return { service: moduleRef.get(AuditErasureService), em, outbox, keystore }
}

/** The keystore answers of a subject who has a key that is gone after the destruction. */
const keyDestroyed = (keystore: ReturnType<typeof mock<AuditKeystoreService>>): void => {
    keystore.getKeyIdForPerson.mockResolvedValue("k1")
    keystore.getKeyMaterials.mockResolvedValue(new Map())
    keystore.destroyKey.mockResolvedValue(undefined)
}

describe("AuditErasureService", () => {
    describe("request", () => {
        it("opens a request for the caller and verifies it at once", async () => {
            const stored = row()
            const { service } = await build()
            const manager = mockEntityManager({
                save: [
                    [AuditErasureRequestEntity, stored],
                    [AuditErasureRequestEntity, row({ state: "verified", verifiedAt: LATER })],
                ],
                findOne: [AuditErasureRequestEntity, stored],
            })

            await expect(service.request({ manager, personId: "p1", at: LATER })).resolves.toSucceedWith({
                requestId: "r1",
                personId: "p1",
                state: "verified",
                requestedAt: AT,
                verifiedAt: LATER,
                refusedAt: null,
                executingAt: null,
                completedAt: null,
            })

            expect(manager.save).toHaveBeenNthCalledWith(1, AuditErasureRequestEntity, {
                requestId: expect.any(String),
                personId: "p1",
                state: "requested",
                requestedAt: LATER,
                verifiedAt: null,
                refusedAt: null,
                executingAt: null,
                completedAt: null,
            })
            expect(manager.save).toHaveBeenNthCalledWith(2, AuditErasureRequestEntity, {
                ...stored,
                verifiedAt: LATER,
                state: "verified",
            })
        })
    })

    describe("confirm", () => {
        it("refuses the request when a stranger confirms it and touches no key", async () => {
            const { service, keystore } = await build()
            const manager = mockEntityManager({
                findOne: [AuditErasureRequestEntity, row()],
                save: [AuditErasureRequestEntity, row({ state: "refused", refusedAt: LATER })],
            })

            await expect(service.confirm({ manager, requestId: "r1", callerId: "mallory", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestForbidden,
                params: { requestId: "r1" },
            })

            expect(manager.save).toHaveBeenCalledWith(AuditErasureRequestEntity, { ...row(), refusedAt: LATER, state: "refused" })
            expect(keystore.destroyKey).not.toHaveBeenCalled()
        })

        it("refuses an unknown request without writing", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, null] })

            await expect(service.confirm({ manager, requestId: "nope", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestNotFound,
                params: { requestId: "nope" },
            })

            expect(manager.findOne).toHaveBeenCalledWith(AuditErasureRequestEntity, {
                where: { requestId: "nope" },
                lock: { mode: "pessimistic_write" },
            })
            expect(manager.save).not.toHaveBeenCalled()
        })

        it("refuses a request that is no longer requested without writing", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, row({ state: "verified" })] })

            await expect(service.confirm({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestInvalidState,
                params: { requestId: "r1", state: "verified", expected: "requested" },
            })

            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("execute", () => {
        const verified = row({ state: "verified", verifiedAt: AT })

        it("destroys the subject key, confirms nothing is readable, then completes and drops the person id", async () => {
            const { service, keystore } = await build()
            keyDestroyed(keystore)
            const manager = mockEntityManager({
                findOne: [AuditErasureRequestEntity, verified],
                save: [
                    [AuditErasureRequestEntity, row({ state: "executing", executingAt: LATER })],
                    [AuditErasureRequestEntity, row({ state: "complete", personId: null, completedAt: LATER, executingAt: LATER })],
                ],
            })

            await expect(service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toSucceedWith(
                row({ state: "complete", personId: null, completedAt: LATER, executingAt: LATER }),
            )

            expect(keystore.getKeyIdForPerson).toHaveBeenCalledWith({ personId: "p1", manager })
            expect(keystore.destroyKey).toHaveBeenCalledWith({ manager, personId: "p1" })
            expect(keystore.getKeyMaterials).toHaveBeenCalledWith({ keyIds: ["k1"], manager })
            expect(manager.save).toHaveBeenNthCalledWith(1, AuditErasureRequestEntity, {
                ...verified,
                executingAt: LATER,
                state: "executing",
            })
            expect(manager.save).toHaveBeenNthCalledWith(2, AuditErasureRequestEntity, {
                ...verified,
                executingAt: LATER,
                completedAt: LATER,
                state: "complete",
                personId: null,
            })
        })

        it("completes for a subject who never produced a line, with no key to check", async () => {
            const { service, keystore } = await build()
            keystore.getKeyIdForPerson.mockResolvedValue(null)
            keystore.destroyKey.mockResolvedValue(undefined)
            const manager = mockEntityManager({
                findOne: [AuditErasureRequestEntity, verified],
                save: [AuditErasureRequestEntity, row({ state: "complete", personId: null })],
            })

            await expect(service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toSucceedWith(
                row({ state: "complete", personId: null }),
            )

            expect(keystore.getKeyMaterials).not.toHaveBeenCalled()
        })

        it("falls back to the caller as subject when the request no longer names a person", async () => {
            const { service, keystore } = await build()
            keystore.getKeyIdForPerson.mockResolvedValue(null)
            keystore.destroyKey.mockResolvedValue(undefined)
            const manager = mockEntityManager({
                findOne: [AuditErasureRequestEntity, row({ state: "verified", personId: null })],
                save: [AuditErasureRequestEntity, row({ state: "complete", personId: null })],
            })

            await service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })

            expect(keystore.destroyKey).toHaveBeenCalledWith({ manager, personId: "p1" })
        })

        it("refuses completion, and does not complete the request, when the key is still readable after the destruction", async () => {
            const { service, keystore } = await build()
            keystore.getKeyIdForPerson.mockResolvedValue("k1")
            keystore.destroyKey.mockResolvedValue(undefined)
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            const manager = mockEntityManager({
                findOne: [AuditErasureRequestEntity, verified],
                save: [AuditErasureRequestEntity, row({ state: "executing" })],
            })

            await expect(service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureNotConfirmed,
                params: { requestId: "r1" },
            })

            expect(manager.save).toHaveBeenCalledTimes(1)
        })

        it("refuses a caller who is not the subject and destroys nothing", async () => {
            const { service, keystore } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, verified] })

            await expect(service.execute({ manager, requestId: "r1", callerId: "mallory", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestForbidden,
                params: { requestId: "r1" },
            })

            expect(keystore.destroyKey).not.toHaveBeenCalled()
            expect(manager.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown request", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, null] })

            await expect(service.execute({ manager, requestId: "nope", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestNotFound,
                params: { requestId: "nope" },
            })
        })

        it.each(["requested", "refused", "executing"])("refuses a request in state %s and destroys nothing", async (state) => {
            const { service, keystore } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, row({ state })] })

            await expect(service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestInvalidState,
                params: { requestId: "r1", state, expected: "verified" },
            })

            expect(keystore.destroyKey).not.toHaveBeenCalled()
        })

        it("refuses a request that already completed", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ findOne: [AuditErasureRequestEntity, row({ state: "complete", personId: null })] })

            await expect(service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toBeRefused({
                code: AuditErrorCode.ErasureRequestInvalidState,
                params: { requestId: "r1", state: "complete", expected: "verified" },
            })
        })
    })

    describe("requestForCaller", () => {
        it("opens the request and queues the erasure-requested line naming the request and the system actor, in one transaction", async () => {
            const em = mockEntityManager({
                save: [
                    [AuditErasureRequestEntity, row()],
                    [AuditErasureRequestEntity, row({ state: "verified", verifiedAt: LATER })],
                ],
                findOne: [AuditErasureRequestEntity, row()],
            })
            const { service, outbox } = await build(em)
            const tx = fakeTransaction(em)

            await expect(service.requestForCaller({ personId: "p1" })).resolves.toSucceedWith({
                requestId: "r1",
                state: "verified",
            })

            expect(tx.outcomes).toEqual(["commit"])
            expect(outbox.messages).toEqual([
                {
                    queue: AUDIT_APPEND_QUEUE.name,
                    eventId: expect.any(String),
                    payload: {
                        actorId: SYSTEM_ACTOR_ID,
                        action: AuditAction.ErasureRequested,
                        target: "r1",
                        at: LATER.toISOString(),
                    },
                    availableAt: LATER,
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
        })

        it("returns a refusal and queues no line", async () => {
            const em = mockEntityManager({
                save: [AuditErasureRequestEntity, row({ personId: "someone-else" })],
                findOne: [AuditErasureRequestEntity, row({ personId: "someone-else" })],
            })
            const { service, outbox } = await build(em)
            fakeTransaction(em)

            await expect(service.requestForCaller({ personId: "p1" })).resolves.toBeRefused(
                AuditErrorCode.ErasureRequestForbidden,
            )

            expect(outbox.writes).toEqual([])
        })
    })

    describe("completeForCaller", () => {
        it("completes the request and queues the erasure-completed line naming the request and the system actor, in one transaction", async () => {
            const em = mockEntityManager({
                findOne: [AuditErasureRequestEntity, row({ state: "verified" })],
                save: [AuditErasureRequestEntity, row({ state: "complete", personId: null })],
            })
            const { service, outbox, keystore } = await build(em)
            const tx = fakeTransaction(em)
            keystore.getKeyIdForPerson.mockResolvedValue(null)
            keystore.destroyKey.mockResolvedValue(undefined)

            await expect(service.completeForCaller({ requestId: "r1", callerId: "p1" })).resolves.toSucceedWith({
                requestId: "r1",
                state: "complete",
            })

            expect(tx.outcomes).toEqual(["commit"])
            expect(outbox.messages).toEqual([
                {
                    queue: AUDIT_APPEND_QUEUE.name,
                    eventId: expect.any(String),
                    payload: {
                        actorId: SYSTEM_ACTOR_ID,
                        action: AuditAction.ErasureCompleted,
                        target: "r1",
                        at: LATER.toISOString(),
                    },
                    availableAt: LATER,
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
        })

        it("returns a refusal and queues no line", async () => {
            const em = mockEntityManager({ findOne: [AuditErasureRequestEntity, null] })
            const { service, outbox } = await build(em)
            fakeTransaction(em)

            await expect(service.completeForCaller({ requestId: "nope", callerId: "p1" })).resolves.toBeRefused(
                AuditErrorCode.ErasureRequestNotFound,
            )

            expect(outbox.writes).toEqual([])
        })
    })
})
