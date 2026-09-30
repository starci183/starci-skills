import { toCompleteOccurrenceRequest, toCompleteOccurrenceType } from "./complete-occurrence.mapper"

describe("complete-occurrence mapper", () => {
    it("maps the input to the request and the completed occurrence to the type", () => {
        expect(toCompleteOccurrenceRequest({ occurrenceId: "t1" })).toEqual({ occurrenceId: "t1" })
        expect(toCompleteOccurrenceType({ occurrenceId: "t1", status: "completed" })).toEqual({ occurrenceId: "t1", status: "completed" })
    })
})
