import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import { UploadStorageError, UploadStorageErrorCode } from "@modules/integrations/upload"
import type { UploadStorage } from "@modules/integrations/upload"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AcceptUploadContentCommand } from "./accept-upload-content.command"
import { AcceptUploadContentHandler } from "./accept-upload-content.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const pending: UploadView = {
    id: "u1",
    owner: "owner-1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status: "pending",
    createdAt: AT,
}
const ready: UploadView = { ...pending, status: "ready", sizeBytes: 5 }
const content = Buffer.from("hello")
const command = new AcceptUploadContentCommand({ request: { uploadId: "u1", token: "signed", content } })

const build = (
    parts: { admitted?: unknown; store?: jest.Mock } = {},
): {
    handler: AcceptUploadContentHandler
    uploads: UploadService
    storage: UploadStorage
    inner: ReturnType<typeof mockEntityManager>
} => {
    const inner = mockEntityManager()
    const uploads = mock<UploadService>({
        admitContent: jest.fn().mockResolvedValue(parts.admitted ?? { kind: "ok", value: pending }),
        markReady: jest.fn().mockResolvedValue(ready),
    })
    const storage = mock<UploadStorage>({ store: parts.store ?? jest.fn().mockResolvedValue({ accepted: true }) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new AcceptUploadContentHandler(mock<Logger>(), entityManager, new FakeClock(AT), storage, uploads)
    return { handler, uploads, storage, inner }
}

describe("AcceptUploadContentHandler", () => {
    it("decides admission on the received size, stores the bytes, then turns the row ready in a transaction", async () => {
        const { handler, uploads, storage, inner } = build()
        const result = await handler.execute(command)
        expect(result).toEqual({
            kind: "ok",
            value: {
                uploadId: "u1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 5,
                status: "ready",
                createdAt: AT,
            },
        })
        expect(uploads.admitContent).toHaveBeenCalledWith({ uploadId: "u1", token: "signed", sizeBytes: 5, at: AT })
        expect(storage.store).toHaveBeenCalledWith({ uploadId: "u1", content })
        expect(uploads.markReady).toHaveBeenCalledWith({ manager: inner, upload: pending, sizeBytes: 5 })
    })

    it("stores nothing and writes nothing when admission is refused", async () => {
        for (const code of [UploadErrorCode.NotFound, UploadErrorCode.TokenInvalid, UploadErrorCode.TooLarge]) {
            const admitted = { kind: "refused", code, params: { uploadId: "u1" } }
            const { handler, storage, uploads } = build({ admitted })
            await expect(handler.execute(command)).resolves.toEqual(admitted)
            expect(storage.store).not.toHaveBeenCalled()
            expect(uploads.markReady).not.toHaveBeenCalled()
        }
    })

    it("refuses as scan-rejected with the reason and keeps the row pending when the inspection rejects the bytes", async () => {
        const store = jest.fn().mockResolvedValue({ accepted: false, reason: "signature-match" })
        const { handler, uploads } = build({ store })
        const result = await handler.execute(command)
        expect(result).toEqual({
            kind: "refused",
            code: UploadErrorCode.ScanRejected,
            params: { uploadId: "u1", reason: "signature-match" },
        })
        expect(uploads.markReady).not.toHaveBeenCalled()
    })

    it("refuses as storage-unavailable and keeps the row pending when the storage fails", async () => {
        const store = jest.fn().mockRejectedValue(new UploadStorageError({ code: UploadStorageErrorCode.Failed }))
        const { handler, uploads } = build({ store })
        const result = await handler.execute(command)
        expect(result).toMatchObject({ kind: "refused", code: UploadErrorCode.StorageUnavailable })
        expect(uploads.markReady).not.toHaveBeenCalled()
    })

    it("lets a failure that is not a storage failure through", async () => {
        const bug = new TypeError("bug")
        const { handler } = build({ store: jest.fn().mockRejectedValue(bug) })
        await expect(handler.execute(command)).rejects.toBe(bug)
    })
})
