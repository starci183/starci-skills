import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type {
    AccountData,
    BuyerStatusData,
    CartData,
    OrderReceiptData,
    PlaceOrderData,
    ReceiptDocumentView,
} from "../../fixtures/e2e-views.contracts"
import { readRows, readCount, readStock } from "../../fixtures/persistence/e2e-verification.rows"
import { ORDER_SUMMARY, ORDER_LINE_COUNT, CART_ITEM_COUNT } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The happy path of the checkout end to end: a visitor registers on identity, signs in, browses the catalog through the
 * order cart query, fills the cart, places the order with an idempotency key (a replay answers the same order, never a second
 * one), and the placement transaction leaves a pending order, decremented stock and an empty cart. The buyer then
 * downloads the order's receipt from the private archive through a link that expires; another buyer is refused it. The
 * Postgres reads are out-of-band verification only: every step of the journey travels over the public doors.
 *
 * Run: npm run test:e2e -- checkout/checkout-journey
 */
describe("checkout journey", () => {
    let personId = ""

    const world = useTestWorld({ apps: ["identity", "order"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-thermos", stock: 2 })
    })

    it("register, browse the catalog, add to the cart, place the order, and end with an empty cart", async () => {
        const session = await world.signedInPerson("checkout")
        personId = session.personId
        const buyer = world.apps.order.api.bearing(session.sessionToken)

        // The catalog is read through the cart query: it is the only catalog surface checkout has.
        const browsed = await buyer.read<CartData>("cart")
        expect(browsed.errorCode).toBeNull()
        const browsedCart = present(browsed.data, "cart data").cart
        expect(browsedCart.items).toEqual([])
        const mug = present(
            browsedCart.catalog.find((product) => product.id === "sku-mug"),
            "sku-mug",
        )
        const notebook = present(
            browsedCart.catalog.find((product) => product.id === "sku-notebook"),
            "sku-notebook",
        )
        const expectedTotal = mug.priceMinorUnits * 2 + notebook.priceMinorUnits

        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-mug", quantity: 2 } } }))
                .errorCode,
        ).toBeNull()
        expect(
            (await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-notebook", quantity: 1 } } }))
                .errorCode,
        ).toBeNull()
        const unknown = await buyer.mutate("addCartItem", {
            variables: { input: { productId: "sku-ghost", quantity: 1 } },
        })
        expect(unknown.errorCode).toBe("ORDER_UNKNOWN_PRODUCT")

        const filled = await buyer.read<CartData>("cart")
        expect(filled.data?.cart.items).toEqual([
            { productId: "sku-mug", quantity: 2 },
            { productId: "sku-notebook", quantity: 1 },
        ])

        const idempotencyKey = `e2e-${personId}`
        const placed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(placed.errorCode).toBeNull()
        const order = present(placed.data, "placeOrder data").placeOrder
        expect(order).toMatchObject({
            status: "pending",
            totalMinorUnits: expectedTotal,
            currency: "USD",
            replayed: false,
        })

        // Replay with the same key: the first answer again, not a second order.
        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(replayed.errorCode).toBeNull()
        expect(replayed.data?.placeOrder).toMatchObject({
            orderId: order.orderId,
            replayed: true,
        })

        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])
        expect(await readRows(world.db.order, ORDER_SUMMARY, [order.orderId])).toEqual([
            { status: "pending", total_minor_units: expectedTotal },
        ])
        expect(await readCount(world.db.order, ORDER_LINE_COUNT, order.orderId)).toBe(2)
        expect(await readCount(world.db.order, CART_ITEM_COUNT, personId)).toBe(0)
        expect(await readStock(world.db.order, "sku-mug")).toBe(mug.stock - 2)

        // The receipt: archived after the commit, downloaded by the buyer through a presigned link of the private bucket.
        const receipt = await buyer.read<OrderReceiptData>("orderReceipt", {
            variables: { input: { orderId: order.orderId } },
        })
        expect(receipt.errorCode).toBeNull()
        const link = new URL(present(receipt.data, "orderReceipt data").orderReceipt.url)
        const downloaded = await world.http(link.origin).get<ReceiptDocumentView>(`${link.pathname}${link.search}`)
        expect(downloaded.status).toBe(200)
        expect(downloaded.body).toMatchObject({
            orderId: order.orderId,
            personId,
            totalMinorUnits: expectedTotal,
            lines: [
                { productId: "sku-mug", quantity: 2, unitPriceMinorUnits: mug.priceMinorUnits },
                { productId: "sku-notebook", quantity: 1, unitPriceMinorUnits: notebook.priceMinorUnits },
            ],
        })
        const unsigned = await world.http(link.origin).get(link.pathname)
        expect(unsigned.status).toBe(403)
        const stranger = await world.signedInPerson("checkout-stranger")
        const refused = await world.apps.order.api
            .bearing(stranger.sessionToken)
            .read<OrderReceiptData>("orderReceipt", { variables: { input: { orderId: order.orderId } } })
        expect(refused.errorCode).toBe("ORDER_RECEIPT_NOT_FOUND")

        // The identity to order contract, live: order answers buyerStatus for the bearer, and identity account reads it.
        const buyerStatus = await buyer.read<BuyerStatusData>("buyerStatus")
        expect(buyerStatus.data?.buyerStatus).toEqual({ personId, hasOrders: true })
        const account = await world.apps.identity.api.bearing(session.sessionToken).read<AccountData>("account")
        expect(account.data?.account).toMatchObject({ personId, email: session.email, hasOrders: true })

        // Sign-out: the guard consults identity on every request, so the revoked token stops answering on order.
        const revoked = await world.apps.identity.api.bearing(session.sessionToken).mutate("revokeSession", {
            variables: { input: { sessionToken: session.sessionToken } },
        })
        expect(revoked.errorCode).toBeNull()
        const afterRevoke = await buyer.read<CartData>("cart")
        expect(afterRevoke.errorCode).toBe("IDENTITY_UNAUTHENTICATED")
    })
})
