import type { EntityManager } from "typeorm"
import type { BaseEvent, EventClass, EventDelivery } from "./event-bus.contracts"

/** Publishing joins the domain transaction; delivery only reads committed rows. */
export interface EventBus {
    publish(event: BaseEvent, tx: EntityManager): Promise<void>
}

/** A thin transport forwards the stable id to its handler's transactional inbox. */
export interface EventConsumer<Event extends BaseEvent> {
    readonly event: EventClass<Event>
    handle(delivery: EventDelivery<Event>): Promise<void>
}
