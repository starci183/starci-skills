import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { OccurrenceService, OccurrenceView, RuleService, RuleView } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { UpcomingOccurrencesHandler } from "./upcoming-occurrences.handler"
import { UpcomingOccurrencesQuery } from "./upcoming-occurrences.query"

// 2026-09-18 is a Friday, 12:00Z is 19:00 in Ho Chi Minh, the same calendar day.
const NOW = new Date("2026-09-18T12:00:00.000Z")
const principal: Principal = { id: "o1", roles: ["member"] }
const rule: RuleView = {
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-01",
    endedAt: null,
}
const stored: OccurrenceView = {
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-17",
    localDate: "2026-09-17",
    dueAtUtc: new Date("2026-09-17T02:00:00.000Z"),
    status: "materialised",
}

const build = (found: RuleView | null): { handler: UpcomingOccurrencesHandler; occurrences: OccurrenceService } => {
    const rules = mock<RuleService>({ find: jest.fn().mockResolvedValue(found) })
    const occurrences = mock<OccurrenceService>({ listByRule: jest.fn().mockResolvedValue([stored]) })
    return { handler: new UpcomingOccurrencesHandler(mock<Logger>(), new FakeClock(NOW), rules, occurrences), occurrences }
}

describe("UpcomingOccurrencesHandler", () => {
    it("lists the materialised occurrences and previews the next dates, never landing on a weekend", async () => {
        const { handler, occurrences } = build(rule)
        const result = await handler.execute(new UpcomingOccurrencesQuery({ request: { ruleId: "r1", previewDays: 7 }, principal }))
        expect(result).toEqual({
            kind: "ok",
            value: {
                ruleId: "r1",
                materialised: [
                    { occurrenceId: "t1", localDate: "2026-09-17", dueAtUtc: "2026-09-17T02:00:00.000Z", status: "materialised" },
                ],
                previewDates: ["2026-09-18", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"],
            },
        })
        expect(occurrences.listByRule).toHaveBeenCalledWith({ ruleId: "r1" })
    })

    it("previews 14 days ahead by default", async () => {
        const { handler } = build(rule)
        const result = await handler.execute(new UpcomingOccurrencesQuery({ request: { ruleId: "r1" }, principal }))
        expect(result).toMatchObject({ kind: "ok", value: { previewDates: expect.arrayContaining(["2026-09-18", "2026-10-01"]) } })
    })

    it("shows an ended rule no preview, only its history", async () => {
        const { handler } = build({ ...rule, endedAt: "2026-09-16" })
        const result = await handler.execute(new UpcomingOccurrencesQuery({ request: { ruleId: "r1" }, principal }))
        expect(result).toMatchObject({ kind: "ok", value: { previewDates: [], materialised: [expect.objectContaining({ occurrenceId: "t1" })] } })
    })

    it("refuses a caller who is not the owner and reads no occurrences", async () => {
        const { handler, occurrences } = build(rule)
        const result = await handler.execute(
            new UpcomingOccurrencesQuery({ request: { ruleId: "r1" }, principal: { id: "stranger", roles: ["member"] } }),
        )
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleForbidden })
        expect(occurrences.listByRule).not.toHaveBeenCalled()
    })

    it("refuses an unknown rule", async () => {
        const { handler } = build(null)
        const result = await handler.execute(new UpcomingOccurrencesQuery({ request: { ruleId: "nope" }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleNotFound })
    })
})
