import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a recurrence rule that cannot be resolved. */
export interface RecurRuleNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The rule id looked up. */
  ruleId?: string;
}

export class RecurRuleNotFoundException extends AbstractException {
  constructor({ ruleId, ...metadata }: RecurRuleNotFoundExceptionMetadata = {}) {
    super('The recurrence rule does not exist.', 'RECUR_RULE_NOT_FOUND', { ruleId, ...metadata });
  }
}
