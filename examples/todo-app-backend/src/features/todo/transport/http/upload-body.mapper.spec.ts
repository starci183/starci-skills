import { toUploadBody } from "./upload-body.mapper"

describe("toUploadBody", () => {
    it("answers the buffer the raw-body middleware put on the request", () => {
        const body = Buffer.from("bytes")
        expect(toUploadBody(body)).toBe(body)
    })

    it("answers null for a body that is not a buffer", () => {
        expect(toUploadBody(undefined)).toBeNull()
        expect(toUploadBody({})).toBeNull()
        expect(toUploadBody("text")).toBeNull()
        expect(toUploadBody([1, 2, 3])).toBeNull()
    })
})
