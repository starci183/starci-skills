import { EventOutboxEntity } from "./entities/event-outbox.entity"
import { CreateEventOutbox@@epochMs13@@ } from "./migrations/@@epochMs13@@-create-event-outbox"

/** The entities of the event bus, for every connection that publishes events. */
export const eventBusEntities = [EventOutboxEntity]

/** The migrations of the event bus, in the order they run. */
export const eventBusMigrations = [CreateEventOutbox@@epochMs13@@]
