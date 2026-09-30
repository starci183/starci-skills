import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { productRow, productView } from "@tests/fixtures/builders/catalog.builder"
import { In, MoreThanOrEqual } from "typeorm"
import { CatalogService } from "./catalog.service"
import { ProductEntity } from "./persistence/entities/product.entity"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [CatalogService, { provide: ORDER_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(CatalogService)
}

describe("CatalogService", () => {
    describe("list", () => {
        it("returns every product by SKU, capped at the list maximum", async () => {
            const em = mockEntityManager({
                find: [
                    ProductEntity,
                    [
                        productRow({ id: "sku-1", stock: 3 }),
                        productRow({ id: "sku-2", priceMinorUnits: 900, stock: 0 }),
                    ],
                ],
            })

            expect(await (await build(em)).list()).toEqual([
                productView({ id: "sku-1", stock: 3 }),
                productView({ id: "sku-2", priceMinorUnits: 900, stock: 0 }),
            ])
            expect(em.find).toHaveBeenCalledWith(ProductEntity, { order: { id: "ASC" }, take: LIST_ROWS_MAX })
        })
    })

    describe("byIds", () => {
        it("returns the products keyed by id and leaves an unknown id absent", async () => {
            const em = mockEntityManager({ find: [ProductEntity, [productRow({ id: "sku-1", stock: 3 })]] })

            const lookup = await (await build(em)).byIds({ ids: ["sku-1", "sku-9"] })

            expect(lookup).toEqual({ "sku-1": productView({ id: "sku-1", stock: 3 }) })
            expect(lookup["sku-9"]).toBeUndefined()
            expect(em.find).toHaveBeenCalledWith(ProductEntity, {
                where: { id: In(["sku-1", "sku-9"]) },
                take: LIST_ROWS_MAX,
            })
        })

        it("returns an empty lookup for no id without reading the database", async () => {
            const em = mockEntityManager()

            expect(await (await build(em)).byIds({ ids: [] })).toEqual({})
        })
    })

    describe("reserveStock", () => {
        it("takes the units with a guarded decrement and returns true when a row changed", async () => {
            const manager = mockEntityManager({ decrement: [ProductEntity, { affected: 1 }] })

            const reserved = await (
                await build(mockEntityManager())
            ).reserveStock({
                manager,
                productId: "sku-1",
                quantity: 2,
            })

            expect(reserved).toBe(true)
            expect(manager.decrement).toHaveBeenCalledWith(
                ProductEntity,
                { id: "sku-1", stock: MoreThanOrEqual(2) },
                "stock",
                2,
            )
        })

        it("returns false when the stock no longer covers the quantity", async () => {
            const manager = mockEntityManager({ decrement: [ProductEntity, { affected: 0 }] })

            expect(
                await (await build(mockEntityManager())).reserveStock({ manager, productId: "sku-1", quantity: 9 }),
            ).toBe(false)
        })

        it("returns false when the driver reports no affected count", async () => {
            const manager = mockEntityManager({ decrement: [ProductEntity, {}] })

            expect(
                await (await build(mockEntityManager())).reserveStock({ manager, productId: "sku-1", quantity: 1 }),
            ).toBe(false)
        })
    })
})
