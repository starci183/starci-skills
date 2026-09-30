import { randomUUID } from "node:crypto"
import {
    DELIVERY_ATTEMPTS_OF_NOTIFICATION,
    TASK_COMPLETE_NOTIFICATIONS,
    TASK_COMPLETE_WITH_ATTEMPT,
} from "@tests/fixtures/persistence/e2e-verification.sql"
import type {
    DeliveryAttemptRow,
    NotificationAttemptRow,
    NotificationRow,
} from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    CompleteTaskData,
    CreateTaskData,
    NotificationPreferencesData,
    UnsubscribeData,
    UpdateNotificationPreferencesData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/test-world.service"
import type { SignedInPerson } from "@tests/world/test-world.contracts"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"
import { AppModule as WorkerApp } from "../../../../apps/worker/src/app.module"

const CHANNEL = "email"
/** The mail host answers a temporary refusal: the transient class the notify retry policy knows. */
const SMTP_TRANSIENT_REFUSAL = 451

/**
 * fr.notify.* as one A->Z journey over the real apps: a preference update is honored by the next admission, a real
 * task-complete event flows the real pipeline (an outbox message written with the completion, the worker admit consumer,
 * dedupe, preferences, digest window, a delayed dispatch message, the worker dispatch consumer, the real SMTP client against
 * the mail host fake), a temporary refusal of the mail host is retried and the mail arrives on the retry, and unsubscribe
 * suppresses every later event at admission, before any digest window or transport attempt.
 *
 * Notify public doors are the two mutations and the preferences query; the pipeline effects live in Postgres rows
 * (notify_notifications, notify_delivery_attempts), read through the shared entity manager, and in the mails the fake accepted.
 * The digest window is at least one minute and the retry backoff is thirty seconds, so the mail wait is measured in minutes.
 */
describe("notify preferences journey (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true }, worker: { module: WorkerApp } } })

    const completeFreshTask = async (person: SignedInPerson, title: string): Promise<string> => {
        const created = await person.caller.graphql<CreateTaskData>("createTask", { input: { title } })
        const taskId = created.data?.createTask.taskId ?? ""
        const completed = await person.caller.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
        expect(completed.errorCode).toBeNull()
        return taskId
    }

    it("update prefs -> event notifies -> transient mail refusal retried -> mail delivered -> unsubscribe -> later events suppressed at admission", async () => {
        const run = `e2e-notify-${randomUUID()}`
        const me = await world.signedInPerson("notify")

        const prefsNow = async (): Promise<NotificationPreferencesData["notificationPreferences"] | undefined> => {
            const observed = await me.caller.graphql<NotificationPreferencesData>("notificationPreferences", { input: { channel: CHANNEL } })
            return observed.data?.notificationPreferences
        }

        // No preference row written yet: the default read is subscribed, no digest override.
        expect(await prefsNow()).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: null })

        // Update prefs: the smallest allowed digest window (1 minute) so the run observes a real flush.
        const updated = await me.caller.graphql<UpdateNotificationPreferencesData>("updateNotificationPreferences", {
            input: { channel: CHANNEL, digestWindowMinutes: 1 },
        })
        expect(updated.errorCode).toBeNull()
        expect(updated.data?.updateNotificationPreferences).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: 1 })
        expect(await prefsNow()).toEqual({ channel: CHANNEL, unsubscribed: false, digestWindowMinutes: 1 })

        // Event: completing the task writes the admit message with the completion; the worker admits it after the mutation
        // returned, so the row is awaited into existence, waiting for the joined-a-window state.
        const firstTaskId = await completeFreshTask(me, `${run}-first`)
        const notification = await world.waitFor(
            "task-complete notification joined its digest group",
            async () => {
                const rows: Array<NotificationRow> = await world.db.primary.query(TASK_COMPLETE_NOTIFICATIONS, [me.personId, firstTaskId])
                return rows.find((row) => row.digest_group_id !== null) ?? null
            },
            { timeoutMs: 30_000 },
        )
        expect(notification.digest_group_id).toBeTruthy()

        // The mail host refuses the first send of this recipient with a temporary refusal, so the first dispatch must end
        // classified transient and back in the queue with a retry scheduled.
        await world.fake.smtp.failNext({ status: SMTP_TRANSIENT_REFUSAL, recipient: me.personId })
        const retried = await world.waitFor(
            "the first dispatch classified transient and queued for retry",
            async () => {
                const rows: Array<DeliveryAttemptRow> = await world.db.primary.query(DELIVERY_ATTEMPTS_OF_NOTIFICATION, [notification.id])
                return rows.find((row) => row.attempt >= 1 && row.state === "queued" && row.failure_class === "transient") ?? null
            },
            { timeoutMs: 150_000, intervalMs: 1_000 },
        )
        expect(retried.history.map((entry) => entry.state)).toContain("sending")

        // The retry (thirty seconds later) goes through: the message reaches the mail host, addressed to the recipient, and the
        // attempt settles delivered.
        const mail = await world.waitFor(
            "the digest mail accepted by the mail host",
            async () => (await world.fake.smtp.mails()).find((accepted) => accepted.to === me.personId) ?? null,
            { timeoutMs: 120_000, intervalMs: 1_000 },
        )
        expect(mail.subject).not.toBe("")
        const delivered = await world.waitFor(
            "the delivery attempt settled delivered",
            async () => {
                const rows: Array<DeliveryAttemptRow> = await world.db.primary.query(DELIVERY_ATTEMPTS_OF_NOTIFICATION, [notification.id])
                return rows.find((row) => row.state === "delivered") ?? null
            },
            { timeoutMs: 30_000 },
        )
        expect(delivered.attempt).toBe(2)

        // Unsubscribe: honored for every event admitted after it, immediately.
        const unsubscribed = await me.caller.graphql<UnsubscribeData>("unsubscribe", { input: { channel: CHANNEL } })
        expect(unsubscribed.errorCode).toBeNull()
        expect(unsubscribed.data?.unsubscribe).toEqual({ channel: CHANNEL, unsubscribed: true })
        expect((await prefsNow())?.unsubscribed).toBe(true)

        // A fresh event is still admitted (the dedupe row exists) but its delivery attempt is created already suppressed:
        // failure_class unsubscribed, zero transport attempts, no digest window.
        const secondTaskId = await completeFreshTask(me, `${run}-second`)
        const suppressed = await world.waitFor(
            "suppressed notification row for the post-unsubscribe event",
            async () => {
                const rows: Array<NotificationAttemptRow> = await world.db.primary.query(TASK_COMPLETE_WITH_ATTEMPT, [me.personId, secondTaskId])
                return rows[0] ?? null
            },
            { timeoutMs: 30_000 },
        )
        expect(suppressed.digest_group_id).toBeNull()
        expect(suppressed.state).toBe("suppressed")
        expect(suppressed.failure_class).toBe("unsubscribed")
        expect(suppressed.attempt).toBe(0)
    }, 500_000)
})
