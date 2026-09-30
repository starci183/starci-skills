import { randomBytes } from "node:crypto"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditKeyEntity } from "./persistence/entities/audit-key.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("AuditKeystoreService", () => {
    it("mints and stores a key in the caller transaction on first use", async () => {
        const own = mockEntityManager()
        const manager = mockEntityManager({
            findOneBy: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity)),
        })
        const minted = await new AuditKeystoreService(own).getOrCreateKey({ manager, personId: "p1", at: AT })
        expect(minted.key).toHaveLength(32)
        expect(manager.save).toHaveBeenCalledWith(
            AuditKeyEntity,
            expect.objectContaining({ personId: "p1", keyId: minted.keyId, createdAt: AT, key: minted.key.toString("base64") }),
        )
        expect(own.save).not.toHaveBeenCalled()
    })

    it("returns the stored key on later calls without writing", async () => {
        const key = randomBytes(32)
        const manager = mockEntityManager({
            findOneBy: jest.fn().mockResolvedValue({ personId: "p1", keyId: "k1", key: key.toString("base64"), createdAt: AT }),
        })
        const found = await new AuditKeystoreService(mockEntityManager()).getOrCreateKey({ manager, personId: "p1", at: AT })
        expect(found).toEqual({ keyId: "k1", key })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("looks a key id up without ever creating a key, through the manager it is handed when there is one", async () => {
        const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ keyId: "k1" }) })
        const inner = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
        const service = new AuditKeystoreService(own)
        await expect(service.getKeyIdForPerson({ personId: "p1" })).resolves.toBe("k1")
        await expect(service.getKeyIdForPerson({ personId: "p1", manager: inner })).resolves.toBeNull()
        expect(own.save).not.toHaveBeenCalled()
        expect(inner.findOneBy).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
    })

    it("loads the material of the key ids that still exist in one bounded read, and nothing for no ids", async () => {
        const key = randomBytes(32)
        const own = mockEntityManager({ find: jest.fn().mockResolvedValue([{ keyId: "k1", key: key.toString("base64") }]) })
        const service = new AuditKeystoreService(own)
        const materials = await service.getKeyMaterials({ keyIds: ["k1", "gone"] })
        expect([...materials.entries()]).toEqual([["k1", key]])
        expect(own.find).toHaveBeenCalledWith(AuditKeyEntity, expect.objectContaining({ take: LIST_ROWS_MAX }))
        const none = await service.getKeyMaterials({ keyIds: [] })
        expect(none.size).toBe(0)
        expect(own.find).toHaveBeenCalledTimes(1)
    })

    it("destroys the key row of the person through the given manager", async () => {
        const manager = mockEntityManager()
        await new AuditKeystoreService(mockEntityManager()).destroyKey({ manager, personId: "p1" })
        expect(manager.delete).toHaveBeenCalledWith(AuditKeyEntity, { personId: "p1" })
    })

    it("round-trips a plaintext under the same key", () => {
        const service = new AuditKeystoreService(mockEntityManager())
        const key = randomBytes(32)
        const sealed = service.seal(key, "person-1")
        expect(sealed).not.toContain("person-1")
        expect(service.unseal(key, sealed)).toEqual({ opened: true, plaintext: "person-1" })
    })

    it("reports opened false with the cause, never throwing, for a wrong key, a tampered blob and a bad shape", () => {
        const service = new AuditKeystoreService(mockEntityManager())
        const sealed = service.seal(randomBytes(32), "person-1")
        expect(service.unseal(randomBytes(32), sealed)).toMatchObject({ opened: false })
        const [iv, tag] = sealed.split(".")
        expect(service.unseal(randomBytes(32), `${iv}.${tag}.AAAA`)).toMatchObject({ opened: false })
        expect(service.unseal(randomBytes(32), "not-a-sealed-blob")).toMatchObject({ opened: false })
    })
})
