import { randomUUID } from "node:crypto"
import { pollUntil } from "@e2e-kit/platform/poll"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { E2EGraphqlHandle } from "../setup/e2e-graphql.client"
import { present } from "../setup/e2e.error"
import type {
    CompleteTaskData,
    CreateTaskData,
    NotificationPreferencesData,
    UnsubscribeData,
    UpdateNotificationPreferencesData,
} from "../setup/e2e-views.contracts"

const CHANNEL = "email"

/**
 * fr.notify.* as one A->Z journey over the run-owned stack: a preference update is honored by the next admission, a real
 * task-complete event flows the real pipeline (an outbox message written with the completion, the worker admit consumer,
 * dedupe, preferences, digest window, a delayed dispatch message, the worker dispatch consumer, SMTP), and unsubscribe
 * suppresses every later event at admission, before any digest window or transport attempt.
 *
 * Notify public doors are the two mutations and the preferences query; the pipeline effects live in Postgres rows
 * (notify_notifications, notify_delivery_attempts), verified out-of-band. The run pins SMTP to a dead loopback port, so a
 * real dispatch attempt is observable as a classified transient retry rather than a delivery: the honest signal for this
 * stack.
 */
describe("notify preferences journey (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("notify/notify-preferences")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    const completeFreshTask = async (caller: E2EGraphqlHandle, title: string): Promise<string> => {
        const created = await caller.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        const taskId = present(created.data, "createTask data").createTask.taskId
        const completed = await caller.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(completed.errorCode).toBeNull()
        return taskId
    }

    it("update prefs -> task-complete event notifies -> dispatch attempted on window close -> unsubscribe -> later events suppressed at admission", async () => {
        const { graphql, auth, database } = world
        const run = `e2e-notify-${randomUUID()}`
        const me = await auth.persona("owner")
        const caller = graphql.client(me.sessionToken)

        const prefsNow = async (): Promise<NotificationPreferencesData["notificationPreferences"]> => {
            const observed = await caller.read<NotificationPreferencesData>("notificationPreferences", { variables: { input: { channel: CHANNEL } } })
            return present(observed.data, "notificationPreferences data").notificationPreferences
        }

        // No preference row written yet: the default read is subscribed, no digest override.
        expect(await prefsNow()).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: null })

        // Update prefs: the smallest allowed digest window (1 minute) so the run observes a real flush.
        const updated = await caller.mutate<UpdateNotificationPreferencesData>("updateNotificationPreferences", {
            variables: { input: { channel: CHANNEL, digestWindowMinutes: 1 } },
        })
        expect(updated.errorCode).toBeNull()
        expect(updated.data?.updateNotificationPreferences).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: 1 })
        expect(await prefsNow()).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: 1 })

        // Event: completing the task writes the admit message with the completion; the worker admits it after the mutation
        // returned, so the row is polled into existence, waiting for the joined-a-window state (the dedupe insert and the
        // digest-group assignment are sequential writes of one admission).
        const firstTaskId = await completeFreshTask(caller, `${run}-first`)
        const notification = await pollUntil(
            "task-complete notification joined its digest group",
            async () => {
                const rows = await database.taskCompleteNotifications(me.personId, firstTaskId)
                return rows.find((row) => row.digest_group_id !== null) ?? null
            },
            30_000,
            250,
        )
        expect(notification.digest_group_id).toBeTruthy()

        // The delayed dispatch message becomes due when the 1-minute window closes; the worker consumer then runs the dispatch,
        // observed as the attempt row leaving its admission state.
        const attempt = await pollUntil(
            "delivery attempt row past admission",
            async () => {
                const rows = await database.deliveryAttemptsOf(notification.id)
                return rows.find((row) => row.attempt >= 1) ?? null
            },
            150_000,
            1_000,
        )
        // SMTP is pinned to a dead port in this stack, so the outcome is a classified transient retry, never suppressed:
        // this recipient was subscribed at admission.
        expect(attempt.state).not.toBe("suppressed")
        expect(attempt.history.map((entry) => entry.state)).toContain("sending")

        // Unsubscribe: honored for every event admitted after it, immediately.
        const unsubscribed = await caller.mutate<UnsubscribeData>("unsubscribe", { variables: { input: { channel: CHANNEL } } })
        expect(unsubscribed.errorCode).toBeNull()
        expect(unsubscribed.data?.unsubscribe).toEqual({ channel: CHANNEL, unsubscribed: true })
        expect((await prefsNow()).unsubscribed).toBe(true)

        // A fresh event is still admitted (the dedupe row exists) but its delivery attempt is created already suppressed:
        // failure_class unsubscribed, zero transport attempts, no digest window.
        const secondTaskId = await completeFreshTask(caller, `${run}-second`)
        const suppressed = await pollUntil(
            "suppressed notification row for the post-unsubscribe event",
            async () => (await database.taskCompleteWithAttempt(me.personId, secondTaskId))[0] ?? null,
            30_000,
            250,
        )
        expect(suppressed.digest_group_id).toBeNull()
        expect(suppressed.state).toBe("suppressed")
        expect(suppressed.failure_class).toBe("unsubscribed")
        expect(suppressed.attempt).toBe(0)
    }, 400_000)
})
