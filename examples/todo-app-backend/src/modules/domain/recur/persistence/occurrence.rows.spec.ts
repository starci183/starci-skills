import { toAffectedCount, toOccurrenceView } from "./occurrence.rows"

describe("occurrence rows", () => {
    it("maps a row to the view", () => {
        const dueAtUtc = new Date("2026-09-30T02:00:00.000Z")
        const row = { id: "t1", ruleId: "r1", windowKey: "r1:2026-09-30", localDate: "2026-09-30", dueAtUtc, status: "materialised" as const }
        expect(toOccurrenceView(row)).toEqual(row)
    })

    it("reads the affected count out of the [rows, rowCount] answer of an UPDATE", () => {
        expect(toAffectedCount([[{ id: "a" }], 1])).toBe(1)
        expect(toAffectedCount([[], 0])).toBe(0)
    })

    it("counts nothing for an answer of another shape", () => {
        expect(toAffectedCount([])).toBe(0)
        expect(toAffectedCount([[], "3"])).toBe(0)
        expect(toAffectedCount(undefined)).toBe(0)
    })
})
