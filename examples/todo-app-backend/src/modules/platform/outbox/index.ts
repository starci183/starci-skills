import { OutboxMessageEntity } from "./persistence/entities/outbox-message.entity"
import { CreateOutboxMessages1758400000002 } from "./persistence/migrations/1758400000002-create-outbox-messages"

/** The entities of the outbox capability, for the connection that holds them. */
export const outboxEntities = [OutboxMessageEntity]

/** The migrations of the outbox capability, in the order they run. */
export const outboxMigrations = [CreateOutboxMessages1758400000002]

export type { OutboxMessage, OutboxRecord } from "./outbox.contracts"
export { InjectOutbox } from "./outbox.decorators"
export { OutboxModule } from "./outbox.module"
export type { Outbox } from "./outbox.port"
