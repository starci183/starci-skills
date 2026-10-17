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
