/** Persisted job progress used to verify fencing and redispatch. */
export interface JobSnapshotRow {
    /** The database identity of this persisted row. */
    readonly id: string
    /** The persisted lifecycle state of this job. */
    readonly status: string
    /** The current claim token, returned as text. */
    readonly fencing_token: string
    /** The last completed processing step, or null. */
    readonly current_step: string | null
    /** The last failure code, or null after successful completion. */
    readonly error: string | null
}
