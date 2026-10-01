import type { TaskView } from "../task.contracts"
import type { TaskEntity } from "./entities/task.entity"

/** Maps a task row to the view callers get. */
export const toTaskView = (row: TaskEntity): TaskView => ({
    id: row.id,
    owner: row.owner,
    title: row.title,
    complete: row.complete,
    completedAt: row.completedAt,
})
