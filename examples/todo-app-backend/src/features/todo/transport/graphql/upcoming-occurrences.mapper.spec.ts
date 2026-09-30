import { toUpcomingOccurrencesRequest, toUpcomingOccurrencesType } from "./upcoming-occurrences.mapper"

describe("upcoming-occurrences mapper", () => {
    it("maps the input to the request, leaving the preview length to the default", () => {
        expect(toUpcomingOccurrencesRequest({ ruleId: "r1" })).toEqual({ ruleId: "r1" })
    })

    it("maps the occurrence picture to the type", () => {
        const upcoming = {
            ruleId: "r1",
            materialised: [{ occurrenceId: "t1", localDate: "2026-09-17", dueAtUtc: "2026-09-17T02:00:00.000Z", status: "materialised" }],
            previewDates: ["2026-09-18", "2026-09-21"],
        }
        expect(toUpcomingOccurrencesType(upcoming)).toEqual(upcoming)
    })
})
