// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import type { CommandBus } from "@nestjs/cqrs"
//   import { OrderPlacedEvent } from "@modules/events/order"
//   import { InjectCommandBus } from "@modules/platform/cqrs"
//   import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
//   import { IssueInvoiceCommand } from "../../application/issue-invoice.command"

@Injectable()
/** The consumer door of `order.placed`, in billing: it dispatches one command and forwards the event id. */
export class OrderPlacedConsumer implements EventConsumer<OrderPlacedEvent> {
    readonly event = OrderPlacedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the invoice service claims `eventId` in platform/inbox inside its own transaction. */
    async handle(delivery: EventDelivery<OrderPlacedEvent>): Promise<void> {
        await this.commandBus.execute(
            new IssueInvoiceCommand({ request: { eventId: delivery.eventId, orderId: delivery.event.payload.orderId, totalMinorUnits: delivery.event.payload.totalMinorUnits } }),
        )
    }
}
