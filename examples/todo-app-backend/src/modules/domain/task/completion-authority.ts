import { TaskRecord } from './task-record.types';
import { TaskForbiddenException } from './task.exception';

export type CompletionAction = 'complete' | 'reopen';

/**
 * br.task.single-owner rev 2 split delete from complete/reopen: OwnershipGuard remains the sole,
 * unconditional authority for delete, while who may complete or reopen a task is this separate,
 * replaceable seam. `assertMayTransition` throws an AbstractException subclass (TaskForbiddenException,
 * or a widened authority's own) to refuse the transition.
 */
export interface CompletionAuthority {
  assertMayTransition(record: TaskRecord, actorId: string, action: CompletionAction): void;
}

/**
 * The default: only the owner may complete or reopen their own task. This is what br.task.single-owner
 * describes today, before any `share` authority is registered.
 */
export class OwnerOnlyCompletionAuthority implements CompletionAuthority {
  assertMayTransition(record: TaskRecord, actorId: string): void {
    if (record.owner !== actorId) {
      throw new TaskForbiddenException();
    }
  }
}
