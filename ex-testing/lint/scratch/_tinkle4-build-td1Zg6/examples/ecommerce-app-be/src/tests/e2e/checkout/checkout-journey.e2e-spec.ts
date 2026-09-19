import {
    E2EWorld, bootE2eWorld 
} from "@tests/infra/e2e-world"
import {
    E2EAuthService 
} from "@tests/infra/bussiness/accounts/e2e-auth.service"
import {
    E2EDbService 
} from "@tests/infra/platform/databases/e2e-db.service"
import {
    E2EHttpClient, E2EHttpService 
} from "@tests/infra/integrations/http/e2e-http.service"
import {
    E2EGraphqlClient, E2EGraphqlService 
} from "@tests/infra/integrations/graphql/e2e-graphql.service"

jest.setTimeout(120_000)

interface ProductView {
  id: string;
  name: string;
  priceMinorUnits: number;
  stock: number;
}

interface CartLineView { productId: string; quantity: number }

interface CartPayload {
  items: Array<CartLineView>;
  catalog: Array<ProductView>;
}

interface CartData { cart: CartPayload }

interface RegisterPayload { personId: string }

interface RegisterData { register: RegisterPayload }

interface SignInPayload { sessionToken: string; personId: string }

interface SignInData { signIn: SignInPayload }

interface PlaceOrderPayload {
  orderId: string;
  status: "confirmed";
  totalMinorUnits: number;
  currency: "USD";
  paymentId: string;
  replayed: boolean;
}

interface PlaceOrderData { placeOrder: PlaceOrderPayload }

interface AccountPayload { personId: string; email: string; hasOrders: boolean }

interface AccountData { account: AccountPayload }

interface CountRow {
  count: number;
}

/**
 * The happy path of sds.checkout.order-flow end to end: a visitor registers on identity, signs
 * in, browses the catalog through the order service's cart query, fills the cart, confirms with
 * an idempotency key (a replay answers the same order, never a second payment), and the
 * confirmation's transaction leaves a captured payment, decremented stock and an empty cart.
 * The Postgres reads are out-of-band verification only - every step of the journey itself
 * travels over the real public doors of both services.
 *
 * The user-facing doors are GraphQL now: register/signIn on identity's /graphql, cart,
 * addCartItem, clearCart and placeOrder on order's /graphql - the bearer the guard verifies
 * rides the operation's Authorization header exactly as the retired REST doors expected. Only
 * the justified machine doors (/internal/buyers, /internal/sessions) and the /health probes
 * still ride plain HTTP.
 */
describe("checkout journey (e2e)",
    () => {
        let world: E2EWorld | undefined
        let auth: E2EAuthService
        let dataSource: E2EDbService
        let http: E2EHttpService
        let graphql: E2EGraphqlService

        const email = `e2e-checkout-${Date.now()}@starci.test`
        const password = "e2e-checkout-pass"
        let personId = ""

        beforeAll(async () => {
            world = await bootE2eWorld("checkout/checkout-journey")
            auth = world.auth
            dataSource = world.dataSource
            http = world.http
            graphql = world.graphql
            // The stack counts as up only when both services answer their real dependency-checked /health.
            const identity: E2EHttpClient = http.client("identity")
            const order: E2EHttpClient = http.client("order")
            expect((await identity.get<{ status: string }>("/health")).data.status).toBe("ok")
            expect((await order.get<{ status: string }>("/health")).data.status).toBe("ok")
        })

        afterAll(async () => {
            if (personId) await auth.deleteAccount(personId)
            await world?.moduleRef.close()
        })

        it("register → browse catalog → add to cart → checkout → pay → order confirmed → cart empty",
            async () => {
                const identity: E2EHttpClient = http.client("identity")
                const identityGql: E2EGraphqlClient = graphql.client("identity")

                const registered = await identityGql.mutate<RegisterData>("register",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        } 
                    })
                expect(registered.errorCode).toBeNull()
                expect(registered.data?.register.personId).toEqual(expect.any(String))
                personId = registered.data!.register.personId

                const signedIn = await identityGql.mutate<SignInData>("signIn",
                    {
                        variables: {
                            input: {
                                email, password 
                            } 
                        } 
                    })
                expect(signedIn.errorCode).toBeNull()
                expect(signedIn.data?.signIn.personId).toBe(personId)
                const sessionToken = signedIn.data!.signIn.sessionToken

                const buyer: E2EGraphqlClient = graphql.client("order",
                    {
                        bearerToken: sessionToken 
                    })

                // The catalog is read through the cart query - it is the only catalog surface checkout has.
                const browsed = await buyer.query<CartData>("cart")
                expect(browsed.errorCode).toBeNull()
                expect(browsed.data?.cart.items).toEqual([])
                const mug = browsed.data!.cart.catalog.find((p) => p.id === "sku-mug")
                const notebook = browsed.data!.cart.catalog.find((p) => p.id === "sku-notebook")
                expect(mug).toBeDefined()
                expect(notebook).toBeDefined()
                const expectedTotal = mug!.priceMinorUnits * 2 + notebook!.priceMinorUnits

                const addedMug = await buyer.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-mug", quantity: 2 
                            } 
                        } 
                    })
                expect(addedMug.errorCode).toBeNull()
                const addedNotebook = await buyer.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-notebook", quantity: 1 
                            } 
                        } 
                    })
                expect(addedNotebook.errorCode).toBeNull()

                const filled = await buyer.query<CartData>("cart")
                expect(filled.data?.cart.items).toEqual([
                    {
                        productId: "sku-mug", quantity: 2 
                    },
                    {
                        productId: "sku-notebook", quantity: 1 
                    },
                ])

                // The replay key the REST door read off the Idempotency-Key header is a canonical
                // GraphQL input field now - same semantics, first answer on replay.
                const idempotencyKey = `e2e-${personId}`
                const placed = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey 
                            } 
                        } 
                    })
                expect(placed.errorCode).toBeNull()
                expect(placed.data?.placeOrder).toMatchObject({
                    status: "confirmed",
                    totalMinorUnits: expectedTotal,
                    currency: "USD",
                    replayed: false,
                })
                expect(placed.data!.placeOrder.orderId).toEqual(expect.any(String))
                expect(placed.data!.placeOrder.paymentId).toEqual(expect.any(String))

                // Replay with the same key: the first answer again, not a second order or a second capture.
                const replayed = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey 
                            } 
                        } 
                    })
                expect(replayed.errorCode).toBeNull()
                expect(replayed.data?.placeOrder.orderId).toBe(placed.data!.placeOrder.orderId)
                expect(replayed.data?.placeOrder.paymentId).toBe(placed.data!.placeOrder.paymentId)
                expect(replayed.data?.placeOrder.replayed).toBe(true)

                const emptied = await buyer.query<CartData>("cart")
                expect(emptied.data?.cart.items).toEqual([])

                const orders = await dataSource.query<{ status: string; total_minor_units: number }>(
                    "SELECT status, total_minor_units FROM sales_order WHERE id = $1",
                    [placed.data!.placeOrder.orderId],
                )
                expect(orders).toEqual([{
                    status: "confirmed", total_minor_units: expectedTotal 
                }])

                const lines = await dataSource.query<CountRow>(
                    "SELECT COUNT(*)::int AS count FROM sales_order_line WHERE order_id = $1",
                    [placed.data!.placeOrder.orderId],
                )
                expect(lines[0].count).toBe(2)

                const payments = await dataSource.query<{ status: string; amount_minor_units: number }>(
                    "SELECT status, amount_minor_units FROM payment WHERE person_id = $1",
                    [personId],
                )
                expect(payments).toEqual([{
                    status: "captured", amount_minor_units: expectedTotal 
                }])

                const cartRows = await dataSource.query<CountRow>(
                    "SELECT COUNT(*)::int AS count FROM cart_item WHERE person_id = $1",
                    [personId],
                )
                expect(cartRows[0].count).toBe(0)

                const mugStock = await dataSource.query<{ stock: number }>("SELECT stock FROM product WHERE id = $1",
                    ["sku-mug"])
                expect(mugStock[0].stock).toBe(mug!.stock - 2)

                // contract.checkout.order-for-identity live: order serves identity hasOrders on the
                // machine door GET /internal/buyers/:personId - the confirmation is what flipped it.
                const buyerStatus = await http.client("order").get<{ hasOrders: boolean }>(`/internal/buyers/${personId}`)
                expect(buyerStatus.data.hasOrders).toBe(true)
                const account = await identityGql.query<AccountData>("account",
                    {
                        variables: {
                            personId 
                        } 
                    })
                expect(account.errorCode).toBeNull()
                expect(account.data?.account).toMatchObject({
                    personId, email, hasOrders: true 
                })

                // Sign-out: the guard consults identity live, so the revoked token stops answering on order.
                const revoked = await identity.post("/internal/sessions/revoke",
                    {
                        sessionToken 
                    })
                expect(revoked.status).toBe(201)
                const afterRevoke = await buyer.query<CartData>("cart")
                expect(afterRevoke.errorCode).toBe("SESSION_INVALID")
                expect(afterRevoke.errors?.[0]?.extensions?.code).toBe("SESSION_INVALID")
            })
    })
