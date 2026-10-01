import type { CreateTaskRequest, CreatedTask } from "../../application/create-task.contracts"
import type { CreateTaskInput } from "./dto/create-task.input"
import type { CreateTaskType } from "./dto/create-task.type"

/** Maps the GraphQL input to the command request. */
export const toCreateTaskRequest = (input: CreateTaskInput): CreateTaskRequest => ({ title: input.title })

/** Maps the created task to the GraphQL type. */
export const toCreateTaskType = (created: CreatedTask): CreateTaskType => ({
    taskId: created.taskId,
    title: created.title,
})
