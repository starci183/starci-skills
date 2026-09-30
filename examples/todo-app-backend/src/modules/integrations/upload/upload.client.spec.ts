import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mock } from "@starci/jest-preset/mock"
import type { Logger } from "@modules/platform/logging"
import { UploadStorageErrorCode } from "./errors/upload-storage.error"
import { UploadClient } from "./upload.client"
import { UploadLogEvent } from "./upload.log-events"
import type { UploadScan } from "./upload.port"

const accepting = (): UploadScan => mock<UploadScan>({ scan: jest.fn().mockResolvedValue({ accepted: true }) })

describe("UploadClient", () => {
    let directory = ""

    beforeAll(async () => {
        directory = await mkdtemp(join(tmpdir(), "upload-client-spec-"))
    })

    afterAll(async () => {
        await rm(directory, { recursive: true, force: true })
    })

    it("round-trips an object and deletes it; a missing object reads null and deletes quietly", async () => {
        const client = new UploadClient({ directory }, accepting(), mock<Logger>())
        const uploadId = "spec-object"
        await expect(client.get({ uploadId })).resolves.toBeNull()

        await expect(client.store({ uploadId, content: Buffer.from("the bytes", "utf8") })).resolves.toEqual({ accepted: true })
        expect((await client.get({ uploadId }))?.toString("utf8")).toBe("the bytes")

        await client.store({ uploadId, content: Buffer.from("replaced", "utf8") })
        expect((await client.get({ uploadId }))?.toString("utf8")).toBe("replaced")

        await client.delete({ uploadId })
        await expect(client.get({ uploadId })).resolves.toBeNull()
        await expect(client.delete({ uploadId })).resolves.toBeUndefined()
    })

    it("hands the stored bytes to the scan hook", async () => {
        const scanner = accepting()
        const content = Buffer.from("scan me")
        await new UploadClient({ directory }, scanner, mock<Logger>()).store({ uploadId: "scanned", content })
        expect(scanner.scan).toHaveBeenCalledWith({ uploadId: "scanned", content })
    })

    it("removes the object again and answers the verdict when the scan rejects it", async () => {
        const rejecting = mock<UploadScan>({
            scan: jest.fn().mockResolvedValue({ accepted: false, reason: "signature-match" }),
        })
        const client = new UploadClient({ directory }, rejecting, mock<Logger>())
        const verdict = await client.store({ uploadId: "refused", content: Buffer.from("bad") })
        expect(verdict).toEqual({ accepted: false, reason: "signature-match" })
        await expect(client.get({ uploadId: "refused" })).resolves.toBeNull()
    })

    it("refuses an id that would leave the objects folder, on every verb, and logs it before a byte moves", async () => {
        const logger = mock<Logger>()
        const client = new UploadClient({ directory }, accepting(), logger)
        for (const uploadId of ["../escape", "..", "", "nested/id"]) {
            const expected = { code: UploadStorageErrorCode.Failed, params: { reason: "id-leaves-root" } }
            await expect(client.store({ uploadId, content: Buffer.from("x") })).rejects.toMatchObject(expected)
            await expect(client.get({ uploadId })).rejects.toMatchObject(expected)
            await expect(client.delete({ uploadId })).rejects.toMatchObject(expected)
        }
        expect(logger.warn).toHaveBeenCalledWith(UploadLogEvent.StorageFailed, expect.objectContaining({ reason: "id-leaves-root" }))
    })

    it("fails with the storage error, keeping the cause and logging it, when the filesystem refuses", async () => {
        const logger = mock<Logger>()
        const scanner = accepting()
        await new UploadClient({ directory }, scanner, logger).store({ uploadId: "a-file", content: Buffer.from("x") })
        const blocked = new UploadClient({ directory: join(directory, "uploads", "a-file") }, scanner, logger)
        const call = blocked.store({ uploadId: "other", content: Buffer.from("x") })
        await expect(call).rejects.toMatchObject({ code: UploadStorageErrorCode.Failed })
        await expect(call).rejects.toHaveProperty("cause")
        expect(logger.error).toHaveBeenCalledWith(UploadLogEvent.StorageFailed, expect.anything(), { uploadId: "other" })
    })
})
