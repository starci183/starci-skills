import { QueryFailedError } from "typeorm"
import { PaymentConfirmedEvent } from "@modules/events/billing"
import { ErrorsFilter } from "@modules/platform/errors"
import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    BILLING_FAULT_OBJECT_COUNT,
    BILLING_PAYMENTS_OF_ORDER,
    DELETE_TRANSFER_CLAIM,
    DUPLICATE_OUTBOX_ROW,
    INBOX_CLAIM_COUNT,
    INVOICES_OF_ORDER,
    OUTBOX_OF_EVENT,
    TRANSFER_CLAIM_COUNT,
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
    let filterSpy: jest.SpiedFunction<ErrorsFilter["catch"]>

    beforeAll(() => {
        filterSpy = jest.spyOn(ErrorsFilter.prototype, "catch")
    })

    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    afterAll(() => {
        filterSpy.mockRestore()
    })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-desk", priceMinorUnits: 4500, stock: 10 })
    })

    /** A signed-in buyer places an order of one desk and waits for billing to issue its invoice. */
    const orderWithInvoice = async (name: string) => {
        const session = await world.signedInPerson(name)
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-desk", quantity: 1 } } }))
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
        return order.orderId
    }

    /** Counts committed confirmations of this order rather than inferring publication from its payment row. */
    const confirmationCountOf = async (orderId: string): Promise<number> =>
        (await readRows(world.db.billing, OUTBOX_OF_EVENT, [orderId])).filter(
            (row) => row.event_name === PaymentConfirmedEvent.eventName,
        ).length

    it("webhooks/bad-signature-is-refused: a delivery with a wrong signature is answered 401 and leaves the invoice open", async () => {
        const orderId = await orderWithInvoice("sepay-bad-signature")

        await world.fake.sepay.failNext({ badSignature: true })
        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 4500 })

        expect(delivery?.status).toBe(401)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
        expect(await confirmationCountOf(orderId)).toBe(0)
    })

    it("webhooks/replay-is-refused: a correctly signed delivery older than the replay window is answered 401 and changes nothing", async () => {
        const orderId = await orderWithInvoice("sepay-replay")
        await world.fake.sepay.failNext({ badSignature: true })
        await world.fake.sepay.settle({ reference: orderId, amount: 4500 })

        const stale = await world.fake.sepay.replayWebhook(orderId, { ageMs: STALE_AGE_MS })

        expect(stale.status).toBe(401)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
        expect(await confirmationCountOf(orderId)).toBe(0)
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
        expect(await confirmationCountOf(orderId)).toBe(1)
        const claimsAfterFirst = await readCount(world.db.billing, INBOX_CLAIM_COUNT, "sepay")
        expect(claimsAfterFirst).toBeGreaterThanOrEqual(1)

        // A completed redelivery must add neither another payment, claim nor confirmation outbox row.
        const repeated = await world.fake.sepay.replayWebhook(orderId)
        expect(repeated.status).toBe(204)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toHaveLength(1)
        expect(await readCount(world.db.billing, INBOX_CLAIM_COUNT, "sepay")).toBe(claimsAfterFirst)
        expect(await confirmationCountOf(orderId)).toBe(1)
    })

    it("a transfer of the wrong amount is accepted by the door but pays nothing: the invoice stays open for a correct transfer", async () => {
        const orderId = await orderWithInvoice("sepay-wrong-amount")

        const delivery = await world.fake.sepay.settle({ reference: orderId, amount: 1000 })

        expect(delivery?.status).toBe(204)
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toEqual([])
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("issued")
    })

    it("webhooks/failed-transaction-keeps-transfer-retryable: claim, payment and confirmation roll back together even when compensating DELETE is refused", async () => {
        filterSpy.mockClear()
        const controlOrderId = await orderWithInvoice("sepay-delete-control")
        const orderId = await orderWithInvoice("sepay-rollback-retry")
        const control = present(
            await world.fake.sepay.settle({ reference: controlOrderId, amount: 4500 }),
            "committed DELETE-control delivery",
        )
        await world.fake.sepay.failNext({ badSignature: true })
        const original = present(
            await world.fake.sepay.settle({ reference: orderId, amount: 4500 }),
            "unclaimed target transfer",
        )
        let faultDelivery = original
        const billing = world.infra.postgresql.connection("billing")
        const outboxFault = billing.writeFault("event_outbox", "insert")
        const deleteFault = billing.writeFault("inbox_claims", "delete")
        const faultNames = [outboxFault.name, deleteFault.name]

        // The database is slot-isolated, not test-isolated: Root schedules this spec alone and serially.
        try {
            expect(control.status).toBe(204)
            expect(original.status).toBe(401)
            expect(await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", control.body])).toEqual([
                { count: 1 },
            ])
            expect(await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", original.body])).toEqual([
                { count: 0 },
            ])
            expect(await readRows(world.db.billing, BILLING_FAULT_OBJECT_COUNT, faultNames)).toEqual([{ count: 0 }])

            await outboxFault.install()
            await deleteFault.install()
            expect(await readRows(world.db.billing, BILLING_FAULT_OBJECT_COUNT, faultNames)).toEqual([{ count: 4 }])

            // A BEFORE ROW fault is not invoked when the DELETE matches no row.
            await world.db.billing.query(DELETE_TRANSFER_CLAIM, ["sepay", original.body])
            await expect(world.db.billing.query(DELETE_TRANSFER_CLAIM, ["sepay", control.body])).rejects.toMatchObject({
                driverError: { code: deleteFault.errorCode, detail: deleteFault.name },
            })
            expect(await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", control.body])).toEqual([
                { count: 1 },
            ])
            await expect(world.db.billing.query(DUPLICATE_OUTBOX_ROW, [orderId])).rejects.toMatchObject({
                driverError: { code: outboxFault.errorCode, detail: outboxFault.name },
            })

            // Re-sign the captured body freshly; subsequent replays preserve these exact valid headers and bytes.
            faultDelivery = await world.fake.sepay.replayWebhook(orderId, { ageMs: 1 })
            expect(faultDelivery.body).toBe(original.body)
            expect(faultDelivery.status).toBe(500)
            const rollbackState = {
                claims: await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", faultDelivery.body]),
                payments: await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId]),
                invoiceStatus: (await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status,
                confirmations: await confirmationCountOf(orderId),
            }
            expect(rollbackState).toEqual({
                claims: [{ count: 0 }],
                payments: [],
                invoiceStatus: "issued",
                confirmations: 0,
            })
            const routeError = present(
                filterSpy.mock.calls
                    .map(([error]) => error)
                    .find(
                        (error): error is QueryFailedError =>
                            error instanceof QueryFailedError &&
                            error.query.startsWith("INSERT INTO event_outbox") &&
                            error.parameters?.[0] === orderId,
                    ),
                "the actual billing HTTP route's outbox failure",
            )
            expect(routeError.driverError).toMatchObject({
                code: outboxFault.errorCode,
                detail: outboxFault.name,
            })
            expect(routeError.parameters).toEqual([
                orderId,
                PaymentConfirmedEvent.eventName,
                expect.any(String),
                orderId,
                expect.stringContaining(orderId),
                expect.any(Date),
            ])
        } finally {
            // Attempt both removals even if one fails, then attempt control cleanup and both independent reads.
            const removed = await Promise.allSettled([deleteFault.restore(), outboxFault.restore()])
            const controlRemoved = await Promise.allSettled([
                world.db.billing.query(DELETE_TRANSFER_CLAIM, ["sepay", control.body]),
            ])
            const readable = await Promise.allSettled([
                readRows(world.db.billing, BILLING_FAULT_OBJECT_COUNT, faultNames),
                readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", control.body]),
            ])
            expect(removed).toEqual([
                expect.objectContaining({ status: "fulfilled" }),
                expect.objectContaining({ status: "fulfilled" }),
            ])
            expect(controlRemoved).toEqual([expect.objectContaining({ status: "fulfilled" })])
            expect(readable).toEqual([
                { status: "fulfilled", value: [{ count: 0 }] },
                { status: "fulfilled", value: [{ count: 0 }] },
            ])
        }

        const retried = await world.fake.sepay.replayWebhook(orderId)
        expect(retried.body).toBe(faultDelivery.body)
        expect(retried.headers).toEqual(faultDelivery.headers)
        expect(retried.status).toBe(204)
        expect(await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", retried.body])).toEqual([{ count: 1 }])
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toHaveLength(1)
        expect((await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId]))[0]?.status).toBe("paid")
        expect(await confirmationCountOf(orderId)).toBe(1)

        const repeated = await world.fake.sepay.replayWebhook(orderId)
        expect(repeated.body).toBe(retried.body)
        expect(repeated.headers).toEqual(retried.headers)
        expect(repeated.status).toBe(204)
        expect(await readRows(world.db.billing, TRANSFER_CLAIM_COUNT, ["sepay", repeated.body])).toEqual([{ count: 1 }])
        expect(await readRows(world.db.billing, BILLING_PAYMENTS_OF_ORDER, [orderId])).toHaveLength(1)
        expect(await confirmationCountOf(orderId)).toBe(1)
    })
})
