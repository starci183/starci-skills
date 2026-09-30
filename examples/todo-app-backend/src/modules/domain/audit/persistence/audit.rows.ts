import type { ErasureRequestView } from "../audit.contracts"
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
