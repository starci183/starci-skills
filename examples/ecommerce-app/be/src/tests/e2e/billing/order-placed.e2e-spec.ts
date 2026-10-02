import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { CartData, PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    INBOX_CLAIM_COUNT,
    INVOICES_OF_ORDER,
    INVOICE_COUNT_OF_PERSON,
    PLACE_ORDER_SAGA_STATE,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The async path between the services, end to end: a buyer places an order on the order service (one call across the
 * services, identity checking the session), the order service publishes `order.placed` on its Redis queue, and the billing
 * worker, a separate app with its own database, consumes it and records one invoice. A confirmation replayed with the same key
 * announces the order again; the billing inbox claims the repeated event once, so the order keeps one invoice. A second order
 * proves the repeat was consumed before it: the queue is ordered. The invoice the billing service issues is announced as
 * `billing.invoice-issued`, which completes the saga run of the order at version 2.
 *
 * Run: npm run test:e2e -- billing/order-placed
 */
describe("order.placed consumed by billing", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-lamp", priceMinorUnits: 4000, stock: 10 })
    })

    it("invoices a placed order once in the billing service, whatever the redeliveries", async () => {
        const session = await world.signedInPerson("billing-flow")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        const place = async (key: string) => {
            expect(
                (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-lamp", quantity: 1 } } }))
                    .errorCode,
            ).toBeNull()
            const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
                variables: { input: { idempotencyKey: key } },
            })
            expect(placed.errorCode).toBeNull()
            return present(placed.data, "placeOrder data").placeOrder
        }

        const first = await place("billing-flow-1")

        const invoiced = await world.waitFor("billing records the invoice of the first order", async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [first.orderId])
            return rows[0] ?? null
        })
        expect(invoiced).toEqual({ order_id: first.orderId, status: "issued", total_minor_units: 4000 })

        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "billing-flow-1" } },
        })
        expect(replayed.data?.placeOrder).toMatchObject({ orderId: first.orderId, replayed: true })

        const second = await place("billing-flow-2")
        await world.waitFor("billing records the invoice of the second order", async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [second.orderId])
            return rows[0] ?? null
        })

        expect(await readRows(world.db.billing, INVOICES_OF_ORDER, [first.orderId])).toHaveLength(1)
        const completed = await world.waitFor("the saga run of the first order is completed", async () => {
            const rows = await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [first.orderId])
            return rows.find((row) => row.status === "completed") ?? null
        })
        expect(completed).toEqual({ status: "completed", version: 2 })
        expect(await readCount(world.db.billing, INVOICE_COUNT_OF_PERSON, session.personId)).toBe(2)
        expect(await readCount(world.db.billing, INBOX_CLAIM_COUNT, "order")).toBeGreaterThanOrEqual(2)
        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])
    })
})
