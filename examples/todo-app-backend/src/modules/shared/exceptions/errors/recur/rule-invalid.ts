import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a rule submission whose frequency-specific fields do not match data.recur.rule's own invariant. */
export interface RecurRuleInvalidExceptionMetadata extends AbstractExceptionMetadata {
  /** Why the submission is invalid, e.g. "n is required for every-n-days". */
  reason?: string;
}

/**
 * data.recur.rule's invariant: `dayOfMonth` is required and 1-31 when frequency is `monthly-day` (and
 * absent otherwise); `n` is required and a positive integer when frequency is `every-n-days` (and absent
 * otherwise). This refusal is about that shape, never about a day-of-month value that simply does not
 * exist in every month - decision.recur.impossible-date explicitly keeps that case out of creation-time
 * refusal.
 */
export class RecurRuleInvalidException extends AbstractException {
  constructor({ reason, ...metadata }: RecurRuleInvalidExceptionMetadata = {}) {
    super('The recurrence rule submission is invalid.', 'RECUR_RULE_INVALID', { reason, ...metadata });
  }
}
