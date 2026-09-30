import "server-only"
import { ORDER_API_URL } from "../config"
import { formatPrice } from "@ecommerce/shared"
import { postGraphql, type GraphqlResult } from "../api"
import type { LineItemRow } from "../types"

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

/** What a read answers when there is no session to read under: the order service's own refusal, without asking it. */
const SIGNED_OUT = { ok: false, reason: "no signed-in session", code: "SESSION_INVALID" } as const

const CART_QUERY = `query ShopCart {
    cart {
        items { productId quantity }
        catalog { id name priceMinorUnits stock }
    }
}`

const ADD_CART_ITEM_MUTATION = `mutation ShopAddCartItem($input: AddCartItemInput!) {
    addCartItem(request: $input) { item { productId quantity } }
}`

const CLEAR_CART_MUTATION = `mutation ShopClearCart {
    clearCart { cleared }
}`

/**
 * Read the signed-in person's cart through the order service's session-guarded `cart` query - the
 * only cart door the backend serves, and also the only door the catalog is read through.
 */
export const fetchCart = async (sessionToken: string | null): Promise<GraphqlResult<CartView>> => {
    if (sessionToken === null) return SIGNED_OUT
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

/** The cart rendered for a page: one row per line, the formatted total, and each product's name for refusal copy. */
export type CartSummary = {
    readonly rows: ReadonlyArray<LineItemRow>
    readonly total: string
    readonly productNames: Readonly<Record<string, string>>
}

/** What a cart the service could not read shows: no rows, a zero total, no names. */
const EMPTY_CART_SUMMARY: CartSummary = { rows: [], total: formatPrice(0, "USD"), productNames: {} }

/**
 * Join the cart's lines with the catalog snapshot for their name and price. A line the catalog no
 * longer knows renders under its product id with no line total, honestly unnamed. `quantityLabel`
 * is the page's own copy for one line's quantity.
 */
export const summarizeCart = (view: CartView, quantityLabel: (count: number) => string): CartSummary => {
    const lineMinorUnits = (line: CartLine): number | null => {
        const product = view.catalog.find((entry) => entry.id === line.productId)
        return product ? product.priceMinorUnits * line.quantity : null
    }
    const total = view.items.reduce((sum, line) => sum + (lineMinorUnits(line) ?? 0), 0)
    return {
        rows: view.items.map((line) => {
            const minorUnits = lineMinorUnits(line)
            return {
                productId: line.productId,
                name: view.catalog.find((entry) => entry.id === line.productId)?.name ?? line.productId,
                quantityLabel: quantityLabel(line.quantity),
                lineTotal: minorUnits === null ? "—" : formatPrice(minorUnits, "USD"),
            }
        }),
        total: formatPrice(total, "USD"),
        productNames: Object.fromEntries(view.catalog.map((product) => [product.id, product.name])),
    }
}

/** One page's read of the cart: the service's answer beside its summary (empty when the cart could not be read). */
export type CartRead = {
    readonly result: GraphqlResult<CartView>
    readonly summary: CartSummary
}

/** Read the signed-in person's cart and summarize it for a page; `null` is an anonymous visitor. */
export const readCart = async (sessionToken: string | null, quantityLabel: (count: number) => string): Promise<CartRead> => {
    const result = await fetchCart(sessionToken)
    return { result, summary: result.ok ? summarizeCart(result.data, quantityLabel) : EMPTY_CART_SUMMARY }
}
