import type { ReopenTaskRequest, ReopenedTask } from "../../application/reopen-task.contracts"
import type { ReopenTaskInput } from "./dto/reopen-task.input"
import type { ReopenTaskType } from "./dto/reopen-task.type"

/** Maps the GraphQL input to the command request. */
export const toReopenTaskRequest = (input: ReopenTaskInput): ReopenTaskRequest => ({ taskId: input.id })

/** Maps the transitioned task to the GraphQL type. */
export const toReopenTaskType = (task: ReopenedTask): ReopenTaskType => ({
    taskId: task.taskId,
    complete: task.complete,
})
