import { mock } from "@starci/jest-preset/mock"
import type { CartService } from "@modules/domain/cart"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { ClearCartCommand } from "./clear-cart.command"
import { ClearCartHandler } from "./clear-cart.handler"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("ClearCartHandler", () => {
    it("clears the cart of the caller through one transaction and confirms", async () => {
        const inner = mockEntityManager()
        const cart = mock<CartService>({ clear: jest.fn().mockResolvedValue(undefined) })
        const handler = new ClearCartHandler(
            mock<Logger>(),
            mockEntityManager({ transaction: fakeTransaction(inner) }),
            cart,
        )
        await expect(handler.execute(new ClearCartCommand({ request: {}, principal }))).resolves.toEqual({
            cleared: true,
        })
        expect(cart.clear).toHaveBeenCalledWith({ manager: inner, personId: "p-1" })
    })
})
