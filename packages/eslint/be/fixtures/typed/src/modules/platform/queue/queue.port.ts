import type { EntityManager } from "typeorm"

/** The outbox of the queues: a producer writes a job row in the caller's transaction, the relay hands it to BullMQ. */
export interface QueueOutbox {
    write(tx: EntityManager, queue: string, payload: object): Promise<void>
}
