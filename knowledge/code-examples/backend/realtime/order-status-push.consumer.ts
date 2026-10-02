import { Injectable } from "@nestjs/common"
import { OrderStatusChangedEvent } from "@modules/events/order"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { RealtimeHub } from "@modules/platform/realtime"

/**
 * The reactor that feeds the channel: it receives the domain event and pushes one frame through the hub to the topic of the order
 * owner, the same topic the subscription builds from the principal. It lives in the reactors kind, never in the realtime door.
 */
@Injectable()
export class OrderStatusPushConsumer implements EventConsumer<OrderStatusChangedEvent> {
    readonly event = OrderStatusChangedEvent

    constructor(private readonly hub: RealtimeHub) {}

    async handle(delivery: EventDelivery<OrderStatusChangedEvent>): Promise<void> {
        const { buyerId, orderId, status, changedAt } = delivery.event.payload
        this.hub.publish(`order-status:${buyerId}:${orderId}`, { orderId, status, changedAt })
    }
}
