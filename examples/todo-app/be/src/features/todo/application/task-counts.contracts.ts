/** Counting the caller tasks takes no input. */
export type TaskCountsRequest = Readonly<Record<string, never>>

/** How many of the caller own tasks are open and complete. */
export interface TaskCountsResult {
    /** Tasks not yet complete. */
    readonly open: number
    /** Tasks complete. */
    readonly complete: number
}
