import { randomUUID } from "node:crypto"
import { rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { UPLOAD_STORAGE, UploadStorageErrorCode } from "@modules/integrations/upload-storage"
import type { UploadStorage } from "@modules/integrations/upload-storage"
import { INTEGRATION_UPLOADS, UPLOAD_STORAGE_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"
import { useTestWorld } from "@tests/world/use-test-world"

/**
 * upload-storage: the real storage adapter (the local filesystem one the dev stack runs) over a run directory, no HTTP door
 * of ours. Stored bytes read back byte for byte and are gone once deleted; an unknown upload reads as absent. An id that
 * would leave the storage root is the declared storage refusal, and a storage the adapter cannot write is the declared
 * storage failure, with the adapter serving again once the storage is back.
 */
describe("upload-storage: storage adapter (integration)", () => {
    const world = useTestWorld({ modules: UPLOAD_STORAGE_CAPABILITY_MODULES })

    const storage = (): UploadStorage => world.context.get<UploadStorage>(UPLOAD_STORAGE, { strict: false })

    it("stores bytes, reads them back byte for byte, and deletes them", async () => {
        const uploadId = randomUUID()
        const content = Buffer.from([0, 1, 2, 254, 255, ...Buffer.from("attachment")])

        expect(await storage().store({ uploadId, content })).toEqual({ accepted: true })
        expect(await storage().get({ uploadId })).toEqual(content)

        await storage().delete({ uploadId })
        expect(await storage().get({ uploadId })).toBeNull()
        expect(await storage().get({ uploadId: randomUUID() })).toBeNull()
    })

    it("an id that leaves the storage root is the declared storage refusal", async () => {
        await expect(storage().store({ uploadId: "../escape", content: Buffer.from("x") })).rejects.toMatchObject({
            code: UploadStorageErrorCode.Failed,
            params: { reason: "id-leaves-root" },
        })
        await expect(storage().get({ uploadId: "../escape" })).rejects.toMatchObject({
            code: UploadStorageErrorCode.Failed,
        })
    })

    it("a storage the adapter cannot write is the declared storage failure, and it serves again once restored", async () => {
        // The objects folder of the storage is taken by a plain file: every write under it fails as a broken volume does.
        const objects = join(world.scratchDir(INTEGRATION_UPLOADS), "uploads")
        await rm(objects, { recursive: true, force: true })
        await writeFile(objects, "not a folder")
        try {
            await expect(storage().store({ uploadId: randomUUID(), content: Buffer.from("x") })).rejects.toMatchObject({
                code: UploadStorageErrorCode.Failed,
            })
        } finally {
            await rm(objects, { force: true })
        }

        const uploadId = randomUUID()
        expect(await storage().store({ uploadId, content: Buffer.from("back") })).toEqual({ accepted: true })
        expect(await storage().get({ uploadId })).toEqual(Buffer.from("back"))
    })
})
