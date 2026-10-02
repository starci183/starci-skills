import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { REJECTED_INVOICE_QUEUE } from "@modules/domain/order"
import type { RejectedInvoiceNotice } from "@modules/domain/order"
import type { ConsumedMessage, MessageConsumer } from "@modules/integrations/messaging"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { CompensatePlaceOrderCommand } from "../../application/compensate-place-order.command"

@Injectable()
/** Consumer of `billing.invoice-rejected`, the failure event of the place-order saga: hands each delivery to the compensate command. */
export class InvoiceRejectedConsumer implements MessageConsumer<RejectedInvoiceNotice> {
    readonly queue = REJECTED_INVOICE_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one compensate command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(message: ConsumedMessage<RejectedInvoiceNotice>): Promise<void> {
        await this.commandBus.execute(
            new CompensatePlaceOrderCommand({
                request: { orderId: message.payload.orderId, eventId: message.eventId },
            }),
        )
    }
}
