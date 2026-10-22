/** One row the relay reads from the outbox. */
export interface OutboxRow {
    /** The position of the row (a bigint arrives as text). */
    readonly id: string
    /** The topic the event travels on. */
    readonly topic: string
    /** The partition key. */
    readonly message_key: string
    /** The envelope, as the database returns the jsonb value. */
    readonly envelope: object
}
