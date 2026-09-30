import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type { AccountData, BuyerStatusData, CartData, PlaceOrderData } from "../setup/e2e-views.contracts"

/**
 * The happy path of the checkout end to end: a visitor registers on identity, signs in, browses the catalog through the
 * order cart query, fills the cart, confirms with an idempotency key (a replay answers the same order, never a second
 * payment), and the confirmation transaction leaves a captured payment, decremented stock and an empty cart. The
 * Postgres reads are out-of-band verification only: every step of the journey travels over the public doors.
 *
 * Run: npm run test:e2e -- checkout/checkout-journey
 */
describe("checkout journey", () => {
    let world: E2EWorld
    let personId = ""

    beforeAll(async () => {
        world = await bootE2eWorld("checkout/checkout-journey")
        // The stack counts as up only when both services answer their real dependency-checked /health.
        expect((await world.http("identity").get<{ status: string }>("/health")).body.status).toBe("ok")
        expect((await world.http("order").get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 300_000)

    afterAll(async () => {
        if (personId) await world.auth.deleteAccount(personId)
        await world.close()
    })

    it("register, browse the catalog, add to the cart, place the order, pay, and end with an empty cart", async () => {
        const session = await world.auth.registerBuyer("checkout", "e2e-checkout-pass")
        personId = session.personId
        const buyer = world.graphql.client("order", session.sessionToken)

        // The catalog is read through the cart query: it is the only catalog surface checkout has.
        const browsed = await buyer.read<CartData>("cart")
        expect(browsed.errorCode).toBeNull()
        const browsedCart = present(browsed.data, "cart data").cart
        expect(browsedCart.items).toEqual([])
        const mug = present(browsedCart.catalog.find((product) => product.id === "sku-mug"), "sku-mug")
        const notebook = present(browsedCart.catalog.find((product) => product.id === "sku-notebook"), "sku-notebook")
        const expectedTotal = mug.priceMinorUnits * 2 + notebook.priceMinorUnits

        expect((await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-mug", quantity: 2 } } })).errorCode).toBeNull()
        expect((await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-notebook", quantity: 1 } } })).errorCode).toBeNull()
        const unknown = await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-ghost", quantity: 1 } } })
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
        expect(order).toMatchObject({ status: "confirmed", totalMinorUnits: expectedTotal, currency: "USD", replayed: false })

        // Replay with the same key: the first answer again, not a second order or a second capture.
        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(replayed.errorCode).toBeNull()
        expect(replayed.data?.placeOrder).toMatchObject({ orderId: order.orderId, paymentId: order.paymentId, replayed: true })

        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])
        expect(await world.database.orderSummary(order.orderId)).toEqual([{ status: "confirmed", total_minor_units: expectedTotal }])
        expect(await world.database.orderLineCount(order.orderId)).toBe(2)
        expect(await world.database.paymentsOfPerson(personId)).toEqual([
            expect.objectContaining({ status: "captured", amount_minor_units: expectedTotal }),
        ])
        expect(await world.database.cartItemCount(personId)).toBe(0)
        expect(await world.database.stockOf("sku-mug")).toBe(mug.stock - 2)

        // The identity to order contract, live: order answers buyerStatus for the bearer, and identity account reads it.
        const buyerStatus = await buyer.read<BuyerStatusData>("buyerStatus")
        expect(buyerStatus.data?.buyerStatus).toEqual({ personId, hasOrders: true })
        const account = await world.graphql.client("identity", session.sessionToken).read<AccountData>("account")
        expect(account.data?.account).toMatchObject({ personId, email: session.email, hasOrders: true })

        // Sign-out: the guard consults identity on every request, so the revoked token stops answering on order.
        const revoked = await world.graphql.client("identity", session.sessionToken).mutate("revokeSession", {
            variables: { input: { sessionToken: session.sessionToken } },
        })
        expect(revoked.errorCode).toBeNull()
        const afterRevoke = await buyer.read<CartData>("cart")
        expect(afterRevoke.errorCode).toBe("AUTH_UNAUTHENTICATED")
    })
})
