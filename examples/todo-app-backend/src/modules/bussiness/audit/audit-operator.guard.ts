import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ActorClaims,
  assertOperatorRead,
  isOperatorRead,
} from './audit-operator-read';

export { AuditOperatorRoleNotAuthorizedException } from './audit-operator-role.guard';
export { AUDIT_SEALED_ACTIONS } from './audit-operator-read';
export type { OperatorFilter } from './audit-operator-read';
/**
 * gap.audit.operator-role, coded against how `session` resolves the actor today: SessionRecord is
 * {token, personId, issuedAt, expiresAt} and SessionService.findActive hands back exactly that - no
 * role claim exists anywhere in the session or person shape (data.login.person has no role field), so
 * an operator authorization cannot be checked without inventing one.
 *
 * The check is a pure, unit-tested function pair (audit-operator-read.ts) that the read handlers call
 * directly - it guards CQRS use cases, not just HTTP resolvers, which is why this class carries no
 * Nest CanActivate: the refusal must fire before a handler touches a line no matter what transport
 * reached it. Call sites pass the claims they actually resolved from the live session (every audit
 * call site passes `role: undefined` today, read straight off the SessionRecord shape); if
 * sds.login.session-store later grows a role claim, the only change is which value the call sites
 * pass in - the check already honors operator/operator:* and denies everything else, fail-closed.
 */
@Injectable()
export class AuditOperatorGuard {
  assertCanRead(claims: ActorClaims): void {
    assertOperatorRead(claims);
  }

  canRead(claims: ActorClaims): boolean {
    return isOperatorRead(claims);
  }

  /** Transport face for a future HTTP/GraphQL context, kept honest: an actor the context never
   * resolved is an empty claim, and an empty claim is a denial, never a fallback grant. */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ actor?: ActorClaims }>();
    this.assertCanRead(request.actor ?? { personId: 'unknown' });
    return true;
  }
}
