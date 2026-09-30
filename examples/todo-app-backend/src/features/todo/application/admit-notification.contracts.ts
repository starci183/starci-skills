import type { AdmittedNotification, NotifyErrorCode, NotifyPayload } from "@modules/domain/notify"
import type { Outcome } from "@modules/platform/primitives"

/** What admitting an event into the notify pipeline takes. */
export interface AdmitNotificationRequest {
    /** The id of the event that produced the notification, from its producer; the dedupe key is built on it. */
    readonly sourceEventId: string
    /** What happened. */
    readonly kind: string
    /** The person to tell. */
    readonly recipientId: string
    /** The channel to tell them on. */
    readonly channel: string
    /** The scalar facts of the event. */
    readonly payload: NotifyPayload
}

/** How the admission ended, or the refusal that names why nothing was admitted. */
export type AdmitNotificationResult = Outcome<AdmittedNotification, NotifyErrorCode>
