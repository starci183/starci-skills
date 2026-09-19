import {
    AbstractException 
} from "../abstract"
import type {
    AbstractExceptionMetadata 
} from "../abstract"

/** Type alias naming the task title required exception metadata set task-title-required switches on; a new member is added here once, not scattered as literals. */
export type TaskTitleRequiredExceptionMetadata = AbstractExceptionMetadata;

/** br.task.title.required: a task is created only with a non-empty, trimmed title. */
export class TaskTitleRequiredException extends AbstractException {
    constructor(metadata: TaskTitleRequiredExceptionMetadata = {
    }) {
        super("A task needs a non-empty title.",
            "TASK_TITLE_REQUIRED_EXCEPTION",
            metadata)
    }
}
