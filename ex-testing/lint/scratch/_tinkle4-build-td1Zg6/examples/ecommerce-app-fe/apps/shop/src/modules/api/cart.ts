import "server-only"
import { ORDER_API_URL } from "../config"
import { postGraphql } from "./graphql"
import type { GraphqlResult } from "./graphql"

/** One cart line as the order service's `cart` query answers it. */
export type CartLine = {
    readonly productId: string
    readonly quantity: number
}

/** A catalog row as the `cart` query's catalog snapshot answers it: id, name, price, live stock. */
export type CatalogProduct = {
    readonly id: string
    readonly name: string
    readonly priceMinorUnits: number
    readonly stock: number
}

/** The cart view: the person's lines plus the catalog snapshot names and prices are read against. */
export type CartView = {
    readonly items: ReadonlyArray<CartLine>
    readonly catalog: ReadonlyArray<CatalogProduct>
}

const CART_QUERY = `query ShopCart {
    cart {
        items { productId quantity }
        catalog { id name priceMinorUnits stock }
    }
}`

const ADD_CART_ITEM_MUTATION = `mutation ShopAddCartItem($input: AddCartItemInput!) {
    addCartItem(input: $input) { item { productId quantity } }
}`

const CLEAR_CART_MUTATION = `mutation ShopClearCart {
    clearCart { cleared }
}`

/**
 * Read the signed-in person's cart through the order service's session-guarded `cart` query - the
 * only cart door the backend serves, and also the only door the catalog is read through.
 */
export const fetchCart = async (sessionToken: string): Promise<GraphqlResult<CartView>> => {
    const result = await postGraphql<{ cart: CartView }>(
        ORDER_API_URL, CART_QUERY, undefined, sessionToken)
    return result.ok ? { ok: true, data: result.data.cart } : result
}

/**
 * Add `quantity` of a product to the person's cart; the service accumulates on
 * (person, product) and answers the line's new total quantity.
 */
export const addCartItem = async (
    sessionToken: string,
    productId: string,
    quantity: number,
): Promise<GraphqlResult<CartLine>> => {
    const result = await postGraphql<{ addCartItem: { item: CartLine } }>(
        ORDER_API_URL, ADD_CART_ITEM_MUTATION, { input: { productId, quantity } }, sessionToken)
    return result.ok ? { ok: true, data: result.data.addCartItem.item } : result
}

/**
 * Empty the person's cart. This is the only removal the service exposes - there is no per-line
 * delete door, so "remove" in this product means clearing the cart, not editing a line.
 */
export const clearCart = async (sessionToken: string): Promise<GraphqlResult<{ cleared: boolean }>> => {
    const result = await postGraphql<{ clearCart: { cleared: boolean } }>(
        ORDER_API_URL, CLEAR_CART_MUTATION, undefined, sessionToken)
    return result.ok ? { ok: true, data: result.data.clearCart } : result
}
