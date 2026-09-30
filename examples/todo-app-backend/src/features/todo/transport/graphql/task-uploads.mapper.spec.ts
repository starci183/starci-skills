import { toTaskUploadsRequest, toTaskUploadsTypes } from "./task-uploads.mapper"

describe("task-uploads mapper", () => {
    it("maps the input to the request", () => {
        expect(toTaskUploadsRequest({ taskId: "t1" })).toEqual({ taskId: "t1" })
    })

    it("maps every attachment of the task and an empty task to an empty list", () => {
        const upload = {
            uploadId: "u1",
            taskId: "t1",
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            status: "ready" as const,
            createdAt: new Date("2026-09-30T10:00:00.000Z"),
        }
        expect(toTaskUploadsTypes({ uploads: [upload] })).toEqual([{ ...upload, createdAt: "2026-09-30T10:00:00.000Z" }])
        expect(toTaskUploadsTypes({ uploads: [] })).toEqual([])
    })
})
