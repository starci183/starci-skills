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
 * decision.audit.operator-role (decided), coded against how the actor is resolved today. The check is a
 * pure function pair (audit-operator-read.ts) that the read handlers call directly - it guards CQRS use
 * cases, not just HTTP resolvers, which is why this class carries no Nest CanActivate requirement: the
 * refusal must fire before a handler touches a line no matter what transport reached it.
 *
 * What the decision settled is *who may hold an operator claim and where it comes from*: a caller-supplied
 * `role` is never trusted (the session shape carries no role - SessionRecord is {token, personId, issuedAt,
 * expiresAt} and data.login.person has no role field), so a role that rode in on the request would be an
 * unverifiable claim. AuditOperatorService resolves the authenticated subject against a trusted server-side
 * operator roster instead, and only a claim it mints reaches this check. The check honors operator and
 * operator:* and denies everything else, fail-closed: no claim, or a subject the roster does not name,
 * refuses and reads the caller's own lines - never a silently broader read.
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
