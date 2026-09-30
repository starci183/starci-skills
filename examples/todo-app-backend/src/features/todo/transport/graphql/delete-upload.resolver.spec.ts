import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { UploadError, UploadErrorCode } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteUploadCommand } from "../../application/delete-upload.command"
import { DeleteUploadResolver } from "./delete-upload.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("DeleteUploadResolver", () => {
    it("dispatches one delete command carrying the principal and confirms the deletion", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { uploadId: "u1", deleted: true } }),
        })
        const result = await new DeleteUploadResolver(commandBus).deleteUpload(principal, { uploadId: "u1" })
        expect(result).toEqual({ uploadId: "u1", deleted: true })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new DeleteUploadCommand({ request: { uploadId: "u1" }, principal }))
    })

    it("turns the refusal of a stranger upload into the upload error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "refused",
                code: UploadErrorCode.Forbidden,
                params: { uploadId: "u1" },
            }),
        })
        const call = new DeleteUploadResolver(commandBus).deleteUpload(principal, { uploadId: "u1" })
        await expect(call).rejects.toBeInstanceOf(UploadError)
        await expect(call).rejects.toMatchObject({ code: UploadErrorCode.Forbidden })
    })
})
