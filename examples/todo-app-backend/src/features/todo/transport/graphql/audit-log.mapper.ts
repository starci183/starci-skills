import type { AuditLogRead, AuditLogRequest } from "../../application/audit-log.contracts"
import type { AuditLogArgs } from "./dto/audit-log.args"
import type { AuditLogType } from "./dto/audit-log.type"

/** Maps the GraphQL arguments to the query request; an absent filter is null. */
export const toAuditLogRequest = (args: AuditLogArgs): AuditLogRequest => ({
    action: args.action ?? null,
    target: args.target ?? null,
})

/** Maps the lines the caller may read to the GraphQL types. */
export const toAuditLogType = (read: AuditLogRead): Array<AuditLogType> =>
    read.lines.map((line) => ({ at: line.at, action: line.action, target: line.target }))
