import type { AuditLineView, ErasureRequestView, ResolvedAuditLine } from "../audit.contracts"
import type { AuditErasureRequestEntity } from "./entities/audit-erasure-request.entity"

/** Maps an erasure request row to the view callers get. */
export const toErasureRequestView = (row: AuditErasureRequestEntity): ErasureRequestView => ({
    requestId: row.requestId,
    personId: row.personId,
    state: row.state,
    requestedAt: row.requestedAt,
    verifiedAt: row.verifiedAt,
    refusedAt: row.refusedAt,
    executingAt: row.executingAt,
    completedAt: row.completedAt,
})

/** Maps a resolved line to what a reader sees: never the actor. */
export const toAuditLineView = (line: ResolvedAuditLine): AuditLineView => ({
    at: line.at,
    action: line.action,
    target: line.target,
})
