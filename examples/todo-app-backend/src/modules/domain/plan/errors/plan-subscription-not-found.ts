import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a subscription row that cannot be resolved by id. */
export interface PlanSubscriptionNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The subscription id looked up. */
  subscriptionId?: string;
}

/**
 * data.plan.subscription: exactly one subscription row exists per personId, created lazily on first
 * read/write by SubscriptionService.getOrCreate; this exception guards the narrow internal path where a
 * transition is asked to act on a subscription id that does not (or no longer) resolve to a row.
 */
export class PlanSubscriptionNotFoundException extends DomainError {
    constructor({ subscriptionId, ...metadata }: PlanSubscriptionNotFoundExceptionMetadata = {
    }) {
        super("PLAN_SUBSCRIPTION_NOT_FOUND_EXCEPTION",
            "The subscription does not exist.",
            {
                metadata: {
                    subscriptionId, ...metadata 
                } 
            })
    }
}
