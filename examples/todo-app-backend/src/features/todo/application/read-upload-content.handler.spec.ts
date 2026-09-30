import { mock } from "@starci/jest-preset/mock"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import type { UploadStorage } from "@modules/integrations/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { storageFailure } from "@tests/fixtures/gateway-errors"
import { ReadUploadContentHandler } from "./read-upload-content.handler"
import { ReadUploadContentQuery } from "./read-upload-content.query"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const upload: UploadView = {
    id: "u1",
    owner: "owner-1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    storageKey: "uploads/u1",
    status: "ready",
    createdAt: AT,
}
const query = new ReadUploadContentQuery({ request: { uploadId: "u1" }, principal })

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: ReadUploadContentHandler
    storage: UploadStorage
}

const build = (
    parts: { authorized?: unknown; ready?: unknown; get?: jest.Mock } = {},
): Built => {
    const uploads = mock<UploadService>({
        authorize: jest.fn().mockResolvedValue(parts.authorized ?? { kind: "ok", value: upload }),
        requireReady: jest.fn().mockReturnValue(parts.ready ?? { kind: "ok", value: upload }),
    })
    const storage = mock<UploadStorage>({ get: parts.get ?? jest.fn().mockResolvedValue(Buffer.from("hello")) })
    return { handler: new ReadUploadContentHandler(mock<Logger>(), storage, uploads), storage }
}

describe("ReadUploadContentHandler", () => {
    it("answers the bytes with the stored media type and file name to the owner", async () => {
        const { handler, storage } = build()
        const result = await handler.execute(query)
        expect(result).toEqual({
            kind: "ok",
            value: { filename: "note.txt", mime: "text/plain", content: Buffer.from("hello") },
        })
        expect(storage.get).toHaveBeenCalledWith({ uploadId: "u1" })
    })

    it("reads no bytes for a stranger, a missing upload or a pending one", async () => {
        const forbidden = { kind: "refused", code: UploadErrorCode.Forbidden, params: { uploadId: "u1" } }
        const notReady = { kind: "refused", code: UploadErrorCode.NotReady, params: { uploadId: "u1" } }
        const stranger = build({ authorized: forbidden })
        await expect(stranger.handler.execute(query)).resolves.toEqual(forbidden)
        expect(stranger.storage.get).not.toHaveBeenCalled()
        const pending = build({ ready: notReady })
        await expect(pending.handler.execute(query)).resolves.toEqual(notReady)
        expect(pending.storage.get).not.toHaveBeenCalled()
    })

    it("answers not found when the row is ready but the object vanished from storage", async () => {
        const { handler } = build({ get: jest.fn().mockResolvedValue(null) })
        await expect(handler.execute(query)).resolves.toEqual({
            kind: "refused",
            code: UploadErrorCode.NotFound,
            params: { uploadId: "u1", reason: "object-missing" },
        })
    })

    it("refuses as storage-unavailable when the storage fails, and rethrows any other failure", async () => {
        const failing = build({ get: jest.fn().mockRejectedValue(storageFailure()) })
        await expect(failing.handler.execute(query)).resolves.toMatchObject({
            kind: "refused",
            code: UploadErrorCode.StorageUnavailable,
        })
        const bug = new TypeError("bug")
        await expect(build({ get: jest.fn().mockRejectedValue(bug) }).handler.execute(query)).rejects.toBe(bug)
    })
})
