export interface AuditLogQueryParams {
  readonly personId: string;
}

export interface AuditLogLineSummaryResult {
  readonly at: Date;
  readonly action: string;
  readonly target: string | null;
}

export interface AuditLogQueryResult {
  readonly lines: AuditLogLineSummaryResult[];
}

/**
 * The `auditLog` GraphQL query's CQRS read: the caller's own lines only. gap.audit.operator-role stays
 * todo (no admin role exists in this example), so this query is intentionally narrower than
 * fr.audit.log.read's own mainFlow ("an authorized operator asks to see recent activity... optionally
 * filtered by action or target"): it authorizes a person to read exactly their own lines, never anyone
 * else's, and takes no action/target filter. fr.audit.log.read itself remains todo until an operator
 * role exists to authorize the wider read that record actually describes.
 */
export class AuditLogQuery {
  constructor(readonly params: AuditLogQueryParams) {}
}
