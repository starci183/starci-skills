import type { EntityManager } from "typeorm"
import type { ProductView } from "@modules/domain/catalog"

/** The columns of a catalog product row. */
export interface ProductRow {
    /** The SKU. */
    id: string
    /** The display name. */
    name: string
    /** The unit price in minor units. */
    priceMinorUnits: number
    /** How many units can still be sold. */
    stock: number
}

/** The table the catalog rows live in. */
const PRODUCTS = "products"

/** A catalog product row with valid defaults; the spec overrides only what matters. */
export const productRow = (overrides: Partial<ProductRow> = {}): ProductRow => ({
    id: "sku-1",
    name: "Shirt",
    priceMinorUnits: 500,
    stock: 4,
    ...overrides,
})

/** The product view the catalog answers, with valid defaults. */
export const productView = (overrides: Partial<ProductView> = {}): ProductView => ({
    id: "sku-1",
    name: "Shirt",
    priceMinorUnits: 500,
    stock: 4,
    ...overrides,
})

/** Arranges catalog rows in a real database, constraints on. */
export const productBuilder = (manager: EntityManager) => ({
    /** Creates the product, or applies the overrides to the one the seed already holds under that id, and answers the stored row. */
    async build(overrides: Partial<ProductRow> = {}): Promise<ProductRow> {
        const wanted = productRow(overrides)
        const existing = await manager.findOneBy<ProductRow>(PRODUCTS, { id: wanted.id })
        const stored: ProductRow = { ...(existing ?? wanted), ...overrides }
        await manager.save(PRODUCTS, stored)
        return stored
    },
})
