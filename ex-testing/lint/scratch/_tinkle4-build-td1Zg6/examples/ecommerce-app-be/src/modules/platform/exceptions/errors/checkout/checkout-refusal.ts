import {
    HttpStatus 
} from "@nestjs/common"
import {
    CheckoutRefusalReason 
} from "@modules/bussiness/order/checkout.policy"
import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/**
 * The refusal verdict the checkout policy produced, carried as exception metadata verbatim so the
 * door answers it unchanged (sds.checkout.order-flow t-refuse): the reason, the product it is
 * about and - for stock - how much was asked and how much the catalog actually had.
 */
export interface CheckoutRefusalExceptionMetadata extends AbstractExceptionMetadata {
  /** The refusal marker - the policy's `ok: false` verdict travels through unchanged. */
  ok: false;
  /** Which named refusal the evaluation produced. */
  reason: CheckoutRefusalReason;
  /** The product the refusal is about ("" for an empty cart). */
  productId: string;
  /** How much was asked - set for stock refusals. */
  requested?: number;
  /** How much the catalog actually had - set for stock refusals. */
  available?: number;
}

/**
 * A named checkout refusal carrying code CHECKOUT_REFUSAL_EXCEPTION: insufficient stock is a 409
 * (a retryable, inventory-bound refusal), every other reason is a 400. The refusal fields spread
 * into the response body beside the code so a client reads `reason` and the stock truth directly -
 * a refusal never renders as a successful (empty) order.
 */
export class CheckoutRefusalException extends AbstractException {
    constructor({ ok, reason, productId, requested, available, ...metadata }: CheckoutRefusalExceptionMetadata) {
        const status = reason === "insufficient-stock" ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST
        super(`The checkout was refused: ${reason}.`,
            "CHECKOUT_REFUSAL_EXCEPTION",
            {
                ok, reason, productId, requested, available, ...metadata 
            },
            status)
    }
}
