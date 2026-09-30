import { mock } from "@starci/jest-preset/mock"
import type { CartService } from "@modules/domain/cart"
import type { CatalogService } from "@modules/domain/catalog"
import type { PaymentService } from "@modules/domain/payment"
import { mockEntityManager } from "@tests/fixtures/database"
import { OrderErrorCode } from "./errors/order.error"
import type { CheckoutPlan } from "./order.contracts"
import { OrderService } from "./order.service"
import { OrderEntity } from "./persistence/entities/order.entity"
import { OrderLineEntity } from "./persistence/entities/order-line.entity"
import { COUNT_PERSON_ORDERS, INSERT_ORDER_IF_NEW } from "./persistence/order.sql"

const plan: CheckoutPlan = {
    lines: [
        { productId: "mug", quantity: 2, unitPriceMinorUnits: 1299 },
        { productId: "thermos", quantity: 1, unitPriceMinorUnits: 2499 },
    ],
    totalMinorUnits: 5097,
    currency: "USD",
}

const existingOrder = (): OrderEntity =>
    Object.assign(new OrderEntity(), { id: "o-0", personId: "p-1", status: "confirmed", totalMinorUnits: 5097, currency: "USD" })

const collaborators = (reserved = true): { cart: CartService; catalog: CatalogService; payments: PaymentService } => ({
    cart: mock<CartService>({ clear: jest.fn().mockResolvedValue(undefined) }),
    catalog: mock<CatalogService>({ reserveStock: jest.fn().mockResolvedValue(reserved) }),
    payments: mock<PaymentService>({
        capture: jest.fn().mockResolvedValue({ paymentId: "pay-1", amountMinorUnits: 5097 }),
        findByOrder: jest.fn().mockResolvedValue({ paymentId: "pay-0", amountMinorUnits: 5097 }),
    }),
})

const serviceWith = (
    entityManager = mockEntityManager(),
    parts = collaborators(),
): OrderService => new OrderService(entityManager, parts.cart, parts.catalog, parts.payments)

describe("OrderService", () => {
    describe("place", () => {
        it("claims the key, takes the stock, writes the lines, captures the payment and clears the cart in the caller transaction", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ id: "o-1" }]), insert: jest.fn().mockResolvedValue({}) })
            const parts = collaborators()
            const placed = await serviceWith(mockEntityManager(), parts).place({ manager, personId: "p-1", plan, idempotencyKey: "k-1" })
            expect(placed).toEqual({
                orderId: "o-1",
                status: "confirmed",
                totalMinorUnits: 5097,
                currency: "USD",
                paymentId: "pay-1",
                replayed: false,
            })
            expect(manager.query).toHaveBeenCalledWith(INSERT_ORDER_IF_NEW, ["p-1", 5097, "USD", "k-1"])
            expect(parts.catalog.reserveStock).toHaveBeenCalledTimes(2)
            expect(manager.insert).toHaveBeenCalledWith(OrderLineEntity, [
                { orderId: "o-1", productId: "mug", quantity: 2, unitPriceMinorUnits: 1299 },
                { orderId: "o-1", productId: "thermos", quantity: 1, unitPriceMinorUnits: 2499 },
            ])
            expect(parts.payments.capture).toHaveBeenCalledWith({ manager, personId: "p-1", orderId: "o-1", amountMinorUnits: 5097 })
            expect(parts.cart.clear).toHaveBeenCalledWith({ manager, personId: "p-1" })
        })

        it("stores no key when the client sent none", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ id: "o-1" }]), insert: jest.fn().mockResolvedValue({}) })
            await serviceWith().place({ manager, personId: "p-1", plan })
            expect(manager.query).toHaveBeenCalledWith(INSERT_ORDER_IF_NEW, ["p-1", 5097, "USD", null])
        })

        it("answers the earlier order as a replay when the key was already used, touching no stock", async () => {
            const manager = mockEntityManager({
                query: jest.fn().mockResolvedValue([]),
                findOneBy: jest.fn().mockResolvedValue(existingOrder()),
            })
            const parts = collaborators()
            const placed = await serviceWith(mockEntityManager(), parts).place({ manager, personId: "p-1", plan, idempotencyKey: "k-1" })
            expect(placed).toMatchObject({ orderId: "o-0", paymentId: "pay-0", replayed: true })
            expect(parts.catalog.reserveStock).not.toHaveBeenCalled()
        })

        it("fails as a defect when the insert claimed nothing and no earlier order explains it", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([]) })
            await expect(serviceWith().place({ manager, personId: "p-1", plan })).rejects.toMatchObject({
                code: OrderErrorCode.PlacementFailed,
            })
        })

        it("throws insufficient stock naming the product when the guarded decrement finds no stock, so the transaction rolls back", async () => {
            const manager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ id: "o-1" }]), insert: jest.fn() })
            const parts = collaborators(false)
            await expect(serviceWith(mockEntityManager(), parts).place({ manager, personId: "p-1", plan })).rejects.toMatchObject({
                code: OrderErrorCode.InsufficientStock,
                params: { productId: "mug", requested: 2 },
            })
            expect(manager.insert).not.toHaveBeenCalled()
            expect(parts.payments.capture).not.toHaveBeenCalled()
            expect(parts.cart.clear).not.toHaveBeenCalled()
        })
    })

    describe("findPlaced", () => {
        it("finds an earlier confirmation by person and key", async () => {
            const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(existingOrder()) })
            await expect(serviceWith(entityManager).findPlaced({ personId: "p-1", idempotencyKey: "k-1" })).resolves.toMatchObject({
                orderId: "o-0",
                replayed: true,
            })
            expect(entityManager.findOneBy).toHaveBeenCalledWith(OrderEntity, { personId: "p-1", idempotencyKey: "k-1" })
        })

        it("answers null when the key was never used", async () => {
            const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
            await expect(serviceWith(entityManager).findPlaced({ personId: "p-1", idempotencyKey: "k-1" })).resolves.toBeNull()
        })
    })

    describe("buyerStatus", () => {
        it("is a buyer when the person has orders", async () => {
            const entityManager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ order_count: 3 }]) })
            await expect(serviceWith(entityManager).buyerStatus({ personId: "p-1" })).resolves.toEqual({ personId: "p-1", hasOrders: true })
            expect(entityManager.query).toHaveBeenCalledWith(COUNT_PERSON_ORDERS, ["p-1"])
        })

        it("is not a buyer at zero orders", async () => {
            const entityManager = mockEntityManager({ query: jest.fn().mockResolvedValue([{ order_count: 0 }]) })
            await expect(serviceWith(entityManager).buyerStatus({ personId: "p-2" })).resolves.toEqual({ personId: "p-2", hasOrders: false })
        })
    })
})
