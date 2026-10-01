import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { REJECTED_INVOICE_QUEUE } from "@modules/domain/order"
import type { RejectedInvoiceNotice } from "@modules/domain/order"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ConsumedMessage, MessageConsumer } from "@modules/integrations/messaging"
import { CancelOrderCommand } from "../../application/cancel-order.command"

@Injectable()
/** Consumer of `billing.invoice-rejected`, the compensating step of the order saga: hands each rejection to the cancel command. */
export class InvoiceRejectedConsumer implements MessageConsumer<RejectedInvoiceNotice> {
    readonly queue = REJECTED_INVOICE_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one cancel command; cancelling an order that is not confirmed any more is a no-op, so a redelivery is safe. */
    async handle(message: ConsumedMessage<RejectedInvoiceNotice>): Promise<void> {
        await this.commandBus.execute(new CancelOrderCommand({ request: { orderId: message.payload.orderId } }))
    }
}
