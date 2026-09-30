import { ORDER_CONNECTION } from "@modules/platform/database"
import { CartItemEntity } from "./entities/cart-item.entity"
import { CreateCartItems1789800002000 } from "./migrations/1789800002000-create-cart-items"

/** The connection whose database holds the tables of the cart capability. */
export const CONNECTION = ORDER_CONNECTION

/** The entities of the cart capability, for the connection that holds them. */
export const cartEntities = [CartItemEntity]

/** The migrations of the cart capability, in the order they run. */
export const cartMigrations = [CreateCartItems1789800002000]
