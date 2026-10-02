import { Injectable } from "@nestjs/common"

@Injectable()
/** The first step of the place-order saga: the order is reserved by the domain in the transaction that places it, which announces `order.placed`. */
export class ReserveOrderStep {
    /** The name the compensation of this step carries. */
    readonly name = "reserve-order"

    /** The event this step puts on the wire (the contract `be/contracts/order/events.json`). */
    readonly event = "order.placed"
}
