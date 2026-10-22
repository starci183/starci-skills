/** One row the relay reads from the queue outbox. */
export interface QueueRow {
    /** The row id: it is the BullMQ job id, so a repeated relay pass adds nothing. */
    readonly id: string
    /** The queue the job goes to. */
    readonly queue: string
    /** The payload, as the database returns the jsonb value. */
    readonly payload: object
}
