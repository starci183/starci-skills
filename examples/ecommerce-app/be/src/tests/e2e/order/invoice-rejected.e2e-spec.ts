import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readRows, readStock } from "../../fixtures/persistence/e2e-verification.rows"
import {
    CANCELLED_ORDER,
    INVOICES_OF_ORDER,
    PLACE_ORDER_SAGA_STATE,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/** How many 250 ms polls the order database stays down while the compensation retries against it (two backoffs of the queue pass). */
const OUTAGE_POLLS = 10

/**
 * The place-order saga with its compensation, end to end on the real services: a buyer places an order whose total is above
 * what the billing service invoices (`order.placed`), billing records a rejected invoice and announces
 * `billing.invoice-rejected`, and the order service, whose message transport is the compensating step, cancels the order, gives
 * the stock of its lines back, settling the saga run as compensated. A confirmation replayed with the
 * same key announces the order again; billing announces the rejection again; the saga finds the run settled and changes
 * nothing, so the stock comes back once. The second path injects the failure: the order database is cut while the rejection is
 * delivered, the compensation fails on its first deliveries, the queue retries them with its backoff and the run settles once
 * the database is back.
 *
 * Run: npm run test:e2e -- order/invoice-rejected
 */
describe("billing.invoice-rejected compensates order.placed", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-yacht", priceMinorUnits: 200_000, stock: 6 })
    })

    const placeYacht = async (buyer: ReturnType<typeof world.apps.order.api.bearing>, key: string) => {
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

    it("cancels the order, restores the stock once, whatever the redeliveries", async () => {
        const session = await world.signedInPerson("saga-flow")
        const buyer = world.apps.order.api.bearing(session.sessionToken)

        const first = await placeYacht(buyer, "saga-flow-1")
        expect(first).toMatchObject({ status: "pending", totalMinorUnits: 200_000, replayed: false })
        expect(await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [first.orderId])).toHaveLength(1)

        expect(await cancelled(first.orderId)).toEqual({ status: "cancelled", total_minor_units: 200_000 })
        expect(await readRows(world.db.billing, INVOICES_OF_ORDER, [first.orderId])).toEqual([
            { order_id: first.orderId, status: "rejected", total_minor_units: 200_000 },
        ])
        const settled = await world.waitFor("the saga run of the first order is compensated", async () => {
            const rows = await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [first.orderId])
            return rows.find((row) => row.status === "compensated") ?? null
        })
        expect(settled).toEqual({ status: "compensated", version: 3 })
        expect(await readStock(world.db.order, "sku-yacht")).toBe(6)

        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "saga-flow-1" } },
        })
        expect(replayed.data?.placeOrder).toMatchObject({ orderId: first.orderId, replayed: true })

        const second = await placeYacht(buyer, "saga-flow-2")
        await cancelled(second.orderId)

        expect(await readStock(world.db.order, "sku-yacht")).toBe(6)
        expect(await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [first.orderId])).toEqual([
            { status: "compensated", version: 3 },
        ])
    })

    it("resumes the compensation on the queue retry after the order database was down while the rejection arrived", async () => {
        const session = await world.signedInPerson("saga-outage")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        const placed = await placeYacht(buyer, "saga-outage-1")
        let polls = 0

        await world.infra.postgresql.connection("order").during(async () => {
            await world.waitFor("billing records the rejected invoice", async () => {
                const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [placed.orderId])
                return rows[0] ?? null
            })
            await world.waitUntil(
                "the compensation retries against the dead database",
                () => {
                    polls += 1
                    return Promise.resolve(polls)
                },
                (observed) => observed >= OUTAGE_POLLS,
            )
        })

        expect(await cancelled(placed.orderId)).toEqual({ status: "cancelled", total_minor_units: 200_000 })
        const settled = await world.waitFor("the saga run is compensated after the retry", async () => {
            const rows = await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [placed.orderId])
            return rows.find((row) => row.status === "compensated") ?? null
        })
        expect(settled.version).toBe(3)
        expect(await readStock(world.db.order, "sku-yacht")).toBe(6)
    })
})
