import type { TestCaller } from "@starci/test-world"
import { productBuilder } from "../../fixtures/builders/catalog.builder"
import { present } from "../../fixtures/present.mapper"
import type { OrdersData, OrdersListReply, PlaceOrderData } from "../../fixtures/e2e-views.contracts"
import { useTestWorld } from "../../world/use-test-world"

/**
 * Cursor pagination end to end (BE-AUTH-6) over both doors of the order list: a buyer places three orders, the GraphQL
 * `orders` query walks them two at a time by cursor, newest first and without a repeat or a gap, the versioned REST operation
 * `orders.list@1` answers the same pages, and a cursor the service did not sign, a stranger's history and an out-of-bounds
 * page size are refused or empty. Every step travels over the public doors.
 *
 * Run: npm run test:e2e -- checkout/order-pagination
 */
describe("order pagination", () => {
    const world = useTestWorld({ apps: ["identity", "order"] })

    beforeAll(async () => {
        await productBuilder(world.db.order).build({ id: "sku-thermos", stock: 10 })
    })

    it("walks a buyer's orders by cursor, newest first, over GraphQL and the versioned operation", () =>
        walksOrdersByCursor(world))

    it("refuses a forged cursor and an out-of-bounds page, and shows a stranger no order", () =>
        refusesBadPagesAndHidesOtherBuyers(world))
})

/** Places `count` orders of one thermos each and answers their ids, oldest first. */
async function placeOrders(buyer: TestCaller, count: number): Promise<Array<string>> {
    const placed: Array<string> = []
    for (let index = 0; index < count; index += 1) {
        await buyer.mutate("addCartItem", { variables: { input: { productId: "sku-thermos", quantity: 1 } } })
        const order = await buyer.mutate<PlaceOrderData>("placeOrder", { variables: { input: {} } })
        expect(order.errorCode).toBeNull()
        placed.push(present(order.data, "placeOrder data").placeOrder.orderId)
    }
    return placed
}

async function walksOrdersByCursor(world: ReturnType<typeof useTestWorld>): Promise<void> {
    const session = await world.signedInPerson("pagination")
    const buyer = world.apps.order.api.bearing(session.sessionToken)
    const [first, second, third] = await placeOrders(buyer, 3)
    const newestFirst = [third, second, first]

    const page1 = await buyer.read<OrdersData>("orders", { variables: { first: 2 } })
    expect(page1.errorCode).toBeNull()
    const firstPage = present(page1.data, "orders data").orders
    expect(firstPage.items.map((order) => order.orderId)).toEqual(newestFirst.slice(0, 2))
    expect(firstPage.items[0]).toMatchObject({ status: "pending", currency: "USD" })
    expect(firstPage.pageInfo.hasNextPage).toBe(true)

    const page2 = await buyer.read<OrdersData>("orders", {
        variables: { first: 2, after: firstPage.pageInfo.endCursor },
    })
    const lastPage = present(page2.data, "orders data").orders
    expect(lastPage.items.map((order) => order.orderId)).toEqual(newestFirst.slice(2))
    expect(lastPage.pageInfo.hasNextPage).toBe(false)

    // The versioned operation answers the same pages: same cursor, same order, same end.
    const operation = await buyer.post<OrdersListReply>("operations", {
        operation: "orders.list@1",
        requestId: "walk-1",
        input: { first: 2, after: firstPage.pageInfo.endCursor },
    })
    expect(operation.status).toBe(201)
    expect(operation.body).toMatchObject({ operation: "orders.list@1", requestId: "walk-1", outcome: { kind: "ok" } })
    const reply = operation.body.outcome
    expect(reply.kind === "ok" && reply.value.items.map((order) => order.orderId)).toEqual(newestFirst.slice(2))
    expect(reply.kind === "ok" && reply.value.hasNextPage).toBe(false)
}

async function refusesBadPagesAndHidesOtherBuyers(world: ReturnType<typeof useTestWorld>): Promise<void> {
    const session = await world.signedInPerson("pagination-owner")
    const buyer = world.apps.order.api.bearing(session.sessionToken)
    await placeOrders(buyer, 1)

    const forged = await buyer.read<OrdersData>("orders", { variables: { first: 2, after: "forged.cursor" } })
    expect(forged.errorCode).toBe("ORDER_PAGE_CURSOR_INVALID")

    const tooBig = await buyer.read<OrdersData>("orders", { variables: { first: 1000 } })
    expect(tooBig.errorCode).not.toBeNull()

    const refusedByRoute = await buyer.post<OrdersListReply>("operations", {
        operation: "orders.list@1",
        requestId: "forged-1",
        input: { first: 2, after: "forged.cursor" },
    })
    expect(refusedByRoute.body.outcome).toMatchObject({ kind: "refused", code: "ORDER_PAGE_CURSOR_INVALID" })

    const undeclared = await buyer.post("operations", { operation: "orders.drop@1", requestId: "x", input: {} })
    expect(undeclared.status).toBe(400)

    const stranger = await world.signedInPerson("pagination-stranger")
    const none = await world.apps.order.api
        .bearing(stranger.sessionToken)
        .read<OrdersData>("orders", { variables: { first: 5 } })
    expect(none.data?.orders).toEqual({ items: [], pageInfo: { endCursor: null, hasNextPage: false } })
}
