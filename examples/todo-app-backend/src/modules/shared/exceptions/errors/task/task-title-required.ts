import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

export type TaskTitleRequiredExceptionMetadata = AbstractExceptionMetadata;

/** br.task.title.required: a task is created only with a non-empty, trimmed title. */
export class TaskTitleRequiredException extends AbstractException {
  constructor(metadata: TaskTitleRequiredExceptionMetadata = {}) {
    super('A task needs a non-empty title.', 'TASK_TITLE_REQUIRED', metadata);
  }
}
