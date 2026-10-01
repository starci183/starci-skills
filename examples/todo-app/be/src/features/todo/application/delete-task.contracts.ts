import type { TaskErrorCode } from "@modules/domain/task"
import type { Outcome } from "@modules/platform/primitives"

/** What deleting a task takes: its id. */
export interface DeleteTaskRequest {
    /** The task id. */
    readonly taskId: string
}

/** What a successful delete answers. */
export interface DeletedTask {
    /** Always true: a refused delete answers a refusal instead. */
    readonly deleted: boolean
}

/** The confirmation, or the refusal that names why the task stays. */
export type DeleteTaskResult = Outcome<DeletedTask, TaskErrorCode>
