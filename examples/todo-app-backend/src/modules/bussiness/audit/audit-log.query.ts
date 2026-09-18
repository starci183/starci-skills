import { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';

export interface AuditLogQueryParams {
  readonly personId: string;
  /**
   * gap.audit.operator-role: the caller's resolved role claim, straight off the live session shape.
   * SessionService.findActive returns a SessionRecord of {token, personId, issuedAt, expiresAt} -
   * there is no role anywhere in it, so resolvers pass nothing today and every query without an
   * operator claim gets the person's own lines only (the honest subset this example can authorize).
   * When sds.login.session-store grows a role claim, passing it through is the resolver's only change:
   * the operator read below - the whole chain, optionally filtered by action or target - is gated on
   * exactly this field, fail-closed.
   */
  readonly role?: string;
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
 * The `auditLog` GraphQL query's CQRS read: two authorized readers, dispatched on the caller's
 * resolved claim (audit-operator-read.ts) - an operator's whole-chain filtered read per
 * fr.audit.log.read's mainFlow, or the person's own lines. gap.audit.operator-role stays open (rev 2)
 * because the example's session shape resolves no role claim at all, so today only the own-lines
 * branch is reachable - the honest subset, never a stranger's lines and never a fake grant.
 */
export class AuditLogQuery {
  constructor(readonly params: AuditLogQueryParams) {}
}
