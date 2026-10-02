import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { OrderReceiptData, PlaceOrderData, ReceiptDocumentView } from "../../fixtures/e2e-views.contracts"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { INVOICES_OF_ORDER } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The receipt of a paid order, end to end: the buyer places an order, billing issues its invoice and the notifier fake settles
 * it; the order service marks the order paid and enqueues the send-receipt job in that transaction, the fenced job stores the
 * receipt in the private archive, and the buyer downloads it through a presigned link that expires. Another buyer is refused it.
 * The Postgres reads are out-of-band verification only.
 *
 * Run: npm run test:e2e -- order/order-paid-archives-receipt
 */
describe("order paid archives its receipt", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-kettle", priceMinorUnits: 2_400, stock: 5 })
    })

    /** Waits for billing to issue the invoice of an order. */
    const issuedInvoice = (orderId: string) =>
        world.waitFor("billing issues the invoice", async () => {
            const rows = await readRows(world.db.billing, INVOICES_OF_ORDER, [orderId])
            return rows[0]?.status === "issued" ? rows[0] : null
        })

    /** Waits for the receipt of a paid order to be readable by its buyer. */
    const archivedReceipt = (buyer: ReturnType<typeof world.apps.order.api.bearing>, orderId: string) =>
        world.waitFor("the receipt of the paid order is archived", async () => {
            const read = await buyer.read<OrderReceiptData>("orderReceipt", { variables: { input: { orderId } } })
            return read.errorCode === null ? read : null
        })

    it("the send-receipt job archives the receipt of a paid order and the buyer downloads it through a link that expires", async () => {
        const session = await world.signedInPerson("receipt-owner")
        const buyer = world.apps.order.api.bearing(session.sessionToken)
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-kettle", quantity: 2 } } }))
                .errorCode,
        ).toBeNull()
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", {
            variables: { input: { idempotencyKey: "receipt-owner-1" } },
        })
        const order = present(placed.data, "placeOrder data").placeOrder
        await issuedInvoice(order.orderId)

        const delivery = await world.fake.sepay.settle({ reference: order.orderId, amount: 4_800 })

        expect(delivery?.status).toBe(204)
        const receipt = await archivedReceipt(buyer, order.orderId)
        const link = new URL(present(receipt.data, "orderReceipt data").orderReceipt.url)
        const downloaded = await world.http(link.origin).get<ReceiptDocumentView>(`${link.pathname}${link.search}`)
        expect(downloaded.status).toBe(200)
        expect(downloaded.body).toMatchObject({
            orderId: order.orderId,
            personId: session.personId,
            totalMinorUnits: 4_800,
            lines: [{ productId: "sku-kettle", quantity: 2, unitPriceMinorUnits: 2_400 }],
        })
        expect((await world.http(link.origin).get(link.pathname)).status).toBe(403)

        const stranger = await world.signedInPerson("receipt-stranger")
        const refused = await world.apps.order.api
            .bearing(stranger.sessionToken)
            .read<OrderReceiptData>("orderReceipt", { variables: { input: { orderId: order.orderId } } })
        expect(refused.errorCode).toBe("ORDER_RECEIPT_NOT_FOUND")
    })
})
