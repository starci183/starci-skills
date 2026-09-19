import {
    AuditLogLineRecord 
} from "./audit-log-line-record"

/** A line resolved for a reader - the record's fields plus the tombstone, and by construction no
 * sealed actor blob and no keyId (fr.audit.log.read's postcondition). The record itself is kept for
 * the append path, which still names the row id. */
export type ResolvedAuditLine = Omit<AuditLogLineRecord, "id">;
