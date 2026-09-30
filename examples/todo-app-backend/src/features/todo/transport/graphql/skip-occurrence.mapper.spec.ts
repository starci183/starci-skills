import { toSkipOccurrenceRequest, toSkipOccurrenceType } from "./skip-occurrence.mapper"

describe("skip-occurrence mapper", () => {
    it("maps the input to the request and the skipped occurrence to the type", () => {
        expect(toSkipOccurrenceRequest({ occurrenceId: "t1" })).toEqual({ occurrenceId: "t1" })
        expect(toSkipOccurrenceType({ occurrenceId: "t1", status: "skipped" })).toEqual({ occurrenceId: "t1", status: "skipped" })
    })
})
