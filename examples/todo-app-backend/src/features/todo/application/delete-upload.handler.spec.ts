import { mock } from "@starci/jest-preset/mock"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import { UploadStorageError, UploadStorageErrorCode } from "@modules/integrations/upload"
import type { UploadStorage } from "@modules/integrations/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { DeleteUploadCommand } from "./delete-upload.command"
import { DeleteUploadHandler } from "./delete-upload.handler"

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
const command = new DeleteUploadCommand({ request: { uploadId: "u1" }, principal })

const build = (
    parts: { authorized?: unknown; remove?: jest.Mock } = {},
): {
    handler: DeleteUploadHandler
    uploads: UploadService
    storage: UploadStorage
    inner: ReturnType<typeof mockEntityManager>
} => {
    const inner = mockEntityManager()
    const uploads = mock<UploadService>({
        authorize: jest.fn().mockResolvedValue(parts.authorized ?? { kind: "ok", value: upload }),
        remove: jest.fn().mockResolvedValue(undefined),
    })
    const storage = mock<UploadStorage>({ delete: parts.remove ?? jest.fn().mockResolvedValue(undefined) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new DeleteUploadHandler(mock<Logger>(), entityManager, storage, uploads), uploads, storage, inner }
}

describe("DeleteUploadHandler", () => {
    it("deletes the stored bytes, then the row through the transaction manager", async () => {
        const order: Array<string> = []
        const { handler, uploads, storage, inner } = build({
            remove: jest.fn().mockImplementation(() => {
                order.push("object")
                return Promise.resolve()
            }),
        })
        jest.mocked(uploads.remove).mockImplementation(() => {
            order.push("row")
            return Promise.resolve()
        })
        const result = await handler.execute(command)
        expect(result).toEqual({ kind: "ok", value: { uploadId: "u1", deleted: true } })
        expect(uploads.authorize).toHaveBeenCalledWith({ uploadId: "u1", actorId: "owner-1" })
        expect(storage.delete).toHaveBeenCalledWith({ uploadId: "u1" })
        expect(uploads.remove).toHaveBeenCalledWith({ manager: inner, id: "u1" })
        expect(order).toEqual(["object", "row"])
    })

    it("refuses a stranger and a missing upload and deletes neither bytes nor row", async () => {
        for (const code of [UploadErrorCode.Forbidden, UploadErrorCode.NotFound]) {
            const authorized = { kind: "refused", code, params: { uploadId: "u1" } }
            const { handler, uploads, storage } = build({ authorized })
            await expect(handler.execute(command)).resolves.toEqual(authorized)
            expect(storage.delete).not.toHaveBeenCalled()
            expect(uploads.remove).not.toHaveBeenCalled()
        }
    })

    it("keeps the row and refuses as storage-unavailable when the bytes cannot be deleted", async () => {
        const failing = jest.fn().mockRejectedValue(new UploadStorageError({ code: UploadStorageErrorCode.Failed }))
        const { handler, uploads } = build({ remove: failing })
        await expect(handler.execute(command)).resolves.toMatchObject({
            kind: "refused",
            code: UploadErrorCode.StorageUnavailable,
        })
        expect(uploads.remove).not.toHaveBeenCalled()
    })

    it("rethrows a failure that is not a storage failure and keeps the row", async () => {
        const bug = new TypeError("bug")
        const { handler, uploads } = build({ remove: jest.fn().mockRejectedValue(bug) })
        await expect(handler.execute(command)).rejects.toBe(bug)
        expect(uploads.remove).not.toHaveBeenCalled()
    })
})
