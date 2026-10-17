import { CommandHandler } from "@nestjs/cqrs"
import { PaymentService } from "@modules/domain/payment"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SettleBankTransferCommand } from "./settle-bank-transfer.command"

@CommandHandler(SettleBankTransferCommand)
/** Hands the delivered bank-transfer-received event to the domain service, which claims the event id and applies the change in one transaction. */
export class SettleBankTransferHandler extends ICQRSHandler<SettleBankTransferCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly payments: PaymentService,
    ) {
        super(logger)
    }

    protected override process(command: SettleBankTransferCommand): Promise<void> {
        return this.payments.acceptBankTransfer({
            ...command.params.request.event.payload,
            eventId: command.params.request.eventId,
        })
    }
}
