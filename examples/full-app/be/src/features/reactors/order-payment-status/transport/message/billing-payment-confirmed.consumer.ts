import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { PaymentConfirmedEvent } from "@modules/events/billing"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { RecordOrderPaymentCommand } from "../../application/record-order-payment.command"

@Injectable()
/** Consumer of `billing.payment-confirmed`: hands each confirmed payment to the record command with the event id as its dedupe key. */
export class BillingPaymentConfirmedConsumer implements EventConsumer<PaymentConfirmedEvent> {
    readonly event = PaymentConfirmedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one record order payment command with the event id as its dedupe key. */
    async handle(delivery: EventDelivery<PaymentConfirmedEvent>): Promise<void> {
        await this.commandBus.execute(
            new RecordOrderPaymentCommand({
                request: {
                    eventId: delivery.eventId,
                    orderId: delivery.event.payload.orderId,
                },
            }),
        )
    }
}
