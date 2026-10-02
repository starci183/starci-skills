import { defineEvent } from "@modules/platform/event-bus"
import type { BusEvent } from "@modules/platform/event-bus"
import { isRecord } from "@modules/platform/primitives"

/** The payload of `order.placed` (the contract `be/contracts/order/events.json`). */
export interface OrderPlacedPayload {
    /** The placed order. */
    readonly orderId: string
    /** The buyer. */
    readonly personId: string
    /** The total of the order in minor units. */
    readonly totalMinorUnits: number
}

/** An order was placed: version 1 of the order service's contract; three deliveries, one second of backoff doubling. */
export class OrderPlacedEvent implements BusEvent<OrderPlacedPayload> {
    /** The declaration publishers and consumers share. */
    static readonly definition = defineEvent<OrderPlacedPayload>({
        name: "order.placed",
        version: 1,
        attempts: 3,
        backoffMs: 1000,
        parse: (value) =>
            isRecord(value) &&
            typeof value.orderId === "string" &&
            typeof value.personId === "string" &&
            typeof value.totalMinorUnits === "number"
                ? { orderId: value.orderId, personId: value.personId, totalMinorUnits: value.totalMinorUnits }
                : null,
    })

    readonly definition = OrderPlacedEvent.definition

    private constructor(
        readonly eventId: string,
        readonly payload: OrderPlacedPayload,
    ) {}

    /** Builds the event of a placed order; its id is the order id, so a repeat is recognised by the receiver. */
    static create(payload: OrderPlacedPayload): OrderPlacedEvent {
        return new OrderPlacedEvent(payload.orderId, payload)
    }
}
