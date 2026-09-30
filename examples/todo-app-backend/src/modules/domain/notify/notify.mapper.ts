import { defineQueue } from "@modules/platform/messaging"
import type { OutboxMessage } from "@modules/platform/outbox"
import { isRecord } from "@modules/platform/primitives"
import type {
    NotifyAdmitMessageParams,
    NotifyAdmitPayload,
    NotifyDispatchKind,
    NotifyDispatchMessageParams,
    NotifyDispatchPayload,
    NotifyPayload,
} from "./notify.contracts"

const isScalar = (value: unknown): value is string | number | boolean | null =>
    value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"

const isDispatchKind = (value: unknown): value is NotifyDispatchKind => value === "flush" || value === "retry"

const parsePayload = (value: unknown): NotifyPayload | null => {
    if (!isRecord(value)) return null
    const scalars: Record<string, string | number | boolean | null> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (!isScalar(entry)) return null
        scalars[key] = entry
    }
    return scalars
}

const parseAdmitPayload = (value: unknown): NotifyAdmitPayload | null => {
    if (!isRecord(value)) return null
    const { kind, recipientId, channel, at } = value
    const payload = parsePayload(value.payload)
    if (typeof kind !== "string" || typeof recipientId !== "string" || typeof channel !== "string") return null
    if (typeof at !== "string" || Number.isNaN(Date.parse(at)) || payload === null) return null
    return { kind, recipientId, channel, payload, at }
}

const parseDispatchPayload = (value: unknown): NotifyDispatchPayload | null => {
    if (!isRecord(value)) return null
    const { kind, groupId } = value
    if (!isDispatchKind(kind) || typeof groupId !== "string") return null
    return { kind, groupId }
}

/** The queue that admits events into the notify pipeline: one message per event that may notify someone. */
export const NOTIFY_ADMIT_QUEUE = defineQueue<NotifyAdmitPayload>({
    name: "notify.admit",
    attempts: 5,
    backoffMs: 5_000,
    parse: parseAdmitPayload,
})

/** The queue that dispatches a digest group: the delayed flush when its window closes, and the retry after a failed send. */
export const NOTIFY_DISPATCH_QUEUE = defineQueue<NotifyDispatchPayload>({
    name: "notify.dispatch",
    attempts: 5,
    backoffMs: 5_000,
    parse: parseDispatchPayload,
})

/** The message for the admit queue, written in the transaction of the change that caused it; deliverable at the instant of the event. */
export const toNotifyAdmitMessage = (params: NotifyAdmitMessageParams): OutboxMessage => ({
    queue: NOTIFY_ADMIT_QUEUE.name,
    eventId: params.eventId,
    payload: {
        kind: params.kind,
        recipientId: params.recipientId,
        channel: params.channel,
        payload: params.payload,
        at: params.at.toISOString(),
    },
    availableAt: params.at,
})

/** The message for the dispatch queue, deliverable at `dueAt`; the same event id twice keeps one message. */
export const toNotifyDispatchMessage = (params: NotifyDispatchMessageParams): OutboxMessage => ({
    queue: NOTIFY_DISPATCH_QUEUE.name,
    eventId: params.eventId,
    payload: { kind: params.kind, groupId: params.groupId },
    availableAt: params.dueAt,
})
