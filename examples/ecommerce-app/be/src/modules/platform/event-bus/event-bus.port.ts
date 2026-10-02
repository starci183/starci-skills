import type { EntityManager } from "typeorm"
import type { BaseEvent, EventClass, EventDeadLetter, EventDelivery } from "./event-bus.contracts"

/** The event bus of a service: events leave it through `publish`, called by a domain service in the transaction of the change they report. */
export interface EventBus {
    /** Writes the event in the outbox of the transaction `tx` carries; the relay hands it to the broker once the transaction commits. */
    publish(event: BaseEvent, tx: EntityManager): Promise<void>
    /** How many deliveries of the class wait on the retry topic for their backoff to pass. */
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
