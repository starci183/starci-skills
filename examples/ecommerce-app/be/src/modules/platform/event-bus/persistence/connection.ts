import { EventOutboxEntity } from "./entities/event-outbox.entity"
import { CreateEventOutbox1789800009000 } from "./migrations/1789800009000-create-event-outbox"

/** The entities of the event bus, for every connection that publishes events. */
export const eventBusEntities = [EventOutboxEntity]

/** The migrations of the event bus, in the order they run. */
export const eventBusMigrations = [CreateEventOutbox1789800009000]
