import { CatalogService } from "@modules/domain/catalog"
import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { readStock } from "../../fixtures/persistence/e2e-verification.rows"
import { CATALOG_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * catalog: the guarded stock decrement under real concurrency. The real catalog module over the order database, no HTTP:
 * two checkouts that race for the last unit each take a transaction, and the database decides. Exactly one wins, stock ends
 * at zero and never below; a transaction that reserves and then fails gives the unit back.
 */
describe("catalog: stock reservation (integration)", () => {
    const world = useTestWorld({ modules: CATALOG_CAPABILITY_MODULES })

    it("two simultaneous checkouts for the last unit: exactly one takes it and stock ends at zero", async () => {
        await productBuilder(world.db.order).build({
            id: "sku-race",
            name: "Race product",
            priceMinorUnits: 1000,
            stock: 1,
        })
        const catalog = world.resolve(CatalogService)

        const outcomes = await Promise.all(
            [1, 2].map(() =>
                world.db.order.transaction((manager) =>
                    catalog.reserveStock({ manager, productId: "sku-race", quantity: 1 }),
                ),
            ),
        )

        expect(outcomes.filter(Boolean)).toHaveLength(1)
        expect(await readStock(world.db.order, "sku-race")).toBe(0)
    })

    it("a reservation that is rolled back leaves the stock untouched", async () => {
        await productBuilder(world.db.order).build({
            id: "sku-rollback",
            name: "Rollback product",
            priceMinorUnits: 1000,
            stock: 3,
        })
        const catalog = world.resolve(CatalogService)

        await expect(
            world.db.order.transaction(async (manager) => {
                await catalog.reserveStock({ manager, productId: "sku-rollback", quantity: 2 })
                return Promise.reject(new TypeError("the confirmation failed after the reservation"))
            }),
        ).rejects.toThrow("the confirmation failed")

        expect(await readStock(world.db.order, "sku-rollback")).toBe(3)
    })

    it("refuses a reservation the stock cannot cover and takes nothing", async () => {
        await productBuilder(world.db.order).build({
            id: "sku-short",
            name: "Short product",
            priceMinorUnits: 1000,
            stock: 1,
        })
        const catalog = world.resolve(CatalogService)

        const reserved = await world.db.order.transaction((manager) =>
            catalog.reserveStock({ manager, productId: "sku-short", quantity: 2 }),
        )

        expect(reserved).toBe(false)
        expect(await readStock(world.db.order, "sku-short")).toBe(1)
    })
})
