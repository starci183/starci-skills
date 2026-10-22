import type { CartLine } from "@modules/domain/cart"
import type { OrderErrorCode } from "@modules/domain/order"
import type { Outcome } from "@modules/platform/primitives"

/** What adding to the cart takes: the product and how many units. */
export interface AddCartItemRequest {
    /** The SKU. */
    readonly productId: string
    /** How many units to add. */
    readonly quantity: number
}

/** The merged cart line, or the refusal of a product the catalog does not have. */
export type AddCartItemResult = Outcome<CartLine, OrderErrorCode.UnknownProduct>
