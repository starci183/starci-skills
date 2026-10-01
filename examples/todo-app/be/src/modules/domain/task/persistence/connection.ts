import { TaskEntity } from "./entities/task.entity"
import { CreateTasksTable1758160000001 } from "./migrations/1758160000001-create-tasks-table"

/** The entities of the task capability, for the connection that holds them. */
export const taskEntities = [TaskEntity]

/** The migrations of the task capability, in the order they run. */
export const taskMigrations = [CreateTasksTable1758160000001]
