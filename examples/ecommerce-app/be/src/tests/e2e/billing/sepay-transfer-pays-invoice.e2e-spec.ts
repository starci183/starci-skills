import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    BILLING_PAYMENTS_OF_ORDER,
    INBOX_CLAIM_COUNT,
    INVOICES_OF_ORDER,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

const STALE_AGE_MS = 10 * 60_000

/**
 * The signed bank transfer webhook of the billing service, end to end, against the SePay fake at the network edge: a buyer
 * places an order, billing issues its invoice, and the notifier tells billing the buyer transferred the money. Billing proves
 * every delivery first (signature and replay window, on the exact bytes), then records the payment and marks the invoice paid
 * in one transaction; a refused or repeated delivery changes nothing. The Postgres reads are out-of-band verification only.
 *
 * Run: npm run test:e2e -- billing/sepay-transfer-pays-invoice
 */
describe("sepay transfer pays an invoice", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-desk", priceMinorUnits: 4500, stock: 10 })
    })

    /** A signed-in buyer places an order of one desk and waits for billing to issue its invoice. */
    const orderWithInvoice = async (name: string) => {
        const session = await world.signedInPerson(name)
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-desk", quantity: 1 } } })).errorCode,
        ).toBeNull()
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: `${name}-1` } } })
        const order = present(placed.data, "placeOrder data").placeOrder
        await world.waitFor(`billing issues the invoice of ${name}`, async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [order.orderId])
            return rows[0]?.status === "issued" ? rows[0] : null
        })
        return order.orderId
    }

    it("webhooks/bad-signature-is-refused: a delivery with a wrong signature is answered 401 and leaves the invoice open", async () => {
        const orderId = await orderWithInvoice("sepay-bad-signature")

        await world.fake.sepay.failNext({ badSignature: true })
        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 4500 })

        expect(delivery?.status).toBe(401)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
    })

    it("webhooks/replay-is-refused: a correctly signed delivery older than the replay window is answered 401 and changes nothing", async () => {
        const orderId = await orderWithInvoice("sepay-replay")
        await world.fake.sepay.failNext({ badSignature: true })
        await world.fake.sepay.settle({ reference: orderId, amount: 4500 })

        const stale = await world.fake.sepay.replayWebhook(orderId, { ageMs: STALE_AGE_MS })

        expect(stale.status).toBe(401)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
    })

    it("webhooks/accepted-delivery-publishes-once: a valid transfer pays the invoice once, whatever the repeats", async () => {
        const orderId = await orderWithInvoice("sepay-accepted")

        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 4500 })

        expect(delivery?.status).toBe(204)
        const paid = await world.waitFor("billing records the payment of the order", async () => {
            const rows = await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])
            return rows[0] ?? null
        })
        expect(paid).toMatchObject({ order_id: orderId, amount_minor_units: 4500 })
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("paid")

        // The very same delivery sent again is claimed once by the inbox: still one payment and one claim.
        const repeated = await world.fake.sepay.replayWebhook(orderId)
        expect(repeated.status).toBe(204)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toHaveLength(1)
        expect(await readCount(world.db.billing, INBOX_CLAIM_COUNT, "sepay")).toBeGreaterThanOrEqual(1)
    })

    it("a transfer of the wrong amount is accepted by the door but pays nothing: the invoice stays open for a correct transfer", async () => {
        const orderId = await orderWithInvoice("sepay-wrong-amount")

        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 1000 })

        expect(delivery?.status).toBe(204)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
    })
})
