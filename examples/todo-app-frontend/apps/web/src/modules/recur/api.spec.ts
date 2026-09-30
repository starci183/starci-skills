import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "@/modules/api"
import { endRecurrence, makeRecurring, readUpcomingOccurrences } from "./api"

vi.mock("@/modules/api", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("@/modules/api")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("recur api", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("makeRecurring sends the input under the MakeRecurring document with the caller's token", async () => {
        const made = { ruleId: "r-1", title: "Water", frequency: "EveryWeekday", timeZone: "Asia/Bangkok", time: "09:00", startDate: "2026-09-21" }
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: made })
        const input = { title: "Water", frequency: "EveryWeekday", timeZone: "Asia/Bangkok", time: "09:00", startDate: "2026-09-21" }

        await expect(makeRecurring("tok-1", input)).resolves.toEqual({ ok: true, data: made })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("makeRecurring"), { input }, "tok-1")
    })

    it("readUpcomingOccurrences asks for the rule's occurrences by ruleId", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { materialised: [], previewDates: ["2026-09-22"] } })

        await expect(readUpcomingOccurrences("tok-1", "r-1")).resolves.toEqual({ ok: true, data: { materialised: [], previewDates: ["2026-09-22"] } })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("upcomingOccurrences"), { ruleId: "r-1" }, "tok-1")
    })

    it("endRecurrence sends the rule and its end date and hands a refusal back as a Result", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "refused", code: "RECUR_RULE_ENDED" })

        await expect(endRecurrence("tok-1", "r-1", "2026-09-30")).resolves.toEqual({ ok: false, reason: "refused", code: "RECUR_RULE_ENDED" })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("endRecurrence"), { input: { ruleId: "r-1", endedAt: "2026-09-30" } }, "tok-1")
    })
})
