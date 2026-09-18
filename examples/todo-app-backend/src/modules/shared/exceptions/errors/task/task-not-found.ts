import { AbstractException } from '../abstract';
import type { AbstractExceptionMetadata } from '../abstract';

/** Metadata for a task that cannot be resolved. */
export interface TaskNotFoundExceptionMetadata extends AbstractExceptionMetadata {
  /** The task id looked up. */
  taskId?: string;
}

export class TaskNotFoundException extends AbstractException {
  constructor({ taskId, ...metadata }: TaskNotFoundExceptionMetadata = {}) {
    super('The task does not exist.', 'TASK_NOT_FOUND', { taskId, ...metadata });
  }
}
