import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import type { Request, Response } from "express"
import { mock } from "@starci/jest-preset/mock"
import { UploadError, UploadErrorCode } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptUploadContentCommand } from "../../application/accept-upload-content.command"
import { CreateDirectUploadCommand } from "../../application/create-direct-upload.command"
import { ReadUploadContentQuery } from "../../application/read-upload-content.query"
import { UploadController } from "./upload.controller"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const bytes = Buffer.from("hello")
const summary = {
    uploadId: "u1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    status: "ready",
    createdAt: new Date("2026-09-30T10:00:00.000Z"),
}
const stored = {
    uploadId: "u1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 5,
    status: "ready",
    createdAt: "2026-09-30T10:00:00.000Z",
}
const requestWith = (body: unknown): Request => mock<Request>({ body })

describe("UploadController", () => {
    describe("createDirectUpload", () => {
        it("dispatches one direct upload command with the raw bytes and the content type as media type", async () => {
            const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: summary }) })
            const controller = new UploadController(commandBus, mock<QueryBus>())
            const result = await controller.createDirectUpload(
                principal,
                { filename: "note.txt" },
                "text/plain; charset=utf-8",
                requestWith(bytes),
            )
            expect(result).toEqual(stored)
            expect(commandBus.execute).toHaveBeenCalledTimes(1)
            expect(commandBus.execute).toHaveBeenCalledWith(
                new CreateDirectUploadCommand({
                    request: { filename: "note.txt", mime: "text/plain", content: bytes },
                    principal,
                }),
            )
        })

        it("sends an empty file when the request carries no raw body, leaving the refusal to the intake rules", async () => {
            const commandBus = mock<CommandBus>({
                execute: jest.fn().mockResolvedValue({ kind: "refused", code: UploadErrorCode.TooLarge, params: { sizeBytes: 0 } }),
            })
            const controller = new UploadController(commandBus, mock<QueryBus>())
            const call = controller.createDirectUpload(principal, {}, "application/json", requestWith({ parsed: true }))
            await expect(call).rejects.toBeInstanceOf(UploadError)
            expect(commandBus.execute).toHaveBeenCalledWith(
                new CreateDirectUploadCommand({
                    request: { filename: "file", mime: "application/json", content: Buffer.alloc(0) },
                    principal,
                }),
            )
        })
    })

    describe("putContent", () => {
        it("dispatches one accept command with the token header and no principal", async () => {
            const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: summary }) })
            const controller = new UploadController(commandBus, mock<QueryBus>())
            const result = await controller.putContent({ uploadId: "u1" }, "signed", requestWith(bytes))
            expect(result).toEqual(stored)
            expect(commandBus.execute).toHaveBeenCalledTimes(1)
            expect(commandBus.execute).toHaveBeenCalledWith(
                new AcceptUploadContentCommand({ request: { uploadId: "u1", token: "signed", content: bytes } }),
            )
        })

        it("turns a token refusal into the upload error carrying the reason", async () => {
            const params = { uploadId: "u1", reason: "expired" }
            const commandBus = mock<CommandBus>({
                execute: jest.fn().mockResolvedValue({ kind: "refused", code: UploadErrorCode.TokenInvalid, params }),
            })
            const call = new UploadController(commandBus, mock<QueryBus>()).putContent(
                { uploadId: "u1" },
                "old",
                requestWith(bytes),
            )
            await expect(call).rejects.toBeInstanceOf(UploadError)
            await expect(call).rejects.toMatchObject({ code: UploadErrorCode.TokenInvalid, params })
        })
    })

    describe("download", () => {
        it("dispatches one read query, sets the stored media type and file name and streams the bytes", async () => {
            const queryBus = mock<QueryBus>({
                execute: jest.fn().mockResolvedValue({
                    kind: "ok",
                    value: { filename: "note.txt", mime: "text/plain", content: bytes },
                }),
            })
            const response = mock<Response>({ setHeader: jest.fn() })
            const controller = new UploadController(mock<CommandBus>(), queryBus)
            const streamed = await controller.download(principal, { uploadId: "u1" }, response)
            expect(queryBus.execute).toHaveBeenCalledTimes(1)
            expect(queryBus.execute).toHaveBeenCalledWith(
                new ReadUploadContentQuery({ request: { uploadId: "u1" }, principal }),
            )
            expect(response.setHeader).toHaveBeenCalledWith("content-type", "text/plain")
            expect(response.setHeader).toHaveBeenCalledWith("content-disposition", 'attachment; filename="note.txt"')
            expect(response.setHeader).toHaveBeenCalledWith("content-length", "5")
            expect(streamed.getStream().read()).toEqual(bytes)
        })

        it("sets no header and streams nothing when the read is refused", async () => {
            const queryBus = mock<QueryBus>({
                execute: jest.fn().mockResolvedValue({
                    kind: "refused",
                    code: UploadErrorCode.Forbidden,
                    params: { uploadId: "u1" },
                }),
            })
            const response = mock<Response>({ setHeader: jest.fn() })
            const call = new UploadController(mock<CommandBus>(), queryBus).download(principal, { uploadId: "u1" }, response)
            await expect(call).rejects.toMatchObject({ code: UploadErrorCode.Forbidden })
            expect(response.setHeader).not.toHaveBeenCalled()
        })
    })
})
