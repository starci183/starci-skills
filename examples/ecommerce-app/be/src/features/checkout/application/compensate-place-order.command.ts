import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SagaTransition } from "@modules/platform/saga"
import type { CompensatePlaceOrderRequest } from "./compensate-place-order.contracts"

/** Asks to compensate the place-order saga of an order whose invoice was rejected; the invoice-rejected consumer sends it for every delivered event. */
export class CompensatePlaceOrderCommand extends Command<SagaTransition> {
    constructor(readonly params: PublicExecuteParams<CompensatePlaceOrderRequest>) {
        super()
    }
}
