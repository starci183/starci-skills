import {
    DomainError,
} from "@modules/platform/errors/index"
import type {
    DomainErrorMetadata,
} from "@modules/platform/errors/index"

/** Type alias naming the task title required exception metadata set task-title-required switches on; a new member is added here once, not scattered as literals. */
export type TaskTitleRequiredExceptionMetadata = DomainErrorMetadata;

/** br.task.title.required: a task is created only with a non-empty, trimmed title. */
export class TaskTitleRequiredException extends DomainError {
    constructor(metadata: TaskTitleRequiredExceptionMetadata = {
    }) {
        super("TASK_TITLE_REQUIRED_EXCEPTION",
            "A task needs a non-empty title.",
            {
                metadata: metadata 
            })
    }
}
