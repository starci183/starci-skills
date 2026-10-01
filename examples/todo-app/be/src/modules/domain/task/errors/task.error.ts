import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the task capability, also the refusals of the task operations that other capabilities take part in. */
export enum TaskErrorCode {
    /** The task does not exist. */
    NotFound = "TASK_NOT_FOUND",
    /** The caller may not touch this task. */
    Forbidden = "TASK_FORBIDDEN",
    /** The title is blank after trimming. */
    TitleRequired = "TASK_TITLE_REQUIRED",
    /** The plan of the caller has no room for another active task; the cap and the upgrade path ride in the params. */
    PlanCapExceeded = "TASK_PLAN_CAP_EXCEEDED",
}

/** How each task code travels. */
export const TASK_ERROR_KINDS: Record<TaskErrorCode, ErrorKind> = {
    [TaskErrorCode.NotFound]: "not-found",
    [TaskErrorCode.Forbidden]: "forbidden",
    [TaskErrorCode.TitleRequired]: "invalid",
    [TaskErrorCode.PlanCapExceeded]: "forbidden",
}

/** The one error class of the task capability. */
export class TaskError extends DomainError<TaskErrorCode> {}
