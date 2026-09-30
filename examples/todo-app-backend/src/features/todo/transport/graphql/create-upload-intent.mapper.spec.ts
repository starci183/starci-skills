import { toCreateUploadIntentRequest, toCreateUploadIntentType } from "./create-upload-intent.mapper"

describe("create-upload-intent mapper", () => {
    it("maps the input to the request", () => {
        expect(toCreateUploadIntentRequest({ filename: "note.txt", mime: "text/plain", sizeBytes: 3 })).toEqual({
            filename: "note.txt",
            mime: "text/plain",
            sizeBytes: 3,
        })
    })

    it("maps the intent to the type with the headers as a list and the expiry as an ISO instant", () => {
        const type = toCreateUploadIntentType({
            uploadId: "u1",
            method: "PUT",
            url: "/uploads/u1/content",
            headers: [
                { name: "x-upload-token", value: "signed" },
                { name: "content-type", value: "text/plain" },
            ],
            expiresAt: new Date("2026-09-30T10:05:00.000Z"),
        })
        expect(type).toEqual({
            uploadId: "u1",
            method: "PUT",
            url: "/uploads/u1/content",
            headers: [
                { name: "x-upload-token", value: "signed" },
                { name: "content-type", value: "text/plain" },
            ],
            expiresAt: "2026-09-30T10:05:00.000Z",
        })
    })
})
