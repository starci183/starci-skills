import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { REPLAY_BATCH } from "./order-summary.contracts"
import type { GetOrderSummariesOfPersonParams, GetOrderSummaryResult, OrderSummaryView } from "./order-summary.contracts"
import { OrderSummaryProjectionEntity } from "./order-summary.projection-entity"
import { LOAD_ORDER_SUMMARY_FACTS } from "./persistence/order-summary.sql"
import type { OrderSummaryFactsRow } from "./persistence/order-summary.rows"

const toView = (row: OrderSummaryProjectionEntity): OrderSummaryView => ({
    orderId: row.orderId,
    personId: row.personId,
    status: row.status,
    totalMinorUnits: row.totalMinorUnits,
    lineCount: row.lineCount,
    loyaltyPoints: row.loyaltyPoints,
    placedAt: row.placedAt.toISOString(),
    paidAt: row.paidAt === null ? null : row.paidAt.toISOString(),
})

const toRow = (facts: OrderSummaryFactsRow): OrderSummaryProjectionEntity => {
    const row = new OrderSummaryProjectionEntity()
    row.orderId = facts.order_id
    row.personId = facts.person_id
    row.status = facts.status
    row.totalMinorUnits = facts.total_minor_units
    row.lineCount = facts.line_count
    row.loyaltyPoints = facts.loyalty_points
    row.placedAt = facts.placed_at
    row.paidAt = facts.paid_at
    return row
}

@Injectable()
/**
 * The order-summary read model of the order context: the ONLY writer of its table. A summary is always computed from the
 * facts of the order tables, never from an event, and written as an upsert by the order id, so recomputing is idempotent and
 * the whole table can be rebuilt by replaying every order (`recomputeAllOrderSummaries`). Readers use `get*` and never see
 * the table; this projection publishes no events.
 */
export class OrderSummaryProjection {
    constructor(@InjectOrderEntityManager() private readonly entityManager: EntityManager) {}

    /** Recomputes the summary of one order from its facts; an order that does not exist leaves nothing. */
    async recomputeOrderSummary(orderId: string): Promise<void> {
        const facts = await this.loadFacts(orderId, null, 1)
        await this.write(facts)
    }

    /** Rebuilds every summary from the facts, a bounded batch at a time; answers how many orders it recomputed. */
    async recomputeAllOrderSummaries(): Promise<number> {
        let recomputed = 0
        let cursor: string | null = null
        for (;;) {
            const facts = await this.loadFacts(null, cursor, REPLAY_BATCH)
            await this.write(facts)
            recomputed += facts.length
            const last = facts.at(-1)
            if (facts.length < REPLAY_BATCH || last === undefined) return recomputed
            cursor = last.order_id
        }
    }

    /** The summary of one order, or null when none was computed. */
    async getOrderSummary(orderId: string): Promise<GetOrderSummaryResult> {
        const row = await this.entityManager.findOneBy(OrderSummaryProjectionEntity, { orderId })
        return row === null ? null : toView(row)
    }

    /** The newest summaries of one buyer. */
    async getOrderSummariesOfPerson(params: GetOrderSummariesOfPersonParams): Promise<ReadonlyArray<OrderSummaryView>> {
        const rows = await this.entityManager.find(OrderSummaryProjectionEntity, {
            where: { personId: params.personId },
            order: { placedAt: "DESC" },
            take: params.limit,
        })
        return rows.map(toView)
    }

    /** Reads the facts of one order, or of the next `limit` orders after the cursor. */
    private async loadFacts(orderId: string | null, cursor: string | null, limit: number): Promise<ReadonlyArray<OrderSummaryFactsRow>> {
        return this.entityManager.query(LOAD_ORDER_SUMMARY_FACTS, [orderId, cursor, limit])
    }

    /** Upserts the summaries of the facts by order id. */
    private async write(facts: ReadonlyArray<OrderSummaryFactsRow>): Promise<void> {
        if (facts.length === 0) return
        await this.entityManager.upsert(OrderSummaryProjectionEntity, facts.map(toRow), ["orderId"])
    }
}
