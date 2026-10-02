import type { EntityManager } from "typeorm"
import type { BaseEvent, EventClass, EventDelivery } from "./event-bus.contracts"

/** The publishing port of the event bus. */
export interface EventBus {
    publish(event: BaseEvent, tx: EntityManager): Promise<void>
    pendingRetries(event: EventClass<BaseEvent>): Promise<number>
}

/** One consumer of one event class; a transport class in `transport/message` implements it. */
export interface EventConsumer<E extends BaseEvent> {
    readonly event: EventClass<E>
    handle(delivery: EventDelivery<E>): Promise<void>
}
