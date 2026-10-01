/** What purging lapsed sessions takes: the instant of the tick that asks. */
export interface PurgeLapsedSessionsRequest {
    /** Sessions that lapsed at or before this instant are deleted. */
    readonly at: Date
}

/** How many lapsed sessions were deleted. */
export interface PurgeLapsedSessionsResult {
    /** The number of session rows that went. */
    readonly purged: number
}
