import { AppModule as IdentityApp } from "../../../../apps/identity/src/app.module"
import { AppModule as OrderApp } from "../../../../apps/order/src/app.module"
import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { CartData, PlaceOrderData, AccountData, BuyerStatusData } from "../../fixtures/e2e-views.contracts"
import type { OrderSummaryRow, PaymentRow } from "../../fixtures/persistence/e2e-verification.rows"
import { readRows, readCount, readStock } from "../../fixtures/persistence/e2e-verification.rows"
import {
    ORDER_SUMMARY,
    ORDER_LINE_COUNT,
    CART_ITEM_COUNT,
    PAYMENTS_OF_PERSON,
} from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The happy path of the checkout end to end: a visitor registers on identity, signs in, browses the catalog through the
 * order cart query, fills the cart, confirms with an idempotency key (a replay answers the same order, never a second
 * payment), and the confirmation transaction leaves a captured payment, decremented stock and an empty cart. The
 * Postgres reads are out-of-band verification only: every step of the journey travels over the public doors.
 *
 * Run: npm run test:e2e -- checkout/checkout-journey
 */
describe("checkout journey", () => {
    let personId = ""

    const world = useTestWorld({ apps: { identity: { module: IdentityApp }, order: { module: OrderApp } } })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-thermos", stock: 2 })
    })

    it("register, browse the catalog, add to the cart, place the order, pay, and end with an empty cart", async () => {
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
            status: "confirmed",
            totalMinorUnits: expectedTotal,
            currency: "USD",
            replayed: false,
        })

        // Replay with the same key: the first answer again, not a second order or a second capture.
        const replayed = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(replayed.errorCode).toBeNull()
        expect(replayed.data?.placeOrder).toMatchObject({
            orderId: order.orderId,
            paymentId: order.paymentId,
            replayed: true,
        })

        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])
        expect(await readRows<OrderSummaryRow>(world.db.order, ORDER_SUMMARY, [order.orderId])).toEqual([
            { status: "confirmed", total_minor_units: expectedTotal },
        ])
        expect(await readCount(world.db.order, ORDER_LINE_COUNT, order.orderId)).toBe(2)
        expect(await readRows<PaymentRow>(world.db.order, PAYMENTS_OF_PERSON, [personId])).toEqual([
            expect.objectContaining({ status: "captured", amount_minor_units: expectedTotal }),
        ])
        expect(await readCount(world.db.order, CART_ITEM_COUNT, personId)).toBe(0)
        expect(await readStock(world.db.order, "sku-mug")).toBe(mug.stock - 2)

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
