import type { DeleteTaskRequest, DeletedTask } from "../../application/delete-task.contracts"
import type { DeleteTaskInput } from "./dto/delete-task.input"
import type { DeleteTaskType } from "./dto/delete-task.type"

/** Maps the GraphQL input to the command request. */
export const toDeleteTaskRequest = (input: DeleteTaskInput): DeleteTaskRequest => ({ taskId: input.id })

/** Maps the delete confirmation to the GraphQL type. */
export const toDeleteTaskType = (deleted: DeletedTask): DeleteTaskType => ({ deleted: deleted.deleted })
