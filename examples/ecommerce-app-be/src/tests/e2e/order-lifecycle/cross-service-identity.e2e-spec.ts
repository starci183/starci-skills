import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { AccountData, CartData, PlaceOrderData, RevokeSessionData } from "../setup/e2e-views.contracts"

/**
 * The identity to order boundary for real: an order operation authenticates because the auth guard asks identity
 * verifySession over live GraphQL on EVERY request, so when a session dies mid-journey (revoked on the identity side)
 * the next order operation answers IDENTITY_UNAUTHENTICATED, not a cached principal. Re-auth then issues a new token for the
 * same person, and the person-keyed state (the cart) resumes the journey.
 *
 * Session lifetime is declared by the session cache key (one hour), so an expiry journey is not part of the suite: it
 * would mean waiting an hour or making the TTL a call-site knob, which the convention forbids.
 *
 * Run: npm run test:e2e -- order-lifecycle/cross-service-identity
 */
describe("order lifecycle: identity to order boundary", () => {
    let world: E2EWorld
    const password = "e2e-xservice-pass"
    const personIds: Array<string> = []

    beforeAll(async () => {
        world = await bootE2eWorld("order-lifecycle/cross-service-identity")
    }, 300_000)

    afterAll(async () => {
        for (const personId of personIds) await world.auth.deleteAccount(personId)
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("a revoked session is refused at the order boundary until re-auth resumes the same buyer", async () => {
        const session = await world.auth.registerBuyer("xsrv", password)
        personIds.push(session.personId)
        const identity = world.graphql.client("identity", session.sessionToken)
        const before = world.graphql.client("order", session.sessionToken)

        // The token is live at the order boundary: the guard just verified it against identity.
        const added = await before.mutate("addCartItem", { variables: { input: { productId: "sku-notebook", quantity: 1 } } })
        expect(added.errorCode).toBeNull()

        const revoked = await identity.mutate<RevokeSessionData>("revokeSession", { variables: { input: { sessionToken: session.sessionToken } } })
        expect(revoked.data?.revokeSession.revoked).toBe(true)

        // The order boundary refuses the dead token: no principal survives the revoke.
        const refused = await before.read<CartData>("cart")
        expect(refused.errorCode).toBe("IDENTITY_UNAUTHENTICATED")

        // Re-auth: a different token for the same person.
        const resumed = await world.auth.signIn(session.email, password)
        expect(resumed.personId).toBe(session.personId)
        expect(resumed.sessionToken).not.toBe(session.sessionToken)
        const after = world.graphql.client("order", resumed.sessionToken)

        // Resume: the cart line added under the dead session is person-keyed, so it is still there...
        const cart = await after.read<CartData>("cart")
        expect(cart.errorCode).toBeNull()
        expect(cart.data?.cart.items).toEqual([{ productId: "sku-notebook", quantity: 1 }])

        // ...and the journey completes under the new session.
        const placed = await after.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey: `${session.personId}-resume` } } })
        expect(placed.errorCode).toBeNull()
        expect(placed.data?.placeOrder.status).toBe("confirmed")
        expect(await world.database.ordersOfPerson(session.personId)).toEqual([expect.objectContaining({ status: "confirmed" })])
        const account = await world.graphql.client("identity", resumed.sessionToken).read<AccountData>("account")
        expect(account.data?.account.hasOrders).toBe(true)
    })
})
