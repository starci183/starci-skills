import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a mutation attempted by someone other than the task's owner (or an accepted editor). */
export interface TaskForbiddenExceptionMetadata extends DomainErrorMetadata {
  /** The task id the actor attempted to mutate. */
  taskId?: string;
  /** The actor who was refused. */
  actorId?: string;
}

/** br.task.single-owner: only the owner may complete or delete a task; a stranger's attempt is refused. */
export class TaskForbiddenException extends DomainError {
    constructor({ taskId, actorId, ...metadata }: TaskForbiddenExceptionMetadata = {
    }) {
        super("TASK_FORBIDDEN_EXCEPTION",
            "This task belongs to somebody else.",
            {
                metadata: {
                    taskId, actorId, ...metadata 
                } 
            })
    }
}
