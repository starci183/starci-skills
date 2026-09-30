import type { CartLine } from "@modules/domain/cart"
import type { AddCartItemRequest } from "../../application/add-cart-item.contracts"
import { toCartLineType } from "./cart-line.mapper"
import type { AddCartItemInput } from "./dto/add-cart-item.input"
import type { AddCartItemType } from "./dto/add-cart-item.type"

/** Maps the GraphQL input to the command request. */
export const toAddCartItemRequest = (input: AddCartItemInput): AddCartItemRequest => ({
    productId: input.productId,
    quantity: input.quantity,
})

/** Maps the merged cart line to the GraphQL type. */
export const toAddCartItemType = (line: CartLine): AddCartItemType => ({ item: toCartLineType(line) })
