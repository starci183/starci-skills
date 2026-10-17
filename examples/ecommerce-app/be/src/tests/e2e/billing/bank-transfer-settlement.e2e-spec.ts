import { PaymentConfirmedEvent } from "@modules/events/billing"
import { productBuilder } from "../../fixtures/builders/catalog.builder"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { present } from "../../fixtures/present.mapper"
import {
    APPEND_SETTLEMENT_MARKER,
    SETTLEMENT_CLAIM_COUNT,
    TRANSFER_RECEIPT_OF_ORDER,
} from "../../fixtures/persistence/bank-transfer-settlement.sql"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    BILLING_PAYMENTS_OF_ORDER,
    DUPLICATE_OUTBOX_ROW,
    INVOICES_OF_ORDER,
    OUTBOX_OF_EVENT,
    TRANSFER_CLAIM_COUNT,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/** Publishes a receipt through the signed webhook, then replays its outbox event through Kafka, past the webhook inbox. */
describe("billing.bank-transfer-received settlement", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-settlement", priceMinorUnits: 4500, stock: 10 })
    })

    it("settles a received transfer once when the committed event is redelivered", async () => {
        const session = await world.signedInPerson("bank-transfer-settlement")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-settlement", quantity: 1 } } }))
                .errorCode,
        ).toBeNull()
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "bank-transfer-settlement-1" } },
        })
        expect(placed.errorCode).toBeNull()
        const orderId = present(placed.data, "placeOrder data").placeOrder.orderId
        await world.waitFor("billing issues the invoice before the transfer", async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId])
            return rows.find((row) => row.status === "issued") ?? null
        })

        const delivery = present(
            await world.fake.sepay.settle({ reference: orderId, amount: 4500 }),
            "signed transfer delivery",
        )
        expect(delivery.status).toBe(204)
        const receipt = present(
            (await readRows(world.db.billing, TRANSFER_RECEIPT_OF_ORDER, [orderId]))[0],
            "committed bank transfer receipt",
        )
        const payment = await world.waitFor("the reactor persists the payment", async () => {
            const rows = await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])
            return rows[0] ?? null
        })
        expect(payment).toEqual({
            order_id: orderId,
            amount_minor_units: 4500,
            provider_reference: receipt.provider_reference,
        })

        await world.db.billing.query(DUPLICATE_OUTBOX_ROW, [receipt.event_id])
        // This later receipt names the already-paid invoice: it claims its id but creates no payment.
        // Keeping the original partition key makes its claim a persisted barrier after the duplicate.
        const markerId = `${receipt.event_id}-settlement-marker`
        await world.db.billing.query(APPEND_SETTLEMENT_MARKER, [receipt.event_id, markerId])
        await world.waitUntil(
            "the reactor claims the marker after consuming the duplicate",
            () => readCount(world.db.billing, SETTLEMENT_CLAIM_COUNT, markerId),
            (count) => count === 1,
        )

        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([payment])
        expect(await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId])).toEqual([
            { order_id: orderId, status: "paid", total_minor_units: 4500 },
        ])
        expect(
            await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["billing.bank-transfer-received", delivery.body]),
        ).toEqual([{ count: 1 }])
        const confirmations = (await readRows(world.db.billing, OUTBOX_OF_EVENT, [orderId])).filter(
            (row) => row.event_name === PaymentConfirmedEvent.eventName,
        )
        expect(confirmations).toEqual([expect.objectContaining({ event_name: PaymentConfirmedEvent.eventName })])
    })
})
