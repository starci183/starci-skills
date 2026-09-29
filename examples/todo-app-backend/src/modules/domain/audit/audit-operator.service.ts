import {
    Inject, Injectable
} from "@nestjs/common"
import {
    ActorClaims, isOperatorRead 
} from "./audit-operator-read"

/**
 * decision.audit.operator-role (decided): who may hold an operator claim, and where it comes from.
 *
 * The example has no role on the session shape - `SessionService.findActive` hands back a SessionRecord
 * of {token, personId, issuedAt, expiresAt} (sds.login.session-store) and data.login.person has no role
 * field - so threading a caller-supplied `role` string into the check would be authorizing on an
 * *unverifiable* claim: any code path that set `role: 'operator'` becomes an operator. This service is
 * the trusted source that claim is checked against instead: it maps an already-authenticated subject
 * (the `personId` contract.login.identity-for-task resolves from the live session) to a role by looking
 * it up in a server-side operator roster, so the only lever that can make a reader an operator is which
 * subjects the deployment lists - never a value that rode in on the request.
 *
 * Fail-closed by construction: an unset, empty or malformed roster lists no subject, so every actor
 * resolves to no claim and `AuditLogHandler` runs the own-lines read - exactly the honest default the
 * gap documented, now reachable in the other direction (a configured operator actually reads the whole
 * chain) rather than a permanently-dead branch. The roster comes from configuration
 * (`AppConfigService.getAuditOperatorSubjects`) through the `AUDIT_OPERATOR_SUBJECTS` provider; production
 * leaves the variable unset (no operators, own-lines only) and a deployment that wants one names its
 * comma-separated subject ids there.
 */

/** The injection token of the operator roster: the subject ids the deployment trusts as operators. */
export const AUDIT_OPERATOR_SUBJECTS = "AUDIT_OPERATOR_SUBJECTS"

@Injectable()
/** Injectable service owning the audit operator logic the audit capability exposes; wired by the capability's own module. */
export class AuditOperatorService {
    private readonly subjects: ReadonlySet<string>

    constructor(@Inject(AUDIT_OPERATOR_SUBJECTS) subjects: ReadonlyArray<string>) {
        this.subjects = new Set(subjects)
    }

    /** The verified claim for an authenticated subject: an operator role only when the trusted roster
   * names that subject, otherwise no claim at all. This is the sole place the operator role is minted -
   * nothing downstream can upgrade an actor who was not resolved here. */
    claimFor(personId: string): ActorClaims {
        return {
            personId, role: this.subjects.has(personId) ? "operator" : undefined 
        }
    }

    /** Whether an authenticated subject's verified claim authorizes the operator read. */
    isOperator(personId: string): boolean {
        return isOperatorRead(this.claimFor(personId))
    }
}
