import {
    datesForRule 
} from "./calendar.util"

describe("calendar.util (br.recur.impossible-date.skips, sds.recur.generation-engine)",
    () => {
        it("ac.recur.impossible-date.skips.skips-nonexistent-day: a monthly-day-31 rule produces r3:2026-01-31 and r3:2026-03-31 but nothing for February 2026",
            () => {
                const dates = datesForRule(
                    {
                        frequency: "monthly-day", n: null, dayOfMonth: 31, startDate: "2026-01-01" 
                    },
                    "2026-01-01",
                    "2026-03-31",
                )
                expect(dates).toEqual(["2026-01-31",
                    "2026-03-31"])
                expect(dates.some(date => date.startsWith("2026-02"))).toBe(false)
                expect(dates).not.toContain("2026-02-28")
            })

        it("every-weekday never includes a Saturday or Sunday",
            () => {
                const dates = datesForRule({
                    frequency: "every-weekday", n: null, dayOfMonth: null, startDate: "2026-09-14" 
                },
                "2026-09-14",
                "2026-09-20")
                // 2026-09-14 is a Monday; the week runs Mon-Sun.
                expect(dates).toEqual(["2026-09-14",
                    "2026-09-15",
                    "2026-09-16",
                    "2026-09-17",
                    "2026-09-18"])
            })

        it("every-n-days fires every n days starting from the rule's own startDate",
            () => {
                const dates = datesForRule({
                    frequency: "every-n-days", n: 3, dayOfMonth: null, startDate: "2026-01-01" 
                },
                "2026-01-01",
                "2026-01-10")
                expect(dates).toEqual(["2026-01-01",
                    "2026-01-04",
                    "2026-01-07",
                    "2026-01-10"])
            })

        it("never produces a date before the rule's own startDate even when asked for an earlier range",
            () => {
                const dates = datesForRule({
                    frequency: "every-weekday", n: null, dayOfMonth: null, startDate: "2026-09-16" 
                },
                "2026-09-01",
                "2026-09-18")
                expect(dates.every(date => date >= "2026-09-16")).toBe(true)
                expect(dates).not.toContain("2026-09-14")
            })

        it("monthly-day-31 never substitutes the last day of a shorter month (clamp is rejected, per decision.recur.impossible-date)",
            () => {
                const dates = datesForRule({
                    frequency: "monthly-day", n: null, dayOfMonth: 31, startDate: "2026-04-01" 
                },
                "2026-04-01",
                "2026-04-30")
                expect(dates).toEqual([])
            })
    })
