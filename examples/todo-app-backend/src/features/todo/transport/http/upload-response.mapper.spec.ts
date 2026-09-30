import { toDownloadHeaders, toUploadResponse } from "./upload-response.mapper"

describe("upload response mapper", () => {
    it("maps the summary with the instant as an ISO string", () => {
        expect(
            toUploadResponse({
                uploadId: "u1",
                taskId: null,
                filename: "note.txt",
                mime: "text/plain",
                sizeBytes: 3,
                status: "ready",
                createdAt: new Date("2026-09-30T10:00:00.000Z"),
            }),
        ).toEqual({
            uploadId: "u1",
            taskId: null,
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
            status: "ready",
            createdAt: "2026-09-30T10:00:00.000Z",
        })
    })

    it("builds the download headers from the stored media type, file name and length", () => {
        expect(toDownloadHeaders({ filename: "note.txt", mime: "text/plain", content: Buffer.from("hello") })).toEqual({
            "content-type": "text/plain",
            "content-disposition": 'attachment; filename="note.txt"',
            "content-length": "5",
        })
    })

    it("strips quotes and line breaks from the file name so it cannot break the header", () => {
        const headers = toDownloadHeaders({ filename: 'a"b\r\nc.txt', mime: "text/plain", content: Buffer.from("x") })
        expect(headers["content-disposition"]).toBe('attachment; filename="abc.txt"')
    })
})
