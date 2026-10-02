import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { PaymentConfirmedEvent, PaymentFailedEvent } from "@modules/events/billing"
import { InjectInbox, Inbox } from "@modules/platform/inbox"
import { InjectEventBus, EventBus } from "@modules/platform/event-bus"
import { InjectBillingEntityManager } from "@modules/platform/database"
import { InjectClock, Clock } from "@modules/platform/clock"
import { PaymentEntity } from "./persistence/entities/payment.entity"

const GATEWAY_SOURCE = "payment-gateway"

/** The intake of the payment gateway webhook: one transaction records the delivery and publishes the event. */
@Injectable()
export class PaymentService {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectEventBus() private readonly eventBus: EventBus,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Records a verified notification once, and publishes `payment.confirmed` or `payment.failed` with it. */
    async acceptNotification(notification: { readonly eventId: string; readonly orderId: string; readonly status: "confirmed" | "failed"; readonly amountCents: number }): Promise<void> {
        const at = this.clock.now()
        await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim(GATEWAY_SOURCE, notification.eventId))) return
            await manager.update(PaymentEntity, { orderId: notification.orderId }, { status: notification.status, settledAt: at })
            const event = notification.status === "confirmed"
                ? PaymentConfirmedEvent.create({ eventId: notification.eventId, orderId: notification.orderId, amountCents: notification.amountCents })
                : PaymentFailedEvent.create({ eventId: notification.eventId, orderId: notification.orderId })
            await this.eventBus.publish(event, manager)
        })
    }
}
