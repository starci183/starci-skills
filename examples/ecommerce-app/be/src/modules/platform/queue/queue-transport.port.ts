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

/** The Redis options every queue and worker of the app shares. */
export interface BullmqConnection {
    /** The key prefix of the app. */
    readonly prefix: string
    /** The Redis the driver connects to. */
    readonly connection: {
        readonly host: string
        readonly port: number
        readonly maxRetriesPerRequest: number | null
    }
}

/** The options a worker is built with: the shared connection plus its concurrency. */
export interface BullmqWorkerOptions extends BullmqConnection {
    /** How many jobs the worker runs at a time. */
    readonly concurrency: number
}

/** The options the transport fixes on every job it adds. */
export interface BullmqJobOptions {
    /** The id BullMQ dedupes on: the outbox row id. */
    readonly jobId: string
    /** How many times BullMQ tries the job. */
    readonly attempts: number
    /** The wait between two tries. */
    readonly backoff: { readonly type: string; readonly delay: number }
    /** How long a finished job is kept. */
    readonly removeOnComplete: { readonly age: number }
}

/** The job a scheduler fires. */
export interface BullmqJobTemplate {
    /** The job name, which is the queue name. */
    readonly name: string
    /** The payload of every tick. */
    readonly data: object
    /** The options of every tick. */
    readonly opts: { readonly attempts: number }
}

/** A queue as the transport uses it. */
export interface BullmqQueue {
    /** Adds the job; an id BullMQ already holds makes the add a no-op. */
    add(name: string, payload: object, options: BullmqJobOptions): Promise<unknown>
    /** Creates or updates the scheduler by its id. */
    upsertJobScheduler(
        id: string,
        repeat: { readonly every: number },
        template: BullmqJobTemplate,
    ): Promise<unknown>
    /** Closes the queue. */
    close(): Promise<void>
}

/** A job as a worker receives it: the fields the transport translates into a QueueDelivery. */
export interface BullmqJob {
    /** The job id; a tick the scheduler fires can have none. */
    readonly id?: string
    /** The payload the producer wrote. */
    readonly data: object
    /** How many deliveries were started before this one. */
    readonly attemptsMade: number
}

/** A worker as the transport uses it. */
export interface BullmqWorker {
    /** Stops the worker; `force` drops the jobs it is still running. */
    close(force?: boolean): Promise<void>
}

/** Builds the BullMQ objects; the module provides it so a spec can double it through the injection token. */
export interface QueueFactory {
    /** The queue of the name over the shared connection. */
    queue(name: string, options: BullmqConnection): BullmqQueue
    /** A worker that runs the processor for every job of the queue. */
    worker(name: string, processor: (job: BullmqJob) => Promise<void>, options: BullmqWorkerOptions): BullmqWorker
}
