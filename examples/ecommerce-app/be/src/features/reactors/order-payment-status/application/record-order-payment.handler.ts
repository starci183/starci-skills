import { CommandHandler } from "@nestjs/cqrs"
import { OrderPaymentService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RecordOrderPaymentCommand } from "./record-order-payment.command"
import type { RecordOrderPaymentResult } from "./record-order-payment.contracts"

@CommandHandler(RecordOrderPaymentCommand)
/** Records that billing confirmed the payment of one order; the payment confirmed consumer sends it for every delivered event. */
export class RecordOrderPaymentHandler extends ICQRSHandler<RecordOrderPaymentCommand, RecordOrderPaymentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly payments: OrderPaymentService,
    ) {
        super(logger)
    }

    protected override process(command: RecordOrderPaymentCommand): Promise<RecordOrderPaymentResult> {
        return this.payments.recordPayment(command.params.request)
    }
}
