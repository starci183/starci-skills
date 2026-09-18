import type { PlatformEventHandler } from '../../platform/events';
import { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';
import { AuditLogLineSummaryResult } from './audit-log.query';
import type { ResolvedAuditLine } from './types/resolved-audit-line';

/**
 * gap.audit.operator-role, coded against how `session` resolves the actor today: SessionRecord is
 * {token, personId, issuedAt, expiresAt} and SessionService.findActive hands back exactly that - no
 * role claim exists anywhere in the session or person shape (data.login.person has no role field), so
 * an operator authorization cannot be checked without inventing one.
 *
 * The seam is a pure, unit-tested check rather than a Nest Guard class so it can guard CQRS handlers
 * too, not just HTTP resolvers. Call sites pass the claims they actually resolved from the live
 * session (every audit call site passes `role: undefined` today, read straight off the SessionRecord
 * shape); if sds.login.session-store later grows a role claim, the only change is which value the call
 * sites pass in - this check already honors operator/operator:* and denies everything else,
 * fail-closed.
 */
export interface ActorClaims {
  readonly personId: string;
  readonly role?: string;
}

const isOperator = (role: string | undefined): boolean =>
  role === 'operator' || role === 'operator:*';

export interface OperatorFilter {
  readonly action?: string | null;
  readonly target?: string | null;
}

/** fr.audit.log.read's mainFlow step 1 ("The operator's authorization is checked") enforced before any
 * line is touched: no role claim -> typed refusal, never a fallback grant. */
export function assertOperatorRead(claims: ActorClaims): void {
  if (!isOperatorRead(claims)) {
    throw new AuditOperatorRoleNotAuthorizedException({ actor: claims.personId });
  }
}

/** Whether a caller's resolved claim authorizes the operator read - the guard's boolean face, used by
 * AuditLogHandler to choose which read to run. It never grants by default: this is the one claim
 * rule, asserted or asked, never two rules that can drift. */
export function isOperatorRead(claims: ActorClaims): boolean {
  return isOperator(claims.role);
}

/**
 * The operator read's per-line resolution: AuditLogService.readAllLines resolves every line through
 * readLine, so a tombstoned line reads back as tombstoned here exactly as it does on the own-lines
 * path (fr.audit.log.read's mainFlow), and the response keeps the record's postcondition by
 * construction - a resolved line carries no sealed actor blob and no keyId to leak.
 */
export function toAuditLineSummary(record: ResolvedAuditLine): AuditLogLineSummaryResult {
  return { at: record.at, action: record.action, target: record.target };
}

/** fr.audit.log.read's trigger: "optionally filtered by action or target". */
export function matchOperatorFilter(record: ResolvedAuditLine, filter: OperatorFilter): boolean {
  return (filter.action == null || record.action === filter.action) && (filter.target == null || record.target === filter.target);
}

/**
 * contract.audit.emitted-events' consumer half as data: the five kinds this lane declares, mapped to
 * the action each seals; anything outside the vocabulary - like the bus's NewDeviceSigninEvent, typed
 * but unproduced - is ignored, never failed. Keyed by the literal `kind` each event class carries
 * (platform/events/events.types.ts); AuditEventSubscriber narrows by `instanceof` exactly as the bus's
 * comment prescribes and looks its action label up here, so the vocabulary is stated once.
 */
export const AUDIT_SEALED_ACTIONS = {
  'event.task.created': 'task.created',
  'event.task.completed': 'task.completed',
  'event.task.deleted': 'task.deleted',
  'event.login.signed-in': 'login.signed-in',
  'event.login.signed-out': 'login.signed-out',
} as const;

export type { PlatformEventHandler };
