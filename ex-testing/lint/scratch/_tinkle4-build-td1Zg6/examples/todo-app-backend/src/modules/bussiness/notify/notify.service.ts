import {
    Injectable 
} from "@nestjs/common"
import {
    NotifySmtpMessage 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    NotifyQueuePort 
} from "@modules/integrations/notify-queue/notify-queue.contracts"
import {
    DedupeService 
} from "./dedupe.service"
import {
    DigestService, DEFAULT_DIGEST_WINDOW_MINUTES 
} from "./digest.service"
import {
    PreferencesService 
} from "./preferences.service"
import {
    DeliveryService 
} from "./delivery.service"
import {
    DeliveryState 
} from "./types/delivery-attempt-record"
import {
    NotificationRecord 
} from "./types/notification-record"

const FLUSH_PREFIX = "flush:"
const RETRY_PREFIX = "retry:"
/** A fixed backoff between a transient failure and the next dispatch attempt of the same group.
 * sds.notify.delivery-lifecycle names only that a retry re-enters `queued` for another t-dispatch, not a
 * particular backoff curve, so a correct change to this constant is not a protocol change (see that
 * record's `sequence.note`). */
const RETRY_BACKOFF_MS = 30_000

/** Contract naming the admit event input shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface AdmitEventInput {
  readonly kind: string;
  readonly sourceEventId: string;
  readonly recipientId: string;
  readonly channel: string;
  readonly payload: Record<string, unknown>;
}

/** Contract naming the admit event result shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface AdmitEventResult {
  readonly notificationId: string;
  readonly isNew: boolean;
  readonly deliveryState: DeliveryState;
}

/**
 * The notify pipeline: ties DedupeService, PreferencesService, DigestService and DeliveryService
 * together into the one sequence fr.notify.on-completion, fr.notify.on-new-device, fr.notify.digest and
 * fr.notify.unsubscribe all describe. `admit` is what every event subscriber (notify-event.subscriber.ts)
 * and every retried transport call into; `runDueJobs` is what the real timer (notify.scheduler.ts) and
 * every test that wants to move time forward call - the queue (integration.notify.queue) is the only
 * thing that knows when a window has closed or a retry's backoff has elapsed, so this class never reads
 * a wall clock itself except for the `now` a caller passes in.
 */
@Injectable()
/** Injectable service owning the notify logic the notify capability exposes; wired by the capability's own module. */
export class NotifyService {
    constructor(
    private readonly dedupe: DedupeService,
    private readonly digest: DigestService,
    private readonly preferences: PreferencesService,
    private readonly delivery: DeliveryService,
    private readonly queue: NotifyQueuePort,
    ) {}

    /**
   * br.notify.delivery.once: a retried admission (isNew: false) never re-runs preference checks, never
   * touches the digest window and never creates a second delivery attempt - it just reads back what the
   * first admission already decided. br.notify.failure.classified.suppresses-unsubscribed: an
   * unsubscribed recipient's attempt is created already suppressed and never joins a digest window at
   * all, so it can never be batched into a message that would have gone out anyway.
   */
    async admit(input: AdmitEventInput, now: Date = new Date()): Promise<AdmitEventResult> {
        const { record, isNew } = await this.dedupe.admit(input)
        if (!isNew) {
            const attempt = await this.delivery.findById(record.id)
            return {
                notificationId: record.id, isNew: false, deliveryState: attempt?.state ?? "queued" 
            }
        }

        const preference = await this.preferences.get(input.recipientId,
            input.channel)
        const attempt = await this.delivery.admit(record.id,
            now,
            preference.unsubscribed)

        if (!preference.unsubscribed) {
            const windowMinutes = preference.digestWindowMinutes ?? DEFAULT_DIGEST_WINDOW_MINUTES
            const window = await this.digest.admit(input.recipientId,
                input.channel,
                now,
                windowMinutes)
            await this.dedupe.assignDigestGroup(record.id,
                window.windowId)
            if (window.opened) {
                await this.queue.enqueue(`${FLUSH_PREFIX}${window.windowId}`,
                    window.closesAt.getTime())
            }
        }

        return {
            notificationId: record.id, isNew: true, deliveryState: attempt.state 
        }
    }

    /** Drains every job the queue currently reports as due - a window whose close time has passed, or a
   * retry whose backoff has elapsed - and dispatches it. Called on a real wall-clock tick in production
   * (notify.scheduler.ts) and directly, with an advanced `now`, by specs. */
    async runDueJobs(now: Date = new Date()): Promise<void> {
        const jobIds = await this.queue.dequeueDue(now.getTime())
        for (const jobId of jobIds) {
            if (jobId.startsWith(FLUSH_PREFIX)) {
                await this.flushWindow(jobId.slice(FLUSH_PREFIX.length),
                    now)
            } else if (jobId.startsWith(RETRY_PREFIX)) {
                await this.dispatchGroup(jobId.slice(RETRY_PREFIX.length),
                    now)
            }
        }
    }

    private async flushWindow(windowId: string, now: Date): Promise<void> {
        const flushed = await this.digest.flush(windowId,
            now)
        if (!flushed) return // already flushed, or not actually closed yet - nothing to dispatch
        await this.dispatchGroup(windowId,
            now)
    }

    /** t-dispatch (or a retry's immediate redispatch) for every still-queued member of one digest group,
   * as one rendered message. */
    private async dispatchGroup(groupId: string, now: Date): Promise<void> {
        const notifications = await this.dedupe.findByDigestGroup(groupId)
        if (notifications.length === 0) return
        const message = renderMessage(notifications)
        const result = await this.delivery.dispatchBatch(notifications.map(notification => notification.id),
            now,
            message)
        if (result.retried.length > 0) {
            await this.queue.enqueue(`${RETRY_PREFIX}${groupId}`,
                now.getTime() + RETRY_BACKOFF_MS)
        }
    }
}

/** fr.notify.on-completion's postcondition: "one message names the task". No contract exposes a way to
 * resolve a personId to an email address today, so this demo addresses the message to the recipientId
 * itself - a real product would resolve that through a person-directory port this feature does not have. */
function renderMessage(notifications: Array<NotificationRecord>): NotifySmtpMessage {
    const to = notifications[0].recipientId
    if (notifications.length === 1) {
        return {
            to, subject: subjectFor(notifications[0]), body: lineFor(notifications[0]) 
        }
    }
    return {
        to,
        subject: `${notifications.length} updates`,
        body: notifications.map(lineFor).join("\n"),
    }
}

function subjectFor(notification: NotificationRecord): string {
    if (notification.kind === "task-complete") {
        return `Task completed: ${String(notification.payload.taskId ?? "")}`
    }
    return `Notification: ${notification.kind}`
}

function lineFor(notification: NotificationRecord): string {
    return `- ${notification.kind}: ${JSON.stringify(notification.payload)}`
}
