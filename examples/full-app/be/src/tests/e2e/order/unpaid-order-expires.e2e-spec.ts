import { orderBuilder } from "../../fixtures/builders/order.builder"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { ORDER_SUMMARY } from "../../fixtures/persistence/e2e-verification.sql"
import { useTestWorld } from "../../world/use-test-world"

/** An order placed long before the payment window closed: the sweep expires it. */
const PLACED_LONG_AGO = new Date("2020-01-01T00:00:00.000Z")

/** An order placed far inside the payment window. */
const PLACED_FAR_AHEAD = new Date("2999-01-01T00:00:00.000Z")

/**
 * An order nobody pays expires, end to end: the scheduler of the order-expiry queue ticks inside the running order service,
 * the fenced expire-orders job claims each tick, and the sweep moves the pending order that waited past the payment window to
 * expired in one transaction that also announces order.expired; an order placed inside the window and an order that was
 * already paid are left alone. The Postgres reads are out-of-band verification only.
 *
 * Run: npm run test:e2e -- order/unpaid-order-expires
 */
describe("unpaid order expires", () => {
    const world = useTestWorld({ apps: ["identity", "order", "billing"] })

    it("a pending order past the payment window expires on a tick, while a recent order and a paid order stay as they are", async () => {
        const builder = orderBuilder(world.db.order)
        const overdue = await builder.build({ status: "pending", createdAt: PLACED_LONG_AGO })
        const recent = await builder.build({ status: "pending", createdAt: PLACED_FAR_AHEAD })
        const paid = await builder.build({ status: "paid", createdAt: PLACED_LONG_AGO })

        const expired = await world.waitFor("the sweep expires the overdue order", async () => {
            const rows = await readRows(world.db.order, ORDER_SUMMARY, [overdue.id])
            return rows.find((row) => row.status === "expired") ?? null
        })

        expect(expired.status).toBe("expired")
        expect((await readRows(world.db.order, ORDER_SUMMARY, [recent.id]))[0]?.status).toBe("pending")
        expect((await readRows(world.db.order, ORDER_SUMMARY, [paid.id]))[0]?.status).toBe("paid")
    })
})
