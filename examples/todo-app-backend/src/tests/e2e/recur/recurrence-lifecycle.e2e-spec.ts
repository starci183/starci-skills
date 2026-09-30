import { randomUUID } from "node:crypto"
import { pollUntil } from "@e2e-kit/platform/poll"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { E2EGraphqlHandle } from "../setup/e2e-graphql.client"
import { present } from "../setup/e2e.error"
import type {
    CreateTaskData,
    EditRecurrenceData,
    EndRecurrenceData,
    MakeRecurringData,
    OccurrenceView,
    TasksData,
    UpcomingOccurrencesData,
} from "../setup/e2e-views.contracts"

const DAY_MS = 86_400_000
const GENERATION_JOB = "recur.generation"

const utcDateOffset = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)

const addDaysUtc = (date: string, days: number): string => {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Every date an every-n-days rule fires on inside [startDate, horizon]: an independent re-walk of the calendar arithmetic of
 * the rule, computed here so the assertion does not borrow the answer of the app.
 */
const expectedNDaysDates = (startDate: string, n: number, horizon: string): Array<string> => {
    const dates: Array<string> = []
    let elapsed = 0
    for (let cursor = startDate; cursor <= horizon; cursor = addDaysUtc(cursor, 1), elapsed += 1) {
        if (elapsed % n === 0) dates.push(cursor)
    }
    return dates
}

/** The status a row must carry once its rule ended at endedAt: a row dated on or after the end orphans, earlier rows keep their history. */
const statusAfterEnd = (localDate: string, endedAt: string): string => (localDate >= endedAt ? "orphaned" : "materialised")

/**
 * One row after the rule edit: an occurrence the earlier cadence already materialised must stay identical (history is never
 * rewritten), while a row the new cadence produced carries the new local time.
 */
const expectPostEditRow = (row: OccurrenceView, beforeEdit: ReadonlyArray<OccurrenceView>): void => {
    const original = beforeEdit.find((old) => old.occurrenceId === row.occurrenceId)
    if (original) {
        expect(row).toEqual(original)
    } else {
        expect(row.status).toBe("materialised")
        expect(row.dueAtUtc.endsWith("T18:00:00.000Z")).toBe(true)
    }
}

/**
 * fr.recur full lifecycle, one A->Z journey through the public GraphQL door only: a fresh account creates a task, makes it a
 * recurring rule, watches the worker recur.generation job materialise real occurrences, edits the rule and observes new
 * occurrences carry the new shape while materialised history is untouched, then ends the rule and verifies, over the api and
 * out-of-band, that no new occurrence is ever generated again.
 *
 * The job is a cron of whole minutes (the run sets every minute, the shortest cadence the job supports), so each generation
 * waits for the next minute tick of the worker; the stillness after the end is proved by waiting until the job finished two
 * runs after the change, not by sleeping.
 */
describe("recur: recurrence lifecycle (e2e)", () => {
    let world: E2EWorld
    let personId: string | null = null

    beforeAll(async () => {
        world = await bootE2eWorld("recur/recurrence-lifecycle")
        // The stack counts as up only when the api answers its dependency-checked /health.
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        try {
            if (personId !== null) await world.auth.deleteAccount(personId)
        } finally {
            await world.close()
        }
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("create task -> make recurring -> occurrences -> edit rule -> occurrences reflect edit -> end rule -> no new occurrences", async () => {
        const { graphql, auth, database, stack } = world
        const runId = randomUUID().slice(0, 8)
        const email = `e2e-recur-${runId}@todo.dev`
        const password = `e2e-pass-${runId}`

        // Step 1: a fresh account signs in and owns a plain task before anything recurs.
        personId = (await auth.createAccount({ email, password })).personId
        const session = await auth.signIn(email, password)
        const me: E2EGraphqlHandle = graphql.client(session.sessionToken)
        const title = `e2e:recur-lifecycle:${runId}`
        const created = await me.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        expect(created.errorCode).toBeNull()
        expect(present(created.data, "createTask data").createTask.title).toBe(title)

        // Step 2: the title becomes a weekly (n=7) rule that began 21 days ago at 09:00 UTC.
        const startDate = utcDateOffset(-21)
        const today = utcDateOffset(0)
        const made = await me.mutate<MakeRecurringData>("makeRecurring", {
            variables: {
                input: {
                    title,
                    // The schema exposes RecurFrequency by enum key; the response still echoes the stored value.
                    frequency: "EveryNDays",
                    n: 7,
                    timeZone: "UTC",
                    time: "09:00",
                    startDate,
                },
            },
        })
        expect(made.errorCode).toBeNull()
        const rule = present(made.data, "makeRecurring data").makeRecurring
        expect(rule).toMatchObject({ title, frequency: "every-n-days", timeZone: "UTC", time: "09:00", startDate })
        const ruleId = rule.ruleId

        const readUpcoming = async (): Promise<UpcomingOccurrencesData["upcomingOccurrences"]> => {
            const observed = await me.read<UpcomingOccurrencesData>("upcomingOccurrences", { variables: { input: { ruleId } } })
            expect(observed.errorCode).toBeNull()
            return present(observed.data, "upcomingOccurrences data").upcomingOccurrences
        }

        // Step 3: the generation tick backfills [startDate, today]: -21, -14, -7, 0 at 09:00 UTC.
        const expectedBefore = expectedNDaysDates(startDate, 7, today)
        expect(expectedBefore).toHaveLength(4)
        const beforeEdit = await pollUntil(
            `occurrences for the n=7 rule ${ruleId}`,
            async () => {
                const upcoming = await readUpcoming()
                return upcoming.materialised.length >= expectedBefore.length ? upcoming : null
            },
            150_000,
            2_000,
        )
        expect(beforeEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedBefore)
        for (const row of beforeEdit.materialised) {
            expect(row.status).toBe("materialised")
            expect(row.dueAtUtc.endsWith("T09:00:00.000Z")).toBe(true)
        }
        // The preview is computed live and reaches past the materialised history.
        expect(beforeEdit.previewDates.length).toBeGreaterThan(0)

        // Each materialised occurrence is a real task row: occurrenceId is the created task id.
        const listed = await me.read<TasksData>("tasks")
        const taskIds = new Set(present(listed.data, "tasks data").tasks.map((task) => task.taskId))
        for (const row of beforeEdit.materialised) {
            expect(taskIds.has(row.occurrenceId)).toBe(true)
        }

        // Step 4: edit the rule: cadence n=7 -> n=3, local time 09:00 -> 18:00.
        const edited = await me.mutate<EditRecurrenceData>("editRecurrence", { variables: { input: { ruleId, n: 3, time: "18:00" } } })
        expect(edited.errorCode).toBeNull()
        expect(edited.data?.editRecurrence).toEqual({ ruleId, frequency: "every-n-days", timeZone: "UTC", time: "18:00" })

        // Step 5: occurrences reflect the edit: the n=3 walk adds dates to the ones already materialised; the new rows fire at
        // 18:00 while the old rows stay identical.
        const expectedEdited = expectedNDaysDates(startDate, 3, today)
        const expectedUnion = [...new Set([...expectedBefore, ...expectedEdited])].sort()
        expect(expectedUnion).toHaveLength(10)
        const afterEdit = await pollUntil(
            `n=3 occurrences for the rule ${ruleId}`,
            async () => {
                const upcoming = await readUpcoming()
                return upcoming.materialised.length >= expectedUnion.length ? upcoming : null
            },
            150_000,
            2_000,
        )
        expect(afterEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
        for (const row of afterEdit.materialised) {
            expectPostEditRow(row, beforeEdit.materialised)
        }

        // Step 6: end the rule effective today: the row of today orphans, history is preserved.
        const ended = await me.mutate<EndRecurrenceData>("endRecurrence", { variables: { input: { ruleId, endedAt: today } } })
        expect(ended.errorCode).toBeNull()
        const end = present(ended.data, "endRecurrence data").endRecurrence
        expect(end.ruleId).toBe(ruleId)
        expect(end.endedAt).toBe(today)
        expect(end.orphanedCount).toBe(1)
        const runsAtEnd = stack.completedJobRuns(GENERATION_JOB)
        const atEnd = await readUpcoming()
        expect(atEnd.previewDates).toEqual([])
        expect(atEnd.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
        for (const row of atEnd.materialised) {
            expect(row.status).toBe(statusAfterEnd(row.localDate, today))
        }

        // Step 7: no new occurrences. The assertion is stillness, so the wait is for a state: a generation run that started
        // after the end has finished (two finished runs cover one that was already in flight), then the set must be frozen.
        await pollUntil(
            "two generation runs finished after the end of the rule",
            () => Promise.resolve(stack.completedJobRuns(GENERATION_JOB) >= runsAtEnd + 2),
            180_000,
            2_000,
        )
        const frozenCount = atEnd.materialised.length
        const later = await readUpcoming()
        expect(later.materialised).toHaveLength(frozenCount)
        expect(later.materialised.filter((row) => row.localDate > today)).toEqual([])
        expect(later.previewDates).toEqual([])

        // Out-of-band verify: the rule row is ended and no occurrence row exists past the end date.
        expect(await database.ruleEndedAt(ruleId)).toEqual([{ ended_at: today }])
        expect(await database.occurrenceCountsByStatus(ruleId)).toEqual([
            { status: "materialised", count: frozenCount - 1 },
            { status: "orphaned", count: 1 },
        ])
        expect(await database.occurrenceCountAfter(ruleId, today)).toBe(0)
    }, 600_000)
})
