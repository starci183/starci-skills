import { QueueOutboxEntity } from "./entities/queue-outbox.entity"
import { CreateQueueOutbox1789800010000 } from "./migrations/1789800010000-create-queue-outbox"

/** The entities of the queues, for every connection that enqueues jobs. */
export const queueEntities = [QueueOutboxEntity]

/** The migrations of the queues, in the order they run. */
export const queueMigrations = [CreateQueueOutbox1789800010000]
