import type { LineItemRow } from "@ecommerce/ui"
import type { QueryCartResponse } from "@/modules/api/graphql/queries/types/cart"

/** The page's own words and number format: one line's quantity label, and a minor-unit amount as display text. */
export type CartLabels = {
    readonly quantity: (count: number) => string
    readonly price: (minorUnits: number) => string
}

/** The cart rendered for a page: one row per line, the formatted total, and each product's name for refusal copy. */
export type CartSummary = {
    readonly rows: ReadonlyArray<LineItemRow>
    readonly total: string
    readonly productNames: Readonly<Record<string, string>>
}

/**
 * Joins the cart's lines with the catalogue snapshot for their name and price. A line the catalogue no longer knows
 * renders under its product id with no line total, honestly unnamed.
 */
export const summarizeCart = (view: QueryCartResponse, labels: CartLabels): CartSummary => {
    const productOf = (productId: string) => view.catalog.find((entry) => entry.id === productId)
    const lineMinorUnits = (productId: string, quantity: number): number | null => {
        const product = productOf(productId)
        return product ? product.priceMinorUnits * quantity : null
    }
    const total = view.items.reduce((sum, line) => sum + (lineMinorUnits(line.productId, line.quantity) ?? 0), 0)
    return {
        rows: view.items.map((line) => {
            const minorUnits = lineMinorUnits(line.productId, line.quantity)
            return {
                productId: line.productId,
                name: productOf(line.productId)?.name ?? line.productId,
                quantityLabel: labels.quantity(line.quantity),
                lineTotal: minorUnits === null ? "—" : labels.price(minorUnits),
            }
        }),
        total: labels.price(total),
        productNames: Object.fromEntries(view.catalog.map((product) => [product.id, product.name])),
    }
}
