import type { GetCartResult } from "../../application/get-cart.contracts"
import { toCartLineType } from "./cart-line.mapper"
import type { CartType } from "./dto/cart.type"

/** Maps the cart view to the GraphQL type. */
export const toCartType = (view: GetCartResult): CartType => ({
    items: view.items.map(toCartLineType),
    catalog: view.catalog.map((product) => ({
        id: product.id,
        name: product.name,
        priceMinorUnits: product.priceMinorUnits,
        stock: product.stock,
    })),
})
