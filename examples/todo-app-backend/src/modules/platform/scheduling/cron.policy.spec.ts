import { cronMatches, parseCron } from "./cron.policy"

describe("parseCron", () => {
    it("parses steps, lists, ranges and wildcards", () => {
        const fields = parseCron("*/15 9-11 1,15 * *")
        expect(fields?.minute).toEqual(new Set([0, 15, 30, 45]))
        expect(fields?.hour).toEqual(new Set([9, 10, 11]))
        expect(fields?.dayOfMonth).toEqual(new Set([1, 15]))
        expect(fields?.month.size).toBe(12)
        expect(fields?.dayOfWeek.size).toBe(7)
    })

    it("refuses an expression with the wrong number of fields or an out-of-range value", () => {
        expect(parseCron("* * * *")).toBeNull()
        expect(parseCron("60 * * * *")).toBeNull()
        expect(parseCron("*/0 * * * *")).toBeNull()
        expect(parseCron("a * * * *")).toBeNull()
    })
})

describe("cronMatches", () => {
    const fields = parseCron("*/5 * * * *")

    it("matches a minute the expression admits", () => {
        expect(fields && cronMatches(fields, new Date("2026-09-30T10:05:30.000Z"))).toBe(true)
    })

    it("does not match a minute it does not admit", () => {
        expect(fields && cronMatches(fields, new Date("2026-09-30T10:06:00.000Z"))).toBe(false)
    })
})
