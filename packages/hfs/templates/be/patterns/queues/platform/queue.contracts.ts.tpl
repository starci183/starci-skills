/** A recurring task: BullMQ upserts it by `id`, so every replica of an app may register it and the fleet still fires it once per interval. */
export interface QueueSchedulerDefinition {
    /** The queue the ticks go to; its processor handles every tick like any other job. */
    readonly queue: string
    /** The stable id of the scheduler. */
    readonly id: string
    /** The interval between two ticks, in milliseconds. */
    readonly everyMs: number
    /** The payload of every tick. */
    readonly payload?: object
}

/** One job as a handler receives it. */
export interface QueueDelivery {
    /** The BullMQ job id: the outbox row id of an enqueued job, the tick id of a scheduled one. */
    readonly id: string
    /** The queue. */
    readonly queue: string
    /** The payload the producer wrote. */
    readonly payload: object
    /** How many deliveries were started, this one included. */
    readonly attempt: number
}

/** Handles one delivery; a return completes the BullMQ job and a throw lets BullMQ retry it. */
export type QueueHandler = (delivery: QueueDelivery) => Promise<void>
