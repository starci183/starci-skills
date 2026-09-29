import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/** Metadata for an order-service answer outside its contract; no extra fields required. */
export interface OrderContractMismatchExceptionMetadata extends DomainErrorMetadata {
}

/**
 * House failure carrying code ORDER_CONTRACT_MISMATCH_EXCEPTION, which a transport maps to status 503: the order service
 * answered 2xx but outside the buyer-status contract - an unreadable body, a personId that does not
 * match the asked one, or a hasOrders that is not a boolean.
 */
export class OrderContractMismatchException extends DomainError {
    constructor({ ...metadata }: OrderContractMismatchExceptionMetadata) {
        super("ORDER_CONTRACT_MISMATCH_EXCEPTION",
            "The order service answered outside its contract.",
            {
                metadata: metadata 
            })
    }
}
