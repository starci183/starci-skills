import { CartItemEntity } from "./persistence/entities/cart-item.entity"
import { CreateCartItems1789800002000 } from "./persistence/migrations/1789800002000-create-cart-items"

/** The entities of the cart capability, for the connection that holds them. */
export const cartEntities = [CartItemEntity]

/** The migrations of the cart capability, in the order they run. */
export const cartMigrations = [CreateCartItems1789800002000]

export type { CartLine } from "./cart.contracts"
export { CartModule } from "./cart.module"
export { CartService } from "./cart.service"
export { CART_ERROR_KINDS } from "./errors/cart.error"
