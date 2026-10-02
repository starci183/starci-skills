import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CART_SERVICE } from "@modules/domain/cart"
import type { CartService } from "@modules/domain/cart"
import { CATALOG_SERVICE } from "@modules/domain/catalog"
import type { CatalogService } from "@modules/domain/catalog"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { SAGA_SERVICE } from "@modules/platform/saga"
import type { SagaService } from "@modules/platform/saga"
import { OrderPlacedEvent } from "@modules/events/order"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { Test } from "@nestjs/testing"
import { orderLineRow, orderRow, placedOrder } from "@tests/fixtures/builders/order.builder"
import { productView } from "@tests/fixtures/builders/catalog.builder"
import { OrderErrorCode } from "./errors/order.error"
import { PLACE_ORDER_SAGA } from "./order.contracts"
import { OrderService } from "./order.service"
import { ReceiptService } from "./receipt.service"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { CANCEL_ORDER_IF_PENDING, COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

const shirt = productView()
const mug = productView({ id: "sku-2", name: "Mug", priceMinorUnits: 250, stock: 10 })

const build = async (entityManager: MockEntityManager) => {
    const cart = mock<CartService>()
    const catalog = mock<CatalogService>()
    const receipts = mock<ReceiptService>()
    const bus = mock<EventBus>()
    const sagas = mock<SagaService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderService,
            { provide: ORDER_ENTITY_MANAGER, useValue: entityManager },
            { provide: CART_SERVICE, useValue: cart },
            { provide: CATALOG_SERVICE, useValue: catalog },
            { provide: ReceiptService, useValue: receipts },
            { provide: EVENT_BUS, useValue: bus },
            { provide: SAGA_SERVICE, useValue: sagas },
        ],
    }).compile()
    return { orders: moduleRef.get(OrderService), cart, catalog, receipts, bus, sagas }
}

describe("OrderService", () => {
    describe("placeOrder", () => {
        it("refuses an empty cart without touching the database", async () => {
            const em = mockEntityManager()
            const { orders, cart, catalog } = await build(em)
            cart.list.mockResolvedValue([])
            catalog.byIds.mockResolvedValue({})

            expect(await orders.placeOrder({ personId: "p-1" })).toBeRefused(OrderErrorCode.CartEmpty)

            expect(em.transaction).not.toHaveBeenCalled()
            expect(catalog.reserveStock).not.toHaveBeenCalled()
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
            const { orders, cart, bus } = await build(em)

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-1" })).toSucceedWith(
                placedOrder({ replayed: true }),
            )

            expect(em.findOneBy).toHaveBeenCalledWith(OrderEntity, { personId: "p-1", idempotencyKey: "key-1" })
            expect(cart.list).not.toHaveBeenCalled()
            expect(em.transaction).not.toHaveBeenCalled()
            expect(bus.publish).not.toHaveBeenCalled()
        })

        it("places the order with every write inside one committed transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneBy: [OrderEntity, null],
                    query: [INSERT_ORDER_IF_NEW, [{ id: "o-7" }]],
                    insert: [OrderLineEntity, {}],
                }),
            )
            const { orders, cart, catalog, receipts, bus, sagas } = await build(tx.em)
            cart.list.mockResolvedValue([
                { productId: "sku-1", quantity: 2 },
                { productId: "sku-2", quantity: 1 },
            ])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt, "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)
            cart.clear.mockResolvedValue(undefined)

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-7" })).toSucceedWith(
                placedOrder({ orderId: "o-7" }),
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
            expect(cart.clear).toHaveBeenCalledWith({ manager: expect.anything(), personId: "p-1" })
            expect(tx.commits).toBe(1)
            expect(receipts.archive).toHaveBeenCalledWith("o-7")
            expect(sagas.begin).toHaveBeenCalledWith({
                manager: expect.anything(),
                saga: PLACE_ORDER_SAGA,
                correlationId: "o-7",
            })
            expect(bus.publish).toHaveBeenCalledWith(
                OrderPlacedEvent.create({ orderId: "o-7", personId: "p-1", totalMinorUnits: 1250 }),
                expect.anything(),
            )
        })

        it("rolls the whole placement back when the announcement cannot be written, so no order exists that billing never hears of", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-6" }]], insert: [OrderLineEntity, {}] }),
            )
            const { orders, cart, catalog, bus, receipts } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-2", quantity: 4 }])
            catalog.byIds.mockResolvedValue({ "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)
            const failure = new Error("outbox down")
            bus.publish.mockRejectedValueOnce(failure)

            await expect(orders.placeOrder({ personId: "p-1" })).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(receipts.archive).not.toHaveBeenCalled()
        })

        it("places an order without a replay key and claims no key", async () => {
            const tx = fakeTransaction(
                mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-8" }]], insert: [OrderLineEntity, {}] }),
            )
            const { orders, cart, catalog } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-2", quantity: 4 }])
            catalog.byIds.mockResolvedValue({ "sku-2": mug })
            catalog.reserveStock.mockResolvedValue(true)

            expect(await orders.placeOrder({ personId: "p-1" })).toSucceedWith(
                placedOrder({ orderId: "o-8", totalMinorUnits: 1000 }),
            )

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_ORDER_IF_NEW, ["p-1", 1000, "USD", null])
            expect(tx.em.findOneBy).not.toHaveBeenCalled()
        })

        it("rolls back with no committed write when the stock was taken by a concurrent checkout", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_ORDER_IF_NEW, [{ id: "o-9" }]] }))
            const { orders, cart, catalog } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 2 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })
            catalog.reserveStock.mockResolvedValue(false)

            await expect(orders.placeOrder({ personId: "p-1" })).rejects.toMatchObject({
                code: OrderErrorCode.InsufficientStock,
                params: { productId: "sku-1", requested: 2 },
            })

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
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
            const { orders, cart, catalog, receipts } = await build(tx.em)
            cart.list.mockResolvedValue([{ productId: "sku-1", quantity: 1 }])
            catalog.byIds.mockResolvedValue({ "sku-1": shirt })

            expect(await orders.placeOrder({ personId: "p-1", idempotencyKey: "key-3" })).toSucceedWith(
                placedOrder({ orderId: "o-3", totalMinorUnits: 500, replayed: true }),
            )

            expect(catalog.reserveStock).not.toHaveBeenCalled()
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
        it("cancels a pending order and releases the stock of its lines in one committed transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [CANCEL_ORDER_IF_PENDING, [{ id: "o-1" }]],
                    find: [
                        OrderLineEntity,
                        [orderLineRow(), orderLineRow({ id: "l-2", productId: "sku-2", quantity: 1 })],
                    ],
                }),
            )
            const { orders, catalog } = await build(tx.em)

            expect(await orders.cancelOrder({ orderId: "o-1" })).toEqual({ orderId: "o-1", cancelled: true })

            expect(tx.em.query).toHaveBeenCalledWith(CANCEL_ORDER_IF_PENDING, ["o-1"])
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
            expect(tx.commits).toBe(1)
        })

        it("changes nothing for an order that is not pending any more, so a redelivery is a no-op", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [CANCEL_ORDER_IF_PENDING, []] }))
            const { orders, catalog } = await build(tx.em)

            expect(await orders.cancelOrder({ orderId: "o-1" })).toEqual({ orderId: "o-1", cancelled: false })

            expect(catalog.releaseStock).not.toHaveBeenCalled()
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
