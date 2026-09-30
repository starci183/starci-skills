import { AppModule as IdentityApp } from "../../../../apps/identity/src/app.module"
import { AppModule as OrderApp } from "../../../../apps/order/src/app.module"
import { asBearer, present } from "../../fixtures/bearer.mapper"
import type { CatalogProductView, CartData, PlaceOrderData, AccountData, BuyerStatusData } from "../../fixtures/e2e-views.contracts"
import type { OrderRow, OrderLineRow, PaymentRow } from "../../fixtures/persistence/e2e-verification.rows"
import { readRows, readCount } from "../../fixtures/persistence/e2e-verification.rows"
import { ORDER_COUNT, ORDERS_OF_PERSON, LINES_OF_ORDER, PAYMENTS_OF_PERSON, PAYMENT_COUNT, SET_STOCK } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The order lifecycle past the first confirmation: one buyer places several orders and the history they produce is
 * verified end to end. The api has no order list or detail door: the only order reads are the placeOrder answer and the
 * buyerStatus flag the identity service reads. So "list" and "detail" are asserted where the truth lives, out-of-band on
 * this run databases (orders, order_lines and payments rows), cross-checked against the live cross-service reads. The
 * status transitions the schema models are covered too: a confirmation lands confirmed with its payment captured, a
 * refusal appends nothing, and a key replay returns the first answer without appending either.
 *
 * Run: npm run test:e2e -- order-lifecycle/order-history
 */
describe("order lifecycle: order history", () => {
    const password = "e2e-history-pass"

    const world = useTestWorld({ apps: { identity: { module: IdentityApp }, order: { module: OrderApp } } })

    beforeAll(async () => {
        await world.db.order.query(SET_STOCK, ["sku-thermos", 2])
    })

    const productOf = (data: CartData | null, id: string): CatalogProductView =>
        present(data?.cart.catalog.find((product) => product.id === id), id)

    it("a buyer placing several orders builds a confirmed, paid history both services can read", async () => {
        const session = await world.auth.registerBuyer("hist-a", password)
        const { personId } = session
        const buyer = asBearer(world.apps.order.api, session.sessionToken)
        const identity = asBearer(world.apps.identity.api, session.sessionToken)

        // Baseline: not a buyer yet, on both sides of the contract.
        expect((await buyer.read<BuyerStatusData>("buyerStatus")).data?.buyerStatus).toEqual({ personId, hasOrders: false })
        expect((await identity.read<AccountData>("account")).data?.account.hasOrders).toBe(false)

        // The catalog snapshot the confirmations price against.
        const browsed = await buyer.read<CartData>("cart")
        const mug = productOf(browsed.data, "sku-mug")
        const notebook = productOf(browsed.data, "sku-notebook")
        const thermos = productOf(browsed.data, "sku-thermos")
        const firstTotal = mug.priceMinorUnits * 2
        const secondTotal = notebook.priceMinorUnits + thermos.priceMinorUnits

        // Order 1: sku-mug x2.
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-mug", quantity: 2 } } })
        const first = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: `${personId}-1` } } })
        expect(first.errorCode).toBeNull()
        const firstOrder = present(first.data, "first order").placeOrder
        expect(firstOrder).toMatchObject({ status: "confirmed", totalMinorUnits: firstTotal, currency: "USD", replayed: false })

        // The cart cleared itself at confirmation, so order 2 starts from a fresh fill.
        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])

        // Order 2: sku-notebook x1 and sku-thermos x1.
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-notebook", quantity: 1 } } })
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: 1 } } })
        const second = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: `${personId}-2` } } })
        expect(second.errorCode).toBeNull()
        const secondOrder = present(second.data, "second order").placeOrder
        expect(secondOrder).toMatchObject({ status: "confirmed", totalMinorUnits: secondTotal, replayed: false })
        expect(secondOrder.orderId).not.toBe(firstOrder.orderId)
        expect(secondOrder.paymentId).not.toBe(firstOrder.paymentId)

        // list: two orders in creation order, each confirmed and priced as answered.
        const orders = await readRows<OrderRow>(world.db.order, ORDERS_OF_PERSON, [personId])
        expect(orders).toHaveLength(2)
        expect(orders[0]).toMatchObject({ id: firstOrder.orderId, status: "confirmed", total_minor_units: firstTotal, currency: "USD", idempotency_key: `${personId}-1` })
        expect(orders[1]).toMatchObject({ id: secondOrder.orderId, status: "confirmed", total_minor_units: secondTotal, idempotency_key: `${personId}-2` })

        // detail: each order lines carry the catalog price snapshot taken at confirmation.
        expect(await readRows<OrderLineRow>(world.db.order, LINES_OF_ORDER, [firstOrder.orderId])).toEqual([
            { product_id: "sku-mug", quantity: 2, unit_price_minor_units: mug.priceMinorUnits },
        ])
        expect(await readRows<OrderLineRow>(world.db.order, LINES_OF_ORDER, [secondOrder.orderId])).toEqual([
            { product_id: "sku-notebook", quantity: 1, unit_price_minor_units: notebook.priceMinorUnits },
            { product_id: "sku-thermos", quantity: 1, unit_price_minor_units: thermos.priceMinorUnits },
        ])

        // ...and each order has exactly one captured payment, keyed by the order id.
        const payments = await readRows<PaymentRow>(world.db.order, PAYMENTS_OF_PERSON, [personId])
        expect(payments).toHaveLength(2)
        expect(payments[0]).toMatchObject({ id: firstOrder.paymentId, order_id: firstOrder.orderId, status: "captured", amount_minor_units: firstTotal })
        expect(payments[1]).toMatchObject({ id: secondOrder.paymentId, order_id: secondOrder.orderId, status: "captured", amount_minor_units: secondTotal })

        // The guarded stock moved by exactly the confirmed quantities, and the cart stayed empty.
        const after = await buyer.read<CartData>("cart")
        expect(productOf(after.data, "sku-mug").stock).toBe(mug.stock - 2)
        expect(productOf(after.data, "sku-notebook").stock).toBe(notebook.stock - 1)
        expect(productOf(after.data, "sku-thermos").stock).toBe(thermos.stock - 1)
        expect(after.data?.cart.items).toEqual([])

        // The cross-service read: identity can only know this by asking order over real GraphQL.
        expect((await buyer.read<BuyerStatusData>("buyerStatus")).data?.buyerStatus).toEqual({ personId, hasOrders: true })
        expect((await identity.read<AccountData>("account")).data?.account).toMatchObject({ personId, email: session.email, hasOrders: true })
    })

    it("a refusal and an idempotent replay never append to order history", async () => {
        const session = await world.auth.registerBuyer("hist-b", password)
        const { personId } = session
        const buyer = asBearer(world.apps.order.api, session.sessionToken)

        // Refusal 1: an empty cart confirms nothing and records nothing.
        const emptyRefusal = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: {} } })
        expect(emptyRefusal.errorCode).toBe("ORDER_CART_EMPTY")
        expect(await readCount(world.db.order, ORDER_COUNT, (personId))).toBe(0)

        // A real order, then the same key again: the key is checked before the (now empty) cart, so the replay returns
        // the first answer rather than degenerating into an empty-cart refusal.
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-mug", quantity: 1 } } })
        const key = `${personId}-replay`
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: key } } })
        expect(placed.errorCode).toBeNull()
        const order = present(placed.data, "placed order").placeOrder
        expect(order.replayed).toBe(false)

        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: key } } })
        expect(replayed.errorCode).toBeNull()
        expect(replayed.data?.placeOrder).toMatchObject({ orderId: order.orderId, paymentId: order.paymentId, replayed: true })
        expect(await readCount(world.db.order, ORDER_COUNT, (personId))).toBe(1)
        expect(await readCount(world.db.order, PAYMENT_COUNT, (personId))).toBe(1)

        // Refusal 2: beyond stock. Nothing changes: the order count stays 1, the cart keeps its line, the stock did not move.
        const thermos = productOf((await buyer.read<CartData>("cart")).data, "sku-thermos")
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: thermos.stock + 1 } } })
        const stockRefusal = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: {} } })
        expect(stockRefusal.errorCode).toBe("ORDER_INSUFFICIENT_STOCK")
        expect(stockRefusal.errors?.[0]?.extensions).toMatchObject({ params: { productId: "sku-thermos" } })
        expect(await readCount(world.db.order, ORDER_COUNT, (personId))).toBe(1)
        const kept = await buyer.read<CartData>("cart")
        expect(kept.data?.cart.items).toEqual([{ productId: "sku-thermos", quantity: thermos.stock + 1 }])
        expect(productOf(kept.data, "sku-thermos").stock).toBe(thermos.stock)
    })
})
