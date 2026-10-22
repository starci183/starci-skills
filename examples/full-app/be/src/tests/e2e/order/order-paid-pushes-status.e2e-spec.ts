import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { OrderStatusChangedData, PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    INVOICES_OF_ORDER,
    LOYALTY_POINTS_OF_ORDER,
    ORDER_SUMMARY,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * An order is paid by a bank transfer and its buyer sees it, end to end: the buyer places an order (it stays pending while billing
 * issues the invoice), opens an order status subscription, the notifier fake tells billing the buyer transferred the money,
 * billing confirms the payment and announces it, the order service records it and announces `order.paid`, and the reactors
 * push the frame to the buyer, grant the loyalty points and refresh nothing else. Another buyer subscribed to the same order id
 * receives nothing: the channel is built from the principal. The Postgres reads are out-of-band verification only.
 *
 * Run: npm run test:e2e -- order/order-paid-pushes-status
 */
describe("order paid pushes its status", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-chair", priceMinorUnits: 12_500, stock: 10 })
    })

    /** A signed-in buyer places an order of one chair and waits for billing to issue its invoice. */
    const placedOrder = async (name: string) => {
        const session = await world.signedInPerson(name)
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-chair", quantity: 1 } } }))
                .errorCode,
        ).toBeNull()
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: `${name}-1` } },
        })
        const order = present(placed.data, "placeOrder data").placeOrder
        await world.waitFor(`billing issues the invoice of ${name}`, async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [order.orderId])
            return rows[0]?.status === "issued" ? rows[0] : null
        })
        return { session, buyer, orderId: order.orderId }
    }

    it("realtime/subscriber-receives-push: the buyer's open subscription receives the paid frame once the transfer is confirmed", async () => {
        const { buyer, orderId } = await placedOrder("push-owner")
        expect((await readRows(world.db.order, ORDER_SUMMARY, [orderId]))[0]?.status).toBe("pending")
        const subscription = await buyer.subscribe<OrderStatusChangedData>("orderStatusChanged", {
            variables: { input: { orderId } },
        })

        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 12_500 })

        expect(delivery?.status).toBe(204)
        const frame = await subscription.next()
        expect(frame.orderStatusChanged).toMatchObject({ orderId, status: "paid" })
        expect((await readRows(world.db.order, ORDER_SUMMARY, [orderId]))[0]?.status).toBe("paid")
        const points = await world.waitFor("the loyalty points of the order are granted", async () => {
            const rows = await readRows(world.db.order, LOYALTY_POINTS_OF_ORDER, [orderId])
            return rows.find((row) => row.points === 125) ?? null
        })
        expect(points).toEqual({ points: 125 })
        await subscription.close()
    })

    it("realtime/foreign-topic-is-isolated: another buyer subscribed to the same order id receives nothing", async () => {
        const owner = await placedOrder("push-isolated-owner")
        const stranger = await world.signedInPerson("push-isolated-stranger")
        const ownerSubscription = await owner.buyer.subscribe<OrderStatusChangedData>("orderStatusChanged", {
            variables: { input: { orderId: owner.orderId } },
        })
        const strangerSubscription = await world.apps.order.api
            .bearing(stranger.sessionToken)
            .subscribe<OrderStatusChangedData>("orderStatusChanged", {
                variables: { input: { orderId: owner.orderId } },
            })

        await world.fake.sepay.settle({ reference: owner.orderId, amount: 12_500 })

        expect((await ownerSubscription.next()).orderStatusChanged).toMatchObject({
            orderId: owner.orderId,
            status: "paid",
        })
        expect(strangerSubscription.frames()).toEqual([])
        await ownerSubscription.close()
        await strangerSubscription.close()
    })
})
