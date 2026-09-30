import { builder } from "@starci/jest-preset"
import type { TaskView } from "@modules/domain/task"

/** The instant the task specs run at. */
export const TASK_AT = "2026-09-30T10:00:00.000Z"

/** An open task t-1 of owner-1 (row and view have the same shape); override the owner, title or completion a spec is about. */
export const taskRow = builder<TaskView>({ id: "t-1", owner: "owner-1", title: "Write", complete: false, completedAt: null })

/** The task t-1 of owner-1 after it was completed at {@link TASK_AT}. */
export const completedTaskRow = (overrides: Partial<TaskView> = {}): TaskView =>
    taskRow({ complete: true, completedAt: new Date(TASK_AT), ...overrides })
