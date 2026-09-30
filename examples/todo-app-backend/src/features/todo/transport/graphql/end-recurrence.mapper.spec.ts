import { toEndRecurrenceRequest, toEndRecurrenceType } from "./end-recurrence.mapper"

describe("end-recurrence mapper", () => {
    it("maps the input to the request and the ended rule to the type", () => {
        expect(toEndRecurrenceRequest({ ruleId: "r1", endedAt: "2026-09-20" })).toEqual({ ruleId: "r1", endedAt: "2026-09-20" })
        const ended = { ruleId: "r1", endedAt: "2026-09-20", orphanedCount: 2 }
        expect(toEndRecurrenceType(ended)).toEqual(ended)
    })
})
