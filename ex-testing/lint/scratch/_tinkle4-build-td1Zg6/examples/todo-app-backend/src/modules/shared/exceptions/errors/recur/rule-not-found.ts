import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a recurrence rule that cannot be resolved. */
export interface RecurRuleNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The rule id looked up. */
  ruleId?: string;
}

/** House refusal carrying code RECUR_RULE_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the recur rule not found refusal turned on. */
export class RecurRuleNotFoundException extends AbstractException {
    constructor({ ruleId, ...metadata }: RecurRuleNotFoundExceptionMetadata = {
    }) {
        super("The recurrence rule does not exist.",
            "RECUR_RULE_NOT_FOUND_EXCEPTION",
            {
                ruleId, ...metadata 
            })
    }
}
