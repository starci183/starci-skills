// Imports the host resolves (a comment, because this folder is a shape and not a compiled app):
//   import { Injectable } from "@nestjs/common"
//   import type { CommandBus } from "@nestjs/cqrs"
//   import { PaymentSettledEvent } from "@modules/events/payment"
//   import { InjectCommandBus } from "@modules/platform/cqrs"
//   import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
//   import { RecomputeOrderSummaryCommand } from "../../application/recompute-order-summary.command"

@Injectable()
/** The reactor door of `payment.settled` in order: it keeps the order summary current by asking for a recompute. */
export class PaymentSettledConsumer implements EventConsumer<PaymentSettledEvent> {
    readonly event = PaymentSettledEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one command and forwards the event id; the handler calls `recomputeOrderSummary`. */
    async handle(delivery: EventDelivery<PaymentSettledEvent>): Promise<void> {
        await this.commandBus.execute(
            new RecomputeOrderSummaryCommand({ request: { eventId: delivery.eventId, orderId: delivery.event.payload.orderId } }),
        )
    }
}
