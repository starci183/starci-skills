import { defineQueue } from "@modules/platform/messaging"
import type { OutboxMessage } from "@modules/platform/outbox"
import { isRecord } from "@modules/platform/primitives"
import { AuditAction } from "./audit.contracts"
import type { AuditAppendMessageParams, AuditAppendPayload } from "./audit.contracts"

/** Reads a stored payload back; null when it is not an audit append payload. */
const parseAuditAppend = (value: unknown): AuditAppendPayload | null => {
    if (!isRecord(value)) return null
    const { actorId, action, target, at } = value
    const knownAction = Object.values(AuditAction).find((candidate) => candidate === action)
    if (typeof actorId !== "string" || knownAction === undefined) return null
    const knownTarget = target === null ? null : typeof target === "string" ? target : undefined
    if (knownTarget === undefined) return null
    if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null
    return { actorId, action: knownAction, target: knownTarget, at }
}

/** The queue that carries the lines every capability wants on the audit log; the audit consumer appends them. */
export const AUDIT_APPEND_QUEUE = defineQueue<AuditAppendPayload>({
    name: "audit.append",
    attempts: 5,
    backoffMs: 5000,
    parse: parseAuditAppend,
})

/** Builds the outbox message a producer writes in the transaction of the change it audits. */
export const toAuditAppendMessage = (params: AuditAppendMessageParams): OutboxMessage => {
    const payload: AuditAppendPayload = {
        actorId: params.actorId,
        action: params.action,
        target: params.target,
        at: params.at.toISOString(),
    }
    return { queue: AUDIT_APPEND_QUEUE.name, eventId: params.eventId, payload, availableAt: params.at }
}
