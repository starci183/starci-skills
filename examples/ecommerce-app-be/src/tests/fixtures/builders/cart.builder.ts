import type { CartLine } from "@modules/domain/cart"

/** The columns of a cart line row. */
export interface CartItemRow {
    /** The row id. */
    id: string
    /** The cart owner. */
    personId: string
    /** The SKU. */
    productId: string
    /** How many units the person holds. */
    quantity: number
}

/** A cart line row with valid defaults; the spec overrides only what matters. */
export const cartItemRow = (overrides: Partial<CartItemRow> = {}): CartItemRow => ({
    id: "00000000-0000-4000-8000-0000000000c1",
    personId: "p-1",
    productId: "sku-1",
    quantity: 1,
    ...overrides,
})

/** The cart line the cart answers, with valid defaults. */
export const cartLine = (overrides: Partial<CartLine> = {}): CartLine => ({
    productId: "sku-1",
    quantity: 1,
    ...overrides,
})
