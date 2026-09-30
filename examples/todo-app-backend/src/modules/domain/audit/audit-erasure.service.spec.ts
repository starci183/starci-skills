import { mock } from "@starci/jest-preset/mock"
import { mockEntityManager } from "@tests/fixtures/database"
import { AuditErasureService } from "./audit-erasure.service"
import type { AuditKeystoreService } from "./audit-keystore.service"
import { AuditErrorCode } from "./errors/audit.error"
import { AuditErasureRequestEntity } from "./persistence/entities/audit-erasure-request.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const LATER = new Date("2026-09-30T11:00:00.000Z")

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

const setup = (
    stored: AuditErasureRequestEntity | null,
    keys: { keyId?: string | null; remaining?: number } = {},
): {
    service: AuditErasureService
    keystore: AuditKeystoreService
    manager: ReturnType<typeof mockEntityManager>
} => {
    const keystore = mock<AuditKeystoreService>({
        getKeyIdForPerson: jest.fn().mockResolvedValue(keys.keyId === undefined ? "k1" : keys.keyId),
        getKeyMaterials: jest.fn().mockResolvedValue(new Map(Array.from({ length: keys.remaining ?? 0 }, () => ["k1", Buffer.alloc(32)] as const))),
        destroyKey: jest.fn().mockResolvedValue(undefined),
    })
    const manager = mockEntityManager({
        findOne: jest.fn().mockResolvedValue(stored),
        save: jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity)),
    })
    return { service: new AuditErasureService(keystore), keystore, manager }
}

describe("AuditErasureService.request", () => {
    it("opens a request for the caller and verifies it at once", async () => {
        const { service, manager } = setup(row())
        const outcome = await service.request({ manager, personId: "p1", at: AT })
        expect(outcome).toMatchObject({ kind: "ok", value: { requestId: "r1", personId: "p1", state: "verified", verifiedAt: AT } })
        expect(manager.save).toHaveBeenNthCalledWith(
            1,
            AuditErasureRequestEntity,
            expect.objectContaining({ personId: "p1", state: "requested", requestedAt: AT }),
        )
    })
})

describe("AuditErasureService.confirm", () => {
    it("verifies the subject of a still requested request", async () => {
        const { service, manager } = setup(row())
        const outcome = await service.confirm({ manager, requestId: "r1", callerId: "p1", at: LATER })
        expect(outcome).toMatchObject({ kind: "ok", value: { state: "verified", verifiedAt: LATER } })
    })

    it("refuses the request when a stranger confirms it and touches no key", async () => {
        const { service, keystore, manager } = setup(row())
        const outcome = await service.confirm({ manager, requestId: "r1", callerId: "mallory", at: LATER })
        expect(outcome).toMatchObject({ kind: "refused", code: AuditErrorCode.ErasureRequestForbidden })
        expect(manager.save).toHaveBeenCalledWith(
            AuditErasureRequestEntity,
            expect.objectContaining({ state: "refused", refusedAt: LATER }),
        )
        expect(keystore.destroyKey).not.toHaveBeenCalled()
    })

    it("refuses an unknown request before any state check, and a request that is no longer requested", async () => {
        const unknown = setup(null)
        await expect(unknown.service.confirm({ manager: unknown.manager, requestId: "nope", callerId: "p1", at: LATER })).resolves.toMatchObject({
            kind: "refused",
            code: AuditErrorCode.ErasureRequestNotFound,
            params: { requestId: "nope" },
        })
        const verified = setup(row({ state: "verified" }))
        await expect(verified.service.confirm({ manager: verified.manager, requestId: "r1", callerId: "p1", at: LATER })).resolves.toMatchObject({
            kind: "refused",
            code: AuditErrorCode.ErasureRequestInvalidState,
            params: { state: "verified", expected: "requested" },
        })
        expect(verified.manager.save).not.toHaveBeenCalled()
    })
})

describe("AuditErasureService.execute", () => {
    it("destroys the subject key, then completes the request and drops the person id", async () => {
        const { service, keystore, manager } = setup(row({ state: "verified", verifiedAt: AT }))
        const outcome = await service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })
        expect(outcome).toMatchObject({ kind: "ok", value: { state: "complete", personId: null, completedAt: LATER } })
        expect(keystore.destroyKey).toHaveBeenCalledWith({ manager, personId: "p1" })
        expect(keystore.getKeyMaterials).toHaveBeenCalledWith({ keyIds: ["k1"], manager })
    })

    it("completes for a subject who never produced a line, with no key to check", async () => {
        const { service, keystore, manager } = setup(row({ state: "verified" }), { keyId: null })
        const outcome = await service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })
        expect(outcome).toMatchObject({ kind: "ok", value: { state: "complete" } })
        expect(keystore.getKeyMaterials).not.toHaveBeenCalled()
    })

    it("refuses completion when the subject key is still readable after the destruction", async () => {
        const { service, manager } = setup(row({ state: "verified" }), { remaining: 1 })
        const outcome = await service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })
        expect(outcome).toMatchObject({ kind: "refused", code: AuditErrorCode.ErasureNotConfirmed })
        expect(manager.save).not.toHaveBeenCalledWith(AuditErasureRequestEntity, expect.objectContaining({ state: "complete" }))
    })

    it("refuses a caller who is not the subject, and destroys nothing", async () => {
        const { service, keystore, manager } = setup(row({ state: "verified" }))
        const outcome = await service.execute({ manager, requestId: "r1", callerId: "mallory", at: LATER })
        expect(outcome).toMatchObject({ kind: "refused", code: AuditErrorCode.ErasureRequestForbidden })
        expect(keystore.destroyKey).not.toHaveBeenCalled()
    })

    it("refuses an unknown request", async () => {
        const { service, manager } = setup(null)
        await expect(service.execute({ manager, requestId: "nope", callerId: "p1", at: LATER })).resolves.toMatchObject({
            kind: "refused",
            code: AuditErrorCode.ErasureRequestNotFound,
        })
    })

    it("refuses a request that is not verified, and a request that already completed", async () => {
        for (const stored of [row({ state: "requested" }), row({ state: "refused" }), row({ state: "complete", personId: null })]) {
            const { service, keystore, manager } = setup(stored)
            const outcome = await service.execute({ manager, requestId: "r1", callerId: "p1", at: LATER })
            expect(outcome).toMatchObject({
                kind: "refused",
                code: AuditErrorCode.ErasureRequestInvalidState,
                params: { state: stored.state, expected: "verified" },
            })
            expect(keystore.destroyKey).not.toHaveBeenCalled()
        }
    })
})
