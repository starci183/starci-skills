import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { UploadError, UploadErrorCode } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import { CreateUploadIntentCommand } from "../../application/create-upload-intent.command"
import { CreateUploadIntentResolver } from "./create-upload-intent.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const input = { filename: "note.txt", mime: "text/plain", sizeBytes: 3 }

describe("CreateUploadIntentResolver", () => {
    it("dispatches one command carrying the principal and answers the presigned request", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "ok",
                value: {
                    uploadId: "u1",
                    method: "PUT",
                    url: "/uploads/u1/content",
                    headers: [{ name: "x-upload-token", value: "signed" }],
                    expiresAt: new Date("2026-09-30T10:05:00.000Z"),
                },
            }),
        })
        const result = await new CreateUploadIntentResolver(commandBus).createUploadIntent(principal, input)
        expect(result).toMatchObject({ uploadId: "u1", method: "PUT", expiresAt: "2026-09-30T10:05:00.000Z" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new CreateUploadIntentCommand({ request: input, principal }))
    })

    it("turns an intake refusal into the upload error carrying its params", async () => {
        const params = { mime: "application/x-msdownload" }
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: UploadErrorCode.MimeNotAllowed, params }),
        })
        const call = new CreateUploadIntentResolver(commandBus).createUploadIntent(principal, input)
        await expect(call).rejects.toBeInstanceOf(UploadError)
        await expect(call).rejects.toMatchObject({ code: UploadErrorCode.MimeNotAllowed, params })
    })
})
