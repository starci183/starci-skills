import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CART_SERVICE } from "@modules/domain/cart"
import type { CartService } from "@modules/domain/cart"
import { CATALOG_SERVICE } from "@modules/domain/catalog"
import type { CatalogService } from "@modules/domain/catalog"
import { PAYMENT_SERVICE } from "@modules/domain/payment"
import type { PaymentService } from "@modules/domain/payment"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MESSAGE_PUBLISHER } from "@modules/integrations/messaging"
import type { MessagePublisher } from "@modules/integrations/messaging"
import { Test } from "@nestjs/testing"
import { orderLineRow, orderRow, placedOrder } from "@tests/fixtures/builders/order.builder"
import { productView } from "@tests/fixtures/builders/catalog.builder"
import { OrderErrorCode } from "./errors/order.error"
import { ORDER_PLACED_QUEUE } from "./order.contracts"
import { OrderLogEvent } from "./order.log-events"
import { OrderService } from "./order.service"
import { ReceiptService } from "./receipt.service"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { CANCEL_ORDER_IF_CONFIRMED, COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

const shirt = productView()
const mug = productView({ id: "sku-2", name: "Mug", priceMinorUnits: 250, stock: 10 })

const build = async (entityManager: MockEntityManager) => {
    const cart = mock<CartService>()
    const catalog = mock<CatalogService>()
    const payments = mock<PaymentService>()
    const receipts = mock<ReceiptService>()
    const messages = mock<MessagePublisher>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CART_SERVICE, useValue: cart },
            { provide: CATALOG_SERVICE, useValue: catalog },
            { provide: PAYMENT_SERVICE, useValue: payments },
            { provide: ReceiptService, useValue: receipts },
            { provide: MESSAGE_PUBLISHER, useValue: messages },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { orders: moduleRef.get(OrderService), cart, catalog, payments, receipts, messages, logger }
}

describe("OrderService", () => {
    describe("placeOrder", () => {
        it("refuses an empty cart without touching the database", async () => {
            const em = mockEntityManager()
            const { orders, cart, catalog, payments } = await build(em)
            cart.list.mockResolvedValue([])
            catalog.byIds.mockResolvedValue({})

            expect(await orders.placeOrder({ personId: "p-1" })).toBeRefused(OrderErrorCode.CartEmpty)

            expect(em.transaction).not.toHaveBeenCalled()
            expect(catalog.reserveStock).not.toHaveBeenCalled()
            expect(payments.capture).not.toHaveBeenCalled()
        })

        it("refuses a cart line the catalog does not have", async () => {
            const { orders, cart, catalog } = await build(mockEntityManager())
            cart.list.mockResolvedValue([{ productId: "sku-9", quantity: 1 }])
            catalog.byIds.mockResolvedValue({})

            expect(await orders.placeOrder({ personId: "p-1" })).toBeRefused({
                code: OrderErrorCode.UnknownProduct,
                params: { productId: "sku-9" },
            })
        })

        it("refuses a cart line asking for more than the stock", async () => {
            const { orders, cart, catalog } = await build(mockEntityManager())
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 5 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })

            expect(await orders.placeOrder({ personId: "p-1" })).toBeRefused({
                code: OrderErrorCode.InsufficientStock,
                params: { productId: "sku-1", requested: 5, available: 4 },
            })
            expect(catalog.byIds).toHaveBeenCalledWith({ ids: ["sku-1"] })
        })

        it("returns the first order of a replayed key and writes nothing", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, orderRow({ idempotencyKey: "key-1" })] })
            const { orders, cart, payments, messages } = await build(em)
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 1250 })

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-1" })).toSucceedWith(
                placedOrder({ replayed: true }),
            )

            expect(em.findOneBy).toHaveBeenCalledWith(OrderEntity, { personId: "p-1", idempotencyKey: "key-1" })
            expect(payments.findByOrder).toHaveBeenCalledWith({ orderId: "o-1", manager: em })
            expect(cart.list).not.toHaveBeenCalled()
            expect(payments.capture).not.toHaveBeenCalled()
            expect(em.transaction).not.toHaveBeenCalled()
            expect(messages.publish).toHaveBeenCalledWith({
                queue: ORDER_PLACED_QUEUE,
                eventId: "o-1",
                payload: { orderId: "o-1", personId: "p-1", totalMinorUnits: 1250 },
            })
        })

        it("fails with the payment missing error when a replayed order has no payment", async () => {
            const em = mockEntityManager({ findOneBy: [OrderEntity, orderRow({ idempotencyKey: "key-1" })] })
            const { orders, payments } = await build(em)
            payments.findByOrder.mockResolvedValue(null)

            await expect(orders.placeOrder({ personId: "p-1", idempotencyKey: "key-1" })).rejects.toMatchObject({
                code: OrderErrorCode.PaymentMissing,
            })
        })

        it("places the order with every write inside one committed transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneBy: [OrderEntity, null],
                    query: [INSERT_ORDER_IF_NEW, [{ id: "o-7" }]],
                    insert: [OrderLineEntity, {}],
                }),
            )
            const { orders, cart, catalog, payments, receipts, messages } = await build(tx.em)
            cart.list.mockResolvedValue([
                { productId: "sku-1", quantity: 2 },
                { productId: "sku-2", quantity: 1 },
            ])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt, "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)
            payments.capture.mockResolvedValue({ paymentId: "pay-7", amountMinorUnits: 1250 })
            cart.clear.mockResolvedValue(undefined)

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-7" })).toSucceedWith(
                placedOrder({ orderId: "o-7", paymentId: "pay-7" }),
            )

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ORDER_IF_NEW, ["p-1", 1250, "USD", "key-7"])
            expect(catalog.reserveStock).toHaveBeenNthCalledWith(1, {
                manager: expect.anything(),
                productId: "sku-1",
                quantity: 2,
            })
            expect(catalog.reserveStock).toHaveBeenNthCalledWith(2, {
                manager: expect.anything(),
                productId: "sku-2",
                quantity: 1,
            })
            expect(tx.em.insert).toHaveBeenCalledWith(OrderLineEntity, [
                { orderId: "o-7", productId: "sku-1", quantity: 2, unitPriceMinorUnits: 500 },
                { orderId: "o-7", productId: "sku-2", quantity: 1, unitPriceMinorUnits: 250 },
            ])
            expect(payments.capture).toHaveBeenCalledWith({
                manager: expect.anything(),
                personId: "p-1",
                orderId: "o-7",
                amountMinorUnits: 1250,
            })
            expect(cart.clear).toHaveBeenCalledWith({ manager: expect.anything(), personId: "p-1" })
            expect(tx.commits).toBe(1)
            expect(receipts.archive).toHaveBeenCalledWith("o-7")
            expect(messages.publish).toHaveBeenCalledWith({
                queue: ORDER_PLACED_QUEUE,
                eventId: "o-7",
                payload: { orderId: "o-7", personId: "p-1", totalMinorUnits: 1250 },
            })
        })

        it("logs a failed announcement and still answers the placed order", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-6" }]], insert: [OrderLineEntity, {}] }),
            )
            const { orders, cart, catalog, payments, messages, logger } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-2", quantity: 4 }])
            catalog.byIds.mockResolvedValue({ "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)
            payments.capture.mockResolvedValue({ paymentId: "pay-6", amountMinorUnits: 1000 })
            const failure = new Error("stream down")
            messages.publish.mockRejectedValueOnce(failure)

            expect(await orders.placeOrder({ personId: "p-1" })).toSucceedWith(
                placedOrder({ orderId: "o-6", totalMinorUnits: 1000, paymentId: "pay-6" }),
            )

            expect(logger.error).toHaveBeenCalledWith(OrderLogEvent.EventPublishFailed, failure, { orderId: "o-6" })
        })

        it("places an order without a replay key and claims no key", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-8" }]], insert: [OrderLineEntity, {}] }),
            )
            const { orders, cart, catalog, payments } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-2", quantity: 4 }])
            catalog.byIds.mockResolvedValue({ "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)
            payments.capture.mockResolvedValue({ paymentId: "pay-8", amountMinorUnits: 1000 })

            expect(await orders.placeOrder({ personId: "p-1" })).toSucceedWith(
                placedOrder({ orderId: "o-8", totalMinorUnits: 1000, paymentId: "pay-8" }),
            )

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ORDER_IF_NEW, ["p-1", 1000, "USD", null])
            expect(tx.em.findOneBy).not.toHaveBeenCalled()
        })

        it("rolls back with no committed write when the stock was taken by a concurrent checkout", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-9" }]] }))
            const { orders, cart, catalog, payments } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 2 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })
            catalog.reserveStock.mockResolvedValue(false)

            await expect(orders.placeOrder({ personId: "p-1" })).rejects.toMatchObject({
                code: OrderErrorCode.InsufficientStock,
                params: { productId: "sku-1", requested: 2 },
            })

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
            expect(payments.capture).not.toHaveBeenCalled()
        })

        it("answers the winning order as a replay when a concurrent request claimed the key first", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneBy: [
                        [OrderEntity, null],
                        [OrderEntity, orderRow({ id: "o-3", totalMinorUnits: 500, idempotencyKey: "key-3" })],
                    ],
                    query: [INSERT_ORDER_IF_NEW, []],
                }),
            )
            const { orders, cart, catalog, payments, receipts } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 1 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })
            payments.findByOrder.mockResolvedValue({ paymentId: "pay-3", amountMinorUnits: 500 })

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-3" })).toSucceedWith(
                placedOrder({ orderId: "o-3", totalMinorUnits: 500, paymentId: "pay-3", replayed: true }),
            )

            expect(catalog.reserveStock).not.toHaveBeenCalled()
            expect(payments.capture).not.toHaveBeenCalled()
            expect(receipts.archive).not.toHaveBeenCalled()
        })

        it("fails with the placement failed error when the key was claimed but no order explains it", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ findOneBy: [OrderEntity, null], query: [INSERT_ORDER_IF_NEW, []] }),
            )
            const { orders, cart, catalog } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 1 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })

            await expect(orders.placeOrder({ personId: "p-1", idempotencyKey: "key-4" })).rejects.toMatchObject({
                code: OrderErrorCode.PlacementFailed,
            })
        })

        it("fails with the placement failed error when no key was sent and the insert answers no row", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_ORDER_IF_NEW, []] }))
            const { orders, cart, catalog } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 1 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })

            await expect(orders.placeOrder({ personId: "p-1" })).rejects.toMatchObject({
                code: OrderErrorCode.PlacementFailed,
            })
        })
    })

    describe("cancelOrder", () => {
        it("cancels a confirmed order, releases the stock of its lines and refunds its payment in one committed transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [CANCEL_ORDER_IF_CONFIRMED, [{ id: "o-1" }]],
                    find: [
                        OrderLineEntity,
                        [orderLineRow(), orderLineRow({ id: "l-2", productId: "sku-2", quantity: 1 })],
                    ],
                }),
            )
            const { orders, catalog, payments } = await build(tx.em)
            payments.refund.mockResolvedValue(true)

            expect(await orders.cancelOrder({ orderId: "o-1" })).toEqual({ orderId: "o-1", cancelled: true })

            expect(tx.em.query).toHaveBeenCalledWith(CANCEL_ORDER_IF_CONFIRMED, ["o-1"])
            expect(catalog.releaseStock).toHaveBeenNthCalledWith(1, {
                manager: expect.anything(),
                productId: "sku-1",
                quantity: 2,
            })
            expect(catalog.releaseStock).toHaveBeenNthCalledWith(2, {
                manager: expect.anything(),
                productId: "sku-2",
                quantity: 1,
            })
            expect(payments.refund).toHaveBeenCalledWith({ manager: expect.anything(), orderId: "o-1" })
            expect(tx.commits).toBe(1)
        })

        it("changes nothing for an order that is not confirmed any more, so a redelivery is a no-op", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [CANCEL_ORDER_IF_CONFIRMED, []] }))
            const { orders, catalog, payments } = await build(tx.em)

            expect(await orders.cancelOrder({ orderId: "o-1" })).toEqual({ orderId: "o-1", cancelled: false })

            expect(catalog.releaseStock).not.toHaveBeenCalled()
            expect(payments.refund).not.toHaveBeenCalled()
        })
    })

    describe("buyerStatus", () => {
        it("is a buyer when the person has orders", async () => {
            const em = mockEntityManager({ query: [COUNT_PERSON_ORDERS, [{ order_count: 2 }]] })
            const { orders } = await build(em)

            expect(await orders.buyerStatus({ personId: "p-1" })).toEqual({ personId: "p-1", hasOrders: true })
            expect(em.query).toHaveBeenCalledWith(COUNT_PERSON_ORDERS, ["p-1"])
        })

        it("is not a buyer at zero orders", async () => {
            const { orders } = await build(mockEntityManager({ query: [COUNT_PERSON_ORDERS, [{ order_count: 0 }]] }))

            expect((await orders.buyerStatus({ personId: "p-1" })).hasOrders).toBe(false)
        })

        it("is not a buyer for an unknown person with no row", async () => {
            const { orders } = await build(mockEntityManager({ query: [COUNT_PERSON_ORDERS, []] }))

            expect(await orders.buyerStatus({ personId: "p-9" })).toEqual({ personId: "p-9", hasOrders: false })
        })
    })
})
