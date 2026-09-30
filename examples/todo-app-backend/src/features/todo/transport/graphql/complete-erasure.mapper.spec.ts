import { toCompleteErasureRequest, toCompleteErasureType } from "./complete-erasure.mapper"

describe("complete-erasure mapper", () => {
    it("maps the input to the request and the completed request to the type", () => {
        expect(toCompleteErasureRequest({ requestId: "r1" })).toEqual({ requestId: "r1" })
        expect(toCompleteErasureType({ requestId: "r1", state: "complete" })).toEqual({
            requestId: "r1",
            state: "complete",
        })
    })
})
