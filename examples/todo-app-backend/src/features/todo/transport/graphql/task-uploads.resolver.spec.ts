import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { UploadError, UploadErrorCode } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import { ListTaskUploadsQuery } from "../../application/list-task-uploads.query"
import { TaskUploadsResolver } from "./task-uploads.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("TaskUploadsResolver", () => {
    it("dispatches one query carrying the principal and answers the attachments", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "ok",
                value: {
                    uploads: [
                        {
                            uploadId: "u1",
                            taskId: "t1",
                            filename: "note.txt",
                            mime: "text/plain",
                            sizeBytes: 3,
                            status: "ready",
                            createdAt: new Date("2026-09-30T10:00:00.000Z"),
                        },
                    ],
                },
            }),
        })
        const result = await new TaskUploadsResolver(queryBus).taskUploads(principal, { taskId: "t1" })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ uploadId: "u1", taskId: "t1" })
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new ListTaskUploadsQuery({ request: { taskId: "t1" }, principal }))
    })

    it("turns the refusal of a task the caller does not own into the upload error", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({
                kind: "refused",
                code: UploadErrorCode.Forbidden,
                params: { taskId: "t1" },
            }),
        })
        const call = new TaskUploadsResolver(queryBus).taskUploads(principal, { taskId: "t1" })
        await expect(call).rejects.toBeInstanceOf(UploadError)
        await expect(call).rejects.toMatchObject({ code: UploadErrorCode.Forbidden, params: { taskId: "t1" } })
    })
})
