import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { OrderPlacedEvent } from "@modules/events/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { IssueInvoiceCommand } from "../../application/issue-invoice.command"

@Injectable()
/** Consumer of `order.placed`: hands each placed order to the invoice command with the event id as its dedupe key. */
export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {
    readonly event = OrderPlacedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one invoice command; a refusal is a recorded, announced outcome and not a failed delivery. */
    async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> {
        await this.commandBus.execute(
            new IssueInvoiceCommand({
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
