import type { EntityManager } from "typeorm"

/** One cart line as the doors answer it: the product and how many of it the person holds. */
export interface CartLine {
    /** The SKU. */
    readonly productId: string
    /** How many units the person holds. */
    readonly quantity: number
}

/** What reading a cart needs. */
export interface ListCartParams {
    /** The cart owner. */
    readonly personId: string
}

/** What adding to a cart needs; the write joins the caller transaction. */
export interface AddCartItemParams extends ListCartParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The SKU. */
    readonly productId: string
    /** How many units to add. */
    readonly quantity: number
}

/** What clearing a cart needs; the write joins the caller transaction. */
export interface ClearCartParams extends ListCartParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
}
