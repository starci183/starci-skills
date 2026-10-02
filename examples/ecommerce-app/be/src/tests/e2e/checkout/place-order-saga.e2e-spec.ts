import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readRows, readStock } from "../../fixtures/persistence/e2e-verification.rows"
import {
    INVOICES_OF_ORDER,
    ORDER_SUMMARY,
    PLACE_ORDER_SAGA_STATE,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The place-order saga from the api call to its final state, on the real services: one `placeOrder` mutation on the order
 * service starts the run (the order, the stock and the saga row commit together at version 1), the order is
 * announced to the billing service, which issues the invoice in its own database and announces it back, and the run settles
 * as completed at version 2. Nothing is compensated: the order stays pending (its payment arrives later as an event) and the stock stays taken. The compensation paths are `order/invoice-rejected`.
 *
 * Run: npm run test:e2e -- checkout/place-order-saga
 */
describe("place-order saga: api call to the completed run", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-desk", priceMinorUnits: 3000, stock: 5 })
    })

    it("completes the run after one placeOrder call, leaving the order pending and invoiced", async () => {
        const session = await world.signedInPerson("place-order-saga")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-desk", quantity: 2 } } }))
                .errorCode,
        ).toBeNull()

        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "place-order-saga-1" } },
        })
        const order = present(placed.data, "placeOrder data").placeOrder
        expect(order).toMatchObject({ status: "pending", totalMinorUnits: 6000, replayed: false })
        expect(await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [order.orderId])).toHaveLength(1)

        const completed = await world.waitFor("the saga run is completed", async () => {
            const rows = await readRows(world.db.order, PLACE_ORDER_SAGA_STATE, [order.orderId])
            return rows.find((row) => row.status === "completed") ?? null
        })

        expect(completed).toEqual({ status: "completed", version: 2 })
        expect(await readRows(world.db.order, ORDER_SUMMARY, [order.orderId])).toEqual([
            { status: "pending", total_minor_units: 6000 },
        ])
        expect(await readRows(world.db.billing, INVOICES_OF_ORDER, [order.orderId])).toEqual([
            { order_id: order.orderId, status: "issued", total_minor_units: 6000 },
        ])
        expect(await readStock(world.db.order, "sku-desk")).toBe(3)
    })
})
