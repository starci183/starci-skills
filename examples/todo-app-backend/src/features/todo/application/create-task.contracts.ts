import type { TaskErrorCode } from "@modules/domain/task"
import type { Outcome } from "@modules/platform/primitives"

/** What creating a task takes: its title. */
export interface CreateTaskRequest {
    /** The title; blank after trimming is refused. */
    readonly title: string
}

/** The task that was created. */
export interface CreatedTask {
    /** The new task id. */
    readonly taskId: string
    /** The stored, trimmed title. */
    readonly title: string
}

/** The created task, or the refusal that names why nothing was written. */
export type CreateTaskResult = Outcome<CreatedTask, TaskErrorCode>
