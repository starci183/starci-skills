import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PlaceOrderRequest, PlaceOrderResult } from "../../application/place-order.contracts"
import { ReserveOrderCommand } from "../../application/reserve-order.command"

@Injectable()
/** The first step of the place-order saga: takes the stock, writes the order, captures the payment and clears the cart, and announces `order.placed`. */
export class ReserveOrderStep {
    /** The name the compensation of this step carries. */
    readonly name = "reserve-order"

    /** The event this step puts on the wire (the contract `be/contracts/order/events.json`). */
    readonly event = "order.placed"

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches the one command of the step. */
    run(params: ExecuteParams<PlaceOrderRequest>): Promise<PlaceOrderResult> {
        return this.commandBus.execute(new ReserveOrderCommand(params))
    }
}
