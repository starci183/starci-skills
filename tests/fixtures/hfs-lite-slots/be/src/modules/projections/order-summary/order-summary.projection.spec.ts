import type { EntityManager } from "typeorm"
import { OrderSummaryProjection } from "./order-summary.projection"

describe("OrderSummaryProjection", () => {
    it("maps a migration-owned row to its public read contract", async () => {
        const query = jest.fn().mockResolvedValue([{ buyer_id: "p-1", order_count: 2 }])
        const projection = new OrderSummaryProjection({ query } as unknown as EntityManager)

        await expect(projection.getOrderSummary("p-1")).resolves.toEqual({ buyerId: "p-1", orderCount: 2 })

        expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT buyer_id"), ["p-1"])
    })
})
