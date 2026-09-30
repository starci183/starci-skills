import { describe, expect, it } from "vitest"
import { todayInZone, validateDraft, WIRE_FREQUENCY } from "./recur.shared"

const messages = {
    n: "n refused",
    dayOfMonth: "day refused",
    time: "time refused",
    timeZone: "zone refused",
    startDate: "date refused",
}

const draft = {
    frequency: "every-weekday" as const,
    n: "",
    dayOfMonth: "",
    time: "09:00",
    timeZone: "Asia/Bangkok",
    startDate: "2026-09-21",
}

describe("validateDraft", () => {
    it("accepts a complete every-weekday draft", () => {
        expect(validateDraft(draft, messages)).toBeNull()
    })

    it("names the n field for an every-n-days draft without a positive integer", () => {
        expect(validateDraft({ ...draft, frequency: "every-n-days", n: "0" }, messages)).toEqual({ field: "n", message: "n refused" })
        expect(validateDraft({ ...draft, frequency: "every-n-days", n: "3" }, messages)).toBeNull()
    })

    it("names the dayOfMonth field for a monthly-day draft outside 1..31", () => {
        expect(validateDraft({ ...draft, frequency: "monthly-day", dayOfMonth: "32" }, messages)).toEqual({ field: "dayOfMonth", message: "day refused" })
        expect(validateDraft({ ...draft, frequency: "monthly-day", dayOfMonth: "31" }, messages)).toBeNull()
    })

    it("names the first failing field in form order: time, then zone, then start date", () => {
        expect(validateDraft({ ...draft, time: "9:00", timeZone: "", startDate: "x" }, messages)?.field).toBe("time")
        expect(validateDraft({ ...draft, timeZone: " ", startDate: "x" }, messages)?.field).toBe("timeZone")
        expect(validateDraft({ ...draft, startDate: "21/09/2026" }, messages)?.field).toBe("startDate")
    })
})

describe("WIRE_FREQUENCY", () => {
    it("maps each domain frequency to its GraphQL enum literal", () => {
        expect(WIRE_FREQUENCY).toEqual({ "every-weekday": "EveryWeekday", "every-n-days": "EveryNDays", "monthly-day": "MonthlyDay" })
    })
})

describe("todayInZone", () => {
    it("shapes the local date as YYYY-MM-DD", () => {
        expect(todayInZone("Asia/Bangkok")).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
})
