import "server-only"
import { fetchCart } from "./cart"
import type { GraphqlResult } from "./graphql"

/**
 * A catalogue row as the shop renders it. The order service serves catalog data on the
 * session-guarded `cart` query's catalog snapshot - there is no public product list - so a browse
 * read is a signed-in read. `imageUrl` stays optional on purpose: the service serves none and the
 * tile renders a neutral glyph instead of a broken <img>.
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
export const fetchProducts = async (
    sessionToken: string,
): Promise<GraphqlResult<ReadonlyArray<Product>>> => {
    const result = await fetchCart(sessionToken)
    if (!result.ok) return result
    return {
        ok: true,
        data: result.data.catalog.map((product) => ({
            id: product.id,
            name: product.name,
            priceCents: product.priceMinorUnits,
            currency: "USD",
            stock: product.stock,
        })),
    }
}
