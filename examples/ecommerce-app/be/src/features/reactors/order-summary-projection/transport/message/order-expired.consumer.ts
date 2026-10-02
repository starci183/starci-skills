import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderExpiredEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { RecomputeOrderSummaryCommand } from "../../application/recompute-order-summary.command"

@Injectable()
/** Consumer of `order.expired`: asks for the summary of each expired order. */
export class OrderExpiredConsumer implements EventConsumer<OrderExpiredEvent> {
    readonly event = OrderExpiredEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one recompute order summary command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<OrderExpiredEvent>): Promise<void> {
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
