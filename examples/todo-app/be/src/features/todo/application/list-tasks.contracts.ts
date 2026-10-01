/** Listing the caller tasks takes no input. */
export type ListTasksRequest = Readonly<Record<string, never>>

/** One task in the list. */
export interface TaskSummary {
    /** The task id. */
    readonly taskId: string
    /** The title. */
    readonly title: string
    /** Whether the task is complete. */
    readonly complete: boolean
}

/** The tasks the caller owns. */
export interface ListTasksResult {
    /** The tasks, at most the list bound of the task capability. */
    readonly tasks: ReadonlyArray<TaskSummary>
}
