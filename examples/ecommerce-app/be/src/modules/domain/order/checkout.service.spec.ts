import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CART_SERVICE } from "@modules/domain/cart"
import type { CartService } from "@modules/domain/cart"
import { CATALOG_SERVICE } from "@modules/domain/catalog"
import type { CatalogService } from "@modules/domain/catalog"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { Test } from "@nestjs/testing"
import { productView } from "@tests/fixtures/builders/catalog.builder"
import { CheckoutService } from "./checkout.service"
import { OrderErrorCode } from "./errors/order.error"

const shirt = productView()

const build = async (entityManager: MockEntityManager) => {
    const cart = mock<CartService>()
    const catalog = mock<CatalogService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CheckoutService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CART_SERVICE, useValue: cart },
            { provide: CATALOG_SERVICE, useValue: catalog },
        ],
    }).compile()
    return { checkout: moduleRef.get(CheckoutService), cart, catalog }
}

describe("CheckoutService", () => {
    describe("viewCart", () => {
        it("returns the cart lines of the person with the catalog they price against", async () => {
            const { checkout, cart, catalog } = await build(mockEntityManager())
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 2 }])
            catalog.list.mockResolvedValue([shirt])

            expect(await checkout.viewCart({ personId: "p-1" })).toEqual({
                items: [{ productId: "sku-1", quantity: 2 }],
                catalog: [shirt],
            })
            expect(cart.list).toHaveBeenCalledWith({ personId: "p-1" })
        })
    })

    describe("addToCart", () => {
        it("adds the units in one transaction and returns the merged line", async () => {
            const tx = fakeTransaction()
            const { checkout, cart, catalog } = await build(tx.em)
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })
            cart.add.mockResolvedValue({ productId: "sku-1", quantity: 3 })

            expect(await checkout.addToCart({ personId: "p-1", productId: "sku-1", quantity: 2 })).toSucceedWith({
                productId: "sku-1",
                quantity: 3,
            })
            expect(catalog.byIds).toHaveBeenCalledWith({ ids: ["sku-1"] })
            expect(cart.add).toHaveBeenCalledWith({
                manager: expect.anything(),
                personId: "p-1",
                productId: "sku-1",
                quantity: 2,
            })
            expect(tx.commits).toBe(1)
        })

        it("refuses a product the catalog does not have and opens no transaction", async () => {
            const em = mockEntityManager()
            const { checkout, cart, catalog } = await build(em)
            catalog.byIds.mockResolvedValue({})

            expect(await checkout.addToCart({ personId: "p-1", productId: "sku-9", quantity: 1 })).toBeRefused({
                code: OrderErrorCode.UnknownProduct,
                params: { productId: "sku-9" },
            })
            expect(cart.add).not.toHaveBeenCalled()
            expect(em.transaction).not.toHaveBeenCalled()
        })

        it("rolls back and rethrows when the cart write fails", async () => {
            const tx = fakeTransaction()
            const { checkout, cart, catalog } = await build(tx.em)
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })
            cart.add.mockRejectedValue(new Error("write failed"))

            await expect(checkout.addToCart({ personId: "p-1", productId: "sku-1", quantity: 2 })).rejects.toThrow(
                "write failed",
            )

            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("emptyCart", () => {
        it("clears the cart of the person in one transaction", async () => {
            const tx = fakeTransaction()
            const { checkout, cart } = await build(tx.em)
            cart.clear.mockResolvedValue(undefined)

            expect(await checkout.emptyCart({ personId: "p-1" })).toEqual({ cleared: true })

            expect(cart.clear).toHaveBeenCalledWith({ manager: expect.anything(), personId: "p-1" })
            expect(tx.commits).toBe(1)
        })
    })
})
