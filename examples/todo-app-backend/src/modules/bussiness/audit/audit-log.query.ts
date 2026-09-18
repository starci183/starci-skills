import { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';

export interface AuditLogQueryParams {
  readonly personId: string;
  /**
   * decision.audit.operator-role (decided): there is deliberately no caller-supplied role here. The
   * example's session shape carries no role claim (SessionService.findActive returns a SessionRecord of
   * {token, personId, issuedAt, expiresAt}), so a `role` that rode in on the request would be an
   * unverifiable claim - whoever set it becomes an operator. AuditOperatorService resolves the claim
   * from the authenticated personId against a trusted server-side roster instead, so the operator read
   * below is gated on a verified fact, not on a field the caller controls.
   */
  /** fr.audit.log.read's trigger: "optionally filtered by action or target" - operator read only. */
  readonly action?: string | null;
  readonly target?: string | null;
}

/**
 * A missing/empty personId is refused before anything reads the log: an unfiltered own-lines query
 * would resolve the keystore-less empty keyId and hand back every line in the product, which is
 * exactly the stranger-lookup fr.audit.log.read's refusal exists to prevent.
 */
export const assertReadableActor = (params: AuditLogQueryParams): void => {
  if (!params.personId) {
    throw new AuditOperatorRoleNotAuthorizedException({ actor: '<missing>' });
  }
};

export interface AuditLogLineSummaryResult {
  readonly at: Date;
  readonly action: string;
  readonly target: string | null;
}

export interface AuditLogQueryResult {
  readonly lines: AuditLogLineSummaryResult[];
}

/**
 * The `auditLog` GraphQL query's CQRS read: two authorized readers, dispatched on the caller's verified
 * claim (AuditOperatorService resolves it from the authenticated subject) - an operator's whole-chain
 * filtered read per fr.audit.log.read's mainFlow, or the person's own lines. decision.audit.operator-role
 * is what made the operator branch reachable: it settled that the claim comes from a trusted server-side
 * roster, verified at audit's boundary, not from a role on the request. Until a deployment names an
 * operator subject the roster is empty and only the own-lines branch runs - the honest default, never a
 * stranger's lines and never a fake grant.
 */
export class AuditLogQuery {
  constructor(readonly params: AuditLogQueryParams) {}
}
