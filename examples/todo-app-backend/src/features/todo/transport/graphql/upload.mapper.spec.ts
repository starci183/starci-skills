import { toUploadType } from "./upload.mapper"

describe("upload mapper", () => {
    it("maps the summary to the type with the instant as an ISO string", () => {
        expect(
            toUploadType({
                uploadId: "u1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 3,
                status: "pending",
                createdAt: new Date("2026-09-30T10:00:00.000Z"),
            }),
        ).toEqual({
            uploadId: "u1",
            taskId: null,
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            status: "pending",
            createdAt: "2026-09-30T10:00:00.000Z",
        })
    })
})
