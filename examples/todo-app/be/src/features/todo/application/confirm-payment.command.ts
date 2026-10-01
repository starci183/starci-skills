import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ConfirmPaymentRequest, ConfirmPaymentResult } from "./confirm-payment.contracts"

/** Tells the plan what the gateway reported for a payment intent; sent by the signed webhook, never by a person. */
export class ConfirmPaymentCommand extends Command<ConfirmPaymentResult> {
    constructor(readonly params: PublicExecuteParams<ConfirmPaymentRequest>) {
        super()
    }
}
