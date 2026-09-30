import type { TaskErrorCode } from "@modules/domain/task"
import type { Outcome } from "@modules/platform/primitives"

/** What creating a task for a person needs. */
export interface CreateTaskflowParams {
    /** The person who will own the task. */
    readonly ownerId: string
    /** The title; blank after trimming is refused. */
    readonly title: string
}

/** The created task, or the refusal that names why nothing was written. */
export type CreateTaskflowResult = Outcome<{ readonly taskId: string; readonly title: string }, TaskErrorCode>

/** What completing a task needs. */
export interface CompleteTaskflowParams {
    /** The person who completes; the owner or an accepted editor. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
}

/** The task after completing, or the refusal that names why it was not touched. */
export type CompleteTaskflowResult = Outcome<{ readonly taskId: string; readonly complete: boolean }, TaskErrorCode>

/** What reopening a task needs. */
export interface ReopenTaskflowParams {
    /** The person who reopens; the owner or an accepted editor. */
    readonly actorId: string
    /** The task. */
    readonly taskId: string
}

/** The task after reopening, or the refusal that names why it was not touched. */
export type ReopenTaskflowResult = Outcome<{ readonly taskId: string; readonly complete: boolean }, TaskErrorCode>

/** What reading the plan usage of a person needs. */
export interface PlanUsageParams {
    /** The person. */
    readonly personId: string
}

/** The plan of a person against the active tasks the person holds. */
export interface PlanUsage {
    /** The effective plan: free or paid. */
    readonly plan: string
    /** How many active tasks the plan allows, null on the paid plan. */
    readonly cap: number | null
    /** How many active tasks the person holds now. */
    readonly activeCount: number
}
