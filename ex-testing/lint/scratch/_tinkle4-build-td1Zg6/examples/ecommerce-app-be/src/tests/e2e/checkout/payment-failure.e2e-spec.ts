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
    E2EHttpService 
} from "@tests/infra/integrations/http/e2e-http.service"
import {
    E2EGraphqlClient, E2EGraphqlService 
} from "@tests/infra/integrations/graphql/e2e-graphql.service"

jest.setTimeout(120_000)

interface CartLineView { productId: string; quantity: number }

interface ProductView { id: string; name: string; priceMinorUnits: number; stock: number }

interface CartPayload {
  items: Array<CartLineView>;
  catalog: Array<ProductView>;
}

interface CartData { cart: CartPayload }

interface PlaceOrderPayload {
  orderId: string;
  status: "confirmed";
  totalMinorUnits: number;
  currency: "USD";
  paymentId: string;
  replayed: boolean;
}

interface PlaceOrderData { placeOrder: PlaceOrderPayload }

interface ClearCartPayload { cleared: boolean }

interface ClearCartData { clearCart: ClearCartPayload }

interface CountRow {
  count: number;
}

/**
 * The refusal half of sds.checkout.order-flow (t-refuse). The API contract has no external PSP
 * and no pending/declined order state - payment capture runs inside the same transaction as the
 * guarded stock decrement, so the "payment declined" step of the journey is the named refusal
 * and its honest outcome is the full rollback: no order row, no payment row, stock unmoved, cart
 * kept. Retry is a fresh placeOrder mutation once the cart is corrected; cancel is clearCart,
 * after which a confirmation is refused as cart-empty.
 *
 * Over GraphQL a refusal is no longer an HTTP 4xx - it is a GraphQL error whose
 * errors[0].extensions carries the full CHECKOUT_REFUSAL code plus the refusal detail
 * (reason, productId, requested, available) the formatError mapping spreads beside the code,
 * exactly where the REST body used to carry it.
 */
describe("payment failure (e2e)",
    () => {
        let world: E2EWorld | undefined
        let auth: E2EAuthService
        let dataSource: E2EDbService
        let http: E2EHttpService
        let graphql: E2EGraphqlService

        const password = "e2e-payment-pass"
        const personIds: Array<string> = []

        async function freshBuyer(suffix: string): Promise<{ buyer: E2EGraphqlClient; personId: string }> {
            const email = `e2e-payment-${suffix}-${Date.now()}@starci.test`
            const { personId } = await auth.register(email,
                password)
            personIds.push(personId)
            const { sessionToken } = await auth.signIn(email,
                password)
            return {
                buyer: graphql.client("order",
                    {
                        bearerToken: sessionToken 
                    }), personId 
            }
        }

        async function persistedOrderCount(personId: string): Promise<number> {
            const rows = await dataSource.query<CountRow>(
                "SELECT COUNT(*)::int AS count FROM sales_order WHERE person_id = $1",
                [personId],
            )
            return rows[0].count
        }

        async function persistedPaymentCount(personId: string): Promise<number> {
            const rows = await dataSource.query<CountRow>(
                "SELECT COUNT(*)::int AS count FROM payment WHERE person_id = $1",
                [personId],
            )
            return rows[0].count
        }

        beforeAll(async () => {
            world = await bootE2eWorld("checkout/payment-failure")
            auth = world.auth
            dataSource = world.dataSource
            http = world.http
            graphql = world.graphql
            expect((await http.client("order").get<{ status: string }>("/health")).data.status).toBe("ok")
        })

        afterAll(async () => {
            if (auth) {
                for (const personId of personIds) await auth.deleteAccount(personId)
            }
            await world?.moduleRef.close()
        })

        it("a refused confirmation rolls back atomically; the corrected retry captures exactly once",
            async () => {
                const { buyer, personId } = await freshBuyer("retry")

                // sku-thermos seeds at stock 2 on a fresh stack - asking for 3 is a guaranteed refusal.
                const browsed = await buyer.query<CartData>("cart")
                const thermos = browsed.data?.cart.catalog.find((p) => p.id === "sku-thermos")
                expect(thermos).toBeDefined()
                const seededStock = thermos!.stock

                const added = await buyer.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-thermos", quantity: seededStock + 1 
                            } 
                        } 
                    })
                expect(added.errorCode).toBeNull()

                const idempotencyKey = `e2e-${personId}`
                const refused = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey 
                            } 
                        } 
                    })
                expect(refused.errorCode).toBe("CHECKOUT_REFUSAL")
                expect(refused.errors?.[0]?.extensions).toMatchObject({
                    code: "CHECKOUT_REFUSAL",
                    reason: "insufficient-stock",
                    productId: "sku-thermos",
                    requested: seededStock + 1,
                    available: seededStock,
                })

                // The rollback: cart kept, nothing persisted, stock unmoved - a refusal never half-writes.
                const cartKept = await buyer.query<CartData>("cart")
                expect(cartKept.data?.cart.items).toEqual([{
                    productId: "sku-thermos", quantity: seededStock + 1 
                }])
                expect(await persistedOrderCount(personId)).toBe(0)
                expect(await persistedPaymentCount(personId)).toBe(0)
                const stockAfter = await dataSource.query<{ stock: number }>("SELECT stock FROM product WHERE id = $1",
                    ["sku-thermos"])
                expect(stockAfter[0].stock).toBe(seededStock)

                // Correct the cart and retry with the same key: this time the confirmation lands.
                await buyer.mutate("clearCart")
                const corrected = await buyer.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-thermos", quantity: seededStock 
                            } 
                        } 
                    })
                expect(corrected.errorCode).toBeNull()

                const retried = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey 
                            } 
                        } 
                    })
                expect(retried.errorCode).toBeNull()
                expect(retried.data?.placeOrder).toMatchObject({
                    status: "confirmed",
                    totalMinorUnits: thermos!.priceMinorUnits * seededStock,
                    currency: "USD",
                    replayed: false,
                })

                const payments = await dataSource.query<{ status: string; amount_minor_units: number }>(
                    "SELECT status, amount_minor_units FROM payment WHERE person_id = $1",
                    [personId],
                )
                expect(payments).toEqual([{
                    status: "captured", amount_minor_units: thermos!.priceMinorUnits * seededStock 
                }])
                expect((await buyer.query<CartData>("cart")).data?.cart.items).toEqual([])
                const stockSoldOut = await dataSource.query<{ stock: number }>("SELECT stock FROM product WHERE id = $1",
                    ["sku-thermos"])
                expect(stockSoldOut[0].stock).toBe(0)
            })

        it("a refused confirmation can be abandoned - clearing the cart leaves no order behind",
            async () => {
                const { buyer, personId } = await freshBuyer("cancel")

                const browsed = await buyer.query<CartData>("cart")
                const thermos = browsed.data?.cart.catalog.find((p) => p.id === "sku-thermos")
                expect(thermos).toBeDefined()

                await buyer.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-thermos", quantity: thermos!.stock + 1 
                            } 
                        } 
                    })
                const refused = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                            } 
                        } 
                    })
                expect(refused.errorCode).toBe("CHECKOUT_REFUSAL")
                expect(refused.errors?.[0]?.extensions?.reason).toBe("insufficient-stock")

                // Cancel per api contract: the buyer empties the cart and walks away.
                const cleared = await buyer.mutate<ClearCartData>("clearCart")
                expect(cleared.errorCode).toBeNull()
                expect(cleared.data?.clearCart.cleared).toBe(true)
                expect((await buyer.query<CartData>("cart")).data?.cart.items).toEqual([])

                // A confirmation with nothing to confirm is the cart-empty refusal, not a silent order.
                const empty = await buyer.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                            } 
                        } 
                    })
                expect(empty.errorCode).toBe("CHECKOUT_REFUSAL")
                expect(empty.errors?.[0]?.extensions).toMatchObject({
                    code: "CHECKOUT_REFUSAL", reason: "cart-empty" 
                })

                expect(await persistedOrderCount(personId)).toBe(0)
                expect(await persistedPaymentCount(personId)).toBe(0)
                const stockAfter = await dataSource.query<{ stock: number }>("SELECT stock FROM product WHERE id = $1",
                    ["sku-thermos"])
                expect(stockAfter[0].stock).toBe(thermos!.stock)
            })
    })
