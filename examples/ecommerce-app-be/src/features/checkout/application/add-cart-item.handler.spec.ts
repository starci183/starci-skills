import { mock } from "@starci/jest-preset/mock"
import type { CartService } from "@modules/domain/cart"
import type { CatalogService } from "@modules/domain/catalog"
import { OrderErrorCode } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AddCartItemCommand } from "./add-cart-item.command"
import { AddCartItemHandler } from "./add-cart-item.handler"

const principal: Principal = { id: "p-1", roles: ["member"] }
const command = new AddCartItemCommand({ request: { productId: "mug", quantity: 2 }, principal })

describe("AddCartItemHandler", () => {
    it("adds to the cart of the caller through one transaction and answers the merged line", async () => {
        const inner = mockEntityManager()
        const catalog = mock<CatalogService>({ byIds: jest.fn().mockResolvedValue({ mug: { id: "mug" } }) })
        const cart = mock<CartService>({ add: jest.fn().mockResolvedValue({ productId: "mug", quantity: 5 }) })
        const handler = new AddCartItemHandler(
            mock<Logger>(),
            mockEntityManager({ transaction: fakeTransaction(inner) }),
            catalog,
            cart,
        )
        await expect(handler.execute(command)).resolves.toEqual({
            kind: "ok",
            value: { productId: "mug", quantity: 5 },
        })
        expect(cart.add).toHaveBeenCalledWith({ manager: inner, personId: "p-1", productId: "mug", quantity: 2 })
    })

    it("refuses a product the catalog does not have and writes nothing", async () => {
        const catalog = mock<CatalogService>({ byIds: jest.fn().mockResolvedValue({}) })
        const cart = mock<CartService>()
        const entityManager = mockEntityManager({ transaction: fakeTransaction(mockEntityManager()) })
        await expect(
            new AddCartItemHandler(mock<Logger>(), entityManager, catalog, cart).execute(command),
        ).resolves.toEqual({
            kind: "refused",
            code: OrderErrorCode.UnknownProduct,
            params: { productId: "mug" },
        })
        expect(cart.add).not.toHaveBeenCalled()
        expect(entityManager.transaction).not.toHaveBeenCalled()
    })
})
