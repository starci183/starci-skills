import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { CatalogService } from "./catalog.service"
import { ProductEntity } from "./persistence/entities/product.entity"

const product = (id: string, stock: number): ProductEntity =>
    Object.assign(new ProductEntity(), { id, name: `Product ${id}`, priceMinorUnits: 100, stock })

describe("CatalogService", () => {
    it("lists products by id under the list bound", async () => {
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue([product("a", 3)]) })
        await expect(new CatalogService(entityManager).list()).resolves.toEqual([
            { id: "a", name: "Product a", priceMinorUnits: 100, stock: 3 },
        ])
        expect(entityManager.find).toHaveBeenCalledWith(ProductEntity, { order: { id: "ASC" }, take: LIST_ROWS_MAX })
    })

    it("keys the requested products by id and reads nothing for an empty request", async () => {
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue([product("a", 3), product("b", 1)]) })
        const service = new CatalogService(entityManager)
        await expect(service.byIds({ ids: ["a", "b"] })).resolves.toMatchObject({ a: { id: "a" }, b: { id: "b" } })
        await expect(service.byIds({ ids: [] })).resolves.toEqual({})
        expect(entityManager.find).toHaveBeenCalledTimes(1)
    })

    it("reserves stock through the caller manager with a guarded decrement", async () => {
        const manager = mockEntityManager({ decrement: jest.fn().mockResolvedValue({ affected: 1 }) })
        await expect(new CatalogService(mockEntityManager()).reserveStock({ manager, productId: "a", quantity: 2 })).resolves.toBe(true)
        expect(manager.decrement).toHaveBeenCalledWith(ProductEntity, expect.objectContaining({ id: "a" }), "stock", 2)
    })

    it("reports a failed reservation when no row matched", async () => {
        const manager = mockEntityManager({ decrement: jest.fn().mockResolvedValue({ affected: 0 }) })
        await expect(new CatalogService(mockEntityManager()).reserveStock({ manager, productId: "a", quantity: 9 })).resolves.toBe(false)
    })
})
