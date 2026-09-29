import {
    CheckoutRefusalReason 
} from "ecommerce-app-be/modules/domain/order"
import {
    DomainError 
} from "../domain-error"
import type {
    DomainErrorMetadata 
} from "../domain-error"

/**
 * The refusal verdict the checkout policy produced, carried as exception metadata verbatim so the
 * door answers it unchanged (sds.checkout.order-flow t-refuse): the reason, the product it is
 * about and - for stock - how much was asked and how much the catalog actually had.
 */
export interface CheckoutRefusalExceptionMetadata extends DomainErrorMetadata {
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
 * A named checkout refusal carrying code CHECKOUT_REFUSAL_EXCEPTION: insufficient stock is a retryable,
 * inventory-bound refusal a transport maps to 409, every other reason to 400. The refusal fields spread
 * into the response body beside the code so a client reads `reason` and the stock truth directly -
 * a refusal never renders as a successful (empty) order.
 */
export class CheckoutRefusalException extends DomainError {
    constructor({ ok, reason, productId, requested, available, ...metadata }: CheckoutRefusalExceptionMetadata) {
        super("CHECKOUT_REFUSAL_EXCEPTION",
            `The checkout was refused: ${reason}.`,
            {
                metadata: {
                    ok, reason, productId, requested, available, ...metadata 
                } 
            })
    }
}
