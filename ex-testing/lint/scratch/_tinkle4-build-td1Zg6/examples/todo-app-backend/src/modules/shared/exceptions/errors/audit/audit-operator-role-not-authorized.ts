import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/**
 * The fail-closed refusal behind decision.audit.operator-role. assertOperatorRead throws this when a
 * reader's *verified* claim (AuditOperatorService resolves it from the authenticated subject against the
 * trusted operator roster - the session shape itself carries no role) does not authorize the operator
 * read of fr.audit.log.read: no claim, or a subject the roster does not name, is refused with a stable
 * code before any line is touched, rather than silently widening to a read the caller cannot verify.
 */
export class AuditOperatorRoleNotAuthorizedException extends AbstractException {
    constructor(metadata: AbstractExceptionMetadata = {
    }) {
        super(
            "Not authorized to read the operator audit view: this actor has no verified operator claim.",
            "AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED_EXCEPTION",
            metadata,
        )
    }
}
