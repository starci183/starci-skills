import { builder } from "@starci/jest-preset"
import { AuditAction } from "@modules/domain/audit"
import type {
    AppendDeliveredLineParams,
    AppendLineParams,
    AuditErasureRequestRow,
    AuditKeyRow,
    AuditLogLineRow,
    CompleteOwnErasureParams,
    ErasureStepParams,
    ReadAuditLogParams,
    RequestErasureParams,
    RequestOwnErasureParams,
} from "@modules/domain/audit"

/** The instant the audit specs stamp lines and requests with. */
export const AUDIT_AT = "2026-09-30T10:00:00.000Z"

/** A later instant, for the moment a step of a request happens. */
export const AUDIT_LATER = "2026-09-30T11:00:00.000Z"

/** The link of the first line of the chain; the value the chain policy starts from. */
export const AUDIT_GENESIS_HASH = "GENESIS"

/** A stored erasure request just after it was made, before anyone verified it. */
export const auditErasureRow = builder<AuditErasureRequestRow>({
    requestId: "r1",
    personId: "p1",
    state: "requested",
    requestedAt: new Date(AUDIT_AT),
    verifiedAt: null,
    refusedAt: null,
    executingAt: null,
    completedAt: null,
})

/** A stored per-person key whose material is 32 zero bytes, base64 encoded. */
export const auditKeyRow = builder<AuditKeyRow>({
    personId: "p1",
    keyId: "k1",
    key: Buffer.alloc(32).toString("base64"),
    createdAt: new Date(AUDIT_AT),
})

/** A stored log line, sealed under key k1, first in the chain. */
export const auditLogLineRow = builder<AuditLogLineRow>({
    id: "1",
    at: new Date(AUDIT_AT),
    action: AuditAction.TaskCreated,
    target: "t1",
    keyId: "k1",
    actor: "sealed-p1",
    prevHash: AUDIT_GENESIS_HASH,
    hash: "h1",
})

/** The input of opening an erasure request; the caller adds the manager. */
export const requestErasureInput = builder<Omit<RequestErasureParams, "manager">>({
    personId: "p1",
    at: new Date(AUDIT_LATER),
})

/** The input of one erasure step by the subject; the caller adds the manager. */
export const erasureStepInput = builder<Omit<ErasureStepParams, "manager">>({
    requestId: "r1",
    callerId: "p1",
    at: new Date(AUDIT_LATER),
})

/** The input of opening the erasure request of the caller through the transactional door. */
export const requestOwnErasureInput = builder<RequestOwnErasureParams>({ personId: "p1" })

/** The input of completing the erasure request of the caller through the transactional door. */
export const completeOwnErasureInput = builder<CompleteOwnErasureParams>({ requestId: "r1", callerId: "p1" })

/** The input of appending a line; the caller adds the manager. */
export const appendLineInput = builder<Omit<AppendLineParams, "manager">>({
    actorId: "p1",
    action: AuditAction.TaskCompleted,
    target: "t1",
    at: new Date(AUDIT_AT),
})

/** The input of appending a delivered line. */
export const appendDeliveredInput = builder<AppendDeliveredLineParams>({
    eventId: "e1",
    actorId: "p1",
    action: AuditAction.TaskCompleted,
    target: "t1",
    at: new Date(AUDIT_AT),
})

/** The input of reading the log as an ordinary member with no filter. */
export const readAuditLogInput = builder<ReadAuditLogParams>({
    principalId: "p1",
    roles: [],
    action: null,
    target: null,
})
