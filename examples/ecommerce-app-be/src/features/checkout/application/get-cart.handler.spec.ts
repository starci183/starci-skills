import { mock } from "@starci/jest-preset/mock"
import type { CartService } from "@modules/domain/cart"
import type { CatalogService } from "@modules/domain/catalog"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { GetCartHandler } from "./get-cart.handler"
import { GetCartQuery } from "./get-cart.query"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("GetCartHandler", () => {
    it("answers the cart lines of the caller with the catalog snapshot", async () => {
        const items = [{ productId: "mug", quantity: 2 }]
        const catalog = [{ id: "mug", name: "Mug", priceMinorUnits: 1299, stock: 5 }]
        const cart = mock<CartService>({ list: jest.fn().mockResolvedValue(items) })
        const catalogService = mock<CatalogService>({ list: jest.fn().mockResolvedValue(catalog) })
        const handler = new GetCartHandler(mock<Logger>(), cart, catalogService)
        await expect(handler.execute(new GetCartQuery({ request: {}, principal }))).resolves.toEqual({ items, catalog })
        expect(cart.list).toHaveBeenCalledWith({ personId: "p-1" })
    })
})
