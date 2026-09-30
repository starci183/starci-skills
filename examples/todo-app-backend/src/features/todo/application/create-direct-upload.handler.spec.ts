import type { CommandBus } from "@nestjs/cqrs"
import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AcceptUploadContentCommand } from "./accept-upload-content.command"
import { CreateDirectUploadCommand } from "./create-direct-upload.command"
import { CreateDirectUploadHandler } from "./create-direct-upload.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const content = Buffer.from("hello")
const pending: UploadView = {
    id: "u1",
    owner: "owner-1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    storageKey: "uploads/u1",
    status: "pending",
    createdAt: AT,
}
const summary = {
    uploadId: "u1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    status: "ready",
    createdAt: AT,
}
const command = new CreateDirectUploadCommand({ request: { filename: "note.txt", mime: "text/plain", content }, principal })

const build = (
    created: unknown = { kind: "ok", value: pending },
): {
    handler: CreateDirectUploadHandler
    uploads: UploadService
    commandBus: CommandBus
    inner: ReturnType<typeof mockEntityManager>
} => {
    const inner = mockEntityManager()
    const uploads = mock<UploadService>({
        createPending: jest.fn().mockResolvedValue(created),
        presign: jest.fn().mockReturnValue({ token: "fresh", expiresAt: AT }),
    })
    const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: summary }) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new CreateDirectUploadHandler(mock<Logger>(), entityManager, new FakeClock(AT), commandBus, uploads)
    return { handler, uploads, commandBus, inner }
}

describe("CreateDirectUploadHandler", () => {
    it("writes the pending row with the received size, then has the content accepted with a fresh token", async () => {
        const { handler, uploads, commandBus, inner } = build()
        const result = await handler.execute(command)
        expect(result).toEqual({ kind: "ok", value: summary })
        expect(uploads.createPending).toHaveBeenCalledWith({
            manager: inner,
            ownerId: "owner-1",
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 5,
            at: AT,
        })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new AcceptUploadContentCommand({ request: { uploadId: "u1", token: "fresh", content } }),
        )
    })

    it("returns the intake refusal and stores nothing", async () => {
        const refusal = { kind: "refused", code: UploadErrorCode.TooLarge, params: { sizeBytes: 5, maxBytes: 4 } }
        const { handler, commandBus } = build(refusal)
        await expect(handler.execute(command)).resolves.toEqual(refusal)
        expect(commandBus.execute).not.toHaveBeenCalled()
    })

    it("answers the refusal of the content step as it is", async () => {
        const { handler, commandBus } = build()
        const scanRejected = { kind: "refused", code: UploadErrorCode.ScanRejected, params: { uploadId: "u1" } }
        jest.mocked(commandBus.execute).mockResolvedValue(scanRejected)
        await expect(handler.execute(command)).resolves.toEqual(scanRejected)
    })
})
