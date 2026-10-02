import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ORDER_ENTITY_MANAGER } from "@modules/platform/database"
import { REPLAY_BATCH } from "./order-summary.contracts"
import { OrderSummaryProjection } from "./order-summary.projection"
import { OrderSummaryProjectionEntity } from "./order-summary.projection-entity"
import { LOAD_ORDER_SUMMARY_FACTS } from "./persistence/order-summary.sql"
import type { OrderSummaryFactsRow } from "./persistence/order-summary.rows"

const facts = (orderId: string, paidAt: Date | null = new Date("2026-10-01T12:05:00.000Z")): OrderSummaryFactsRow => ({
    order_id: orderId,
    person_id: "person-1",
    status: paidAt === null ? "pending" : "paid",
    total_minor_units: 2500,
    line_count: 2,
    loyalty_points: paidAt === null ? 0 : 25,
    placed_at: new Date("2026-10-01T12:00:00.000Z"),
    paid_at: paidAt,
})

const entity = (orderId: string, paidAt: Date | null): OrderSummaryProjectionEntity =>
    Object.assign(new OrderSummaryProjectionEntity(), {
        orderId,
        personId: "person-1",
        status: paidAt === null ? "pending" : "paid",
        totalMinorUnits: 2500,
        lineCount: 2,
        loyaltyPoints: paidAt === null ? 0 : 25,
        placedAt: new Date("2026-10-01T12:00:00.000Z"),
        paidAt,
    })

const writeResult = { identifiers: [], generatedMaps: [], raw: [] }

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const transaction = fakeTransaction(manager)
    const moduleRef = await Test.createTestingModule({
        providers: [OrderSummaryProjection, { provide: ORDER_ENTITY_MANAGER, useValue: transaction.em }],
    }).compile()
    return { projection: moduleRef.get(OrderSummaryProjection), manager: transaction.em, transaction }
}

describe("OrderSummaryProjection", () => {
    describe("recomputeOrderSummary", () => {
        it("loads one order's facts and idempotently upserts the same summary by order id", async () => {
            const { projection, manager } = await build()
            manager.query.mockResolvedValue([facts("order-1")])
            manager.upsert.mockResolvedValue(writeResult)

            await projection.recomputeOrderSummary("order-1")
            await projection.recomputeOrderSummary("order-1")

            expect(manager.query).toHaveBeenNthCalledWith(1, LOAD_ORDER_SUMMARY_FACTS, ["order-1", null, 1])
            expect(manager.query).toHaveBeenNthCalledWith(2, LOAD_ORDER_SUMMARY_FACTS, ["order-1", null, 1])
            expect(manager.upsert).toHaveBeenNthCalledWith(
                1,
                OrderSummaryProjectionEntity,
                [
                    expect.objectContaining({
                        orderId: "order-1",
                        personId: "person-1",
                        status: "paid",
                        totalMinorUnits: 2500,
                        lineCount: 2,
                        loyaltyPoints: 25,
                        placedAt: new Date("2026-10-01T12:00:00.000Z"),
                        paidAt: new Date("2026-10-01T12:05:00.000Z"),
                    }),
                ],
                ["orderId"],
            )
            expect(manager.upsert).toHaveBeenNthCalledWith(
                2,
                OrderSummaryProjectionEntity,
                [expect.objectContaining({ orderId: "order-1" })],
                ["orderId"],
            )
        })

        it("writes nothing when the order has no facts", async () => {
            const { projection, manager } = await build()
            manager.query.mockResolvedValue([])

            await projection.recomputeOrderSummary("missing-order")

            expect(manager.upsert).not.toHaveBeenCalled()
        })
    })

    describe("recomputeAllOrderSummaries", () => {
        it("walks the facts in bounded order-id batches and returns the number upserted", async () => {
            const { projection, manager } = await build()
            const firstBatch = Array.from({ length: REPLAY_BATCH }, (_value, index) =>
                facts(`order-${String(index + 1).padStart(4, "0")}`),
            )
            const lastBatch = [facts("order-0501", null)]
            manager.query.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce(lastBatch)
            manager.upsert.mockResolvedValue(writeResult)

            await expect(projection.recomputeAllOrderSummaries()).resolves.toBe(501)

            expect(manager.query).toHaveBeenNthCalledWith(1, LOAD_ORDER_SUMMARY_FACTS, [null, null, REPLAY_BATCH])
            expect(manager.query).toHaveBeenNthCalledWith(2, LOAD_ORDER_SUMMARY_FACTS, [
                null,
                "order-0500",
                REPLAY_BATCH,
            ])
            expect(manager.upsert).toHaveBeenCalledTimes(2)
            expect(manager.upsert).toHaveBeenLastCalledWith(
                OrderSummaryProjectionEntity,
                [expect.objectContaining({ orderId: "order-0501", status: "pending", paidAt: null })],
                ["orderId"],
            )
        })
    })

    describe("getOrderSummary", () => {
        it("answers null when no summary was computed", async () => {
            const { projection, manager } = await build()
            manager.findOneBy.mockResolvedValue(null)

            await expect(projection.getOrderSummary("missing-order")).resolves.toBeNull()

            expect(manager.findOneBy).toHaveBeenCalledWith(OrderSummaryProjectionEntity, {
                orderId: "missing-order",
            })
        })

        it("maps a stored summary to its transport view", async () => {
            const { projection, manager } = await build()
            manager.findOneBy.mockResolvedValue(entity("order-1", new Date("2026-10-01T12:05:00.000Z")))

            await expect(projection.getOrderSummary("order-1")).resolves.toEqual({
                orderId: "order-1",
                personId: "person-1",
                status: "paid",
                totalMinorUnits: 2500,
                lineCount: 2,
                loyaltyPoints: 25,
                placedAt: "2026-10-01T12:00:00.000Z",
                paidAt: "2026-10-01T12:05:00.000Z",
            })
        })
    })

    describe("getOrderSummariesOfPerson", () => {
        it("reads the buyer's newest rows with the requested limit and maps nullable payment instants", async () => {
            const { projection, manager } = await build()
            manager.find.mockResolvedValue([
                entity("order-2", new Date("2026-10-01T12:05:00.000Z")),
                entity("order-1", null),
            ])

            await expect(projection.getOrderSummariesOfPerson({ personId: "person-1", limit: 2 })).resolves.toEqual([
                expect.objectContaining({ orderId: "order-2", paidAt: "2026-10-01T12:05:00.000Z" }),
                expect.objectContaining({ orderId: "order-1", paidAt: null }),
            ])

            expect(manager.find).toHaveBeenCalledWith(OrderSummaryProjectionEntity, {
                where: { personId: "person-1" },
                order: { placedAt: "DESC" },
                take: 2,
            })
        })
    })
})
