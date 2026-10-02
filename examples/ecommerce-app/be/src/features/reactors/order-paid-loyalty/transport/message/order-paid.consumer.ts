import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderPaidEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { GrantLoyaltyPointsCommand } from "../../application/grant-loyalty-points.command"

@Injectable()
/** Consumer of `order.paid`: hands each paid order to the grant command with the event id as its dedupe key. */
export class OrderPaidConsumer implements EventConsumer<OrderPaidEvent> {
    readonly event = OrderPaidEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one grant loyalty points command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<OrderPaidEvent>): Promise<void> {
        await this.commandBus.execute(
            new GrantLoyaltyPointsCommand({
                request: {
                    eventId: delivery.eventId,
                    orderId: delivery.event.payload.orderId,
                    personId: delivery.event.payload.personId,
                    totalMinorUnits: delivery.event.payload.totalMinorUnits,
                },
            }),
        )
    }
}
