import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { CancelledOrder } from "@modules/domain/order"
import type { CancelOrderRequest } from "./cancel-order.contracts"

/** Asks to cancel a placed order whose invoice was rejected; the invoice-rejected consumer sends it for every delivered event. */
export class CancelOrderCommand extends Command<CancelledOrder> {
    constructor(readonly params: PublicExecuteParams<CancelOrderRequest>) {
        super()
    }
}
