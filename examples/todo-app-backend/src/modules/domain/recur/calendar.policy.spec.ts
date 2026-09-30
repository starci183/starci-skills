import { addDays, datesForRule, daysBetween, shapeProblemOf } from "./calendar.policy"
import { RuleFrequency } from "./recur.contracts"

describe("calendar policy", () => {
    describe("datesForRule", () => {
        it("skips a month that lacks the day: monthly-day-31 fires in January and March 2026 but not in February", () => {
            const dates = datesForRule(
                { frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 31, startDate: "2026-01-01" },
                "2026-01-01",
                "2026-03-31",
            )
            expect(dates).toEqual(["2026-01-31", "2026-03-31"])
        })

        it("never substitutes the last day of a shorter month", () => {
            const dates = datesForRule(
                { frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 31, startDate: "2026-04-01" },
                "2026-04-01",
                "2026-04-30",
            )
            expect(dates).toEqual([])
        })

        it("never includes a Saturday or a Sunday for every-weekday", () => {
            const dates = datesForRule(
                { frequency: RuleFrequency.EveryWeekday, n: null, dayOfMonth: null, startDate: "2026-09-14" },
                "2026-09-14",
                "2026-09-20",
            )
            expect(dates).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"])
        })

        it("fires every n days counting from the own start date", () => {
            const dates = datesForRule(
                { frequency: RuleFrequency.EveryNDays, n: 3, dayOfMonth: null, startDate: "2026-01-01" },
                "2026-01-01",
                "2026-01-10",
            )
            expect(dates).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"])
        })

        it("never produces a date before the start date even when asked for an earlier range", () => {
            const dates = datesForRule(
                { frequency: RuleFrequency.EveryWeekday, n: null, dayOfMonth: null, startDate: "2026-09-16" },
                "2026-09-01",
                "2026-09-18",
            )
            expect(dates).toEqual(["2026-09-16", "2026-09-17", "2026-09-18"])
        })

        it("answers nothing when the range ends before it starts", () => {
            const rule = { frequency: RuleFrequency.EveryWeekday, n: null, dayOfMonth: null, startDate: "2026-09-16" }
            expect(datesForRule(rule, "2026-09-10", "2026-09-15")).toEqual([])
        })
    })

    describe("date arithmetic", () => {
        it("adds days across a month and a year boundary on the real calendar", () => {
            expect(addDays("2026-02-27", 2)).toBe("2026-03-01")
            expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
            expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59)
        })
    })

    describe("shapeProblemOf", () => {
        it("requires a positive integer n and forbids a day of month for every-n-days", () => {
            expect(shapeProblemOf(RuleFrequency.EveryNDays, 2, null)).toBeNull()
            expect(shapeProblemOf(RuleFrequency.EveryNDays, null, null)).toBe("n-required")
            expect(shapeProblemOf(RuleFrequency.EveryNDays, 0, null)).toBe("n-required")
            expect(shapeProblemOf(RuleFrequency.EveryNDays, 1.5, null)).toBe("n-required")
            expect(shapeProblemOf(RuleFrequency.EveryNDays, 2, 5)).toBe("day-of-month-forbidden")
        })

        it("requires a day of month from 1 to 31 and forbids n for monthly-day, and accepts the 31st", () => {
            expect(shapeProblemOf(RuleFrequency.MonthlyDay, null, 31)).toBeNull()
            expect(shapeProblemOf(RuleFrequency.MonthlyDay, null, null)).toBe("day-of-month-required")
            expect(shapeProblemOf(RuleFrequency.MonthlyDay, null, 0)).toBe("day-of-month-required")
            expect(shapeProblemOf(RuleFrequency.MonthlyDay, null, 32)).toBe("day-of-month-required")
            expect(shapeProblemOf(RuleFrequency.MonthlyDay, 3, 10)).toBe("n-forbidden")
        })

        it("forbids both fields for every-weekday", () => {
            expect(shapeProblemOf(RuleFrequency.EveryWeekday, null, undefined)).toBeNull()
            expect(shapeProblemOf(RuleFrequency.EveryWeekday, 2, null)).toBe("n-forbidden")
            expect(shapeProblemOf(RuleFrequency.EveryWeekday, null, 2)).toBe("day-of-month-forbidden")
        })
    })
})
