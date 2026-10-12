/** A recurring task: pg_cron upserts it by `id`, so every replica of an app may register it and the deployment still fires it once per interval. */
export interface QueueSchedulerDefinition {
    /** The queue the ticks go to; its processor handles every tick like any other job. */
    readonly queue: string
    /** The stable id of the scheduler: the pg_cron job name. */
    readonly id: string
    /** The interval between two ticks, in milliseconds. */
    readonly everyMs: number
    /** The payload of every tick. */
    readonly payload?: object
}

/** One job as a handler receives it. */
export interface QueueDelivery {
    /** The job id: the outbox row id of an enqueued job, the pgmq message id of a scheduled tick. */
    readonly id: string
    /** The queue. */
    readonly queue: string
    /** The payload the producer wrote. */
    readonly payload: object
    /** How many deliveries were started, this one included (the pgmq read count). */
    readonly attempt: number
}

/** The handler of one queue: it receives every delivery of the queue; a return archives the message and a throw lets the worker retry it. */
export interface QueueHandler {
    /** The queue this handler consumes. */
    readonly queue: string
    /** Handles one delivery. */
    handle(delivery: QueueDelivery): Promise<void>
}
