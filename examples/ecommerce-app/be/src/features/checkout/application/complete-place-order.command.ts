import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SagaTransition } from "@modules/platform/saga"
import type { CompletePlaceOrderRequest } from "./complete-place-order.contracts"

/** Asks to complete the place-order saga of an order whose invoice was issued; the invoice-issued consumer sends it for every delivered event. */
export class CompletePlaceOrderCommand extends Command<SagaTransition> {
    constructor(readonly params: PublicExecuteParams<CompletePlaceOrderRequest>) {
        super()
    }
}
