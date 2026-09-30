import type { TaskErrorCode } from "@modules/domain/task"
import type { Outcome } from "@modules/platform/primitives"

/** What completing a task takes: its id. */
export interface CompleteTaskRequest {
    /** The task id. */
    readonly taskId: string
}

/** The task after the transition. */
export interface CompletedTask {
    /** The task id. */
    readonly taskId: string
    /** Whether the task is complete. */
    readonly complete: boolean
}

/** The task after the transition, or the refusal that names why it was not touched. */
export type CompleteTaskResult = Outcome<CompletedTask, TaskErrorCode>
