import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { CartService } from "./cart.service"
import { CartErrorCode } from "./errors/cart.error"
import { UPSERT_CART_ITEM } from "./persistence/cart.sql"
import { CartItemEntity } from "./persistence/entities/cart-item.entity"

describe("CartService", () => {
    it("lists one person cart under the list bound", async () => {
        const rows = [
            Object.assign(new CartItemEntity(), { id: "l-1", personId: "p-1", productId: "sku-1", quantity: 2 }),
        ]
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue(rows) })
        await expect(new CartService(entityManager).list({ personId: "p-1" })).resolves.toEqual([
            { productId: "sku-1", quantity: 2 },
        ])
        expect(entityManager.find).toHaveBeenCalledWith(CartItemEntity, {
            where: { personId: "p-1" },
            order: { productId: "ASC" },
            take: LIST_ROWS_MAX,
        })
    })

    it("adds through the caller manager and answers the merged line", async () => {
        const manager = mockEntityManager({
            query: jest.fn().mockResolvedValue([{ product_id: "sku-1", quantity: 5 }]),
        })
        const line = await new CartService(mockEntityManager()).add({
            manager,
            personId: "p-1",
            productId: "sku-1",
            quantity: 2,
        })
        expect(line).toEqual({ productId: "sku-1", quantity: 5 })
        expect(manager.query).toHaveBeenCalledWith(UPSERT_CART_ITEM, ["p-1", "sku-1", 2])
    })

    it("fails as a defect when the upsert answers no row", async () => {
        const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
        await expect(
            new CartService(mockEntityManager()).add({ manager, personId: "p-1", productId: "sku-1", quantity: 2 }),
        ).rejects.toMatchObject({ code: CartErrorCode.LineMissing })
    })

    it("clears a cart through the caller manager", async () => {
        const manager = mockEntityManager({ delete: jest.fn().mockResolvedValue({ affected: 1 }) })
        await new CartService(mockEntityManager()).clear({ manager, personId: "p-1" })
        expect(manager.delete).toHaveBeenCalledWith(CartItemEntity, { personId: "p-1" })
    })
})
