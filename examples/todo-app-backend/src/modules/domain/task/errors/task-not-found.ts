import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a task that cannot be resolved. */
export interface TaskNotFoundExceptionMetadata extends DomainErrorMetadata {
  /** The task id looked up. */
  taskId?: string;
}

/** House refusal carrying code TASK_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the task not found refusal turned on. */
export class TaskNotFoundException extends DomainError {
    constructor({ taskId, ...metadata }: TaskNotFoundExceptionMetadata = {
    }) {
        super("TASK_NOT_FOUND_EXCEPTION",
            "The task does not exist.",
            {
                metadata: {
                    taskId, ...metadata 
                } 
            })
    }
}
