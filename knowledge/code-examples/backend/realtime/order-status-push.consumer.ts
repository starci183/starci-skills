import { Injectable } from "@nestjs/common"
import { orderStatusTopic } from "@modules/domain/order"
import { OrderStatusChangedEvent } from "@modules/events/order"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

/**
 * The reactor that feeds the channel: it receives the domain event and pushes one frame through the hub to the topic of the order
 * owner, built by the same domain function the subscription uses. It lives in the reactors kind, never in the realtime door.
 */
@Injectable()
export class OrderStatusPushConsumer implements EventConsumer<OrderStatusChangedEvent> {
    readonly event = OrderStatusChangedEvent

    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    async handle(delivery: EventDelivery<OrderStatusChangedEvent>): Promise<void> {
        const { buyerId, orderId, status, changedAt } = delivery.event.payload
        this.hub.publish(orderStatusTopic(buyerId, orderId), { orderId, status, changedAt })
    }
}
