import type { EntityManager } from "typeorm"
import type { BusEvent, EventDefinition, EventDelivery } from "./event-bus.contracts"

/** The event bus of a service: events leave it through `publish`, called in the transaction of the domain change they report. */
export interface EventBus {
    /** Publishes the event of the change `tx` carries. */
    publish<Payload extends object>(event: BusEvent<Payload>, tx: EntityManager): Promise<void>
}

/** One consumer of one event; a transport class in `transport/message` implements it. */
export interface EventConsumer<Payload extends object> {
    /** The event this consumer reads. */
    readonly event: EventDefinition<Payload>
    /** Handles one delivery; a throw schedules a retry with the backoff of the event, a return acknowledges it. */
    handle(delivery: EventDelivery<Payload>): Promise<void>
}

/** Where a message transport module registers its consumers. */
export interface EventConsumerRegistry {
    /** Registers the consumer of its event. */
    add<Payload extends object>(consumer: EventConsumer<Payload>): void
}
