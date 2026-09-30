import type { TaskCountsResult } from "../../application/task-counts.contracts"
import type { TaskCountsType } from "./dto/task-counts.type"

/** Maps the counts to the GraphQL type. */
export const toTaskCountsType = (counts: TaskCountsResult): TaskCountsType => ({
    open: counts.open,
    complete: counts.complete,
})
