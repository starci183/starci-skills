import type { ListTasksResult } from "../../application/list-tasks.contracts"
import type { ListTasksType } from "./dto/list-tasks.type"

/** Maps the listed tasks to the GraphQL types. */
export const toListTasksType = (result: ListTasksResult): Array<ListTasksType> =>
    result.tasks.map((task) => ({ taskId: task.taskId, title: task.title, complete: task.complete }))
