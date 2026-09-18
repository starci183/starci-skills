import { AbstractException } from '../../platform/errors';

export class TaskNotFoundException extends AbstractException {
  constructor() {
    super('The task does not exist.', 'TASK_NOT_FOUND');
  }
}

/** br.task.single-owner: only the owner may complete or delete a task; a stranger's attempt is refused. */
export class TaskForbiddenException extends AbstractException {
  constructor() {
    super('This task belongs to somebody else.', 'TASK_FORBIDDEN');
  }
}

/** br.task.title.required: a task is created only with a non-empty, trimmed title. */
export class TaskTitleRequiredException extends AbstractException {
  constructor() {
    super('A task needs a non-empty title.', 'TASK_TITLE_REQUIRED');
  }
}
