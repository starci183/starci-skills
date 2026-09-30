import type { CartLine } from "@modules/domain/cart"
import type { ProductView } from "@modules/domain/catalog"

/** Reading the cart takes no input: it is the caller own cart. */
export type GetCartRequest = Readonly<Record<string, never>>

/** The cart view: the caller cart lines plus the catalog snapshot the confirmation prices against. */
export interface GetCartResult {
    /** The lines of the caller cart. */
    readonly items: ReadonlyArray<CartLine>
    /** The catalog products. */
    readonly catalog: ReadonlyArray<ProductView>
}
