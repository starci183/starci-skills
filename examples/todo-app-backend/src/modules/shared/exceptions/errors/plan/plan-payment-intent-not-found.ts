import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a payment intent that cannot be resolved. */
export interface PlanPaymentIntentNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The payment intent id looked up (data.plan.payment-intent's own id, the idempotency key). */
  intentId?: string;
}

/**
 * fr.plan.reconcile / the webhook path: a reconciliation poll or a gateway webhook naming an intent id
 * this product never created has nothing to apply against - refused rather than silently ignored, so a
 * stray or forged reference is visible instead of a false success.
 */
export class PlanPaymentIntentNotFoundException extends AbstractException {
  constructor({ intentId, ...metadata }: PlanPaymentIntentNotFoundExceptionMetadata = {}) {
    super('The payment intent does not exist.', 'PLAN_PAYMENT_INTENT_NOT_FOUND', { intentId, ...metadata });
  }
}
