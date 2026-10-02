import { OrderSummaryProjection } from "@modules/projections/order-summary"
import { orderBuilder } from "../../fixtures/builders/order.builder"
import { readCount, readRows } from "../../fixtures/persistence/e2e-verification.rows"
import {
    DELETE_ORDER_SUMMARIES_OF_PERSON,
    ORDER_SUMMARIES_OF_PERSON,
    ORDER_SUMMARY_COUNT_OF_PERSON,
} from "../../fixtures/persistence/e2e-verification.sql"
import { ORDER_SUMMARY_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/**
 * order-summary: the real projection over the run's order database, no HTTP door of ours. A summary is computed from the facts of
 * the order tables and written as an upsert by the order id, so computing it twice leaves one identical row, and the whole read
 * model can be dropped and rebuilt from the orders alone with the same rows.
 */
describe("order-summary: projection (integration)", () => {
    const world = useTestWorld({ modules: ORDER_SUMMARY_CAPABILITY_MODULES })

    const projection = (): OrderSummaryProjection => world.resolve(OrderSummaryProjection)

    it("projection/recompute-is-idempotent: recomputing the same order twice leaves one identical row", async () => {
        const order = await orderBuilder(world.db.order).build({ status: "paid", totalMinorUnits: 3000, paidAt: new Date("2026-02-03T04:05:06.000Z") }, 2)

        await projection().recomputeOrderSummary(order.id)
        const first = await projection().getOrderSummary(order.id)
        await projection().recomputeOrderSummary(order.id)
        const second = await projection().getOrderSummary(order.id)

        expect(first).toMatchObject({ orderId: order.id, status: "paid", totalMinorUnits: 3000, lineCount: 2, loyaltyPoints: 0 })
        expect(second).toEqual(first)
        expect(await readCount(world.db.order, ORDER_SUMMARY_COUNT_OF_PERSON, order.personId)).toBe(1)
    })

    it("projection/replay-rebuilds: dropping the read model and replaying every order gives the same rows", async () => {
        const personId = "6d0e8b9a-3f0b-4f6b-9a39-0b1d2e3f4a5b"
        const builder = orderBuilder(world.db.order)
        await builder.build({ personId, status: "pending", totalMinorUnits: 1000 }, 1)
        await builder.build({ personId, status: "paid", totalMinorUnits: 2000, paidAt: new Date("2026-02-03T04:05:06.000Z") }, 2)
        await builder.build({ personId, status: "expired", totalMinorUnits: 3000 }, 3)

        const recomputed = await projection().recomputeAllOrderSummaries()
        const before = await readRows(world.db.order, ORDER_SUMMARIES_OF_PERSON, [personId])
        await readRows(world.db.order, DELETE_ORDER_SUMMARIES_OF_PERSON, [personId])
        expect(await readCount(world.db.order, ORDER_SUMMARY_COUNT_OF_PERSON, personId)).toBe(0)
        await projection().recomputeAllOrderSummaries()
        const after = await readRows(world.db.order, ORDER_SUMMARIES_OF_PERSON, [personId])

        expect(recomputed).toBeGreaterThanOrEqual(3)
        expect(before).toHaveLength(3)
        expect(after).toEqual(before)
    })

    it("answers the newest summaries of a buyer through its readers and nothing for an unknown order", async () => {
        const order = await orderBuilder(world.db.order).build({ status: "pending" }, 1)
        await projection().recomputeOrderSummary(order.id)

        const summaries = await projection().getOrderSummariesOfPerson({ personId: order.personId, limit: 10 })

        expect(summaries.map((summary) => summary.orderId)).toEqual([order.id])
        expect(await projection().getOrderSummary("00000000-0000-4000-8000-000000000000")).toBeNull()
    })
})
