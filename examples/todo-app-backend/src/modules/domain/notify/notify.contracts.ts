import type { NotifySmtpMessageParams } from "@modules/integrations/notify-smtp"
import type { EntityManager } from "typeorm"

/** The email channel, the only channel notifications are sent on today. */
export const NOTIFY_CHANNEL_EMAIL = "email"

/** The kind of the notification that tells an owner a task was completed. */
export const NOTIFY_KIND_TASK_COMPLETE = "task-complete"

/** The scalar facts of an event, as they travel in a message and are stored with the notification. */
export type NotifyPayload = Readonly<Record<string, string | number | boolean | null>>

/** The states of one delivery attempt. */
export type DeliveryState = "queued" | "sending" | "delivered" | "bounced" | "suppressed"

/** Why a delivery attempt failed or was suppressed. */
export type FailureClass = "transient" | "permanent-bounce" | "retries-exhausted" | "unsubscribed"

/** What one send to the mail host came to. */
export type DeliveryVerdict = "delivered" | "permanent-bounce" | "transient"

/** The two reasons a group is dispatched: its digest window closed, or a failed send is retried. */
export type NotifyDispatchKind = "flush" | "retry"

/** One step of the history of a delivery attempt. */
export interface DeliveryHistoryEntry {
    /** The state entered. */
    readonly state: DeliveryState
    /** When it was entered, as an ISO instant. */
    readonly at: string
    /** The failure class recorded with the step, when there is one. */
    readonly failureClass?: FailureClass
}

/** The payload of a message on the admit queue. */
export interface NotifyAdmitPayload {
    /** What happened. */
    readonly kind: string
    /** The person to tell. */
    readonly recipientId: string
    /** The channel to tell them on. */
    readonly channel: string
    /** The scalar facts of the event. */
    readonly payload: NotifyPayload
    /** When the event happened, as an ISO instant. */
    readonly at: string
}

/** The payload of a message on the dispatch queue. */
export interface NotifyDispatchPayload {
    /** Whether the group is flushed because its window closed, or retried after a failed send. */
    readonly kind: NotifyDispatchKind
    /** The digest group, which is the id of its digest window. */
    readonly groupId: string
}

/** A notification as callers see it. */
export interface NotificationView {
    /** The dedupe key. */
    readonly id: string
    /** What happened. */
    readonly kind: string
    /** The person to tell. */
    readonly recipientId: string
    /** The scalar facts of the event. */
    readonly payload: NotifyPayload
    /** The digest group it joined, null until it joins one. */
    readonly digestGroupId: string | null
    /** When it was admitted. */
    readonly createdAt: Date
}

/** A delivery attempt as callers see it. */
export interface DeliveryAttemptView {
    /** The notification it delivers. */
    readonly notificationId: string
    /** Where it is in its lifecycle. */
    readonly state: DeliveryState
    /** How many dispatches were started. */
    readonly attempt: number
    /** Why it failed or was suppressed. */
    readonly failureClass: FailureClass | null
    /** When the first dispatch started. */
    readonly startedAt: Date | null
    /** When it reached a terminal state. */
    readonly endedAt: Date | null
    /** Every state it went through. */
    readonly history: ReadonlyArray<DeliveryHistoryEntry>
}

/** A digest window as callers see it. */
export interface DigestWindowView {
    /** The window id, also the digest group id. */
    readonly id: string
    /** The person the window belongs to. */
    readonly personId: string
    /** The channel it collects for. */
    readonly channel: string
    /** When it opened. */
    readonly opensAt: Date
    /** When it closes. */
    readonly closesAt: Date
    /** When it was flushed, null while open. */
    readonly flushedAt: Date | null
}

/** The preference of one person on one channel. */
export interface PreferenceView {
    /** The person. */
    readonly personId: string
    /** The channel. */
    readonly channel: string
    /** True when the person opted out of the channel. */
    readonly unsubscribed: boolean
    /** The digest window override in minutes, null for the default. */
    readonly digestWindowMinutes: number | null
}

/** The fields of a preference a caller changes; an omitted field keeps its current value. */
export interface PreferencePatch {
    /** The new opt-out flag. */
    readonly unsubscribed?: boolean | undefined
    /** The new digest window in minutes; null clears the override. */
    readonly digestWindowMinutes?: number | null | undefined
}

/** What reading a preference needs. */
export interface FindPreferenceParams {
    /** The person. */
    readonly personId: string
    /** The channel. */
    readonly channel: string
}

/** What changing a preference needs; the write joins the caller transaction. */
export interface UpdatePreferenceParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person. */
    readonly personId: string
    /** The channel. */
    readonly channel: string
    /** The fields to change. */
    readonly patch: PreferencePatch
}

/** What admitting a notification into the dedupe table needs; the write joins the caller transaction. */
export interface DedupeAdmitParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** What happened. */
    readonly kind: string
    /** The id of the event that produced it, from its producer. */
    readonly sourceEventId: string
    /** The person to tell. */
    readonly recipientId: string
    /** The scalar facts of the event. */
    readonly payload: NotifyPayload
    /** The admission instant. */
    readonly at: Date
}

/** The answer of the dedupe table. */
export interface DedupeAdmitResult {
    /** The notification, new or already admitted. */
    readonly notification: NotificationView
    /** True only when this call inserted it. */
    readonly isNew: boolean
}

/** What assigning a notification to its digest group needs; the write joins the caller transaction. */
export interface AssignDigestGroupParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The notification id. */
    readonly id: string
    /** The digest group. */
    readonly digestGroupId: string
}

/** What reading a digest group needs. */
export interface FindDigestGroupParams {
    /** The digest group. */
    readonly groupId: string
}

/** What creating the delivery attempt of a notification needs; the write joins the caller transaction. */
export interface AdmitDeliveryParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The notification. */
    readonly notificationId: string
    /** The admission instant. */
    readonly at: Date
    /** True when the recipient opted out: the attempt is created suppressed. */
    readonly unsubscribed: boolean
}

/** What reading one delivery attempt needs. */
export interface FindDeliveryParams {
    /** The notification. */
    readonly notificationId: string
}

/** What moving queued attempts to sending needs; the writes join the caller transaction. */
export interface MarkSendingParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The notifications of the group. */
    readonly notificationIds: ReadonlyArray<string>
    /** The instant the dispatch starts. */
    readonly at: Date
}

/** What recording the outcome of a send needs; the writes join the caller transaction. */
export interface RecordDeliveryParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The notifications that were sent together. */
    readonly notificationIds: ReadonlyArray<string>
    /** What the send came to. */
    readonly verdict: DeliveryVerdict
    /** The instant the outcome is recorded. */
    readonly at: Date
}

/** How the attempts of one send were settled. */
export interface RecordedDelivery {
    /** The notifications that were delivered. */
    readonly delivered: ReadonlyArray<string>
    /** The notifications that go back to queued for another try. */
    readonly retried: ReadonlyArray<string>
    /** The notifications that were bounced for good. */
    readonly bounced: ReadonlyArray<string>
    /** The highest attempt number among the settled attempts. */
    readonly attempt: number
}

/** What joining a digest window needs; the write joins the caller transaction. */
export interface AdmitIntoWindowParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person. */
    readonly personId: string
    /** The channel. */
    readonly channel: string
    /** The admission instant. */
    readonly at: Date
    /** The window length in minutes when a new window opens. */
    readonly windowMinutes: number
}

/** The window a notification joined. */
export interface AdmittedIntoWindow {
    /** The window id. */
    readonly windowId: string
    /** True only when this call opened a new window; the one flush is scheduled then. */
    readonly opened: boolean
    /** When the window closes. */
    readonly closesAt: Date
}

/** What flushing a window needs; the write joins the caller transaction. */
export interface FlushWindowParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The window id. */
    readonly windowId: string
    /** The instant of the flush. */
    readonly at: Date
}

/** A window that was flushed. */
export interface FlushedWindow {
    /** The window id. */
    readonly windowId: string
    /** The person it belongs to. */
    readonly personId: string
    /** The channel it collected for. */
    readonly channel: string
}

/** What admitting an event into the notify pipeline needs; the writes join the caller transaction. */
export interface AdmitParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** What happened. */
    readonly kind: string
    /** The id of the event that produced it, from its producer. */
    readonly sourceEventId: string
    /** The person to tell. */
    readonly recipientId: string
    /** The channel to tell them on. */
    readonly channel: string
    /** The scalar facts of the event. */
    readonly payload: NotifyPayload
    /** The admission instant. */
    readonly at: Date
}

/** How an admission ended. */
export interface AdmittedNotification {
    /** The notification id, which is its dedupe key. */
    readonly notificationId: string
    /** False when the same event was admitted before and nothing was written. */
    readonly isNew: boolean
    /** The state of its delivery attempt. */
    readonly deliveryState: DeliveryState
}

/** What preparing a dispatch needs; the writes join the caller transaction. */
export interface PrepareDispatchParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** Flush a closed window, or retry a group. */
    readonly kind: NotifyDispatchKind
    /** The digest group. */
    readonly groupId: string
    /** The instant of the dispatch. */
    readonly at: Date
}

/** A dispatch that is ready to send: the attempts already marked sending and the message they share. */
export interface DispatchPlan {
    /** The notifications whose attempts moved to sending. */
    readonly notificationIds: ReadonlyArray<string>
    /** The digest group. */
    readonly groupId: string
    /** The rendered message, one for the whole group. */
    readonly message: NotifySmtpMessageParams
}

/** What settling a sent dispatch needs; the writes join the caller transaction. */
export interface SettleDispatchParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The dispatch that was sent. */
    readonly plan: DispatchPlan
    /** What the send came to. */
    readonly verdict: DeliveryVerdict
    /** The instant the outcome is recorded. */
    readonly at: Date
}

/** How many notifications of a dispatch ended in each way. */
export interface DispatchedGroup {
    /** Delivered. */
    readonly delivered: number
    /** Back to queued, with a retry message written. */
    readonly retried: number
    /** Bounced for good. */
    readonly bounced: number
}
