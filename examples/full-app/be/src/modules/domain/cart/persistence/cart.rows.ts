import type { CartLine } from "../cart.contracts"

/** The row UPSERT_CART_ITEM answers. */
export interface CartItemRow {
    /** The SKU. */
    product_id: string
    /** The merged quantity. */
    quantity: number
}

/** The cart line of the row an upsert answers, or null when it answered none. */
export const toCartLine = (rows: ReadonlyArray<CartItemRow>): CartLine | null => {
    const row = rows[0]
    return row ? { productId: row.product_id, quantity: row.quantity } : null
}
