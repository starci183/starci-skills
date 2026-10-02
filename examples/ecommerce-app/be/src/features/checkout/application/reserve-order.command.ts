import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PlaceOrderRequest, PlaceOrderResult } from "./place-order.contracts"

/** Asks to take the stock, write the order, capture the payment and clear the cart: the first step of the place-order saga. */
export class ReserveOrderCommand extends Command<PlaceOrderResult> {
    constructor(readonly params: ExecuteParams<PlaceOrderRequest>) {
        super()
    }
}
