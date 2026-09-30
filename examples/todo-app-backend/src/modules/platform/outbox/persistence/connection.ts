import { PRIMARY_CONNECTION } from "@modules/platform/database"
import { OutboxMessageEntity } from "./entities/outbox-message.entity"
import { CreateOutboxMessages1758400000002 } from "./migrations/1758400000002-create-outbox-messages"

/** The connection that holds the tables of the outbox capability. */
export const CONNECTION = PRIMARY_CONNECTION

/** The entities of the outbox capability, for the connection that holds them. */
export const outboxEntities = [OutboxMessageEntity]

/** The migrations of the outbox capability, in the order they run. */
export const outboxMigrations = [CreateOutboxMessages1758400000002]
