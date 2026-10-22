import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { BankTransferReceivedEvent } from "@modules/events/billing"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SettleBankTransferCommand } from "../../application/settle-bank-transfer.command"

@Injectable()
/** The consumer door of the bank-transfer-received event in the bank-transfer-settlement reactor: it dispatches one command and forwards the event id. */
export class BankTransferReceivedConsumer implements EventConsumer<BankTransferReceivedEvent> {
    readonly event = BankTransferReceivedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims `eventId` in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<BankTransferReceivedEvent>): Promise<void> {
        await this.commandBus.execute(
            new SettleBankTransferCommand({ request: { eventId: delivery.eventId, event: delivery.event } }),
        )
    }
}
