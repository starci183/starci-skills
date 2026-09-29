import {
    AbstractException,
} from "@modules/platform/errors/index"
import type {
    AbstractExceptionMetadata,
} from "@modules/platform/errors/index"

/** Metadata for a task that cannot be resolved. */
export interface TaskNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The task id looked up. */
  taskId?: string;
}

/** House refusal carrying code TASK_NOT_FOUND_EXCEPTION; every throw site attaches a metadata object naming the concrete ids the task not found refusal turned on. */
export class TaskNotFoundException extends AbstractException {
    constructor({ taskId, ...metadata }: TaskNotFoundExceptionMetadata = {
    }) {
        super("The task does not exist.",
            "TASK_NOT_FOUND_EXCEPTION",
            {
                taskId, ...metadata 
            })
    }
}
