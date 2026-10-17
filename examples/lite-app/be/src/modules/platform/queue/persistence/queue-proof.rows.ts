/** The outbox identity of a pending message. */
export interface OutboxIdRow {
    /** The database identity of this persisted row. */
    readonly id: string
}
/** A named pg_cron registration. */
export interface ScheduleRow {
    /** The identity of the named cron registration. */
    readonly jobid: string
    /** The cron expression stored by the migration. */
    readonly schedule: string
    /** The SQL command the scheduler executes. */
    readonly command: string
}
/** A PostgreSQL count returned as text. */
export interface TickCountRow {
    /** The number of matching messages, returned as text. */
    readonly count: string
}
/** The inbox identity referenced by a calendar job. */
export interface CalendarReceiptIdRow {
    /** The database identity of this persisted row. */
    readonly id: string
}
/** The persisted consumption instant of an inbox delivery. */
export interface CalendarReceiptRow extends CalendarReceiptIdRow {
    /** The consumption instant, or null before the deferred processor runs. */
    readonly processed_at: Date | null
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
/** A pgmq message observed by the booking proof. */
export interface BookingMessageRow {
    /** The pgmq message identity, returned as text. */
    readonly msg_id: string
    /** The typed envelope sent to pgmq. */
    readonly message: BookingEnvelopeRow
}
/** The message published for a committed calendar outbox job. */
export interface CalendarMessageRow {
    /** The typed envelope sent to pgmq. */
    readonly message: CalendarEnvelopeRow
}
/** Whether a calendar inbox delivery has been consumed. */
export interface CalendarProcessedRow {
    /** Whether the deferred consumer has completed this receipt. */
    readonly processed: boolean
}

/** All receipt identities associated with the delivery being cleaned up. */
export interface CalendarReceiptIdsRow {
    /** Every matching receipt, including duplicates left by a failed proof. */
    readonly ids: Array<string>
}

/** The booking reference stored in the message's JSON payload. */
export interface BookingPayloadRow {
    /** The booking whose reminder was enqueued. */
    readonly bookingId: string
}
/** The booking envelope decoded from the pgmq JSON message. */
export interface BookingEnvelopeRow {
    /** The outbox identity carried through the transport unchanged. */
    readonly jobId: string
    /** The booking reference serialized by the producer. */
    readonly payload: BookingPayloadRow
}
/** The calendar envelope decoded from the pgmq JSON message. */
export interface CalendarEnvelopeRow {
    /** The outbox identity carried through the transport unchanged. */
    readonly jobId: string
    /** The durable receipt reference serialized by the producer. */
    readonly payload: CalendarReceiptReferenceRow
}
