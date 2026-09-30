import { toRequestErasureType } from "./request-erasure.mapper"

describe("request-erasure mapper", () => {
    it("maps the opened request to the type", () => {
        expect(toRequestErasureType({ requestId: "r1", state: "verified" })).toEqual({
            requestId: "r1",
            state: "verified",
        })
    })
})
