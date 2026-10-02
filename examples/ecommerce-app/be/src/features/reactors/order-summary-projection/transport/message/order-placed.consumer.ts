import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderPlacedEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { RecomputeOrderSummaryCommand } from "../../application/recompute-order-summary.command"

@Injectable()
/** Consumer of `order.placed`: asks for the summary of each placed order. */
export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {
    readonly event = OrderPlacedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one recompute order summary command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> {
        await this.commandBus.execute(
            new RecomputeOrderSummaryCommand({
                request: {
                    eventId: delivery.eventId,
                    orderId: delivery.event.payload.orderId,
                },
            }),
        )
    }
}
