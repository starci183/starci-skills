import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a rule mutation attempted by someone other than its owner. */
export interface RecurRuleForbiddenExceptionMetadata extends DomainErrorMetadata {
  /** The rule id the actor attempted to mutate. */
  ruleId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** Only a rule's own owner may edit or end it. */
export class RecurRuleForbiddenException extends DomainError {
    constructor({ ruleId, actorId, ...metadata }: RecurRuleForbiddenExceptionMetadata = {
    }) {
        super("RECUR_RULE_FORBIDDEN_EXCEPTION",
            "This recurrence rule belongs to somebody else.",
            {
                metadata: {
                    ruleId, actorId, ...metadata 
                } 
            })
    }
}
