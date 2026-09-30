import "server-only"
import type { Outcome } from "@ecommerce/api"
import { fetchCart } from "./cart"

/**
 * A catalogue row as the shop renders it. The order service serves catalog data on the
 * session-guarded `cart` query's catalog snapshot - there is no public product list - so a browse
 * read is a signed-in read. `imageUrl` stays optional on purpose: the service serves none and the
 * tile renders a neutral glyph instead of a broken image.
 */
export type Product = {
    readonly id: string
    readonly name: string
    readonly priceCents: number
    readonly currency: string
    readonly stock: number
    readonly imageUrl?: string
}

/**
 * Read the browse catalogue through the order service's `cart` query - the catalog snapshot that
 * rides beside the cart lines. Prices arrive in minor units and `placeOrder` totals answer in
 * USD, which is the currency every row renders.
 */
export const fetchProducts = async (sessionToken: string | null): Promise<Outcome<ReadonlyArray<Product>>> => {
    const outcome = await fetchCart(sessionToken)
    if (outcome.kind !== "ok") return outcome
    return {
        kind: "ok",
        data: outcome.data.catalog.map((product) => ({
            id: product.id,
            name: product.name,
            priceCents: product.priceMinorUnits,
            currency: "USD",
            stock: product.stock,
        })),
    }
}
