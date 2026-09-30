import { mock } from "@starci/jest-preset/mock"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { GeneratorService } from "./generator.service"
import type { OccurrenceService } from "./occurrence.service"
import { RuleFrequency } from "./recur.contracts"
import type { RuleView } from "./recur.contracts"
import type { RuleService } from "./rule.service"

const weekday: RuleView = {
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-14",
    endedAt: null,
}

// 2026-09-18 is a Friday; 12:00Z is 19:00 in Ho Chi Minh, the same calendar day.
const FRIDAY = new Date("2026-09-18T12:00:00.000Z")

interface Rig {
    readonly generator: GeneratorService
    readonly rules: RuleService
    readonly occurrences: OccurrenceService
}

const build = (batches: ReadonlyArray<Array<RuleView>>, existing: ReadonlyArray<string> = []): Rig => {
    const listBatch = jest.fn()
    for (const batch of batches) listBatch.mockResolvedValueOnce(batch)
    const rules = mock<RuleService>({ listBatch })
    const occurrences = mock<OccurrenceService>({
        existingWindowKeys: jest.fn().mockResolvedValue(new Set(existing)),
    })
    return { generator: new GeneratorService(rules, occurrences), rules, occurrences }
}

describe("GeneratorService", () => {
    it("owes one occurrence per weekday between the start date and today, skipping weekends, resolved in the zone of the rule", async () => {
        const { generator } = build([[weekday]])
        const due = await generator.collectDue({ now: FRIDAY, limit: 100 })
        expect(due.map((entry) => entry.localDate)).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"])
        expect(due[0]).toEqual({
            ruleId: "r1",
            ownerId: "o1",
            title: "Stand-up",
            windowKey: "r1:2026-09-14",
            localDate: "2026-09-14",
            dueAtUtc: new Date("2026-09-14T02:00:00.000Z"),
        })
    })

    it("does not owe a window that already has an occurrence, so running twice creates no second one", async () => {
        const { generator, occurrences } = build([[weekday]], ["r1:2026-09-14", "r1:2026-09-15", "r1:2026-09-16"])
        const due = await generator.collectDue({ now: FRIDAY, limit: 100 })
        expect(due.map((entry) => entry.localDate)).toEqual(["2026-09-17", "2026-09-18"])
        expect(occurrences.existingWindowKeys).toHaveBeenCalledWith({
            windowKeys: ["r1:2026-09-14", "r1:2026-09-15", "r1:2026-09-16", "r1:2026-09-17", "r1:2026-09-18"],
        })
    })

    it("backfills every missed date on the first run", async () => {
        const { generator } = build([[{ ...weekday, startDate: "2026-09-01" }]])
        const due = await generator.collectDue({ now: FRIDAY, limit: 100 })
        expect(due).toHaveLength(14)
    })

    it("skips the months that lack the day of a monthly-day-31 rule", async () => {
        const monthly: RuleView = { ...weekday, frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31, startDate: "2026-01-01" }
        const { generator } = build([[monthly]])
        const due = await generator.collectDue({ now: new Date("2026-03-31T12:00:00.000Z"), limit: 100 })
        expect(due.map((entry) => entry.localDate)).toEqual(["2026-01-31", "2026-03-31"])
    })

    it("never owes an occurrence dated after the day an ended rule ended", async () => {
        const { generator } = build([[{ ...weekday, endedAt: "2026-09-16" }]])
        const due = await generator.collectDue({ now: FRIDAY, limit: 100 })
        expect(due.map((entry) => entry.localDate)).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"])
    })

    it("reads today from the zone of the rule: 23:30Z on Sunday is already Monday in Ho Chi Minh", async () => {
        const { generator } = build([[weekday]])
        const due = await generator.collectDue({ now: new Date("2026-09-20T23:30:00.000Z"), limit: 100 })
        expect(due.map((entry) => entry.localDate)).toContain("2026-09-21")
    })

    it("stops at the limit and leaves the rest for the next tick", async () => {
        const { generator, rules } = build([[weekday, { ...weekday, id: "r2" }]])
        const due = await generator.collectDue({ now: FRIDAY, limit: 6 })
        expect(due).toHaveLength(6)
        expect(due.filter((entry) => entry.ruleId === "r2")).toHaveLength(1)
        expect(rules.listBatch).toHaveBeenCalledTimes(1)
    })

    it("walks the batches of rules until a short batch", async () => {
        const full = Array.from({ length: LIST_ROWS_MAX }, (_unused, index) => ({ ...weekday, id: `a${index}`, startDate: "2026-09-18" }))
        const { generator, rules } = build([full, [{ ...weekday, id: "z1", startDate: "2026-09-18" }]])
        const due = await generator.collectDue({ now: FRIDAY, limit: LIST_ROWS_MAX + 10 })
        expect(due).toHaveLength(LIST_ROWS_MAX + 1)
        expect(rules.listBatch).toHaveBeenNthCalledWith(1, { after: null })
        expect(rules.listBatch).toHaveBeenNthCalledWith(2, { after: `a${LIST_ROWS_MAX - 1}` })
    })

    it("owes nothing when there are no rules", async () => {
        const { generator } = build([[]])
        await expect(generator.collectDue({ now: FRIDAY, limit: 100 })).resolves.toEqual([])
    })
})
