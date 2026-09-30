import { toAttachUploadRequest } from "./attach-upload.mapper"

describe("attach-upload mapper", () => {
    it("maps the input to the request", () => {
        expect(toAttachUploadRequest({ uploadId: "u1", taskId: "t1" })).toEqual({ uploadId: "u1", taskId: "t1" })
    })
})
