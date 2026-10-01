import { randomUUID } from "node:crypto"
import { UPLOAD_STORAGE, UploadStorageErrorCode } from "@modules/integrations/upload-storage"
import type { UploadStorage } from "@modules/integrations/upload-storage"
import { UPLOAD_STORAGE_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"
import { useTestWorld } from "@tests/world/use-test-world"

/**
 * upload-storage: the real S3 adapter against the run's own bucket of the stack's MinIO, no HTTP door of ours. Stored bytes
 * read back byte for byte and are gone once deleted; an unknown upload reads as absent. An id that would leave the objects
 * prefix is the declared storage refusal, and a storage that cannot be reached is the declared storage failure, with the
 * adapter serving again once MinIO is back.
 */
describe("upload-storage: storage adapter (integration)", () => {
    const world = useTestWorld({ modules: UPLOAD_STORAGE_CAPABILITY_MODULES })

    const storage = (): UploadStorage => world.resolve<UploadStorage>(UPLOAD_STORAGE)

    it("stores bytes, reads them back byte for byte, and deletes them", async () => {
        const uploadId = randomUUID()
        const content = Buffer.from([0, 1, 2, 254, 255, ...Buffer.from("attachment")])

        expect(await storage().store({ uploadId, content })).toEqual({ accepted: true })
        expect(await storage().get({ uploadId })).toEqual(content)

        await storage().delete({ uploadId })
        expect(await storage().get({ uploadId })).toBeNull()
        expect(await storage().get({ uploadId: randomUUID() })).toBeNull()
        await storage().delete({ uploadId })
    })

    it("an id that leaves the objects prefix is the declared storage refusal", async () => {
        await expect(storage().store({ uploadId: "../escape", content: Buffer.from("x") })).rejects.toMatchObject({
            code: UploadStorageErrorCode.Failed,
            params: { reason: "id-leaves-root" },
        })
        await expect(storage().get({ uploadId: ".." })).rejects.toMatchObject({
            code: UploadStorageErrorCode.Failed,
            params: { reason: "id-leaves-root" },
        })
    })

    it("an unreachable storage is the declared storage failure, and the adapter serves again once MinIO is back", async () => {
        const uploadId = randomUUID()

        await world.infra.minio.during(async () => {
            await expect(storage().store({ uploadId, content: Buffer.from("x") })).rejects.toMatchObject({
                code: UploadStorageErrorCode.Failed,
            })
        })

        expect(await storage().store({ uploadId, content: Buffer.from("back") })).toEqual({ accepted: true })
        expect(await storage().get({ uploadId })).toEqual(Buffer.from("back"))
    })
})
