/** One row of the queue outbox: the job a producer wrote, as the outbox write and the relay read it back. */
export interface QueueRow {
    /** The row id: it is the job id the pgmq message carries, so a processor can recognize a job it already ran. */
    readonly id: string
    /** The queue the job goes to. */
    readonly queue: string
    /** The payload, as the database returns the jsonb value. */
    readonly payload: object
}

/** The message body the transport sends to pgmq: the job id and the payload of the producer. */
export interface QueueMessageRow {
    /** The outbox row id of an enqueued job; absent on the tick of a scheduler. */
    readonly jobId?: string
    /** The payload the producer wrote. */
    readonly payload?: object
}

/** One message `pgmq.read` answers. */
export interface PgmqMessageRow {
    /** The pgmq message id (a bigint, which the driver returns as text). */
    readonly msg_id: string
    /** How many times the message was read, this read included: the attempt of the delivery. */
    readonly read_ct: number
    /** The message body. */
    readonly message: QueueMessageRow
}
