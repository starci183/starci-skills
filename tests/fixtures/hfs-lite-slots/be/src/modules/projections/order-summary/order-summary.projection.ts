import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OrderSummary } from "./order-summary.contracts"
import type { OrderSummaryRow } from "./persistence/order-summary.rows"
import { GET_ORDER_SUMMARY, RECOMPUTE_ORDER_SUMMARY } from "./persistence/order-summary.sql"

@Injectable()
/** This projection alone writes its Supabase read-model table. */
export class OrderSummaryProjection {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** A reactor or job can replay the same recompute safely. */
    async recomputeOrderSummary(buyerId: string): Promise<void> {
        await this.entityManager.query(RECOMPUTE_ORDER_SUMMARY, [buyerId])
    }

    /** API callers read through this method rather than the projection table. */
    async getOrderSummary(buyerId: string): Promise<OrderSummary | null> {
        const [row] = await this.entityManager.query<ReadonlyArray<OrderSummaryRow>>(GET_ORDER_SUMMARY, [buyerId])
        return row === undefined ? null : { buyerId: row.buyer_id, orderCount: row.order_count }
    }
}
