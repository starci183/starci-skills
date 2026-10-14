/** The durable identity and payload of a fact crossing contexts. */
export abstract class BaseEvent {
    abstract readonly eventId: string
    abstract readonly eventName: string
    abstract readonly payload: object
}

/** The class side of a vendored event contract. */
export interface EventClass<Event extends BaseEvent> {
    readonly eventName: string
    readonly version: number
    parse(envelope: unknown): Event | null
}

/** A delivery retains its stable id across visibility-timeout redelivery. */
export interface EventDelivery<Event extends BaseEvent> {
    readonly eventId: string
    readonly event: Event
    readonly attempt: number
}

/** The outbox and pgmq carry the same typed envelope. */
export interface EventEnvelope {
    readonly eventId: string
    readonly eventName: string
    readonly payload: object
}

/** One queue per consumer group of a topic. */
export interface EventQueueRoute {
    readonly eventName: string
    readonly queue: string
}

/** The migration creates both queues before the relay runs. */
export const ORDER_EVENT_ROUTES: ReadonlyArray<EventQueueRoute> = [
    { eventName: "order.placed", queue: "order_notifications" },
    { eventName: "order.placed", queue: "order_metrics" },
]
