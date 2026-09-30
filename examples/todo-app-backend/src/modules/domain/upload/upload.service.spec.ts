import { Test } from "@nestjs/testing"
import { builder, FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { TaskService } from "@modules/domain/task"
import { UPLOAD_STORAGE, UploadStorageError, UploadStorageErrorCode } from "@modules/integrations/upload-storage"
import type { UploadStorage } from "@modules/integrations/upload-storage"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { UPLOAD_AT, UPLOAD_SECRET, uploadRow, uploadTask } from "@tests/fixtures/builders/upload.builder"
import { UploadErrorCode } from "./errors/upload.error"
import { UploadEntity } from "./persistence/entities/upload.entity"
import { UPLOAD_TOKEN_HEADER } from "./upload.contracts"
import { UPLOAD_OPTIONS } from "./upload.decorators"
import type { UploadOptions } from "./upload.options"
import { UploadService } from "./upload.service"
import { signUploadToken } from "./upload-token.policy"

const at = new Date(UPLOAD_AT)
const options = builder<UploadOptions>({
    maxBytes: 1000,
    allowedMimes: ["text/plain", "image/png"],
    presignTtlMs: 60_000,
    signingSecret: new Secret(UPLOAD_SECRET),
})()

const bytes = Buffer.from("hello")

const pending = uploadRow()
const ready = uploadRow({ status: "ready" })

const tokenFor = (uploadId: string, expiresAtMs: number) =>
    signUploadToken({ uploadId, expiresAtMs, secret: UPLOAD_SECRET })
const validToken = tokenFor("u-1", at.getTime() + 30_000)
const storeError = () => new UploadStorageError({ code: UploadStorageErrorCode.Failed })

const build = async (em = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const storage = mock<UploadStorage>()
    const tasks = mock<TaskService>()
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            UploadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(UPLOAD_AT) },
            { provide: IDS, useValue: ids },
            { provide: UPLOAD_OPTIONS, useValue: options },
            { provide: UPLOAD_STORAGE, useValue: storage },
            { provide: TaskService, useValue: tasks },
        ],
    }).compile()
    return { service: moduleRef.get(UploadService), em: tx.em, tx, storage, tasks }
}

describe("UploadService", () => {
    describe("createIntent", () => {
        const request = { ownerId: "p-1", filename: "  note.txt ", mime: "text/plain", sizeBytes: 5 }

        it("refuses a media type off the allowlist without touching the database", async () => {
            const { service, tx } = await build()

            await expect(service.createIntent({ ...request, mime: "application/x-sh" })).resolves.toBeRefused({
                code: UploadErrorCode.MimeNotAllowed,
                params: { mime: "application/x-sh" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it.each([0, -1, 1.5, 1001])("refuses the size %s", async (sizeBytes) => {
            const { service, tx } = await build()

            await expect(service.createIntent({ ...request, sizeBytes })).resolves.toBeRefused({
                code: UploadErrorCode.TooLarge,
                params: { sizeBytes, maxBytes: 1000 },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("accepts the largest allowed size", async () => {
            const { service } = await build(mockEntityManager({ save: [UploadEntity, pending] }))

            const outcome = await service.createIntent({ ...request, sizeBytes: 1000 })

            expect(outcome.kind).toBe("ok")
        })

        it("writes a pending row for the owner and answers the presigned request", async () => {
            const { service, em } = await build(mockEntityManager({ save: [UploadEntity, pending] }))

            const outcome = await service.createIntent(request)

            expect(em.save).toHaveBeenCalledWith(UploadEntity, {
                id: "00000000-0000-4000-8000-000000000001",
                owner: "p-1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 5,
                storageKey: expect.stringMatching(/^uploads\/.+/),
                status: "pending",
                createdAt: at,
            })
            expect(outcome).toSucceedWith({
                uploadId: "u-1",
                method: "PUT",
                url: "/uploads/u-1/content",
                headers: [
                    { name: UPLOAD_TOKEN_HEADER, value: tokenFor("u-1", at.getTime() + 60_000) },
                    { name: "content-type", value: "text/plain" },
                ],
                expiresAt: new Date("2026-09-10T10:01:00.000Z"),
            })
        })

        it("names a blank file name file", async () => {
            const { service, em } = await build(mockEntityManager({ save: [UploadEntity, pending] }))

            await service.createIntent({ ...request, filename: "   " })

            expect(em.save).toHaveBeenCalledWith(UploadEntity, expect.objectContaining({ filename: "file" }))
        })
    })

    describe("createDirect", () => {
        const request = { ownerId: "p-1", filename: "note.txt", mime: "text/plain", content: bytes }

        it("refuses a media type off the allowlist and stores nothing", async () => {
            const { service, storage } = await build()

            await expect(service.createDirect({ ...request, mime: "application/x-sh" })).resolves.toBeRefused(
                UploadErrorCode.MimeNotAllowed,
            )
            expect(storage.store).not.toHaveBeenCalled()
        })

        it("opens the row with the received size, then stores, inspects and flips it ready", async () => {
            const { service, em, storage } = await build(
                mockEntityManager({
                    save: [
                        [UploadEntity, pending],
                        [UploadEntity, ready],
                    ],
                    findOneBy: [UploadEntity, pending],
                }),
            )
            storage.store.mockResolvedValue({ accepted: true })

            const outcome = await service.createDirect(request)

            expect(em.save).toHaveBeenNthCalledWith(
                1,
                UploadEntity,
                expect.objectContaining({ sizeBytes: 5, status: "pending", owner: "p-1" }),
            )
            expect(storage.store).toHaveBeenCalledWith({ uploadId: "u-1", content: bytes })
            expect(outcome).toSucceedWith({
                uploadId: "u-1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 5,
                status: "ready",
                createdAt: pending.createdAt,
            })
        })
    })

    describe("acceptContent", () => {
        const request = { uploadId: "u-1", token: validToken, content: bytes }

        it("refuses an unknown upload", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, null] }))

            await expect(service.acceptContent(request)).resolves.toBeRefused({
                code: UploadErrorCode.NotFound,
                params: { uploadId: "u-1" },
            })
            expect(storage.store).not.toHaveBeenCalled()
        })

        it("answers not found for an empty id before any query", async () => {
            const { service } = await build()

            await expect(service.acceptContent({ ...request, uploadId: "" })).resolves.toBeRefused(
                UploadErrorCode.NotFound,
            )
        })

        it.each([
            ["missing", undefined],
            ["malformed", "garbage"],
            ["signature", tokenFor("other", at.getTime() + 30_000)],
            ["expired", tokenFor("u-1", at.getTime() - 1)],
        ])("refuses a %s token", async (reason, token) => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))

            await expect(service.acceptContent({ ...request, token })).resolves.toBeRefused({
                code: UploadErrorCode.TokenInvalid,
                params: { uploadId: "u-1", reason },
            })
            expect(storage.store).not.toHaveBeenCalled()
        })

        it("refuses a consumed intent whose row is no longer pending", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))

            await expect(service.acceptContent(request)).resolves.toBeRefused({
                code: UploadErrorCode.TokenInvalid,
                params: { uploadId: "u-1", reason: "status" },
            })
        })

        it("refuses received bytes over the ceiling however small the intent was", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))

            await expect(service.acceptContent({ ...request, content: Buffer.alloc(1001) })).resolves.toBeRefused(
                UploadErrorCode.TooLarge,
            )
            expect(storage.store).not.toHaveBeenCalled()
        })

        it("refuses empty bytes", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))

            await expect(service.acceptContent({ ...request, content: Buffer.alloc(0) })).resolves.toBeRefused(
                UploadErrorCode.TooLarge,
            )
        })

        it("refuses with storage unavailable when the storage plane fails, and leaves the row pending", async () => {
            const { service, storage, tx } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))
            storage.store.mockRejectedValue(storeError())

            await expect(service.acceptContent(request)).resolves.toBeRefused({
                code: UploadErrorCode.StorageUnavailable,
                params: { uploadId: "u-1" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("rethrows a failure that is not the storage integration's", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))
            storage.store.mockRejectedValue(new TypeError("bug"))

            await expect(service.acceptContent(request)).rejects.toThrow("bug")
        })

        it("refuses with the reason of the inspection and leaves the row pending", async () => {
            const { service, storage, tx } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))
            storage.store.mockResolvedValue({ accepted: false, reason: "virus" })

            await expect(service.acceptContent(request)).resolves.toBeRefused({
                code: UploadErrorCode.ScanRejected,
                params: { uploadId: "u-1", reason: "virus" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("flips the row ready with the size that landed once the bytes are stored", async () => {
            const { service, em, storage } = await build(
                mockEntityManager({ findOneBy: [UploadEntity, pending], save: [UploadEntity, ready] }),
            )
            storage.store.mockResolvedValue({ accepted: true })

            const outcome = await service.acceptContent(request)

            expect(em.save).toHaveBeenCalledWith(UploadEntity, { ...pending, sizeBytes: 5, status: "ready" })
            expect(outcome).toSucceedWith(expect.objectContaining({ uploadId: "u-1", status: "ready" }))
        })
    })

    describe("attach", () => {
        const request = { actorId: "p-1", uploadId: "u-1", taskId: "t-1" }

        it("refuses an unknown upload", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [UploadEntity, null] }))

            await expect(service.attach(request)).resolves.toBeRefused(UploadErrorCode.NotFound)
        })

        it("refuses an upload that belongs to somebody else", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))

            await expect(service.attach({ ...request, actorId: "p-2" })).resolves.toBeRefused({
                code: UploadErrorCode.Forbidden,
                params: { uploadId: "u-1" },
            })
        })

        it("refuses an upload whose bytes have not landed", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))

            await expect(service.attach(request)).resolves.toBeRefused({
                code: UploadErrorCode.NotReady,
                params: { uploadId: "u-1" },
            })
        })

        it("refuses an unknown task", async () => {
            const { service, tasks, tx } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            tasks.find.mockResolvedValue(null)

            await expect(service.attach(request)).resolves.toBeRefused({
                code: UploadErrorCode.NotFound,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses a task of somebody else", async () => {
            const { service, tasks } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            tasks.find.mockResolvedValue(uploadTask({ owner: "p-2" }))

            await expect(service.attach(request)).resolves.toBeRefused({
                code: UploadErrorCode.Forbidden,
                params: { taskId: "t-1" },
            })
        })

        it("points the upload at the task and keeps every other column", async () => {
            const attached = { ...ready, taskId: "t-1" }
            const { service, tasks, em } = await build(
                mockEntityManager({ findOneBy: [UploadEntity, ready], save: [UploadEntity, attached] }),
            )
            tasks.find.mockResolvedValue(uploadTask())

            const outcome = await service.attach(request)

            expect(em.save).toHaveBeenCalledWith(UploadEntity, { ...ready, taskId: "t-1" })
            expect(outcome).toSucceedWith(expect.objectContaining({ uploadId: "u-1", taskId: "t-1", status: "ready" }))
        })
    })

    describe("remove", () => {
        const request = { actorId: "p-1", uploadId: "u-1" }

        it("refuses an unknown upload and somebody else's upload", async () => {
            const missing = await build(mockEntityManager({ findOneBy: [UploadEntity, null] }))
            const foreign = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))

            await expect(missing.service.remove(request)).resolves.toBeRefused(UploadErrorCode.NotFound)
            await expect(foreign.service.remove({ ...request, actorId: "p-2" })).resolves.toBeRefused(
                UploadErrorCode.Forbidden,
            )
            expect(missing.storage.delete).not.toHaveBeenCalled()
            expect(foreign.storage.delete).not.toHaveBeenCalled()
        })

        it("refuses with storage unavailable and keeps the row when the bytes cannot be removed", async () => {
            const { service, storage, tx } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.delete.mockRejectedValue(storeError())

            await expect(service.remove(request)).resolves.toBeRefused(UploadErrorCode.StorageUnavailable)
            expect(tx.outcomes).toEqual([])
        })

        it("rethrows a failure that is not the storage integration's", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.delete.mockRejectedValue(new TypeError("bug"))

            await expect(service.remove(request)).rejects.toThrow("bug")
        })

        it("removes the bytes first, then the row", async () => {
            const { service, storage, em, tx } = await build(
                mockEntityManager({ findOneBy: [UploadEntity, ready], delete: [UploadEntity, {}] }),
            )

            await expect(service.remove(request)).resolves.toSucceedWith({ uploadId: "u-1", deleted: true })

            expect(storage.delete).toHaveBeenCalledWith({ uploadId: "u-1" })
            expect(em.delete).toHaveBeenCalledWith(UploadEntity, "u-1")
            expect(tx.commits).toBe(1)
        })
    })

    describe("listForTask", () => {
        const request = { actorId: "p-1", taskId: "t-1" }

        it("refuses an unknown task and reads no uploads", async () => {
            const { service, tasks } = await build()
            tasks.find.mockResolvedValue(null)

            await expect(service.listForTask(request)).resolves.toBeRefused({
                code: UploadErrorCode.NotFound,
                params: { taskId: "t-1" },
            })
        })

        it("refuses a task of somebody else and reads no uploads", async () => {
            const { service, tasks } = await build()
            tasks.find.mockResolvedValue(uploadTask({ owner: "p-2" }))

            await expect(service.listForTask(request)).resolves.toBeRefused({
                code: UploadErrorCode.Forbidden,
                params: { taskId: "t-1" },
            })
        })

        it("lists the owner's uploads of the task, bounded, as public summaries", async () => {
            const attached = { ...ready, taskId: "t-1" }
            const { service, tasks, em } = await build(mockEntityManager({ find: [UploadEntity, [attached]] }))
            tasks.find.mockResolvedValue(uploadTask())

            await expect(service.listForTask(request)).resolves.toSucceedWith({
                uploads: [
                    {
                        uploadId: "u-1",
                        taskId: "t-1",
                        filename: "note.txt",
                        mime: "text/plain",
                        sizeBytes: 5,
                        status: "ready",
                        createdAt: pending.createdAt,
                    },
                ],
            })
            expect(em.find).toHaveBeenCalledWith(UploadEntity, {
                where: { taskId: "t-1", owner: "p-1" },
                take: LIST_ROWS_MAX,
            })
        })
    })

    describe("readContent", () => {
        const request = { actorId: "p-1", uploadId: "u-1" }

        it("refuses an unknown upload and somebody else's upload", async () => {
            const missing = await build(mockEntityManager({ findOneBy: [UploadEntity, null] }))
            const foreign = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))

            await expect(missing.service.readContent(request)).resolves.toBeRefused(UploadErrorCode.NotFound)
            await expect(foreign.service.readContent({ ...request, actorId: "p-2" })).resolves.toBeRefused(
                UploadErrorCode.Forbidden,
            )
        })

        it("refuses an upload whose bytes have not landed", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, pending] }))

            await expect(service.readContent(request)).resolves.toBeRefused(UploadErrorCode.NotReady)
            expect(storage.get).not.toHaveBeenCalled()
        })

        it("answers not found when a ready row lost its object", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.get.mockResolvedValue(null)

            await expect(service.readContent(request)).resolves.toBeRefused({
                code: UploadErrorCode.NotFound,
                params: { uploadId: "u-1", reason: "object-missing" },
            })
        })

        it("refuses with storage unavailable when the storage plane fails", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.get.mockRejectedValue(storeError())

            await expect(service.readContent(request)).resolves.toBeRefused(UploadErrorCode.StorageUnavailable)
        })

        it("rethrows a failure that is not the storage integration's", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.get.mockRejectedValue(new TypeError("bug"))

            await expect(service.readContent(request)).rejects.toThrow("bug")
        })

        it("answers the bytes with the stored file name and media type", async () => {
            const { service, storage } = await build(mockEntityManager({ findOneBy: [UploadEntity, ready] }))
            storage.get.mockResolvedValue(bytes)

            await expect(service.readContent(request)).resolves.toSucceedWith({
                filename: "note.txt",
                mime: "text/plain",
                content: bytes,
            })
        })
    })
})
