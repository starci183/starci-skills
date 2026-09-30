import { ProductEntity } from "./persistence/entities/product.entity"
import { CreateProducts1789800001000 } from "./persistence/migrations/1789800001000-create-products"

/** The entities of the catalog capability, for the connection that holds them. */
export const catalogEntities = [ProductEntity]

/** The migrations of the catalog capability, in the order they run. */
export const catalogMigrations = [CreateProducts1789800001000]

export type { ProductLookup, ProductView } from "./catalog.contracts"
export { CatalogModule } from "./catalog.module"
export { CatalogService } from "./catalog.service"
