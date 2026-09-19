import {
    Injectable, Optional 
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
 * chain) rather than a permanently-dead branch. The roster is read once from the environment the
 * process starts with; production leaves `AUDIT_OPERATOR_SUBJECTS` unset (no operators, own-lines only)
 * and a deployment that wants one names its comma-separated subject ids there.
 */
const OPERATOR_SUBJECTS_ENV = "AUDIT_OPERATOR_SUBJECTS"

@Injectable()
/** Injectable service owning the audit operator logic the audit capability exposes; wired by the capability's own module. */
export class AuditOperatorService {
    private readonly subjects: ReadonlySet<string>

    constructor(@Optional() subjects?: ReadonlyArray<string>) {
        this.subjects = new Set(subjects ?? AuditOperatorService.subjectsFromEnv())
    }

    /** The environment's operator roster, split on commas and trimmed; empty (so: no operators) when the
   * variable is unset or names nothing. A bare, fail-closed read of one env value - the same boundary
   * AppConfigService reads for every other deployment knob - kept inside the capability that owns the
   * decision rather than widened across a shared config surface. */
    static subjectsFromEnv(): ReadonlyArray<string> {
        return (process.env[OPERATOR_SUBJECTS_ENV] ?? "")
            .split(",")
            .map(subject => subject.trim())
            .filter(Boolean)
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
