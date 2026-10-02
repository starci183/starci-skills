import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InvoiceIssuedEvent } from "@modules/events/billing"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { CompletePlaceOrderCommand } from "../../application/complete-place-order.command"

@Injectable()
/** Consumer of `billing.invoice-issued`, the last event of the place-order saga: hands each delivery to the complete command. */
export class InvoiceIssuedConsumer implements EventConsumer<InvoiceIssuedEvent> {
    readonly event = InvoiceIssuedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one complete command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(delivery: EventDelivery<InvoiceIssuedEvent>): Promise<void> {
        await this.commandBus.execute(
            new CompletePlaceOrderCommand({
                request: { orderId: delivery.event.payload.orderId, eventId: delivery.eventId },
            }),
        )
    }
}
