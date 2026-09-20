import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { RecurPage } from "@/components/pages/RecurPage"
import { renderJourney, resetJourneyWorld, seedSession, serveGraphQL, type Wire, type WireRoute } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn(), search: "?task=Water the plants" }))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
    useSearchParams: () => new URLSearchParams(mocks.search),
}))

const TASK_TITLE = "Water the plants"

/** The wire answers a working backend gives the schedule screen's three operations. */
const scheduleWorld = (overrides: Readonly<Record<string, WireRoute>> = {}): Wire => {
    seedSession("tok-recur")
    return serveGraphQL({
        makeRecurring: {
            data: {
                ruleId: "rule-1",
                title: TASK_TITLE,
                frequency: "EveryNDays",
                timeZone: "Asia/Bangkok",
                time: "09:00",
                startDate: "2026-09-21",
            },
        },
        upcomingOccurrences: {
            data: {
                ruleId: "rule-1",
                materialised: [{ occurrenceId: "occ-1", localDate: "2026-09-19", dueAtUtc: "2026-09-19T02:00:00Z", status: "materialised" }],
                previewDates: ["2026-09-21", "2026-09-23"],
            },
        },
        endRecurrence: { data: { ruleId: "rule-1", endedAt: "2026-09-20", orphanedCount: 0 } },
        ...overrides,
    })
}

/** The draft the direction's refused frame retains: every-n-days with an n of zero. */
const fillEveryNDaysDraft = (n: string) => {
    fireEvent.click(screen.getByRole("radio", { name: "Every N days" }))
    fireEvent.change(screen.getByLabelText("Every (days)"), { target: { value: n } })
    fireEvent.change(screen.getByLabelText("Time of day"), { target: { value: "09:00" } })
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Asia/Bangkok" } })
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-09-21" } })
}

/** Drive the screen through a valid save so it stands in its active state. */
const reachActive = async (wire: Wire) => {
    fillEveryNDaysDraft("2")
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))
    await waitFor(() => expect(screen.getByText("Upcoming occurrences")).toBeInTheDocument())
    return wire
}

/**
 * The journey `recur/uat/make-recurring` walks on this screen: the owner opens a task's schedule,
 * drafts the repeat rule, sees the upcoming occurrences once the rule is saved, and ends the rule
 * in place. Mounted at the route's own page half, so the `?task=` binding, the connected block's
 * draft validation, the recur transport and the GraphQL fetcher run in the order a reader's
 * browser runs them.
 */
describe("ui.recur.schedule journey: the served schedule screen over the real transport", () => {
    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
        mocks.search = "?task=Water the plants"
    })

    it("no-rule: a fresh visit draws only the make-recurring form and sends nothing", async () => {
        const wire = scheduleWorld()
        renderJourney(<RecurPage />)

        await waitFor(() => expect(screen.getByRole("radio", { name: "Every N days" })).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Save schedule" })).toBeInTheDocument()
        expect(screen.queryByText("Upcoming occurrences")).not.toBeInTheDocument()
        expect(wire.calls).toHaveLength(0)
    })

    it("refused: an impossible interval is named under its field and no write ever leaves", async () => {
        const wire = scheduleWorld()
        renderJourney(<RecurPage />)
        await waitFor(() => expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).not.toBe(""))
        fillEveryNDaysDraft("0")

        fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enter a number of days greater than zero."))
        // The refused frame keeps every submitted value, exactly as fr.recur.make-recurring asks.
        expect(screen.getByLabelText("Every (days)")).toHaveValue("0")
        expect(screen.getByLabelText("Start date")).toHaveValue("2026-09-21")
        expect(wire.callsFor("makeRecurring")).toHaveLength(0)
    })

    it("active: a valid draft reaches makeRecurring under the reader's session, then the upcoming read", async () => {
        const wire = scheduleWorld()
        renderJourney(<RecurPage />)
        await waitFor(() => expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).not.toBe(""))
        fillEveryNDaysDraft("2")

        fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))

        await waitFor(() => expect(screen.getByText("Upcoming occurrences")).toBeInTheDocument())
        const write = wire.callsFor("makeRecurring")[0]
        expect(write.token).toBe("tok-recur")
        // The enum travels under the schema's own literal; the kebab-case is the domain spelling.
        expect(write.variables).toEqual({
            input: {
                title: TASK_TITLE,
                frequency: "EveryNDays",
                n: 2,
                timeZone: "Asia/Bangkok",
                time: "09:00",
                startDate: "2026-09-21",
            },
        })
        const read = wire.callsFor("upcomingOccurrences")[0]
        expect(read.variables).toEqual({ ruleId: "rule-1" })
        expect(screen.getByText(/Repeats every 2 days at 09:00 \(Asia\/Bangkok\)/)).toBeInTheDocument()
        expect(screen.getByText("2026-09-23")).toBeInTheDocument()
    })

    it("a refused write surfaces the backend's own reason on the form", async () => {
        const wire = scheduleWorld({
            makeRecurring: { reason: "A rule already exists for that task.", code: "RECUR_RULE_EXISTS" },
        })
        renderJourney(<RecurPage />)
        await waitFor(() => expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).not.toBe(""))
        fillEveryNDaysDraft("2")

        fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("A rule already exists for that task."))
        // The form is still there to correct: a refused write is not a dead end.
        expect(screen.getByLabelText("Every (days)")).toHaveValue("2")
        expect(wire.callsFor("makeRecurring")).toHaveLength(1)
    })

    it("ended: confirming End rule in place stops the previews and keeps the materialised rows", async () => {
        const wire = scheduleWorld({
            upcomingOccurrences: (variables, call) => call === 0
                ? {
                    data: {
                        ruleId: "rule-1",
                        materialised: [{ occurrenceId: "occ-1", localDate: "2026-09-19", dueAtUtc: "2026-09-19T02:00:00Z", status: "completed" }],
                        previewDates: ["2026-09-21"],
                    },
                }
                : {
                    data: {
                        ruleId: "rule-1",
                        materialised: [{ occurrenceId: "occ-1", localDate: "2026-09-19", dueAtUtc: "2026-09-19T02:00:00Z", status: "completed" }],
                        previewDates: [],
                    },
                },
        })
        renderJourney(<RecurPage />)
        await waitFor(() => expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).not.toBe(""))
        await reachActive(wire)

        // The consequence confirmation replaces the button in place before anything is ended.
        fireEvent.click(screen.getByRole("button", { name: "End rule" }))
        await waitFor(() => expect(screen.getByText(/No new occurrences are created/)).toBeInTheDocument())
        expect(wire.callsFor("endRecurrence")).toHaveLength(0)

        fireEvent.click(screen.getAllByRole("button", { name: "End rule" }).at(-1)!)

        await waitFor(() => expect(screen.getByText("Nothing upcoming")).toBeInTheDocument())
        const end = wire.callsFor("endRecurrence")[0]
        expect(end.token).toBe("tok-recur")
        expect((end.variables.input as { ruleId: string }).ruleId).toBe("rule-1")
        // The kept history still reads; only the previews are gone.
        expect(screen.getByText("completed")).toBeInTheDocument()
        expect(screen.queryByText("2026-09-21")).not.toBeInTheDocument()
        expect(screen.getByText(/ended 2026-09-20\./)).toBeInTheDocument()
    })

    it("fr.recur.make-recurring: with no task bound the form refuses instead of sending a nameless rule", async () => {
        mocks.search = "?"
        const wire = scheduleWorld()
        renderJourney(<RecurPage />)
        await waitFor(() => expect((screen.getByLabelText("Time zone") as HTMLInputElement).value).not.toBe(""))
        fillEveryNDaysDraft("2")

        fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Open a task’s schedule before saving a rule."))
        expect(wire.callsFor("makeRecurring")).toHaveLength(0)
    })
})
