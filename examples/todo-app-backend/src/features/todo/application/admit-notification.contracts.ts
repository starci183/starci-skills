import type { AdmittedNotification, NotifyErrorCode, NotifyPayload } from "@modules/domain/notify"
import type { Outcome } from "@modules/platform/primitives"

/** What admitting an event into the notify pipeline takes. */
export interface AdmitNotificationRequest {
    /** The id of the event that produced the notification, from its producer; the inbox claim and the dedupe key are built on it. */
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

/** How the admission ended (null when the message was already claimed and nothing ran), or the refusal that names why nothing was admitted. */
export type AdmitNotificationResult = Outcome<AdmittedNotification | null, NotifyErrorCode>
