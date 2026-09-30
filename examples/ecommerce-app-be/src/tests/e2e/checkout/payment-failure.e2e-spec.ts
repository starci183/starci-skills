import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type { CartData, ClearCartData, PlaceOrderData } from "../setup/e2e-views.contracts"

/**
 * The refusal half of the checkout. There is no external PSP and no pending or declined order state: payment capture
 * runs inside the same transaction as the guarded stock decrement, so the refusal is named and its honest outcome is
 * the full rollback: no order row, no payment row, stock unmoved, cart kept. Retry is a fresh placeOrder once the cart is
 * corrected; cancel is clearCart, after which a confirmation is refused as an empty cart.
 *
 * A refusal is a GraphQL error whose extensions carry the code, the kind and the params (productId, requested,
 * available) that name what was refused.
 */
describe("payment failure", () => {
    let world: E2EWorld
    const personIds: Array<string> = []

    const freshBuyer = async (tag: string): Promise<{ personId: string; buyer: ReturnType<E2EWorld["graphql"]["client"]> }> => {
        const session = await world.auth.registerBuyer(`payment-${tag}`, "e2e-payment-pass")
        personIds.push(session.personId)
        return { personId: session.personId, buyer: world.graphql.client("order", session.sessionToken) }
    }

    beforeAll(async () => {
        world = await bootE2eWorld("checkout/payment-failure")
        expect((await world.http("order").get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 300_000)

    afterAll(async () => {
        for (const personId of personIds) await world.auth.deleteAccount(personId)
        await world.close()
    })

    it("a refused confirmation rolls back atomically; the corrected retry captures exactly once", async () => {
        const { buyer, personId } = await freshBuyer("retry")

        // sku-thermos is seeded at stock 2: asking for one more is a guaranteed refusal.
        const browsed = await buyer.read<CartData>("cart")
        const thermos = present(browsed.data?.cart.catalog.find((product) => product.id === "sku-thermos"), "sku-thermos")
        const stock = thermos.stock
        expect((await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: stock + 1 } } })).errorCode).toBeNull()

        const idempotencyKey = `e2e-${personId}`
        const refused = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(refused.errorCode).toBe("ORDER_INSUFFICIENT_STOCK")
        expect(refused.errors?.[0]?.extensions).toMatchObject({
            code: "ORDER_INSUFFICIENT_STOCK",
            kind: "conflict",
            params: { productId: "sku-thermos", requested: stock + 1, available: stock },
        })

        // The rollback: cart kept, nothing persisted, stock unmoved. A refusal never half-writes.
        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([{ productId: "sku-thermos", quantity: stock + 1 }])
        expect(await world.database.orderCount(personId)).toBe(0)
        expect(await world.database.paymentCount(personId)).toBe(0)
        expect(await world.database.stockOf("sku-thermos")).toBe(stock)

        // Correct the cart and retry with the same key: this time the confirmation lands.
        await buyer.mutate("clearCart")
        expect((await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: stock } } })).errorCode).toBeNull()
        const retried = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: { idempotencyKey } } })
        expect(retried.errorCode).toBeNull()
        expect(retried.data?.placeOrder).toMatchObject({
            status: "confirmed",
            totalMinorUnits: thermos.priceMinorUnits * stock,
            currency: "USD",
            replayed: false,
        })
        expect(await world.database.paymentsOfPerson(personId)).toEqual([
            expect.objectContaining({ status: "captured", amount_minor_units: thermos.priceMinorUnits * stock }),
        ])
        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])
        expect(await world.database.stockOf("sku-thermos")).toBe(0)
    })

    it("a refused confirmation can be abandoned: clearing the cart leaves no order behind", async () => {
        const { buyer, personId } = await freshBuyer("cancel")
        const browsed = await buyer.read<CartData>("cart")
        const thermos = present(browsed.data?.cart.catalog.find((product) => product.id === "sku-thermos"), "sku-thermos")

        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: thermos.stock + 1 } } })
        const refused = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: {} } })
        expect(refused.errorCode).toBe("ORDER_INSUFFICIENT_STOCK")

        // Cancel: the buyer empties the cart and walks away.
        const cleared = await buyer.mutate<ClearCartData>("clearCart")
        expect(cleared.errorCode).toBeNull()
        expect(cleared.data?.clearCart.cleared).toBe(true)
        expect((await buyer.read<CartData>("cart")).data?.cart.items).toEqual([])

        // A confirmation with nothing to confirm is the empty-cart refusal, not a silent order.
        const empty = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: {} } })
        expect(empty.errorCode).toBe("ORDER_CART_EMPTY")
        expect(empty.errors?.[0]?.extensions).toMatchObject({ code: "ORDER_CART_EMPTY", kind: "invalid" })

        expect(await world.database.orderCount(personId)).toBe(0)
        expect(await world.database.paymentCount(personId)).toBe(0)
        expect(await world.database.stockOf("sku-thermos")).toBe(thermos.stock)
    })
})
