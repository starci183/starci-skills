/** One message to hand to a queue: written in the transaction of the change that caused it. */
export interface OutboxMessage {
    /** The name of the queue whose consumer will receive it. */
    readonly queue: string
    /** The stable id of the event; the pair (queue, event id) is unique, so writing it twice keeps one message. */
    readonly eventId: string
    /** The JSON payload the consumer parses. */
    readonly payload: object
    /** The first instant the message may be delivered; a later instant is a delayed message. */
    readonly availableAt: Date
}

/** A message a worker has claimed for delivery. */
export interface OutboxRecord {
    /** The row id. */
    readonly id: string
    /** The name of the queue. */
    readonly queue: string
    /** The stable event id. */
    readonly eventId: string
    /** The stored payload, not yet parsed. */
    readonly payload: unknown
    /** How many deliveries were started, this one included. */
    readonly attempts: number
}

/** What a worker asks for when it claims due messages. */
export interface ClaimDueParams {
    /** The current instant. */
    readonly at: Date
    /** The queues the worker has consumers for. */
    readonly queues: ReadonlyArray<string>
    /** The most messages one claim returns. */
    readonly limit: number
    /** How long a claimed message stays invisible to other workers before it is claimable again. */
    readonly visibilityMs: number
}

/** What a worker asks for when a delivery failed and should be tried again later. */
export interface RetryMessageParams {
    /** The row id. */
    readonly id: string
    /** The instant of the next delivery. */
    readonly at: Date
    /** The failure, by name and message. */
    readonly error: string
}

/** What a worker asks for when a message will not be delivered any more. */
export interface BuryMessageParams {
    /** The row id. */
    readonly id: string
    /** The last failure, by name and message. */
    readonly error: string
}
