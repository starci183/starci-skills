import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a plan action attempted against somebody else's subscription. */
export interface PlanForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  /** The subscription id the actor attempted to act on. */
  subscriptionId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/**
 * data.plan.subscription's own invariant ("exactly one subscription row exists per personId; a person's
 * plan is looked up, never listed") implies no owner ever reconciles or reads another person's payment
 * intent or subscription. Mirrors br.task.single-owner's TaskForbiddenException shape for the plan
 * feature's own actions (fr.plan.reconcile, fr.plan.downgrade).
 */
export class PlanForbiddenException extends AbstractException {
  constructor({ subscriptionId, actorId, ...metadata }: PlanForbiddenExceptionMetadata = {}) {
    super('This subscription belongs to somebody else.', 'PLAN_FORBIDDEN', { subscriptionId, actorId, ...metadata });
  }
}
