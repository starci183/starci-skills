import type { QueueHandler, QueueSchedulerDefinition } from "./queue.contracts"

/** BullMQ as the queue capability sees it: the one port the BullMQ client implements. */
export interface QueueTransport {
    /** Adds the job to its queue with `jobId`; adding an id BullMQ already holds changes nothing, so a repeated relay pass is harmless. */
    add(queue: string, jobId: string, payload: object): Promise<void>
    /** Creates or updates a job scheduler by its id. */
    upsertScheduler(scheduler: QueueSchedulerDefinition): Promise<void>
    /** Starts a worker of the queue the handler names that runs it for every job, `concurrency` at a time. */
    work(handler: QueueHandler, concurrency: number): Promise<void>
    /** Resolves after `ms` milliseconds: the only clock of the relay loop. */
    wait(ms: number): Promise<void>
    /** Closes every queue and worker. */
    close(): Promise<void>
}
