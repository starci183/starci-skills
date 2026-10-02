import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InvoiceRejectedEvent } from "@modules/events/billing"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { CompensatePlaceOrderCommand } from "../../application/compensate-place-order.command"

@Injectable()
/** Consumer of `billing.invoice-rejected`, the failure event of the place-order saga: hands each delivery to the compensate command. */
export class InvoiceRejectedConsumer implements EventConsumer<InvoiceRejectedEvent> {
    readonly event = InvoiceRejectedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one compensate command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(delivery: EventDelivery<InvoiceRejectedEvent>): Promise<void> {
        await this.commandBus.execute(
            new CompensatePlaceOrderCommand({
                request: { orderId: delivery.event.payload.orderId, eventId: delivery.eventId },
            }),
        )
    }
}
