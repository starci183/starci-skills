import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { PLACED_ORDER_QUEUE } from "@modules/domain/invoice"
import type { PlacedOrderNotice } from "@modules/domain/invoice"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ConsumedMessage, MessageConsumer } from "@modules/integrations/messaging"
import { IssueInvoiceCommand } from "../../application/issue-invoice.command"

@Injectable()
/** Consumer of `order.placed`: hands each placed order to the invoice command with the event id as its dedupe key. */
export class OrderPlacedConsumer implements MessageConsumer<PlacedOrderNotice> {
    readonly queue = PLACED_ORDER_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one invoice command; a refusal is a recorded, announced outcome and not a failed delivery. */
    async handle(message: ConsumedMessage<PlacedOrderNotice>): Promise<void> {
        await this.commandBus.execute(
            new IssueInvoiceCommand({
                request: {
                    eventId: message.eventId,
                    orderId: message.payload.orderId,
                    personId: message.payload.personId,
                    totalMinorUnits: message.payload.totalMinorUnits,
                },
            }),
        )
    }
}
