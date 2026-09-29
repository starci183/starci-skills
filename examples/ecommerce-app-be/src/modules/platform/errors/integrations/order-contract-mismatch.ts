import {
    HttpStatus 
} from "@nestjs/common"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for an order-service answer outside its contract; no extra fields required. */
export interface OrderContractMismatchExceptionMetadata extends AbstractExceptionMetadata {
}

/**
 * House failure carrying code ORDER_CONTRACT_MISMATCH_EXCEPTION and status 503: the order service
 * answered 2xx but outside the buyer-status contract - an unreadable body, a personId that does not
 * match the asked one, or a hasOrders that is not a boolean.
 */
export class OrderContractMismatchException extends AbstractException {
    constructor({ ...metadata }: OrderContractMismatchExceptionMetadata) {
        super("The order service answered outside its contract.",
            "ORDER_CONTRACT_MISMATCH_EXCEPTION",
            metadata,
            HttpStatus.SERVICE_UNAVAILABLE)
    }
}
