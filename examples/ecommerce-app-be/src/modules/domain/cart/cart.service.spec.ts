import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { cartItemRow } from "@tests/fixtures/builders/cart.builder"
import { CartService } from "./cart.service"
import { CartErrorCode } from "./errors/cart.error"
import { CartItemEntity } from "./persistence/entities/cart-item.entity"
import { UPSERT_CART_ITEM } from "./persistence/cart.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [CartService, { provide: ORDER_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(CartService)
}

describe("CartService", () => {
    describe("list", () => {
        it("returns the lines of the person by product, capped at the list maximum", async () => {
            const em = mockEntityManager({
                find: [
                    CartItemEntity,
                    [
                        cartItemRow({ productId: "sku-1", quantity: 2 }),
                        cartItemRow({ productId: "sku-2", quantity: 1 }),
                    ],
                ],
            })

            const lines = await (await build(em)).list({ personId: "p-1" })

            expect(lines).toEqual([
                { productId: "sku-1", quantity: 2 },
                { productId: "sku-2", quantity: 1 },
            ])
            expect(em.find).toHaveBeenCalledWith(CartItemEntity, {
                where: { personId: "p-1" },
                order: { productId: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })

        it("returns no line for an empty cart", async () => {
            const em = mockEntityManager({ find: [CartItemEntity, []] })

            expect(await (await build(em)).list({ personId: "p-1" })).toEqual([])
        })
    })

    describe("add", () => {
        it("upserts through the caller transaction manager and returns the merged line", async () => {
            const own = mockEntityManager()
            const manager = mockEntityManager({ query: [UPSERT_CART_ITEM, [{ product_id: "sku-1", quantity: 5 }]] })

            const line = await (await build(own)).add({ manager, personId: "p-1", productId: "sku-1", quantity: 2 })

            expect(line).toEqual({ productId: "sku-1", quantity: 5 })
            expect(manager.query).toHaveBeenCalledWith(UPSERT_CART_ITEM, ["p-1", "sku-1", 2])
        })

        it("throws the line missing error when the upsert answers no row", async () => {
            const manager = mockEntityManager({ query: [UPSERT_CART_ITEM, []] })

            await expect(
                (await build(mockEntityManager())).add({ manager, personId: "p-1", productId: "sku-1", quantity: 2 }),
            ).rejects.toMatchObject({ code: CartErrorCode.LineMissing })
        })
    })

    describe("clear", () => {
        it("deletes every line of the person through the caller transaction manager", async () => {
            const manager = mockEntityManager({ delete: [CartItemEntity, { affected: 2 }] })

            await (await build(mockEntityManager())).clear({ manager, personId: "p-1" })

            expect(manager.delete).toHaveBeenCalledWith(CartItemEntity, { personId: "p-1" })
        })
    })
})
