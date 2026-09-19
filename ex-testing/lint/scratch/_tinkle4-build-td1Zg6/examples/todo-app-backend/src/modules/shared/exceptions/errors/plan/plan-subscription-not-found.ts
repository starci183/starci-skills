import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a subscription row that cannot be resolved by id. */
export interface PlanSubscriptionNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The subscription id looked up. */
  subscriptionId?: string;
}

/**
 * data.plan.subscription: exactly one subscription row exists per personId, created lazily on first
 * read/write by SubscriptionService.getOrCreate; this exception guards the narrow internal path where a
 * transition is asked to act on a subscription id that does not (or no longer) resolve to a row.
 */
export class PlanSubscriptionNotFoundException extends AbstractException {
    constructor({ subscriptionId, ...metadata }: PlanSubscriptionNotFoundExceptionMetadata = {
    }) {
        super("The subscription does not exist.",
            "PLAN_SUBSCRIPTION_NOT_FOUND_EXCEPTION",
            {
                subscriptionId, ...metadata 
            })
    }
}
