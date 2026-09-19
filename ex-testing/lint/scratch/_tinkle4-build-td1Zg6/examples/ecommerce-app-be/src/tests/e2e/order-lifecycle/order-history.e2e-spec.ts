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
    E2EGraphqlService 
} from "@tests/infra/integrations/graphql/e2e-graphql.service"
import {
    E2EStackService 
} from "@tests/infra/platform/stack/e2e-stack.service"
import {
    AccountData,
    buyerClient,
    CartData,
    CountRow,
    PlaceOrderData,
    ProductView,
    registerBuyer,
} from "./lifecycle.helpers"

interface OrderRow {
  id: string;
  status: string;
  total_minor_units: number;
  currency: string;
  idempotency_key: string | null;
}

interface OrderLineRow {
  product_id: string;
  quantity: number;
  unit_price_minor_units: number;
}

interface PaymentRow {
  id: string;
  order_id: string;
  status: string;
  amount_minor_units: number;
  idempotency_key: string;
}

/**
 * The order lifecycle past the first confirmation: one buyer places several orders and the
 * history those orders produce is verified end to end. This api has no order list/detail door
 * at all - the only order reads are the placeOrder answer itself and the hasOrders flag order
 * serves identity on GET /internal/buyers/:personId (contract.checkout.order-for-identity). So
 * "list" and "detail" are asserted where the truth lives: out-of-band on this run's postgres
 * volume (sales_order / sales_order_line / payment rows), cross-checked against the live
 * cross-service reads. The "status transitions" the schema actually models are covered too: a
 * confirmation lands 'confirmed' with its payment 'captured', a refusal appends nothing, and an
 * idempotency-key replay returns the first answer without appending either.
 *
 * The user-facing doors are GraphQL now: cart/addCartItem/placeOrder on order's /graphql and
 * account on identity's - every refusal is asserted on errors[0].extensions.code carrying the
 * business code (CHECKOUT_REFUSAL, SESSION_INVALID - the `_EXCEPTION` transport suffix stays
 * inside the exception class). Only the machine door /internal/buyers stays on plain HTTP.
 *
 * Run: npx jest --config test/e2e/jest.config.js test/e2e/order-lifecycle/order-history.e2e-spec.ts
 */
describe("order lifecycle - order history (e2e)",
    () => {
        let world: E2EWorld
        let stack: E2EStackService
        let auth: E2EAuthService
        let dataSource: E2EDbService
        let http: E2EHttpService
        let graphql: E2EGraphqlService

        const password = "e2e-history-pass"
        const personIds: Array<string> = []

        beforeAll(async () => {
            world = await bootE2eWorld("order-lifecycle/order-history")
            stack = world.stack
            auth = world.auth
            dataSource = world.dataSource
            http = world.http
            graphql = world.graphql
        },
        300_000)

        afterAll(async () => {
            for (const personId of personIds) await auth.deleteAccount(personId)
            await world.moduleRef.close()
            // Teardown verification is part of the contract: this run's containers and volumes are gone.
            expect(stack.cleanupReport).not.toBeNull()
            expect(stack.cleanupReport?.clean).toBe(true)
        })

        async function orderCount(personId: string): Promise<number> {
            const rows = await dataSource.query<CountRow>("select count(*)::int as count from sales_order where person_id = $1",
                [personId])
            return rows[0].count
        }

        it("a buyer placing several orders builds a confirmed, paid history both services can read",
            async () => {
                const identityGql = graphql.client("identity")
                const order = http.client("order")
                const buyer = await registerBuyer(auth,
                    "hist-a",
                    password)
                personIds.push(buyer.personId)
                const buyerGql = buyerClient(graphql,
                    buyer.sessionToken)

                // Baseline: not a buyer yet - on both sides of the contract.
                const freshBuyer = await order.get<{ personId: string; hasOrders: boolean }>(`/internal/buyers/${buyer.personId}`)
                expect(freshBuyer.body).toEqual({
                    personId: buyer.personId, hasOrders: false 
                })
                const freshAccount = await identityGql.query<AccountData>("account",
                    {
                        variables: {
                            personId: buyer.personId 
                        } 
                    })
                expect(freshAccount.data?.account.hasOrders).toBe(false)

                // The catalog snapshot the confirmations will price against (the cart query is the only
                // catalog surface checkout has).
                const browsed = await buyerGql.query<CartData>("cart")
                expect(browsed.errorCode).toBeNull()
                const catalog = new Map<string, ProductView>(browsed.data!.cart.catalog.map((p) => [p.id,
                    p]))
                const mug = catalog.get("sku-mug")!
                const notebook = catalog.get("sku-notebook")!
                const thermos = catalog.get("sku-thermos")!
                const firstTotal = mug.priceMinorUnits * 2
                const secondTotal = notebook.priceMinorUnits + thermos.priceMinorUnits

                // Order 1: sku-mug x2.
                const addedMug = await buyerGql.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-mug", quantity: 2 
                            } 
                        } 
                    })
                expect(addedMug.errorCode).toBeNull()
                const first = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey: `${buyer.personId}-1` 
                            } 
                        } 
                    })
                expect(first.errorCode).toBeNull()
                expect(first.data?.placeOrder).toMatchObject({
                    status: "confirmed", totalMinorUnits: firstTotal, currency: "USD", replayed: false 
                })

                // The cart cleared itself at confirmation, so order 2 starts from a fresh fill.
                const emptied = await buyerGql.query<CartData>("cart")
                expect(emptied.data?.cart.items).toEqual([])

                // Order 2: sku-notebook x1 + sku-thermos x1.
                await buyerGql.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-notebook", quantity: 1 
                            } 
                        } 
                    })
                await buyerGql.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-thermos", quantity: 1 
                            } 
                        } 
                    })
                const second = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey: `${buyer.personId}-2` 
                            } 
                        } 
                    })
                expect(second.errorCode).toBeNull()
                expect(second.data?.placeOrder).toMatchObject({
                    status: "confirmed", totalMinorUnits: secondTotal, replayed: false 
                })
                expect(second.data!.placeOrder.orderId).not.toBe(first.data!.placeOrder.orderId)
                expect(second.data!.placeOrder.paymentId).not.toBe(first.data!.placeOrder.paymentId)

                // list: two orders in creation order, each confirmed and priced as answered.
                const orders = await dataSource.query<OrderRow>(
                    "select id, status, total_minor_units, currency, idempotency_key from sales_order where person_id = $1 order by created_at, id",
                    [buyer.personId],
                )
                expect(orders).toHaveLength(2)
                expect(orders[0]).toMatchObject({
                    id: first.data!.placeOrder.orderId,
                    status: "confirmed",
                    total_minor_units: firstTotal,
                    currency: "USD",
                    idempotency_key: `${buyer.personId}-1`,
                })
                expect(orders[1]).toMatchObject({
                    id: second.data!.placeOrder.orderId,
                    status: "confirmed",
                    total_minor_units: secondTotal,
                    idempotency_key: `${buyer.personId}-2`,
                })

                // detail: each order's lines carry the catalog price snapshot taken at confirmation.
                const firstLines = await dataSource.query<OrderLineRow>(
                    "select product_id, quantity, unit_price_minor_units from sales_order_line where order_id = $1 order by product_id",
                    [first.data!.placeOrder.orderId],
                )
                expect(firstLines).toEqual([{
                    product_id: "sku-mug", quantity: 2, unit_price_minor_units: mug.priceMinorUnits 
                }])
                const secondLines = await dataSource.query<OrderLineRow>(
                    "select product_id, quantity, unit_price_minor_units from sales_order_line where order_id = $1 order by product_id",
                    [second.data!.placeOrder.orderId],
                )
                expect(secondLines).toEqual([
                    {
                        product_id: "sku-notebook", quantity: 1, unit_price_minor_units: notebook.priceMinorUnits 
                    },
                    {
                        product_id: "sku-thermos", quantity: 1, unit_price_minor_units: thermos.priceMinorUnits 
                    },
                ])

                // ...and each order has exactly one captured payment, keyed by the order id.
                const payments = await dataSource.query<PaymentRow>(
                    "select id, order_id, status, amount_minor_units, idempotency_key from payment where person_id = $1 order by created_at, id",
                    [buyer.personId],
                )
                expect(payments).toHaveLength(2)
                expect(payments[0]).toMatchObject({
                    id: first.data!.placeOrder.paymentId,
                    order_id: first.data!.placeOrder.orderId,
                    status: "captured",
                    amount_minor_units: firstTotal,
                    idempotency_key: first.data!.placeOrder.orderId,
                })
                expect(payments[1]).toMatchObject({
                    id: second.data!.placeOrder.paymentId,
                    order_id: second.data!.placeOrder.orderId,
                    status: "captured",
                    amount_minor_units: secondTotal,
                    idempotency_key: second.data!.placeOrder.orderId,
                })

                // The guarded stock moved by exactly the confirmed quantities, and the cart stayed empty.
                const after = await buyerGql.query<CartData>("cart")
                const afterCatalog = new Map<string, ProductView>(after.data!.cart.catalog.map((p) => [p.id,
                    p]))
                expect(afterCatalog.get("sku-mug")!.stock).toBe(mug.stock - 2)
                expect(afterCatalog.get("sku-notebook")!.stock).toBe(notebook.stock - 1)
                expect(afterCatalog.get("sku-thermos")!.stock).toBe(thermos.stock - 1)
                expect(after.data?.cart.items).toEqual([])

                // The cross-service read: identity can only know this by asking order over real HTTP.
                const buyerNow = await order.get<{ personId: string; hasOrders: boolean }>(`/internal/buyers/${buyer.personId}`)
                expect(buyerNow.body).toEqual({
                    personId: buyer.personId, hasOrders: true 
                })
                const accountNow = await identityGql.query<AccountData>("account",
                    {
                        variables: {
                            personId: buyer.personId 
                        } 
                    })
                expect(accountNow.data?.account).toMatchObject({
                    personId: buyer.personId, email: buyer.email, hasOrders: true 
                })
            })

        it("a refusal and an idempotent replay never append to order history",
            async () => {
                const buyer = await registerBuyer(auth,
                    "hist-b",
                    password)
                personIds.push(buyer.personId)
                const buyerGql = buyerClient(graphql,
                    buyer.sessionToken)

                // Refusal 1: an empty cart confirms nothing and records nothing.
                const emptyRefusal = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                            } 
                        } 
                    })
                expect(emptyRefusal.errorCode).toBe("CHECKOUT_REFUSAL")
                expect(emptyRefusal.errors?.[0]?.extensions).toMatchObject({
                    code: "CHECKOUT_REFUSAL", reason: "cart-empty" 
                })
                expect(await orderCount(buyer.personId)).toBe(0)

                // A real order, then the same key again: the key is checked before the (now empty) cart, so
                // the replay returns the first answer rather than degenerating into a cart-empty refusal.
                await buyerGql.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-mug", quantity: 1 
                            } 
                        } 
                    })
                const key = `${buyer.personId}-replay`
                const placed = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey: key 
                            } 
                        } 
                    })
                expect(placed.errorCode).toBeNull()
                expect(placed.data?.placeOrder.replayed).toBe(false)

                const replayed = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                                idempotencyKey: key 
                            } 
                        } 
                    })
                expect(replayed.errorCode).toBeNull()
                expect(replayed.data?.placeOrder).toMatchObject({
                    orderId: placed.data!.placeOrder.orderId,
                    paymentId: placed.data!.placeOrder.paymentId,
                    replayed: true,
                })
                expect(await orderCount(buyer.personId)).toBe(1)
                const payments = await dataSource.query<CountRow>("select count(*)::int as count from payment where person_id = $1",
                    [buyer.personId])
                expect(payments[0].count).toBe(1)

                // Refusal 2: beyond stock. Nothing changes - order count stays 1, the cart keeps its line,
                // and the catalog's stock did not move.
                const browsed = await buyerGql.query<CartData>("cart")
                const thermos = browsed.data!.cart.catalog.find((p) => p.id === "sku-thermos")!
                await buyerGql.mutate("addCartItem",
                    {
                        variables: {
                            input: {
                                productId: "sku-thermos", quantity: thermos.stock + 1 
                            } 
                        } 
                    })
                const stockRefusal = await buyerGql.mutate<PlaceOrderData>("placeOrder",
                    {
                        variables: {
                            input: {
                            } 
                        } 
                    })
                expect(stockRefusal.errorCode).toBe("CHECKOUT_REFUSAL")
                expect(stockRefusal.errors?.[0]?.extensions).toMatchObject({
                    code: "CHECKOUT_REFUSAL", reason: "insufficient-stock", productId: "sku-thermos" 
                })
                expect(await orderCount(buyer.personId)).toBe(1)
                const keptCart = await buyerGql.query<CartData>("cart")
                expect(keptCart.data?.cart.items).toEqual([{
                    productId: "sku-thermos", quantity: thermos.stock + 1 
                }])
                expect(keptCart.data!.cart.catalog.find((p) => p.id === "sku-thermos")!.stock).toBe(thermos.stock)
            })
    })
