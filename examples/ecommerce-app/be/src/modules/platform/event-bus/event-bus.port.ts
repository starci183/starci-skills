import type { EntityManager } from "typeorm"
import type { BaseEvent, EventClass, EventDeadLetter, EventDelivery } from "./event-bus.contracts"

/** The event bus of a service: events leave it through `publish`, called by a domain service in the transaction of the change they report. */
export interface EventBus {
    /** Publishes the event of the change `tx` carries. */
    publish(event: BaseEvent, tx: EntityManager): Promise<void>
    /** How many events of the class wait for the backoff of a failed delivery to pass. */
    pendingRetries(event: EventClass<BaseEvent>): Promise<number>
    /** The events of the class that ran out of attempts. */
    deadLetters(event: EventClass<BaseEvent>): Promise<ReadonlyArray<EventDeadLetter>>
    /** Puts a dead letter back to be delivered again. */
    requeue(deadLetterId: string): Promise<void>
}

/** One consumer of one event; a transport class in `transport/message` implements it. */
export interface EventConsumer<Event extends BaseEvent> {
    /** The class of the event this consumer reads. */
    readonly event: EventClass<Event>
    /** Handles one delivery; a throw schedules a retry with the backoff of the bus, a return acknowledges it. */
    handle(delivery: EventDelivery<Event>): Promise<void>
}

/** Where a message transport module registers its consumers. */
export interface EventConsumerRegistry {
    /** Registers the consumer of its event. */
    add<Event extends BaseEvent>(consumer: EventConsumer<Event>): void
}
