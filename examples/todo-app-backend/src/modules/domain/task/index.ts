import { TaskEntity } from "./persistence/entities/task.entity"
import { CreateTasksTable1758160000001 } from "./persistence/migrations/1758160000001-create-tasks-table"

/** The entities of the task capability, for the connection that holds them. */
export const taskEntities = [TaskEntity]

/** The migrations of the task capability, in the order they run. */
export const taskMigrations = [CreateTasksTable1758160000001]

export { TASK_ERROR_KINDS, TaskError, TaskErrorCode } from "./errors/task.error"
export { TASK_MESSAGES } from "./messages/task.messages"
export type { TaskView } from "./task.contracts"
export { TaskModule } from "./task.module"
export { TaskService } from "./task.service"
