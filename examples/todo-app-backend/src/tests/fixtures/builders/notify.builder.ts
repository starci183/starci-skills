import { builder } from "@starci/jest-preset"
import type {
    AdmitDeliveryParams,
    AdmitIntoWindowParams,
    AdmitParams,
    AssignDigestGroupParams,
    FindPreferenceParams,
    FlushWindowParams,
    MarkSendingParams,
    PrepareDispatchParams,
    RecordDeliveryParams,
    SettleDispatchParams,
    UpdatePreferenceParams,
    ChangePreferenceParams,
    DedupeAdmitParams,
    DeliveryAttemptView,
    DispatchPlan,
    NotificationView,
    PreferenceView,
    ReceiveAdmitParams,
    ReceiveDispatchParams,
    UnsubscribeParams,
} from "@modules/domain/notify"

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface NotifyDeliveryAttemptRow {
    notificationId: string
    state: "queued" | "sending" | "delivered" | "bounced" | "suppressed"
    attempt: number
    failureClass: "transient" | "permanent-bounce" | "retries-exhausted" | "unsubscribed" | null
    startedAt: Date | null
    endedAt: Date | null
    history: Array<{
        state: "queued" | "sending" | "delivered" | "bounced" | "suppressed"
        at: string
        failureClass?: "transient" | "permanent-bounce" | "retries-exhausted" | "unsubscribed"
    }>
}

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface NotifyDigestWindowRow {
    id: string
    personId: string
    channel: string
    opensAt: Date
    closesAt: Date
    flushedAt: Date | null
}

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface NotifyNotificationRow {
    id: string
    kind: string
    recipientId: string
    payload: Readonly<Record<string, string | number | boolean | null>>
    digestGroupId: string | null
    createdAt: Date
}

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface NotifyPreferenceRow {
    personId: string
    channel: string
    unsubscribed: boolean
    digestWindowMinutes: number | null
}

/** The instant the notify specs admit and dispatch at. */
export const NOTIFY_AT = "2026-09-30T10:00:00.000Z"

/** An earlier instant, for state recorded before the spec starts. */
export const NOTIFY_EARLIER = "2026-09-30T09:00:00.000Z"

/** A stored notification that already joined digest group w1. */
export const notificationRow = builder<NotifyNotificationRow>({
    id: "n1",
    kind: "task-complete",
    recipientId: "p1",
    payload: { taskId: "t1" },
    digestGroupId: "w1",
    createdAt: new Date(NOTIFY_AT),
})

/** A stored delivery attempt that is queued, with the queued step in its history. */
export const deliveryAttemptRow = builder<NotifyDeliveryAttemptRow>({
    notificationId: "n1",
    state: "queued",
    attempt: 0,
    failureClass: null,
    startedAt: null,
    endedAt: null,
    history: [{ state: "queued", at: NOTIFY_EARLIER }],
})

/** A stored delivery attempt that is sending its first dispatch, started at `NOTIFY_EARLIER`. */
export const sendingAttemptRow = builder<NotifyDeliveryAttemptRow>({
    notificationId: "n1",
    state: "sending",
    attempt: 1,
    failureClass: null,
    startedAt: new Date(NOTIFY_EARLIER),
    endedAt: null,
    history: [
        { state: "queued", at: NOTIFY_EARLIER },
        { state: "sending", at: NOTIFY_EARLIER },
    ],
})

/** A stored digest window of p1 on email that is open at `NOTIFY_AT`: opened five minutes before, closing five minutes after. */
export const digestWindowRow = builder<NotifyDigestWindowRow>({
    id: "w1",
    personId: "p1",
    channel: "email",
    opensAt: new Date("2026-09-30T09:55:00.000Z"),
    closesAt: new Date("2026-09-30T10:05:00.000Z"),
    flushedAt: null,
})

/** A stored preference of p1 on email: subscribed, default window. */
export const preferenceRow = builder<NotifyPreferenceRow>({
    personId: "p1",
    channel: "email",
    unsubscribed: false,
    digestWindowMinutes: null,
})

/** A notification as a caller sees it: same facts as the stored row. */
export const notificationView = builder<NotificationView>({
    id: "n1",
    kind: "task-complete",
    recipientId: "p1",
    payload: { taskId: "t1" },
    digestGroupId: "w1",
    createdAt: new Date(NOTIFY_AT),
})

/** A delivery attempt as a caller sees it: queued, nothing sent yet. */
export const deliveryAttemptView = builder<DeliveryAttemptView>({
    notificationId: "n1",
    state: "queued",
    attempt: 0,
    failureClass: null,
    startedAt: null,
    endedAt: null,
    history: [],
})

/** A preference as a caller sees it: subscribed, default window. */
export const preferenceView = builder<PreferenceView>({
    personId: "p1",
    channel: "email",
    unsubscribed: false,
    digestWindowMinutes: null,
})

/** The input of admitting an event into the dedupe table; the caller adds the manager. */
export const dedupeAdmitInput = builder<Omit<DedupeAdmitParams, "manager">>({
    kind: "task-complete",
    sourceEventId: "evt-1",
    recipientId: "p1",
    payload: { taskId: "t1" },
    at: new Date(NOTIFY_AT),
})

/** The input of admitting an event into the notify pipeline; the caller adds the manager. */
export const admitInput = builder<Omit<AdmitParams, "manager">>({
    kind: "task-complete",
    sourceEventId: "evt-1",
    recipientId: "p1",
    channel: "email",
    payload: { taskId: "t1" },
    at: new Date(NOTIFY_AT),
})

/** A dispatch of two notifications of group w1 that is ready to send. */
export const dispatchPlan = builder<DispatchPlan>({
    notificationIds: ["n1", "n2"],
    groupId: "w1",
    message: { to: "p1", subject: "Subject", body: "Body" },
})

/** A delivered admit message of the task-complete event evt-1. */
export const receiveAdmitInput = builder<ReceiveAdmitParams>({
    eventId: "evt-1",
    kind: "task-complete",
    recipientId: "p1",
    channel: "email",
    payload: { taskId: "t1" },
})

/** A delivered dispatch message that flushes group w1. */
export const receiveDispatchInput = builder<ReceiveDispatchParams>({
    eventId: "notify-flush:w1",
    kind: "flush",
    groupId: "w1",
})

/** The input of changing a preference with no field named. */
export const changePreferenceInput = builder<ChangePreferenceParams>({ personId: "p1", channel: "email" })

/** The input of unsubscribing p1 from email. */
export const unsubscribeInput = builder<UnsubscribeParams>({ personId: "p1", channel: "email" })

/** The input of reading a preference of p1 on email. */
export const findPreferenceInput = builder<FindPreferenceParams>({ personId: "p1", channel: "email" })

/** The input of changing a preference; the caller adds the manager. An empty patch keeps every stored value. */
export const updatePreferenceInput = builder<Omit<UpdatePreferenceParams, "manager">>({
    personId: "p1",
    channel: "email",
    patch: {},
})

/** The input of moving a notification to digest group w1; the caller adds the manager. */
export const assignDigestGroupInput = builder<Omit<AssignDigestGroupParams, "manager">>({
    id: "n1",
    digestGroupId: "w1",
})

/** The input of creating the delivery attempt of notification n1 for a subscribed recipient; the caller adds the manager. */
export const admitDeliveryInput = builder<Omit<AdmitDeliveryParams, "manager">>({
    notificationId: "n1",
    at: new Date(NOTIFY_AT),
    unsubscribed: false,
})

/** The input of starting the dispatch of notification n1; the caller adds the manager. */
export const markSendingInput = builder<Omit<MarkSendingParams, "manager">>({
    notificationIds: ["n1"],
    at: new Date(NOTIFY_AT),
})

/** The input of recording a delivered send of notification n1; the caller adds the manager. */
export const recordDeliveryInput = builder<Omit<RecordDeliveryParams, "manager">>({
    notificationIds: ["n1"],
    verdict: "delivered",
    at: new Date(NOTIFY_AT),
})

/** The input of joining the ten minute email window of p1; the caller adds the manager. */
export const admitIntoWindowInput = builder<Omit<AdmitIntoWindowParams, "manager">>({
    personId: "p1",
    channel: "email",
    at: new Date(NOTIFY_AT),
    windowMinutes: 10,
})

/** The input of flushing window w1; the caller adds the manager. */
export const flushWindowInput = builder<Omit<FlushWindowParams, "manager">>({ windowId: "w1", at: new Date(NOTIFY_AT) })

/** The input of preparing the flush of group w1; the caller adds the manager. */
export const prepareDispatchInput = builder<Omit<PrepareDispatchParams, "manager">>({
    kind: "flush",
    groupId: "w1",
    at: new Date(NOTIFY_AT),
})

/** The input of settling a delivered send of the default dispatch plan; the caller adds the manager. */
export const settleDispatchInput = builder<Omit<SettleDispatchParams, "manager">>({
    plan: dispatchPlan(),
    verdict: "delivered",
    at: new Date(NOTIFY_AT),
})
