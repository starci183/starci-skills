import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for an order-service call that could not complete; `message` states which failure answered. */
export interface OrderServiceUnavailableExceptionMetadata extends DomainErrorMetadata {
  /** What the outage looked like - unreachable, or an upstream status that is not the contract. */
  message: string;
}

/**
 * House failure carrying code ORDER_SERVICE_UNAVAILABLE_EXCEPTION, which a transport maps to status 503: the order
 * service could not be reached, or answered a status outside the buyer-status contract
 * (contract.checkout.order-for-identity). An absent answer is not a "no" - the caller learns the
 * dependency failed and must not retry into inventing one.
 */
export class OrderServiceUnavailableException extends DomainError {
    constructor({ message, ...metadata }: OrderServiceUnavailableExceptionMetadata) {
        super("ORDER_SERVICE_UNAVAILABLE_EXCEPTION",
            message,
            {
                metadata: metadata 
            })
    }
}
