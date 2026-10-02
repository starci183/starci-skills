import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readRows, readStock } from "../../fixtures/persistence/e2e-verification.rows"
import { CANCELLED_ORDER, INVOICES_OF_ORDER, PAYMENTS_OF_PERSON } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The order saga with its compensation, end to end on the real services: a buyer places an order whose total is above what
 * the billing service invoices (`order.placed`), the billing worker records a rejected invoice and announces
 * `billing.invoice-rejected`, and the order service, whose message transport is the compensating step, cancels the order, gives the stock of its lines
 * back and refunds its payment. A confirmation replayed with the same key announces the order again; billing announces the
 * rejection again; the order service finds the order already cancelled and changes nothing, so the stock comes back once: a
 * second rejected order proves the repeated rejection was consumed before it (the queue is ordered).
 *
 * Run: npm run test:e2e -- order/invoice-rejected
 */
describe("billing.invoice-rejected compensates order.placed", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-yacht", priceMinorUnits: 200_000, stock: 3 })
    })

    it("cancels the order, restores the stock and refunds the payment once, whatever the redeliveries", async () => {
        const session = await world.signedInPerson("saga-flow")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        const place = async (key: string) => {
            expect(
                (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-yacht", quantity: 1 } } }))
                    .errorCode,
            ).toBeNull()
            const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
                variables: { input: { idempotencyKey: key } },
            })
            expect(placed.errorCode).toBeNull()
            return present(placed.data, "placeOrder data").placeOrder
        }
        const cancelled = (orderId: string) =>
            world.waitFor(`the order ${orderId} is cancelled`, async () => {
                const rows = await readRows(world.db.order, CANCELLED_ORDER, [orderId])
                return rows[0] ?? null
            })

        const first = await place("saga-flow-1")
        expect(first).toMatchObject({ status: "confirmed", totalMinorUnits: 200_000, replayed: false })

        expect(await cancelled(first.orderId)).toEqual({ status: "cancelled", total_minor_units: 200_000 })
        expect(await readRows(world.db.billing, INVOICES_OF_ORDER, [first.orderId])).toEqual([
            { order_id: first.orderId, status: "rejected", total_minor_units: 200_000 },
        ])
        expect(await readStock(world.db.order, "sku-yacht")).toBe(3)

        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "saga-flow-1" } },
        })
        expect(replayed.data?.placeOrder).toMatchObject({ orderId: first.orderId, replayed: true })

        const second = await place("saga-flow-2")
        await cancelled(second.orderId)

        expect(await readStock(world.db.order, "sku-yacht")).toBe(3)
        expect(await readRows(world.db.order, PAYMENTS_OF_PERSON, [session.personId])).toEqual([
            expect.objectContaining({ order_id: first.orderId, status: "refunded", amount_minor_units: 200_000 }),
            expect.objectContaining({ order_id: second.orderId, status: "refunded", amount_minor_units: 200_000 }),
        ])
    })
})
