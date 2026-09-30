import { ORDER_CONNECTION } from "@modules/platform/database"
import { ProductEntity } from "./entities/product.entity"
import { CreateProducts1789800001000 } from "./migrations/1789800001000-create-products"

/** The connection whose database holds the tables of the catalog capability. */
export const CONNECTION = ORDER_CONNECTION

/** The entities of the catalog capability, for the connection that holds them. */
export const catalogEntities = [ProductEntity]

/** The migrations of the catalog capability, in the order they run. */
export const catalogMigrations = [CreateProducts1789800001000]
