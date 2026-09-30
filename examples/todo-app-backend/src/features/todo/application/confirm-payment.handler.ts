import { CommandHandler } from "@nestjs/cqrs"
import { PaymentWebhookService } from "@modules/domain/plan"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConfirmPaymentCommand } from "./confirm-payment.command"
import type { ConfirmPaymentResult } from "./confirm-payment.contracts"

@CommandHandler(ConfirmPaymentCommand)
/** Hands one signed gateway delivery to the payment webhook intake of the plan capability. */
export class ConfirmPaymentHandler extends ICQRSHandler<ConfirmPaymentCommand, ConfirmPaymentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly webhook: PaymentWebhookService,
    ) {
        super(logger)
    }

    protected override async process(command: ConfirmPaymentCommand): Promise<ConfirmPaymentResult> {
        return this.webhook.receive(command.params.request)
    }
}
