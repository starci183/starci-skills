import {
    randomUUID 
} from "node:crypto"
import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    holdFor, pollUntil 
} from "@tests/infra/e2e-poll"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"
import {
    E2EGraphqlResponse, E2EHttpClient 
} from "@tests/infra/integrations/http/e2e-http.service"

/**
 * fr.recur full lifecycle, one A->Z journey through the public GraphQL door only: a fresh account
 * creates a task, makes it a recurring rule, watches the api's own in-process generator
 * (integration.recur.scheduler, per-second RECUR_TICK_CRON on the run-owned stack) materialise real
 * occurrences, edits the rule and observes new occurrences carry the new shape while materialised
 * history is untouched, then ends the rule and verifies - over the API and out-of-band through
 * the run-owned DataSource - that no new occurrence is ever generated again.
 */

// The frozen public transport contract (same documents the proven JS harness sends).
const CREATE_TASK =
  "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }"
const LIST_TASKS = "query { tasks { taskId title complete } }"
const MAKE_RECURRING =
  "mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }"
const EDIT_RECURRENCE =
  "mutation EditRecurrence($input: EditRecurrenceInput!) { editRecurrence(input: $input) { ruleId frequency timeZone time } }"
const END_RECURRENCE =
  "mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }"
const UPCOMING_OCCURRENCES =
  "query Upcoming($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }"

interface MaterialisedRow {
  occurrenceId: string;
  localDate: string;
  dueAtUtc: string;
  status: string;
}
interface UpcomingData {
  upcomingOccurrences: { ruleId: string; materialised: Array<MaterialisedRow>; previewDates: Array<string> };
}
interface CreateTaskData {
  createTask: { taskId: string; title: string };
}
interface TasksData {
  tasks: Array<{ taskId: string; title: string; complete: boolean }>;
}
interface MakeRecurringData {
  makeRecurring: {
    ruleId: string;
    title: string;
    frequency: string;
    timeZone: string;
    time: string;
    startDate: string;
  };
}
interface EditRecurrenceData {
  editRecurrence: { ruleId: string; frequency: string; timeZone: string; time: string };
}
interface EndRecurrenceData {
  endRecurrence: { ruleId: string; endedAt: string; orphanedCount: number };
}

function unwrap<T>(envelope: E2EGraphqlResponse<T>, operation: string): T {
    if (envelope.errorCode || envelope.data === null) {
        throw new Error(
            `${operation} failed: ${envelope.errorCode ?? "no-code"} ${envelope.errorMessage ?? ""}`.trim(),
        )
    }
    return envelope.data
}

function utcDateOffset(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0,
        10)
}

function addDaysUtc(date: string, days: number): string {
    const [year,
        month,
        day] = date.split("-").map(Number)
    return new Date(Date.UTC(year,
        month - 1,
        day + days)).toISOString().slice(0,
        10)
}

/** Every date an every-n-days rule fires on inside [startDate, horizon] - independent re-walk of the
 *  rule's own calendar arithmetic, computed here so the assertion does not borrow the app's answer. */
function expectedNDaysDates(startDate: string, n: number, horizon: string): Array<string> {
    const dates: Array<string> = []
    let elapsed = 0
    for (let cursor = startDate; cursor <= horizon; cursor = addDaysUtc(cursor,
        1), elapsed += 1) {
        if (elapsed % n === 0) dates.push(cursor)
    }
    return dates
}

/** The status a row must carry once its rule ended at endedAt: a row dated on-or-after the end
 *  orphans, earlier rows keep their materialised history. */
function statusAfterEnd(localDate: string, endedAt: string): string {
    return localDate >= endedAt ? "orphaned" : "materialised"
}

/**
 * One row after the rule edit: an occurrence the earlier cadence already materialised must stay
 * byte-identical (history is never rewritten), while a row the new cadence produced carries the new
 * local time. The branch lives here, outside the step, because either shape is the promised outcome
 * for that particular row.
 */
function expectPostEditRow(row: MaterialisedRow, beforeEdit: Array<MaterialisedRow>): void {
    const original = beforeEdit.find((old) => old.occurrenceId === row.occurrenceId)
    if (original) {
        expect(row).toEqual(original)
    } else {
        expect(row.status).toBe("materialised")
        expect(row.dueAtUtc.endsWith("T18:00:00.000Z")).toBe(true)
    }
}

describe("recur: recurrence lifecycle (e2e)",
    () => {
        let world: E2EWorld
        let personId: string | null = null

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect(world.stack.apiBaseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
            // The stack counts as up only when the api answers its dependency-checked /health.
            const health = await world.http.client().get<{ status: string }>("/health")
            expect(health.data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            try {
                if (personId) await world.auth.deleteAccount(personId)
            } finally {
                await world.moduleRef.close()
            }
        },
        120_000)

        it("create task -> make recurring -> occurrences -> edit rule -> occurrences reflect edit -> end rule -> no new occurrences",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const runId = randomUUID().slice(0,
                    8)
                const email = `e2e-recur-${runId}@todo.dev`
                const password = `e2e-pass-${runId}`

                // Step 1 - a fresh account signs in and owns a plain task before anything recurs.
                personId = (await auth.createAccount({
                    email, password 
                })).personId
                const session = await auth.signIn(email,
                    password)
                const me: E2EHttpClient = http.client({
                    bearerToken: session.sessionToken 
                })

                const title = `e2e:recur-lifecycle:${runId}`
                const created = unwrap(
                    await me.graphql<CreateTaskData>(CREATE_TASK,
                        {
                            input: {
                                title 
                            } 
                        }),
                    "createTask",
                )
                expect(created.createTask.taskId).toBeTruthy()
                expect(created.createTask.title).toBe(title)

                // Step 2 - the task becomes a weekly (n=7) rule that began 21 days ago at 09:00 UTC.
                const startDate = utcDateOffset(-21)
                const today = utcDateOffset(0)
                const rule = unwrap(
                    await me.graphql<MakeRecurringData>(MAKE_RECURRING,
                        {
                            input: {
                                title,
                                // The schema exposes RecurFrequency by enum key; the response still echoes the stored
                                // 'every-n-days' value string.
                                frequency: "EveryNDays",
                                n: 7,
                                timeZone: "UTC",
                                time: "09:00",
                                startDate,
                            },
                        }),
                    "makeRecurring",
                ).makeRecurring
                expect(rule).toMatchObject({
                    title,
                    frequency: "every-n-days",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate,
                })
                const ruleId = rule.ruleId

                const readUpcoming = async () =>
                    unwrap(
                        await me.graphql<UpcomingData>(UPCOMING_OCCURRENCES,
                            {
                                ruleId 
                            }),
                        "upcomingOccurrences",
                    ).upcomingOccurrences

                // Step 3 - real generator ticks backfill [startDate, today]: -21, -14, -7, 0 at 09:00 UTC.
                const expectedBefore = expectedNDaysDates(startDate,
                    7,
                    today)
                expect(expectedBefore).toHaveLength(4)
                const beforeEdit = await pollUntil(`occurrences for n=7 rule ${ruleId}`,
                    async () => {
                        const upcoming = await readUpcoming()
                        return (upcoming.materialised.length >= expectedBefore.length && upcoming) || null
                    },
                    120_000,
                    1_500)
                expect(beforeEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedBefore)
                for (const row of beforeEdit.materialised) {
                    expect(row.status).toBe("materialised")
                    expect(row.dueAtUtc.endsWith("T09:00:00.000Z")).toBe(true)
                }
                // The preview is computed live and reaches past the materialised history.
                expect(beforeEdit.previewDates.length).toBeGreaterThan(0)
                // Each materialised occurrence is a real task row - occurrenceId is the created task's id.
                const tasks = unwrap(await me.graphql<TasksData>(LIST_TASKS),
                    "tasks").tasks
                const taskIds = new Set(tasks.map((task) => task.taskId))
                for (const row of beforeEdit.materialised) {
                    expect(taskIds.has(row.occurrenceId)).toBe(true)
                }

                // Step 4 - edit the rule: cadence n=7 -> n=3, local time 09:00 -> 18:00.
                const edited = unwrap(
                    await me.graphql<EditRecurrenceData>(EDIT_RECURRENCE,
                        {
                            input: {
                                ruleId, n: 3, time: "18:00" 
                            },
                        }),
                    "editRecurrence",
                ).editRecurrence
                expect(edited).toEqual({
                    ruleId, frequency: "every-n-days", timeZone: "UTC", time: "18:00" 
                })

                // Step 5 - occurrences reflect the edit: the n=3 walk covers -18,-15,-12,-9,-6,-3 in addition to
                // the dates already materialised; those new rows fire at 18:00 while old rows stay byte-identical.
                const expectedEdited = expectedNDaysDates(startDate,
                    3,
                    today)
                const expectedUnion = [...new Set([...expectedBefore,
                    ...expectedEdited])].sort()
                expect(expectedUnion).toHaveLength(10)
                const afterEdit = await pollUntil(`n=3 occurrences for rule ${ruleId}`,
                    async () => {
                        const upcoming = await readUpcoming()
                        return (upcoming.materialised.length >= expectedUnion.length && upcoming) || null
                    },
                    120_000,
                    1_500)
                expect(afterEdit.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
                for (const row of afterEdit.materialised) {
                    expectPostEditRow(row,
                        beforeEdit.materialised)
                }

                // Step 6 - end the rule effective today: today's row orphans, history is preserved.
                const ended = unwrap(
                    await me.graphql<EndRecurrenceData>(END_RECURRENCE,
                        {
                            input: {
                                ruleId, endedAt: today 
                            },
                        }),
                    "endRecurrence",
                ).endRecurrence
                expect(ended.ruleId).toBe(ruleId)
                expect(ended.endedAt).toBe(today)
                expect(ended.orphanedCount).toBe(1)

                const atEnd = await readUpcoming()
                expect(atEnd.previewDates).toEqual([])
                expect(atEnd.materialised.map((row) => row.localDate).sort()).toEqual(expectedUnion)
                for (const row of atEnd.materialised) {
                    expect(row.status).toBe(statusAfterEnd(row.localDate,
                        today))
                }

                // Step 7 - no new occurrences: across several more real ticks the materialised set stays frozen
                // at the dates the rule had already covered, and nothing is ever dated after endedAt. The
                // assertion IS stillness, so the wait is a bounded observation window, not a poll.
                const frozenCount = atEnd.materialised.length
                await holdFor(5_000)
                const later = await readUpcoming()
                expect(later.materialised).toHaveLength(frozenCount)
                expect(later.materialised.filter((row) => row.localDate > today)).toEqual([])
                expect(later.previewDates).toEqual([])

                // Out-of-band verify on the run-owned postgres: the rule row is ended and no occurrence row
                // exists past the end date (seed/verify only - the flow above never touched the database).
                const ruleRows = await dataSource.query<Array<{ ended_at: string }>>(
                    "select ended_at from recurrence_rules where id = $1",
                    [ruleId],
                )
                expect(ruleRows).toEqual([{
                    ended_at: today 
                }])
                const statusRows = await dataSource.query<Array<{ status: string; count: number }>>(
                    "select status, count(*)::int as count from occurrences where rule_id = $1 group by status order by status",
                    [ruleId],
                )
                expect(statusRows).toEqual([
                    {
                        status: "materialised", count: frozenCount - 1 
                    },
                    {
                        status: "orphaned", count: 1 
                    },
                ])
                const pastEnd = await dataSource.query<Array<{ count: number }>>(
                    "select count(*)::int as count from occurrences where rule_id = $1 and local_date > $2",
                    [ruleId,
                        today],
                )
                expect(pastEnd[0].count).toBe(0)
            },
            300_000)
    })
