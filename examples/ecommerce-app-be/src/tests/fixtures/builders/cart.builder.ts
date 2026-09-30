import { CartItemEntity } from "@modules/domain/cart"
import type { CartLine } from "@modules/domain/cart"

/** A cart line row with valid defaults; the spec overrides only what matters. */
export const cartItemEntity = (overrides: Partial<CartItemEntity> = {}): CartItemEntity =>
    Object.assign(
        new CartItemEntity(),
        { id: "00000000-0000-4000-8000-0000000000c1", personId: "p-1", productId: "sku-1", quantity: 1 },
        overrides,
    )

/** The cart line the cart answers, with valid defaults. */
export const cartLine = (overrides: Partial<CartLine> = {}): CartLine => ({
    productId: "sku-1",
    quantity: 1,
    ...overrides,
})
