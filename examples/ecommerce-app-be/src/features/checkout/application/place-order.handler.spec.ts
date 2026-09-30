import { mock } from "@starci/jest-preset/mock"
import type { CartService } from "@modules/domain/cart"
import type { CatalogService } from "@modules/domain/catalog"
import { OrderErrorCode } from "@modules/domain/order"
import type { OrderService, PlacedOrder } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { PlaceOrderCommand } from "./place-order.command"
import { PlaceOrderHandler } from "./place-order.handler"

const principal: Principal = { id: "p-1", roles: ["member"] }
const placed: PlacedOrder = {
    orderId: "o-1",
    status: "confirmed",
    totalMinorUnits: 2598,
    currency: "USD",
    paymentId: "pay-1",
    replayed: false,
}
const products = { mug: { id: "mug", name: "Mug", priceMinorUnits: 1299, stock: 5 } }

interface Harness {
    handler: PlaceOrderHandler
    cart: CartService
    orders: OrderService
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    parts: { cart?: CartService; catalog?: CatalogService; orders?: OrderService } = {},
    inner = mockEntityManager(),
): Harness => {
    const cart =
        parts.cart ?? mock<CartService>({ list: jest.fn().mockResolvedValue([{ productId: "mug", quantity: 2 }]) })
    const catalog = parts.catalog ?? mock<CatalogService>({ byIds: jest.fn().mockResolvedValue(products) })
    const orders =
        parts.orders ??
        mock<OrderService>({
            findPlaced: jest.fn().mockResolvedValue(null),
            place: jest.fn().mockResolvedValue(placed),
        })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new PlaceOrderHandler(mock<Logger>(), entityManager, cart, catalog, orders), cart, orders, inner }
}

describe("PlaceOrderHandler", () => {
    it("prices the cart and confirms it through one transaction", async () => {
        const { handler, orders, inner } = build()
        const outcome = await handler.execute(new PlaceOrderCommand({ request: { idempotencyKey: "k-1" }, principal }))
        expect(outcome).toEqual({ kind: "ok", value: placed })
        expect(orders.place).toHaveBeenCalledWith({
            manager: inner,
            personId: "p-1",
            plan: {
                lines: [{ productId: "mug", quantity: 2, unitPriceMinorUnits: 1299 }],
                totalMinorUnits: 2598,
                currency: "USD",
            },
            idempotencyKey: "k-1",
        })
    })

    it("answers the first order of a replayed key without pricing or writing", async () => {
        const replay = { ...placed, replayed: true }
        const orders = mock<OrderService>({ findPlaced: jest.fn().mockResolvedValue(replay), place: jest.fn() })
        const { handler, cart } = build({ orders })
        await expect(
            handler.execute(new PlaceOrderCommand({ request: { idempotencyKey: "k-1" }, principal })),
        ).resolves.toEqual({
            kind: "ok",
            value: replay,
        })
        expect(cart.list).not.toHaveBeenCalled()
        expect(orders.place).not.toHaveBeenCalled()
    })

    it("refuses an empty cart and opens no transaction", async () => {
        const cart = mock<CartService>({ list: jest.fn().mockResolvedValue([]) })
        const { handler, orders } = build({ cart })
        await expect(handler.execute(new PlaceOrderCommand({ request: {}, principal }))).resolves.toMatchObject({
            kind: "refused",
            code: OrderErrorCode.CartEmpty,
        })
        expect(orders.place).not.toHaveBeenCalled()
    })

    it("does not look for a replay when the client sent no key", async () => {
        const { handler, orders } = build()
        await handler.execute(new PlaceOrderCommand({ request: {}, principal }))
        expect(orders.findPlaced).not.toHaveBeenCalled()
    })
})
