import { randomBytes } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditKeyEntity } from "./persistence/entities/audit-key.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")

const keyRow = (keyId: string, key: Buffer): AuditKeyEntity => ({
    personId: "p1",
    keyId,
    key: key.toString("base64"),
    createdAt: AT,
})

const build = async (own: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AuditKeystoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: own }],
    }).compile()
    return { service: moduleRef.get(AuditKeystoreService), own }
}

describe("AuditKeystoreService", () => {
    describe("getOrCreateKey", () => {
        it("mints a 256-bit key and stores it through the caller transaction on first use", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({
                findOneBy: [AuditKeyEntity, null],
                save: [AuditKeyEntity, keyRow("k-new", Buffer.alloc(32))],
            })

            const minted = await service.getOrCreateKey({ manager, personId: "p1", at: AT })

            expect(minted.key).toHaveLength(32)
            expect(manager.findOneBy).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
            expect(manager.save).toHaveBeenCalledWith(AuditKeyEntity, {
                personId: "p1",
                keyId: minted.keyId,
                key: minted.key.toString("base64"),
                createdAt: AT,
            })
            expect(own.save).not.toHaveBeenCalled()
        })

        it("returns the stored key on later calls without writing", async () => {
            const { service } = await build()
            const key = randomBytes(32)
            const manager = mockEntityManager({ findOneBy: [AuditKeyEntity, keyRow("k1", key)] })

            await expect(service.getOrCreateKey({ manager, personId: "p1", at: AT })).resolves.toEqual({ keyId: "k1", key })

            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("getKeyIdForPerson", () => {
        it("reads the key id through its own manager and never creates a key", async () => {
            const { service, own } = await build(mockEntityManager({ findOneBy: [AuditKeyEntity, keyRow("k1", Buffer.alloc(32))] }))

            await expect(service.getKeyIdForPerson({ personId: "p1" })).resolves.toBe("k1")

            expect(own.findOneBy).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
            expect(own.save).not.toHaveBeenCalled()
        })

        it("reads through the manager it is handed and answers null when the key is gone", async () => {
            const { service, own } = await build()
            const inner = mockEntityManager({ findOneBy: [AuditKeyEntity, null] })

            await expect(service.getKeyIdForPerson({ personId: "p1", manager: inner })).resolves.toBeNull()

            expect(inner.findOneBy).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
            expect(own.findOneBy).not.toHaveBeenCalled()
        })
    })

    describe("getKeyMaterials", () => {
        it("loads the material of the key ids that still exist in one bounded read", async () => {
            const key = randomBytes(32)
            const { service, own } = await build(mockEntityManager({ find: [AuditKeyEntity, [keyRow("k1", key)]] }))

            const materials = await service.getKeyMaterials({ keyIds: ["k1", "gone"] })

            expect([...materials.entries()]).toEqual([["k1", key]])
            expect(own.find).toHaveBeenCalledTimes(1)
            expect(own.find).toHaveBeenCalledWith(
                AuditKeyEntity,
                expect.objectContaining({ take: LIST_ROWS_MAX }),
            )
        })

        it("reads nothing for no key ids", async () => {
            const { service, own } = await build()

            const materials = await service.getKeyMaterials({ keyIds: [] })

            expect(materials.size).toBe(0)
            expect(own.find).not.toHaveBeenCalled()
        })

        it("reads through the manager it is handed", async () => {
            const key = randomBytes(32)
            const { service, own } = await build()
            const inner = mockEntityManager({ find: [AuditKeyEntity, [keyRow("k1", key)]] })

            const materials = await service.getKeyMaterials({ keyIds: ["k1"], manager: inner })

            expect(materials.get("k1")).toEqual(key)
            expect(own.find).not.toHaveBeenCalled()
        })
    })

    describe("destroyKey", () => {
        it("deletes the key row of the person through the given manager", async () => {
            const { service, own } = await build()
            const manager = mockEntityManager({ delete: [AuditKeyEntity, { affected: 1 }] })

            await service.destroyKey({ manager, personId: "p1" })

            expect(manager.delete).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
            expect(own.delete).not.toHaveBeenCalled()
        })
    })

    describe("seal and unseal", () => {
        it("round-trips a plaintext under the same key without leaking it in the sealed text", async () => {
            const { service } = await build()
            const key = randomBytes(32)

            const sealed = service.seal(key, "person-1")

            expect(sealed).not.toContain("person-1")
            expect(service.unseal(key, sealed)).toEqual({ opened: true, plaintext: "person-1" })
        })

        it("reports not opened for a wrong key", async () => {
            const { service } = await build()
            const sealed = service.seal(randomBytes(32), "person-1")

            expect(service.unseal(randomBytes(32), sealed)).toMatchObject({ opened: false })
        })

        it("reports not opened for a tampered ciphertext", async () => {
            const { service } = await build()
            const key = randomBytes(32)
            const [iv, tag] = service.seal(key, "person-1").split(".")

            expect(service.unseal(key, `${iv}.${tag}.AAAA`)).toMatchObject({ opened: false })
        })

        it("reports not opened, with a range error as the cause, for a bad shape", async () => {
            const { service } = await build()

            expect(service.unseal(randomBytes(32), "not-a-sealed-blob")).toEqual({
                opened: false,
                cause: new RangeError("sealed text is not iv.tag.ciphertext"),
            })
        })
    })
})
