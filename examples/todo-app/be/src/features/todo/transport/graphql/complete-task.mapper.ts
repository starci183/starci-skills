import type { CompleteTaskRequest, CompletedTask } from "../../application/complete-task.contracts"
import type { CompleteTaskInput } from "./dto/complete-task.input"
import type { CompleteTaskType } from "./dto/complete-task.type"

/** Maps the GraphQL input to the command request. */
export const toCompleteTaskRequest = (input: CompleteTaskInput): CompleteTaskRequest => ({ taskId: input.id })

/** Maps the transitioned task to the GraphQL type. */
export const toCompleteTaskType = (task: CompletedTask): CompleteTaskType => ({
    taskId: task.taskId,
    complete: task.complete,
})
