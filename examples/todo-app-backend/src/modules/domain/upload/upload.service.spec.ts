import { LIST_ROWS_MAX } from "@modules/platform/database"
import { Secret } from "@modules/platform/config"
import { mockEntityManager } from "@tests/fixtures/database"
import { UploadErrorCode } from "./errors/upload.error"
import { UploadEntity } from "./persistence/entities/upload.entity"
import type { UploadView } from "./upload.contracts"
import { UploadService } from "./upload.service"
import { signUploadToken } from "./upload-token.policy"

const AT = new Date("2026-09-30T10:00:00.000Z")
const OPTIONS = { maxBytes: 16, allowedMimes: ["text/plain"], presignTtlMs: 60_000, signingSecret: new Secret("spec-secret") }

const rowOf = (overrides: Partial<UploadEntity> = {}): UploadEntity => ({
    id: "u1",
    owner: "p1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status: "pending",
    createdAt: AT,
    ...overrides,
})

const viewOf = (overrides: Partial<UploadView> = {}): UploadView => ({
    id: "u1",
    owner: "p1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status: "pending",
    createdAt: AT,
    ...overrides,
})

const echoingSave = (): jest.Mock => jest.fn().mockImplementation((_target: unknown, entity: object) => entity)

const serviceWith = (found: UploadEntity | null = null): UploadService =>
    new UploadService(mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(found) }), OPTIONS)

describe("UploadService", () => {
    describe("createPending", () => {
        it("writes a pending row through the manager it was given, with the key minted from the id", async () => {
            const own = mockEntityManager()
            const inTransaction = mockEntityManager({ save: echoingSave() })
            const outcome = await new UploadService(own, OPTIONS).createPending({
                manager: inTransaction,
                ownerId: "p1",
                filename: "  note.txt ",
                mime: "text/plain",
                sizeBytes: 3,
                at: AT,
            })
            const created = outcome.kind === "ok" ? outcome.value : null
            expect(created).toMatchObject({
                owner: "p1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 3,
                status: "pending",
                createdAt: AT,
            })
            expect(created?.storageKey).toBe(`uploads/${created?.id}`)
            expect(inTransaction.save).toHaveBeenCalledWith(UploadEntity, expect.objectContaining({ id: created?.id }))
            expect(own.save).not.toHaveBeenCalled()
        })

        it("names a blank file name file", async () => {
            const manager = mockEntityManager({ save: echoingSave() })
            const outcome = await new UploadService(mockEntityManager(), OPTIONS).createPending({
                manager,
                ownerId: "p1",
                filename: "   ",
                mime: "text/plain",
                sizeBytes: 3,
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { filename: "file" } })
        })

        it("refuses a media type off the allowlist and writes nothing", async () => {
            const manager = mockEntityManager({ save: echoingSave() })
            const outcome = await new UploadService(mockEntityManager(), OPTIONS).createPending({
                manager,
                ownerId: "p1",
                filename: "a.exe",
                mime: "application/x-msdownload",
                sizeBytes: 3,
                at: AT,
            })
            expect(outcome).toEqual({
                kind: "refused",
                code: UploadErrorCode.MimeNotAllowed,
                params: { mime: "application/x-msdownload" },
            })
            expect(manager.save).not.toHaveBeenCalled()
        })

        it("refuses an empty, fractional or oversized declaration and writes nothing", async () => {
            for (const sizeBytes of [0, -1, 1.5, Number.NaN, OPTIONS.maxBytes + 1]) {
                const manager = mockEntityManager({ save: echoingSave() })
                const outcome = await new UploadService(mockEntityManager(), OPTIONS).createPending({
                    manager,
                    ownerId: "p1",
                    filename: "a.txt",
                    mime: "text/plain",
                    sizeBytes,
                    at: AT,
                })
                expect(outcome).toMatchObject({ kind: "refused", code: UploadErrorCode.TooLarge })
                expect(manager.save).not.toHaveBeenCalled()
            }
        })
    })

    describe("presign", () => {
        it("mints a token that expires after the configured lifetime", () => {
            const { token, expiresAt } = serviceWith().presign({ uploadId: "u1", at: AT })
            expect(expiresAt).toEqual(new Date(AT.getTime() + 60_000))
            expect(token).toBe(signUploadToken({ uploadId: "u1", expiresAtMs: expiresAt.getTime(), secret: "spec-secret" }))
        })
    })

    describe("find", () => {
        it("answers null for an empty id without querying", async () => {
            const manager = mockEntityManager()
            await expect(new UploadService(manager, OPTIONS).find({ uploadId: "" })).resolves.toBeNull()
            expect(manager.findOneBy).not.toHaveBeenCalled()
        })

        it("answers the view of a row, or null when there is none", async () => {
            await expect(serviceWith(rowOf()).find({ uploadId: "u1" })).resolves.toEqual(viewOf())
            await expect(serviceWith(null).find({ uploadId: "u1" })).resolves.toBeNull()
        })
    })

    describe("admitContent", () => {
        const token = signUploadToken({ uploadId: "u1", expiresAtMs: AT.getTime() + 1_000, secret: "spec-secret" })

        it("admits the bytes of a pending upload presented with its valid token", async () => {
            const outcome = await serviceWith(rowOf()).admitContent({ uploadId: "u1", token, sizeBytes: 3, at: AT })
            expect(outcome).toEqual({ kind: "ok", value: viewOf() })
        })

        it("refuses an unknown upload", async () => {
            const outcome = await serviceWith(null).admitContent({ uploadId: "u1", token, sizeBytes: 3, at: AT })
            expect(outcome).toMatchObject({ kind: "refused", code: UploadErrorCode.NotFound })
        })

        it("refuses an absent, forged or expired token and names why", async () => {
            const service = serviceWith(rowOf())
            const expired = new Date(AT.getTime() + 2_000)
            await expect(service.admitContent({ uploadId: "u1", token: undefined, sizeBytes: 3, at: AT })).resolves.toEqual({
                kind: "refused",
                code: UploadErrorCode.TokenInvalid,
                params: { uploadId: "u1", reason: "missing" },
            })
            await expect(service.admitContent({ uploadId: "u1", token: "1.bad", sizeBytes: 3, at: AT })).resolves.toMatchObject({
                code: UploadErrorCode.TokenInvalid,
                params: { reason: "malformed" },
            })
            await expect(service.admitContent({ uploadId: "u1", token, sizeBytes: 3, at: expired })).resolves.toMatchObject({
                code: UploadErrorCode.TokenInvalid,
                params: { reason: "expired" },
            })
        })

        it("refuses a token minted for another upload", async () => {
            const other = signUploadToken({ uploadId: "u2", expiresAtMs: AT.getTime() + 1_000, secret: "spec-secret" })
            const outcome = await serviceWith(rowOf()).admitContent({ uploadId: "u1", token: other, sizeBytes: 3, at: AT })
            expect(outcome).toMatchObject({ code: UploadErrorCode.TokenInvalid, params: { reason: "signature" } })
        })

        it("refuses a replayed token once the row is ready", async () => {
            const outcome = await serviceWith(rowOf({ status: "ready" })).admitContent({ uploadId: "u1", token, sizeBytes: 3, at: AT })
            expect(outcome).toMatchObject({ code: UploadErrorCode.TokenInvalid, params: { reason: "status" } })
        })

        it("refuses received bytes over the ceiling even when the intent declared a small size", async () => {
            const outcome = await serviceWith(rowOf()).admitContent({ uploadId: "u1", token, sizeBytes: OPTIONS.maxBytes + 1, at: AT })
            expect(outcome).toMatchObject({ code: UploadErrorCode.TooLarge })
        })
    })

    describe("authorize and requireReady", () => {
        it("answers the upload to its owner", async () => {
            const outcome = await serviceWith(rowOf()).authorize({ uploadId: "u1", actorId: "p1" })
            expect(outcome).toEqual({ kind: "ok", value: viewOf() })
        })

        it("refuses a stranger as forbidden and a missing row as not found", async () => {
            await expect(serviceWith(rowOf()).authorize({ uploadId: "u1", actorId: "p2" })).resolves.toMatchObject({
                kind: "refused",
                code: UploadErrorCode.Forbidden,
            })
            await expect(serviceWith(null).authorize({ uploadId: "u1", actorId: "p1" })).resolves.toMatchObject({
                kind: "refused",
                code: UploadErrorCode.NotFound,
            })
        })

        it("refuses a pending upload as not ready and lets a ready one through", () => {
            const service = serviceWith()
            expect(service.requireReady(viewOf())).toEqual({
                kind: "refused",
                code: UploadErrorCode.NotReady,
                params: { uploadId: "u1" },
            })
            expect(service.requireReady(viewOf({ status: "ready" }))).toEqual({ kind: "ok", value: viewOf({ status: "ready" }) })
        })
    })

    describe("writes", () => {
        it("flips the row to ready with the size that landed, through the caller manager", async () => {
            const own = mockEntityManager()
            const inTransaction = mockEntityManager({ save: echoingSave() })
            const ready = await new UploadService(own, OPTIONS).markReady({ manager: inTransaction, upload: viewOf(), sizeBytes: 5 })
            expect(ready).toMatchObject({ id: "u1", status: "ready", sizeBytes: 5, taskId: null })
            expect(inTransaction.save).toHaveBeenCalledWith(UploadEntity, expect.objectContaining({ status: "ready", sizeBytes: 5 }))
            expect(own.save).not.toHaveBeenCalled()
        })

        it("points the upload at the task and keeps every other column", async () => {
            const inTransaction = mockEntityManager({ save: echoingSave() })
            const attached = await serviceWith().attach({ manager: inTransaction, upload: viewOf({ status: "ready" }), taskId: "t1" })
            expect(attached).toEqual(viewOf({ status: "ready", taskId: "t1" }))
        })

        it("deletes the row by id through the caller manager", async () => {
            const inTransaction = mockEntityManager({ delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }) })
            await serviceWith().remove({ manager: inTransaction, id: "u1" })
            expect(inTransaction.delete).toHaveBeenCalledWith(UploadEntity, "u1")
        })
    })

    describe("listForTask", () => {
        it("reads only the rows of the task that the owner owns, bounded", async () => {
            const manager = mockEntityManager({ find: jest.fn().mockResolvedValue([rowOf({ taskId: "t1" })]) })
            const listed = await new UploadService(manager, OPTIONS).listForTask({ taskId: "t1", ownerId: "p1" })
            expect(listed).toEqual([viewOf({ taskId: "t1" })])
            expect(manager.find).toHaveBeenCalledWith(UploadEntity, { where: { taskId: "t1", owner: "p1" }, take: LIST_ROWS_MAX })
        })
    })
})
