import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Metadata for a mutation attempted by someone other than the task's owner (or an accepted editor). */
export interface TaskForbiddenExceptionMetadata extends AbstractExceptionMetadata {
  /** The task id the actor attempted to mutate. */
  taskId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** br.task.single-owner: only the owner may complete or delete a task; a stranger's attempt is refused. */
export class TaskForbiddenException extends AbstractException {
    constructor({ taskId, actorId, ...metadata }: TaskForbiddenExceptionMetadata = {
    }) {
        super("This task belongs to somebody else.",
            "TASK_FORBIDDEN_EXCEPTION",
            {
                taskId, actorId, ...metadata 
            })
    }
}
