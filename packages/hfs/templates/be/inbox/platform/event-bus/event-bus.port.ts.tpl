import type { EntityManager } from "typeorm"
import type { BaseEvent, EventClass, EventDelivery } from "./event-bus.contracts"

/** The publishing side of the lite event bus; the reactor or job owns delivery of committed outbox rows. */
export interface EventBus {
    /** Writes the typed event in the caller's transaction; a rollback writes no durable event. */
    publish(event: BaseEvent, tx: EntityManager): Promise<void>
}

/** A later message transport receives one typed event and forwards its delivery id. */
export interface EventConsumer<Event extends BaseEvent> {
    /** The event class the consumer reads. */
    readonly event: EventClass<Event>
    /** Applies one delivery after commit; a throw leaves the delivery available for retry. */
    handle(delivery: EventDelivery<Event>): Promise<void>
}
