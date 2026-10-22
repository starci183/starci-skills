import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderPaidEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { PushOrderStatusCommand } from "../../application/push-order-status.command"

@Injectable()
/** Consumer of `order.paid`: pushes the paid status of the order to its buyer. */
export class OrderPaidConsumer implements EventConsumer<OrderPaidEvent> {
    readonly event = OrderPaidEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one push order status command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<OrderPaidEvent>): Promise<void> {
        await this.commandBus.execute(
            new PushOrderStatusCommand({
                request: {
                    eventId: delivery.eventId,
                    personId: delivery.event.payload.personId,
                    orderId: delivery.event.payload.orderId,
                    status: "paid",
                    changedAt: delivery.event.payload.paidAt,
                },
            }),
        )
    }
}
