import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OrderExpiredEvent, OrderPaidEvent } from "@modules/events/order"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectEventBus } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    ExpireOverdueOrdersParams,
    ExpireOverdueOrdersResult,
    RecordOrderPaymentParams,
} from "./order-payment.contracts"
import { OrderLogEvent } from "./order.log-events"
import { EXPIRE_PENDING_ORDERS_PLACED_BEFORE, MARK_ORDER_PAID_IF_PENDING } from "./persistence/order-lifecycle.sql"

/** The inbox source of the payment confirmations this service consumes from billing. */
const BILLING_SOURCE = "billing-payment-confirmed"

/** What the payment update answers: the buyer and the total of the order it moved to paid. */
interface PaidOrderRow {
    readonly person_id: string
    readonly total_minor_units: number
}

/** What the expiry update answers: one row per order it moved to expired. */
interface ExpiredOrderRow {
    readonly id: string
    readonly person_id: string
}

@Injectable()
/**
 * The payment lifecycle of an order, kept by the order context: the local copy of what billing announced. `recordPayment`
 * takes a delivery of `billing.payment-confirmed`: it claims the event in the inbox first, then in ONE transaction moves the
 * pending order to paid and publishes `order.paid`; an order that is not pending (expired or cancelled before the money
 * arrived) is logged and left alone. `expireOverdue` moves the pending orders nobody paid in time to expired and publishes
 * `order.expired` for each, in the same transaction.
 */
export class OrderPaymentService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly bus: EventBus,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Records the payment of one order exactly once. */
    async recordPayment(params: RecordOrderPaymentParams): Promise<void> {
        if (!(await this.inbox.claim(BILLING_SOURCE, params.eventId))) return
        try {
            await this.entityManager.transaction((manager) => this.markPaid(manager, params.orderId))
        } catch (error) {
            await this.inbox.release(BILLING_SOURCE, params.eventId)
            throw error
        }
    }

    /** Expires the pending orders placed at or before the cutoff and announces each one; answers how many it expired. */
    async expireOverdue(params: ExpireOverdueOrdersParams): Promise<ExpireOverdueOrdersResult> {
        return this.entityManager.transaction(async (manager) => {
            const expired: Array<ExpiredOrderRow> = await manager.query(EXPIRE_PENDING_ORDERS_PLACED_BEFORE, [
                params.placedBefore,
                params.limit,
            ])
            const at = this.clock.now().toISOString()
            for (const row of expired) {
                await this.bus.publish(
                    OrderExpiredEvent.create({ orderId: row.id, personId: row.person_id, expiredAt: at }),
                    manager,
                )
            }
            return { expired: expired.length }
        })
    }

    /** Moves the pending order to paid and announces it, or logs the payment of an order that is not pending. */
    private async markPaid(manager: EntityManager, orderId: string): Promise<void> {
        const at = this.clock.now()
        const rows: Array<PaidOrderRow> = await manager.query(MARK_ORDER_PAID_IF_PENDING, [orderId, at])
        const paid = rows[0]
        if (paid === undefined) {
            this.logger.warn(OrderLogEvent.PaymentForClosedOrder, { orderId })
            return
        }
        await this.bus.publish(
            OrderPaidEvent.create({
                orderId,
                personId: paid.person_id,
                totalMinorUnits: paid.total_minor_units,
                paidAt: at.toISOString(),
            }),
            manager,
        )
    }
}
