import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { UPLOAD_TOKEN_HEADER, UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CreateUploadIntentCommand } from "./create-upload-intent.command"
import { CreateUploadIntentHandler } from "./create-upload-intent.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const EXPIRES = new Date("2026-09-30T10:05:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
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
const request = { filename: "note.txt", mime: "text/plain", sizeBytes: 3 }

const build = (
    created: unknown = { kind: "ok", value: pending },
): { handler: CreateUploadIntentHandler; uploads: UploadService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const uploads = mock<UploadService>({
        createPending: jest.fn().mockResolvedValue(created),
        presign: jest.fn().mockReturnValue({ token: "signed", expiresAt: EXPIRES }),
    })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new CreateUploadIntentHandler(mock<Logger>(), entityManager, new FakeClock(AT), uploads), uploads, inner }
}

describe("CreateUploadIntentHandler", () => {
    it("writes the pending row for the caller in a transaction and answers the presigned request", async () => {
        const { handler, uploads, inner } = build()
        const result = await handler.execute(new CreateUploadIntentCommand({ request, principal }))
        expect(result).toEqual({
            kind: "ok",
            value: {
                uploadId: "u1",
                method: "PUT",
                url: "/uploads/u1/content",
                headers: [
                    { name: UPLOAD_TOKEN_HEADER, value: "signed" },
                    { name: "content-type", value: "text/plain" },
                ],
                expiresAt: EXPIRES,
            },
        })
        expect(uploads.createPending).toHaveBeenCalledWith({ manager: inner, ownerId: "owner-1", ...request, at: AT })
        expect(uploads.presign).toHaveBeenCalledWith({ uploadId: "u1", at: AT })
    })

    it("returns the intake refusal and mints no token", async () => {
        const refusal = { kind: "refused", code: UploadErrorCode.MimeNotAllowed, params: { mime: "application/x-msdownload" } }
        const { handler, uploads } = build(refusal)
        const result = await handler.execute(new CreateUploadIntentCommand({ request, principal }))
        expect(result).toEqual(refusal)
        expect(uploads.presign).not.toHaveBeenCalled()
    })
})
