import {
    E2EData, E2EWorld, bootE2eWorld 
} from "../setup/e2e-world"
import {
    E2EAuthService 
} from "../setup/domain/accounts/e2e-auth.service"
import {
    E2EHttpService 
} from "../setup/integrations/http/e2e-http.service"
import {
    E2EGraphqlService 
} from "../setup/integrations/graphql/e2e-graphql.service"
import {
    E2EStackService 
} from "../setup/platform/stack/e2e-stack.service"
import {
    retryUntil 
} from "../setup/platform/stack/e2e-util"
import {
    AccountData,
    buyerClient,
    CartData,
    PlaceOrderData,
    RefusalView,
    registerBuyer,
} from "../setup/lifecycle.helpers"

/**
 * The identity↔order boundary for real: an order-door operation authenticates by the guard
 * asking identity's /internal/sessions/verify over live HTTP on EVERY request, so when a
 * session dies mid-journey - revoked on the identity side, or expired by the Redis TTL that owns
 * the session store - the next order operation answers a GraphQL error carrying
 * SESSION_INVALID on errors[0].extensions.code, not a cached actor. Re-auth then
 * issues a new token for the same person, and the person-keyed state (the cart) resumes the
 * journey.
 *
 * The user-facing doors are GraphQL now: cart and placeOrder ride the order service's /graphql
 * with the bearer in the Authorization header, and the account view rides identity's. Only the
 * machine doors (/internal/sessions/*) stay on plain HTTP.
 *
 * The expiry journey needs a short session TTL: IDENTITY_SESSION_TTL_SECONDS is the identity
 * app's own config knob, and E2EStackService spawns the api children with {...process.env}, so
 * setting it here before compile() reaches the spawned identity process.
 *
 * Run: npm run test:e2e -- order-lifecycle/cross-service-identity.e2e-spec.ts
 */
describe("order lifecycle - identity↔order boundary (e2e)",
    () => {
        let world: E2EWorld
        let stack: E2EStackService
        let auth: E2EAuthService
        let dataSource: E2EData
        let http: E2EHttpService
        let graphql: E2EGraphqlService

        const password = "e2e-xservice-pass"
        const personIds: Array<string> = []
        const previousTtl = process.env.IDENTITY_SESSION_TTL_SECONDS

        beforeAll(async () => {
            process.env.IDENTITY_SESSION_TTL_SECONDS = "10"
            world = await bootE2eWorld("order-lifecycle/cross-service-identity")
            stack = world.stack
            auth = world.auth
            dataSource = world.data
            http = world.http
            graphql = world.graphql
        },
        300_000)

        afterAll(async () => {
            for (const personId of personIds) await auth.deleteAccount(personId)
            await world.moduleRef.close()
            if (previousTtl === undefined) delete process.env.IDENTITY_SESSION_TTL_SECONDS
            else process.env.IDENTITY_SESSION_TTL_SECONDS = previousTtl
            // Teardown verification is part of the contract: this run's containers and volumes are gone.
            expect(stack.cleanupReport).not.toBeNull()
            expect(stack.cleanupReport?.clean).toBe(true)
        })

        it("a revoked session is refused at the order boundary until re-auth resumes the same buyer",
            async () => {
                const identity = http.client("identity")
                const identityGql = graphql.client("identity")
                const buyer = await registerBuyer(auth,
                    "xsrv-a",
                    password)
                personIds.push(buyer.personId)
                const buyerA = buyerClient(graphql,
                    buyer.sessionToken)

                // The token is live at the order boundary - the guard just verified it against identity.
                const added = await buyerA.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-notebook", quantity: 1 
                            } 
                        } 
                    })
                expect(added.errorCode).toBeNull()

                const revoked = await identity.post<{ revoked: boolean }>("/internal/sessions/revoke",
                    {
                        sessionToken: buyer.sessionToken 
                    })
                expect(revoked.status).toBe(201)
                expect(revoked.body.revoked).toBe(true)

                // Identity refuses the dead token, and so does the order boundary: the guard consults
                // identity on every operation, so no actor survives the revoke.
                const verifyDead = await identity.post<RefusalView>("/internal/sessions/verify",
                    {
                        sessionToken: buyer.sessionToken 
                    })
                expect(verifyDead.status).toBe(401)
                expect(verifyDead.body.code).toBe("SESSION_INVALID")
                const refused = await buyerA.read<CartData>("cart")
                expect(refused.errorCode).toBe("SESSION_INVALID")
                expect(refused.errors?.[0]?.extensions?.code).toBe("SESSION_INVALID")

                // Re-auth: a different token for the same person.
                const resumed = await auth.signIn(buyer.email,
                    password)
                expect(resumed.personId).toBe(buyer.personId)
                expect(resumed.sessionToken).not.toBe(buyer.sessionToken)
                const buyerB = buyerClient(graphql,
                    resumed.sessionToken)

                // Resume: the cart line added under the dead session is person-keyed, so it is still there...
                const cart = await buyerB.read<CartData>("cart")
                expect(cart.errorCode).toBeNull()
                expect(cart.data?.cart.items).toEqual([{
                    productId: "sku-notebook", quantity: 1 
                }])

                // ...and the journey completes under the new session.
                const placed = await buyerB.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey: `${buyer.personId}-resume` 
                            } 
                        } 
                    })
                expect(placed.errorCode).toBeNull()
                expect(placed.data?.placeOrder.status).toBe("confirmed")

                const orders = await dataSource.orders.orderStatusesForPerson(buyer.personId)
                expect(orders).toEqual([{
                    status: "confirmed" 
                }])
                const account = await identityGql.read<AccountData>("account",
                    {
                        variables: {
                            request: {
                                personId: buyer.personId
                            }
                        } 
                    })
                expect(account.data?.account.hasOrders).toBe(true)
            })

        it("an expired session is refused at the order boundary until a fresh sign-in resumes it",
            async () => {
                const identity = http.client("identity")
                const buyer = await registerBuyer(auth,
                    "xsrv-b",
                    password)
                personIds.push(buyer.personId)
                const expired = buyerClient(graphql,
                    buyer.sessionToken)

                // Live while the TTL holds.
                const live = await expired.read<CartData>("cart")
                expect(live.errorCode).toBeNull()

                // The Redis TTL kills the session in the store itself - wait for the honest expiry rather
                // than simulating one.
                await retryUntil("identity session expiry (IDENTITY_SESSION_TTL_SECONDS=10)",
                    45_000,
                    async () => {
                        const probe = await identity.post<RefusalView>("/internal/sessions/verify",
                            {
                                sessionToken: buyer.sessionToken 
                            })
                        return probe.status === 401
                    })

                const refused = await expired.read<CartData>("cart")
                expect(refused.errorCode).toBe("SESSION_INVALID")
                expect(refused.errors?.[0]?.extensions?.code).toBe("SESSION_INVALID")

                // A fresh sign-in issues a new token for the same person and the journey resumes.
                const resumed = await auth.signIn(buyer.email,
                    password)
                expect(resumed.personId).toBe(buyer.personId)
                expect(resumed.sessionToken).not.toBe(buyer.sessionToken)
                const resumedCart = await buyerClient(graphql,
                    resumed.sessionToken).read<CartData>("cart")
                expect(resumedCart.errorCode).toBeNull()
            })
    })
