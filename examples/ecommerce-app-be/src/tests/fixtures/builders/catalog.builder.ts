import type { EntityManager } from "typeorm"
import { ProductEntity } from "@modules/domain/catalog"
import type { ProductView } from "@modules/domain/catalog"

/** A catalog product row with valid defaults; the spec overrides only what matters. */
export const productEntity = (overrides: Partial<ProductEntity> = {}): ProductEntity =>
    Object.assign(new ProductEntity(), { id: "sku-1", name: "Shirt", priceMinorUnits: 500, stock: 4 }, overrides)

/** The product view the catalog answers, with valid defaults. */
export const productView = (overrides: Partial<ProductView> = {}): ProductView => ({
    id: "sku-1",
    name: "Shirt",
    priceMinorUnits: 500,
    stock: 4,
    ...overrides,
})

/** Arranges catalog rows in a real database. */
export const productBuilder = (manager: EntityManager) => ({
    /** Creates the product, or resets the one the seed already holds under that id, and answers the stored row. */
    async build(overrides: Partial<ProductEntity> = {}): Promise<ProductEntity> {
        const wanted = productEntity(overrides)
        const existing = await manager.findOneBy(ProductEntity, { id: wanted.id })
        return manager.save(
            ProductEntity,
            manager.create(ProductEntity, existing ? { ...existing, ...overrides } : wanted),
        )
    },
})
