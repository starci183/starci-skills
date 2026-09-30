import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PlaceOrderRequest, PlaceOrderResult } from "./place-order.contracts"

/** Asks to turn the caller cart into a confirmed order. */
export class PlaceOrderCommand extends Command<PlaceOrderResult> {
    constructor(readonly params: ExecuteParams<PlaceOrderRequest>) {
        super()
    }
}
