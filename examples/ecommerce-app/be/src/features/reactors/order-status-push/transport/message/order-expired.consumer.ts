import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderExpiredEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { PushOrderStatusCommand } from "../../application/push-order-status.command"

@Injectable()
/** Consumer of `order.expired`: pushes the expired status of the order to its buyer. */
export class OrderExpiredConsumer implements EventConsumer<OrderExpiredEvent> {
    readonly event = OrderExpiredEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one push order status command. */
    async handle(delivery: EventDelivery<OrderExpiredEvent>): Promise<void> {
        await this.commandBus.execute(
            new PushOrderStatusCommand({
                request: {
                    personId: delivery.event.payload.personId,
                    orderId: delivery.event.payload.orderId,
                    status: "expired",
                    changedAt: delivery.event.payload.expiredAt,
                },
            }),
        )
    }
}
