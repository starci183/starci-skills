import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReconcilePaymentRequest, ReconcilePaymentResult } from "./reconcile-payment.contracts"

/** Asks the gateway for the live state of a payment intent of the caller and applies what a webhook would have applied. */
export class ReconcilePaymentCommand extends Command<ReconcilePaymentResult> {
    constructor(readonly params: ExecuteParams<ReconcilePaymentRequest>) {
        super()
    }
}
