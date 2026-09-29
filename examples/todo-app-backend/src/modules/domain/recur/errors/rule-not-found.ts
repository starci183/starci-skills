import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a recurrence rule that cannot be resolved. */
export interface RecurRuleNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The rule id looked up. */
  ruleId?: string;
}

/** House refusal carrying code RECUR_RULE_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the recur rule not found refusal turned on. */
export class RecurRuleNotFoundException extends DomainError {
    constructor({ ruleId, ...metadata }: RecurRuleNotFoundExceptionMetadata = {
    }) {
        super("RECUR_RULE_NOT_FOUND_EXCEPTION",
            "The recurrence rule does not exist.",
            {
                metadata: {
                    ruleId, ...metadata 
                } 
            })
    }
}
