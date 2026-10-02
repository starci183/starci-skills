// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import type { EntityManager } from "typeorm"
//   import { InjectOrderEntityManager } from "@modules/platform/database"
//   import { OrderSummaryProjectionEntity } from "./order-summary.projection-entity"
//   import { LOAD_ORDER_FACTS } from "./persistence/order-summary.sql"

@Injectable()
/** The order-summary read model: the only writer of its table; the api reads it with `get*`. */
export class OrderSummaryProjection {
    constructor(@InjectOrderEntityManager() private readonly entityManager: EntityManager) {}

    /** Recomputes one order's summary from the source facts: an upsert by the natural key, so repeating it changes nothing. */
    async recomputeOrderSummary(orderId: string): Promise<void> {
        const [facts] = await this.entityManager.query(LOAD_ORDER_FACTS, [orderId])
        await this.entityManager.upsert(
            OrderSummaryProjectionEntity,
            { orderId, paymentStatus: facts.paymentStatus, totalMinorUnits: facts.totalMinorUnits },
            ["orderId"],
        )
    }

    /** Reads one order's summary; the caller never sees the table. */
    async getOrderSummary(orderId: string): Promise<{ paymentStatus: string; totalMinorUnits: number } | null> {
        const row = await this.entityManager.findOne(OrderSummaryProjectionEntity, { where: { orderId } })
        return row ? { paymentStatus: row.paymentStatus, totalMinorUnits: row.totalMinorUnits } : null
    }
}
