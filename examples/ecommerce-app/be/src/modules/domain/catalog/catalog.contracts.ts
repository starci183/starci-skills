import type { EntityManager } from "typeorm"

/** A catalog product as the doors answer it: id, name, the minor-unit price and the live stock. */
export interface ProductView {
    /** The SKU. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The unit price in minor units. */
    readonly priceMinorUnits: number
    /** How many units can still be sold. */
    readonly stock: number
}

/** Product views by requested id; an id with no product is absent. */
export interface ProductLookup {
    /** The product with this SKU, when the catalog has one. */
    readonly [id: string]: ProductView | undefined
}

/** What looking products up by id needs. */
export interface ProductsByIdsParams {
    /** The SKUs asked for. */
    readonly ids: ReadonlyArray<string>
}

/** What reserving stock needs; the write joins the caller transaction. */
export interface ReserveStockParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The SKU. */
    readonly productId: string
    /** How many units to take. */
    readonly quantity: number
}
