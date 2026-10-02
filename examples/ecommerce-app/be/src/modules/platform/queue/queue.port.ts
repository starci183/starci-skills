import type { EntityManager } from "typeorm"
import type { QueueHandler } from "./queue.contracts"

/** The queue outbox: a typed producer writes a job row in the transaction of the caller, the relay hands it to BullMQ after commit. */
export interface QueueOutbox {
    /** Writes the job in the outbox of the transaction `tx`, so it exists exactly when the change that needs it commits. */
    write(tx: EntityManager, queue: string, payload: object): Promise<void>
}

/** Where a processor registers the handler of its queue; the workers start when the app has registered every handler. */
export interface QueueWorkerRegistry {
    /** Registers the handler under the queue it names; a second handler for the same queue replaces the first. */
    add(handler: QueueHandler): void
}
