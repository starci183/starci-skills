import {
    AbstractException,
} from "@modules/platform/errors/index"
import type {
    AbstractExceptionMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a rule mutation attempted by someone other than its owner. */
export interface RecurRuleForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  /** The rule id the actor attempted to mutate. */
  ruleId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** Only a rule's own owner may edit or end it. */
export class RecurRuleForbiddenException extends AbstractException {
    constructor({ ruleId, actorId, ...metadata }: RecurRuleForbiddenExceptionMetadata = {
    }) {
        super("This recurrence rule belongs to somebody else.",
            "RECUR_RULE_FORBIDDEN_EXCEPTION",
            {
                ruleId, actorId, ...metadata 
            })
    }
}
