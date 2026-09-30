import type { EntityManager } from "typeorm"

/** A task as callers see it; completedAt is set if and only if complete is true. */
export interface TaskView {
    /** The task id. */
    readonly id: string
    /** The person who owns the task; bound at creation and never rewritten. */
    readonly owner: string
    /** The title. */
    readonly title: string
    /** Whether the task is complete. */
    readonly complete: boolean
    /** When the task was completed, null while it is open. */
    readonly completedAt: Date | null
}

/** What creating a task needs; the write joins the caller transaction. */
export interface CreateTaskParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person who will own the task. */
    readonly ownerId: string
    /** The title; blank after trimming is refused. */
    readonly title: string
}

/** What reading one task needs. */
export interface FindTaskParams {
    /** The task id. */
    readonly id: string
}

/** What listing the tasks of one owner needs. */
export interface ListTasksParams {
    /** The owner. */
    readonly ownerId: string
}

/** What completing or reopening a task needs; the write joins the caller transaction. */
export interface TransitionTaskParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The task, as read before the decision. */
    readonly task: TaskView
    /** The instant of the transition. */
    readonly at: Date
}

/** What deleting a task needs; the write joins the caller transaction. */
export interface DeleteTaskParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The task id. */
    readonly id: string
}

/** The answer of a task lookup: the task, or null when there is none with that id. */
export type TaskLookupResult = TaskView | null
