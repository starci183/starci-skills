import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { INBOX_CLAIM_COUNT, INVOICES_OF_ORDER, ORDER_SUMMARY } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The payment of an order crosses the two services, end to end: the notifier fake tells billing the buyer transferred the money,
 * billing confirms the payment and announces `billing.payment-confirmed`, and the order service consumes it, marks the order paid
 * and keeps a read model of the order. A delivery of the same transfer sent again is claimed once by the inbox of each side and
 * changes nothing. The Postgres reads are out-of-band verification only.
 *
 * Run: npm run test:e2e -- order/payment-confirmation-marks-order-paid
 */
describe("payment confirmation marks the order paid", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-lamp", priceMinorUnits: 3_000, stock: 10 })
    })

    /** Waits for billing to issue the invoice of an order. */
    const issuedInvoice = (orderId: string) =>
        world.waitFor("billing issues the invoice", async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId])
            return rows[0]?.status === "issued" ? rows[0] : null
        })

    /** Waits for the order service to show the order as paid in its read model. */
    const paidSummary = (orderId: string) =>
        world.waitFor("the order service marks the order paid", async () => {
            const rows = await readRows(world.db.order, ORDER_SUMMARY, [orderId])
            return rows[0]?.status === "paid" ? rows[0] : null
        })

    it("billing.payment-confirmed marks a pending order paid once, and the same transfer sent again changes nothing", async () => {
        const session = await world.signedInPerson("payment-confirmed")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-lamp", quantity: 1 } } }))
                .errorCode,
        ).toBeNull()
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "payment-confirmed-1" } },
        })
        const orderId = present(placed.data, "placeOrder data").placeOrder.orderId
        await issuedInvoice(orderId)
        expect((await readRows(world.db.order, ORDER_SUMMARY, [orderId]))[0]?.status).toBe("pending")

        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 3_000 })

        expect(delivery?.status).toBe(204)
        const paid = await paidSummary(orderId)
        expect(paid.status).toBe("paid")
        const claims = await readCount(world.db.order, INBOX_CLAIM_COUNT, "billing-payment-confirmed")

        const repeated = await world.fake.sepay.replayWebhook(orderId)

        expect(repeated.status).toBe(204)
        expect((await readRows(world.db.order, ORDER_SUMMARY, [orderId]))[0]?.status).toBe("paid")
        expect(await readCount(world.db.order, INBOX_CLAIM_COUNT, "billing-payment-confirmed")).toBe(claims)
    })
})
