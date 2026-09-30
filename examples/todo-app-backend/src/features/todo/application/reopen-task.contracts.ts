import type { TaskErrorCode } from "@modules/domain/task"
import type { Outcome } from "@modules/platform/primitives"

/** What reopening a task takes: its id. */
export interface ReopenTaskRequest {
    /** The task id. */
    readonly taskId: string
}

/** The task after the transition. */
export interface ReopenedTask {
    /** The task id. */
    readonly taskId: string
    /** Whether the task is complete. */
    readonly complete: boolean
}

/** The task after the transition, or the refusal that names why it was not touched. */
export type ReopenTaskResult = Outcome<ReopenedTask, TaskErrorCode>
