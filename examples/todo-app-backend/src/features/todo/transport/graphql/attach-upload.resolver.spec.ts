import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { UploadError, UploadErrorCode } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import { AttachUploadCommand } from "../../application/attach-upload.command"
import { AttachUploadResolver } from "./attach-upload.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const input = { uploadId: "u1", taskId: "t1" }

describe("AttachUploadResolver", () => {
    it("dispatches one attach command carrying the principal and answers the attached upload", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "ok",
                value: {
                    uploadId: "u1",
                    taskId: "t1",
                    filename: "note.txt",
                    mime: "text/plain",
                    sizeBytes: 3,
                    status: "ready",
                    createdAt: new Date("2026-09-30T10:00:00.000Z"),
                },
            }),
        })
        const result = await new AttachUploadResolver(commandBus).attachUpload(principal, input)
        expect(result).toMatchObject({ uploadId: "u1", taskId: "t1", status: "ready" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new AttachUploadCommand({ request: input, principal }))
    })

    it("turns the refusal of a task that is not the caller into the upload error carrying the task id", async () => {
        const params = { taskId: "t1" }
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: UploadErrorCode.Forbidden, params }),
        })
        const call = new AttachUploadResolver(commandBus).attachUpload(principal, input)
        await expect(call).rejects.toBeInstanceOf(UploadError)
        await expect(call).rejects.toMatchObject({ code: UploadErrorCode.Forbidden, params })
    })
})
