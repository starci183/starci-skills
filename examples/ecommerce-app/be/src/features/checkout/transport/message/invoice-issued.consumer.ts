import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { ISSUED_INVOICE_QUEUE } from "@modules/domain/order"
import type { IssuedInvoiceNotice } from "@modules/domain/order"
import type { ConsumedMessage, MessageConsumer } from "@modules/integrations/messaging"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { CompletePlaceOrderCommand } from "../../application/complete-place-order.command"

@Injectable()
/** Consumer of `billing.invoice-issued`, the last event of the place-order saga: hands each delivery to the complete command. */
export class InvoiceIssuedConsumer implements MessageConsumer<IssuedInvoiceNotice> {
    readonly queue = ISSUED_INVOICE_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one complete command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(message: ConsumedMessage<IssuedInvoiceNotice>): Promise<void> {
        await this.commandBus.execute(
            new CompletePlaceOrderCommand({ request: { orderId: message.payload.orderId, eventId: message.eventId } }),
        )
    }
}
