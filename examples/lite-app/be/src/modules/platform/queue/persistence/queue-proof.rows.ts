/** The outbox identity of a pending message. */
export interface OutboxIdRow {
    /** The database identity of this persisted row. */
    readonly id: string
}
/** A queue payload references the durable receipt. */
export interface CalendarReceiptReferenceRow {
    /** The durable calendar inbox row this job consumes. */
    readonly receiptId: string
}
/** The committed calendar outbox job. */
export interface RecordedJobRow {
    /** The database identity of this persisted row. */
    readonly id: string
    /** The durable message payload returned by PostgreSQL. */
    readonly payload: CalendarReceiptReferenceRow
}
/** An outbox row observed by the enqueue and relay proofs. */
export interface BookingOutboxRow {
    /** The database identity of this persisted row. */
    readonly id: string
    /** The durable message payload returned by PostgreSQL. */
    readonly payload: BookingPayloadRow
    /** The send instant, or null while the outbox row waits for relay. */
    readonly sent_at: Date | null
}
/** The booking reference stored in the message's JSON payload. */
export interface BookingPayloadRow {
    /** The booking whose reminder was enqueued. */
    readonly bookingId: string
}
