import { randomUUID } from "node:crypto"
import {
    RULE_ENDED_AT,
    OCCURRENCE_COUNT_AFTER,
    OCCURRENCE_COUNTS_BY_STATUS,
} from "@tests/fixtures/persistence/e2e-verification.sql"
import type {
    CountRow,
    OccurrenceStatusCountRow,
    RuleEndedAtRow,
} from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    CreateTaskData,
    EditRecurrenceData,
    EndRecurrenceData,
    MakeRecurringData,
    OccurrenceEntry,
    TasksData,
    UpcomingOccurrencesAnswer,
    UpcomingOccurrencesData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { worldClock } from "@tests/world/kit/world-clock"
import { useTestWorld } from "@tests/world/use-test-world"
import type { SignedInPerson } from "@starci/test-world"

const DAY_MS = 86_400_000
const NO_OCCURRENCES: UpcomingOccurrencesAnswer = { ruleId: "", materialised: [], previewDates: [] }
/** The generation job is a cron of whole minutes, so each generation waits for the next minute tick of the worker. */
const GENERATION_WAIT_MS = 150_000

const utcDateOffset = (days: number): string =>
    new Date(worldClock.now().getTime() + days * DAY_MS).toISOString().slice(0, 10)

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
const statusAfterEnd = (localDate: string, endedAt: string): string =>
    localDate >= endedAt ? "orphaned" : "materialised"

/**
 * One row after the rule edit: an occurrence the earlier cadence already materialised must stay identical (history is never
 * rewritten), while a row the new cadence produced carries the new local time.
 */
const expectPostEditRow = (row: OccurrenceEntry, beforeEdit: ReadonlyArray<OccurrenceEntry>): void => {
    const original = beforeEdit.find((old) => old.occurrenceId === row.occurrenceId)
    if (original) {
        expect(row).toEqual(original)
    } else {
        expect(row.status).toBe("materialised")
        expect(row.dueAtUtc.endsWith("T18:00:00.000Z")).toBe(true)
    }
}

/**
 * fr.recur full lifecycle, one A->Z journey through the public GraphQL door only: a fresh person creates a task, makes it a
 * recurring rule, watches the worker recur.generation job materialise real occurrences, edits the rule and observes new
 * occurrences carry the new shape while materialised history is untouched, then ends the rule and verifies, over the api and
 * in the store, that no new occurrence is ever generated again.
 *
 * The job is a cron of whole minutes (the world sets every minute, the shortest cadence the job supports), so each generation
 * waits up to about 90 seconds for the next minute tick of the worker. The stillness after the end is proved by a state, not
 * a sleep: a control rule of a second person, created after the end, is materialised by a generation run that therefore
 * started after the end, and the ended rule must still be frozen once that run finished.
 */
describe("recur: recurrence lifecycle (e2e)", () => {
    const world = useTestWorld({ apps: ["todo", "worker"] })

    const upcomingOf = async (person: SignedInPerson, ruleId: string): Promise<UpcomingOccurrencesAnswer> => {
        const observed = await person.caller.graphql<UpcomingOccurrencesData>("upcomingOccurrences", {
            input: { ruleId },
        })
        expect(observed.errorCode).toBeNull()
        return observed.data?.upcomingOccurrences ?? NO_OCCURRENCES
    }

    it("create task -> make recurring -> occurrences -> edit rule -> occurrences reflect edit -> end rule -> no new occurrences", async () => {
        const runId = randomUUID().slice(0, 8)
        const me = await world.signedInPerson("recur")

        // Step 1: a fresh person owns a plain task before anything recurs.
        const title = `e2e:recur-lifecycle:${runId}`
        const created = await me.caller.graphql<CreateTaskData>("createTask", { input: { title } })
        expect(created.errorCode).toBeNull()
        expect(created.data?.createTask.title).toBe(title)

        // Step 2: the title becomes a weekly (n=7) rule that began 21 days ago at 09:00 UTC.
        const startDate = utcDateOffset(-21)
        const today = utcDateOffset(0)
        const made = await me.caller.graphql<MakeRecurringData>("makeRecurring", {
            input: {
                title,
                // The schema exposes RecurFrequency by enum key; the response still echoes the stored value.
                frequency: "EveryNDays",
                n: 7,
                timeZone: "UTC",
                time: "09:00",
                startDate,
            },
        })
        expect(made.errorCode).toBeNull()
        expect(made.data?.makeRecurring).toMatchObject({
            title,
            frequency: "every-n-days",
            timeZone: "UTC",
            time: "09:00",
            startDate,
        })
        const ruleId = made.data?.makeRecurring.ruleId ?? ""

        // Step 3: the generation tick backfills [startDate, today]: -21, -14, -7, 0 at 09:00 UTC.
        const expectedBefore = expectedNDaysDates(startDate, 7, today)
        expect(expectedBefore).toHaveLength(4)
        const beforeEdit = await world.waitUntil(
            `occurrences for the n=7 rule ${ruleId}`,
            () => upcomingOf(me, ruleId),
            (upcoming) => upcoming.materialised.length >= expectedBefore.length,
            { timeoutMs: GENERATION_WAIT_MS, intervalMs: 2_000 },
        )
        expect(beforeEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedBefore)
        for (const row of beforeEdit.materialised) {
            expect(row.status).toBe("materialised")
            expect(row.dueAtUtc.endsWith("T09:00:00.000Z")).toBe(true)
        }
        // The preview is computed live and reaches past the materialised history.
        expect(beforeEdit.previewDates.length).toBeGreaterThan(0)

        // Each materialised occurrence is a real task row: occurrenceId is the created task id.
        const listed = await me.caller.graphql<TasksData>("tasks")
        const taskIds = new Set((listed.data?.tasks ?? []).map((task) => task.taskId))
        for (const row of beforeEdit.materialised) {
            expect(taskIds.has(row.occurrenceId)).toBe(true)
        }

        // Step 4: edit the rule: cadence n=7 -> n=3, local time 09:00 -> 18:00.
        const edited = await me.caller.graphql<EditRecurrenceData>("editRecurrence", {
            input: { ruleId, n: 3, time: "18:00" },
        })
        expect(edited.errorCode).toBeNull()
        expect(edited.data?.editRecurrence).toEqual({
            ruleId,
            frequency: "every-n-days",
            timeZone: "UTC",
            time: "18:00",
        })

        // Step 5: occurrences reflect the edit: the n=3 walk adds dates to the ones already materialised; the new rows fire at
        // 18:00 while the old rows stay identical.
        const expectedEdited = expectedNDaysDates(startDate, 3, today)
        const expectedUnion = [...new Set([...expectedBefore, ...expectedEdited])].sort()
        expect(expectedUnion).toHaveLength(10)
        const afterEdit = await world.waitUntil(
            `n=3 occurrences for the rule ${ruleId}`,
            () => upcomingOf(me, ruleId),
            (upcoming) => upcoming.materialised.length >= expectedUnion.length,
            { timeoutMs: GENERATION_WAIT_MS, intervalMs: 2_000 },
        )
        expect(afterEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
        for (const row of afterEdit.materialised) {
            expectPostEditRow(row, beforeEdit.materialised)
        }

        // Step 6: end the rule effective today: the row of today orphans, history is preserved.
        const ended = await me.caller.graphql<EndRecurrenceData>("endRecurrence", { input: { ruleId, endedAt: today } })
        expect(ended.errorCode).toBeNull()
        expect(ended.data?.endRecurrence).toMatchObject({ ruleId, endedAt: today, orphanedCount: 1 })
        const atEnd = await upcomingOf(me, ruleId)
        expect(atEnd.previewDates).toEqual([])
        expect(atEnd.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
        for (const row of atEnd.materialised) {
            expect(row.status).toBe(statusAfterEnd(row.localDate, today))
        }

        // Step 7: no new occurrences. The assertion is stillness, so the wait is for a state: a generation run that started
        // after the end has finished. A control rule of another person, created only now, is materialised by such a run.
        const control = await world.signedInPerson("recur-control")
        const controlRule = await control.caller.graphql<MakeRecurringData>("makeRecurring", {
            input: {
                title: `e2e:recur-control:${runId}`,
                frequency: "EveryNDays",
                n: 1,
                timeZone: "UTC",
                time: "09:00",
                startDate: today,
            },
        })
        expect(controlRule.errorCode).toBeNull()
        const controlRuleId = controlRule.data?.makeRecurring.ruleId ?? ""
        await world.waitUntil(
            "a generation run after the end of the rule (the control rule materialised)",
            () => upcomingOf(control, controlRuleId),
            (upcoming) => upcoming.materialised.length >= 1,
            { timeoutMs: GENERATION_WAIT_MS, intervalMs: 2_000 },
        )
        const frozenCount = atEnd.materialised.length
        const later = await upcomingOf(me, ruleId)
        expect(later.materialised).toHaveLength(frozenCount)
        expect(later.materialised.filter((row) => row.localDate > today)).toEqual([])
        expect(later.previewDates).toEqual([])

        // The store agrees: the rule row is ended and no occurrence row exists past the end date.
        const endedRows: Array<RuleEndedAtRow> = await world.db.primary.query(RULE_ENDED_AT, [ruleId])
        expect(endedRows).toEqual([{ ended_at: today }])
        const counts: Array<OccurrenceStatusCountRow> = await world.db.primary.query(OCCURRENCE_COUNTS_BY_STATUS, [
            ruleId,
        ])
        expect(counts).toEqual([
            { status: "materialised", count: frozenCount - 1 },
            { status: "orphaned", count: 1 },
        ])
        const [after]: Array<CountRow> = await world.db.primary.query(OCCURRENCE_COUNT_AFTER, [ruleId, today])
        expect(after?.count).toBe(0)
    }, 600_000)
})
