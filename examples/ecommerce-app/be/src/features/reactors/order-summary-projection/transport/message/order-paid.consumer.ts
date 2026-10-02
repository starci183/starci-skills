import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderPaidEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { RecomputeOrderSummaryCommand } from "../../application/recompute-order-summary.command"

@Injectable()
/** Consumer of `order.paid`: asks for the summary of each paid order. */
export class OrderPaidConsumer implements EventConsumer<OrderPaidEvent> {
    readonly event = OrderPaidEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one recompute order summary command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<OrderPaidEvent>): Promise<void> {
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
