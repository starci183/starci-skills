import type { EntityManager } from "typeorm"
import type { QueueHandler } from "./queue.contracts"

/** Supabase Queues (pgmq) as the queue capability sees it: the one port the pgmq client implements. */
export interface QueueTransport {
    /** Sends the job to its queue with `jobId` in the message, inside the transaction `tx`: the message exists exactly when `tx` commits. */
    add(tx: EntityManager, queue: string, jobId: string, payload: object): Promise<void>
    /** Starts a worker of the queue the handler names that runs it for every message, `concurrency` at a time. */
    work(handler: QueueHandler, concurrency: number): Promise<void>
    /** Resolves after `ms` milliseconds: the only clock of the relay and worker loops. */
    wait(ms: number): Promise<void>
    /** Stops every worker and waits for the deliveries they run. */
    close(): Promise<void>
}
