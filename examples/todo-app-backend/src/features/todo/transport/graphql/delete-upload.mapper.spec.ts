import { toDeleteUploadRequest, toDeleteUploadType } from "./delete-upload.mapper"

describe("delete-upload mapper", () => {
    it("maps the input to the request and the confirmation to the type", () => {
        expect(toDeleteUploadRequest({ uploadId: "u1" })).toEqual({ uploadId: "u1" })
        expect(toDeleteUploadType({ uploadId: "u1", deleted: true })).toEqual({ uploadId: "u1", deleted: true })
    })
})
