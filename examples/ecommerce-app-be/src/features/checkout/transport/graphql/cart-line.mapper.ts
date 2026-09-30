import type { CartLine } from "@modules/domain/cart"
import type { CartLineType } from "./dto/cart-line.type"

/** Maps a cart line to the GraphQL type; the cart query and the add mutation answer the same shape. */
export const toCartLineType = (line: CartLine): CartLineType => ({ productId: line.productId, quantity: line.quantity })
