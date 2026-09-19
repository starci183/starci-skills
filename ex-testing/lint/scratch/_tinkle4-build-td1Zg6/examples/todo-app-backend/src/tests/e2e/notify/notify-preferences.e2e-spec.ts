import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    pollUntil 
} from "@tests/infra/e2e-poll"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"
import {
    GraphqlObserved 
} from "@tests/infra/integrations/http/e2e-http.service"

jest.setTimeout(120_000)

/**
 * fr.notify.* as one A->Z journey over the run-owned stack: a preference update is honored by the
 * next admission, a real task-complete event flows the real pipeline (PlatformEventBus -> dedupe ->
 * preferences -> digest window -> Redis queue -> scheduler tick -> SMTP dispatch), and unsubscribe
 * suppresses every later event at admission -- before any digest window or transport attempt.
 *
 * Notify's public doors are the two mutations and the preferences query; the pipeline's effects
 * live in Postgres rows (notify_notifications, notify_delivery_attempts), verified out-of-band via
 * the run-owned DataSource. The run pins SMTP to a dead loopback port, so a real dispatch attempt is
 * observable as a classified transient retry rather than a delivery -- the honest signal for this
 * stack.
 */

const UPDATE_PREFS =
  "mutation UpdatePrefs($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }"
const UNSUBSCRIBE =
  "mutation Unsubscribe($input: UnsubscribeInput!) { unsubscribe(input: $input) { channel unsubscribed } }"

const RUN = `e2e-notify-${Date.now().toString(36)}`
const CHANNEL = "email"

interface Preferences {
  channel: string;
  unsubscribed: boolean;
  digestWindowMinutes: number | null;
}

interface NotificationRow {
  id: string;
  digest_group_id: string | null;
}

interface AttemptRow {
  state: string;
  attempt: number;
  failure_class: string | null;
  history: Array<{ state: string; at: string; failureClass?: string | null }>;
}

describe("notify preferences journey (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect(
                (await world.http.anonymous().get<{ status: string }>("/health")).data.status,
            ).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        const dataOf = <TData, K extends keyof TData>(
            observed: GraphqlObserved<TData>,
            operation: K,
        ): NonNullable<TData[K]> => {
            const data = observed.data?.[operation]
            if (data === null || data === undefined) {
                throw new Error(
                    `no data.${String(operation)} (${observed.errorCode ?? "no code"}: ` +
          `${observed.errorMessage ?? "no message"})`,
                )
            }
            return data as NonNullable<TData[K]>
        }

        it("update prefs → task-complete event notifies → dispatch attempted on window close → unsubscribe → later events suppressed at admission",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const me = await auth.persona("owner")
                const token = me.token

                const prefsAt = () =>
                    http
                        .graphql<{ notificationPreferences: Preferences }>(
                            "notificationPreferences",
                            {
                                variables: {
                                    channel: CHANNEL 
                                }, token 
                            },
                        )
                        .then(observed => dataOf(observed,
                            "notificationPreferences"))
                const completeFreshTask = async (title: string): Promise<string> => {
                    const created = dataOf(
                        await http.graphql<{ createTask: { taskId: string } }>(
                            "createTask",
                            {
                                variables: {
                                    input: {
                                        title 
                                    } 
                                }, token 
                            },
                        ),
                        "createTask",
                    )
                    dataOf(
                        await http.graphql<{ completeTask: { taskId: string; complete: boolean } }>(
                            "completeTask",
                            {
                                variables: {
                                    id: created.taskId 
                                }, token 
                            },
                        ),
                        "completeTask",
                    )
                    return created.taskId
                }

                // No preference row written yet: the default read is subscribed, no digest override.
                expect(await prefsAt()).toEqual({
                    channel: CHANNEL,
                    unsubscribed: false,
                    digestWindowMinutes: null,
                })

                // Update prefs: the smallest allowed digest window (1 minute) so the run observes a real flush.
                const updated = dataOf(
                    await http.graphql<{ updateNotificationPreferences: Preferences }>(
                        UPDATE_PREFS,
                        {
                            variables: {
                                input: {
                                    channel: CHANNEL, digestWindowMinutes: 1 
                                } 
                            }, token 
                        },
                    ),
                    "updateNotificationPreferences",
                )
                expect(updated).toEqual({
                    channel: CHANNEL, unsubscribed: false, digestWindowMinutes: 1 
                })
                expect(await prefsAt()).toEqual({
                    channel: CHANNEL,
                    unsubscribed: false,
                    digestWindowMinutes: 1,
                })

                // Event: completing the task publishes TaskCompletedEvent -> admitted, queued, joined a window.
                // The subscriber admits asynchronously after the mutation returns, so the row is polled into
                // existence; the dedupe insert and the digest-group assign are two sequential writes inside
                // admit(), and the probe waits for the joined state instead of catching that gap.
                const firstTaskId = await completeFreshTask(`${RUN}-first`)
                const notification = await pollUntil("task-complete notification joined its digest group",
                    async () => {
                        const rows = await dataSource.query<Array<NotificationRow>>(
                            `select id, digest_group_id from notify_notifications
               where recipient_id = $1 and kind = 'task-complete' and payload->>'taskId' = $2`,
                            [me.personId,
                                firstTaskId],
                        )
                        return rows.filter(row => row.digest_group_id !== null)[0] ?? null
                    },
                    20_000,
                    250)
                expect(notification.digest_group_id).toBeTruthy()

                // The real scheduler tick (5s) drains the Redis queue once the 1-minute window closes and
                // t-dispatch runs - observed as the attempt row leaving its initial admission state.
                const attempt = await pollUntil("delivery attempt row past admission",
                    async () => {
                        const rows = await dataSource.query<Array<AttemptRow>>(
                            `select state, attempt, failure_class, history from notify_delivery_attempts
               where notification_id = $1`,
                            [notification.id],
                        )
                        return rows.filter(row => row.attempt >= 1)[0] ?? null
                    },
                    95_000,
                    1_000)
                // SMTP is pinned to a dead port in this stack, so the outcome is a classified transient retry --
                // never 'suppressed': this recipient was subscribed at admission.
                expect(attempt.state).not.toBe("suppressed")
                expect(attempt.history.map(entry => entry.state)).toContain("sending")

                // Unsubscribe: honored for every event enqueued after it, immediately.
                const unsubscribed = dataOf(
                    await http.graphql<{ unsubscribe: { channel: string; unsubscribed: boolean } }>(
                        UNSUBSCRIBE,
                        {
                            variables: {
                                input: {
                                    channel: CHANNEL 
                                } 
                            }, token 
                        },
                    ),
                    "unsubscribe",
                )
                expect(unsubscribed).toEqual({
                    channel: CHANNEL, unsubscribed: true 
                })
                expect((await prefsAt()).unsubscribed).toBe(true)

                // A fresh event is still admitted (the dedupe row exists) but its delivery attempt is created
                // already suppressed - failure_class 'unsubscribed', zero transport attempts, no digest window.
                const secondTaskId = await completeFreshTask(`${RUN}-second`)
                const suppressed = await pollUntil("suppressed notification row for the post-unsubscribe event",
                    async () => {
                        const rows = await dataSource.query<Array<NotificationRow & AttemptRow>>(
                            `select n.id, n.digest_group_id, a.state, a.attempt, a.failure_class, a.history
               from notify_notifications n
               join notify_delivery_attempts a on a.notification_id = n.id
               where n.recipient_id = $1 and n.kind = 'task-complete' and n.payload->>'taskId' = $2`,
                            [me.personId,
                                secondTaskId],
                        )
                        return rows[0] ?? null
                    })
                expect(suppressed.digest_group_id).toBeNull()
                expect(suppressed.state).toBe("suppressed")
                expect(suppressed.failure_class).toBe("unsubscribed")
                expect(suppressed.attempt).toBe(0)
            })
    })
