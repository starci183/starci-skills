/** One row a claim returns. */
export interface ClaimedRow {
    /** The id of the job row. */
    readonly id: string
    /** The kind of the job. */
    readonly kind: string
    /** The fencing token after the claim (a bigint arrives as text). */
    readonly fencing_token: string
    /** The last recorded step, or null. */
    readonly current_step: string | null
    /** The payload, as the database returns the jsonb value. */
    readonly payload: object
}
