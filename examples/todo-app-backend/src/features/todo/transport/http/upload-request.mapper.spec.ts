import {
    toAcceptUploadContentRequest,
    toDirectUploadRequest,
    toReadUploadContentRequest,
} from "./upload-request.mapper"

const content = Buffer.from("bytes")

describe("upload request mapper", () => {
    it("takes the media type of the direct upload from the content type without its parameters", () => {
        expect(toDirectUploadRequest({ filename: "note.txt" }, "text/plain; charset=utf-8", content)).toEqual({
            filename: "note.txt",
            mime: "text/plain",
            content,
        })
    })

    it("names an unnamed file file and sends an empty media type when the content type is missing", () => {
        expect(toDirectUploadRequest({}, undefined, content)).toEqual({ filename: "file", mime: "", content })
    })

    it("maps the presigned content request with the token header", () => {
        expect(toAcceptUploadContentRequest({ uploadId: "u1" }, "signed", content)).toEqual({
            uploadId: "u1",
            token: "signed",
            content,
        })
        expect(toAcceptUploadContentRequest({ uploadId: "u1" }, undefined, content).token).toBeUndefined()
    })

    it("maps the download request", () => {
        expect(toReadUploadContentRequest({ uploadId: "u1" })).toEqual({ uploadId: "u1" })
    })
})
