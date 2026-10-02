import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RecordOrderPaymentRequest } from "./record-order-payment.contracts"

/** Records that billing confirmed the payment of one order; the payment confirmed consumer sends it for every delivered event. */
export class RecordOrderPaymentCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<RecordOrderPaymentRequest>) {
        super()
    }
}
