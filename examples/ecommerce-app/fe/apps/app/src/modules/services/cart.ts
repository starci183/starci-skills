import "server-only"
import { isRecord, parseList, parseOutcome, requestGraphql, type Outcome } from "@ecommerce/api"
import { orderApiUrl } from "../config"
import type { LineItemRow } from "@ecommerce/ui"
import { DOCUMENTS } from "./__generated__/documents"

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
const SIGNED_OUT: Outcome<never> = { kind: "refused", code: "SESSION_INVALID" }

/** One cart line of the wire, or `null` when the row is not that shape. */
const toCartLine = (row: unknown): CartLine | null =>
    isRecord(row) && typeof row.productId === "string" && typeof row.quantity === "number"
        ? { productId: row.productId, quantity: row.quantity }
        : null

/** One catalog row of the wire, or `null` when the row is not that shape. */
const toCatalogProduct = (row: unknown): CatalogProduct | null =>
    isRecord(row) &&
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.priceMinorUnits === "number" &&
    typeof row.stock === "number"
        ? { id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock }
        : null

/** The cart view of a `cart` payload, or `null` when the payload is not that shape. */
const toCartView = (data: unknown): CartView | null => {
    if (!isRecord(data)) return null
    const items = parseList(data.items, toCartLine)
    const catalog = parseList(data.catalog, toCatalogProduct)
    return items === null || catalog === null ? null : { items, catalog }
}

/** The line an `addCartItem` payload answers with, or `null` when the payload is not that shape. */
const toAddedLine = (data: unknown): CartLine | null => (isRecord(data) ? toCartLine(data.item) : null)

/** Whether a `clearCart` payload says the cart is empty. */
const toCleared = (data: unknown): boolean | null =>
    isRecord(data) && typeof data.cleared === "boolean" ? data.cleared : null

/**
 * Read the signed-in person's cart through the order service's session-guarded `cart` query - the
 * only cart door the backend serves, and also the only door the catalog is read through.
 */
export const fetchCart = async (sessionToken: string | null): Promise<Outcome<CartView>> => {
    if (sessionToken === null) return SIGNED_OUT
    return parseOutcome(
        await requestGraphql({ baseUrl: orderApiUrl(), document: DOCUMENTS.ShopCart, token: sessionToken }),
        toCartView,
    )
}

/**
 * Add `quantity` of a product to the person's cart; the service accumulates on
 * (person, product) and answers the line's new total quantity.
 */
export const addCartItem = async (
    sessionToken: string,
    productId: string,
    quantity: number,
): Promise<Outcome<CartLine>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: orderApiUrl(),
            document: DOCUMENTS.ShopAddCartItem,
            variables: { input: { productId, quantity } },
            token: sessionToken,
        }),
        toAddedLine,
    )

/**
 * Empty the person's cart. This is the only removal the service exposes - there is no per-line
 * delete door, so "remove" in this product means clearing the cart, not editing a line.
 */
export const clearCart = async (sessionToken: string): Promise<Outcome<boolean>> =>
    parseOutcome(
        await requestGraphql({ baseUrl: orderApiUrl(), document: DOCUMENTS.ShopClearCart, token: sessionToken }),
        toCleared,
    )

/** The cart rendered for a page: one row per line, the formatted total, and each product's name for refusal copy. */
export type CartSummary = {
    readonly rows: ReadonlyArray<LineItemRow>
    readonly total: string
    readonly productNames: Readonly<Record<string, string>>
}

/** The page's own words and number format: one line's quantity label, and a minor-unit amount as display text. */
export type CartLabels = {
    readonly quantity: (count: number) => string
    readonly price: (minorUnits: number) => string
}

/**
 * Join the cart's lines with the catalog snapshot for their name and price. A line the catalog no
 * longer knows renders under its product id with no line total, honestly unnamed.
 */
export const summarizeCart = (view: CartView, labels: CartLabels): CartSummary => {
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
                quantityLabel: labels.quantity(line.quantity),
                lineTotal: minorUnits === null ? "—" : labels.price(minorUnits),
            }
        }),
        total: labels.price(total),
        productNames: Object.fromEntries(view.catalog.map((product) => [product.id, product.name])),
    }
}

/** One page's read of the cart: the service's answer beside its summary (empty when the cart could not be read). */
export type CartRead = {
    readonly outcome: Outcome<CartView>
    readonly summary: CartSummary
}

/** Read the signed-in person's cart and summarize it for a page; `null` is an anonymous visitor. */
export const readCart = async (sessionToken: string | null, labels: CartLabels): Promise<CartRead> => {
    const outcome = await fetchCart(sessionToken)
    return {
        outcome,
        summary:
            outcome.kind === "ok"
                ? summarizeCart(outcome.data, labels)
                : { rows: [], total: labels.price(0), productNames: {} },
    }
}
