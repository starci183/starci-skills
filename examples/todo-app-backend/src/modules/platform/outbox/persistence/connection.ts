import { OutboxMessageEntity } from "./entities/outbox-message.entity"
import { CreateOutboxMessages1758400000002 } from "./migrations/1758400000002-create-outbox-messages"

/** The entities of the outbox capability, for the connection that holds them. */
export const outboxEntities = [OutboxMessageEntity]

/** The migrations of the outbox capability, in the order they run. */
export const outboxMigrations = [CreateOutboxMessages1758400000002]
