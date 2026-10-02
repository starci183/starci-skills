import { QueueOutboxEntity } from "./entities/queue-outbox.entity"
import { CreateQueueOutbox@@epochMs13@@ } from "./migrations/@@epochMs13@@-create-queue-outbox"

/** The entities of the queues, for every connection that enqueues jobs. */
export const queueEntities = [QueueOutboxEntity]

/** The migrations of the queues, in the order they run. */
export const queueMigrations = [CreateQueueOutbox@@epochMs13@@]
