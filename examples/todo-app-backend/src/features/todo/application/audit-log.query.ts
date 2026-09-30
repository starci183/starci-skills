import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AuditLogRequest, AuditLogResult } from "./audit-log.contracts"

/** Asks for the audit lines the caller may read: their own, or the whole chain for an administrator. */
export class AuditLogQuery extends Query<AuditLogResult> {
    constructor(readonly params: ExecuteParams<AuditLogRequest>) {
        super()
    }
}
