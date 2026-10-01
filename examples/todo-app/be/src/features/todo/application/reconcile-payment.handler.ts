import { CommandHandler } from "@nestjs/cqrs"
import { PlanCheckoutService } from "@modules/domain/plan"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReconcilePaymentCommand } from "./reconcile-payment.command"
import type { ReconcilePaymentResult } from "./reconcile-payment.contracts"

@CommandHandler(ReconcilePaymentCommand)
/** Polls the gateway for the status of an intent of the caller and applies what a webhook would have applied. */
export class ReconcilePaymentHandler extends ICQRSHandler<ReconcilePaymentCommand, ReconcilePaymentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly checkout: PlanCheckoutService,
    ) {
        super(logger)
    }

    protected override async process(command: ReconcilePaymentCommand): Promise<ReconcilePaymentResult> {
        return this.checkout.reconcile({
            personId: command.params.principal.id,
            paymentIntentId: command.params.request.paymentIntentId,
        })
    }
}
