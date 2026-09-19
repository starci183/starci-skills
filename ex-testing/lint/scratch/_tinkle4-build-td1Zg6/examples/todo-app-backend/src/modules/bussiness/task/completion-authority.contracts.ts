import {
    TaskRecord 
} from "./types/task-record"
import {
    TaskForbiddenException 
} from "@modules/shared/exceptions/errors/task/task-forbidden"


/** Type alias naming the completion action set completion-authority.contracts switches on; a new member is added here once, not scattered as literals. */
export type CompletionAction = "complete" | "reopen";

/**
 * br.task.single-owner rev 2 split delete from complete/reopen: OwnershipGuard remains the sole,
 * unconditional authority for delete, while who may complete or reopen a task is this separate,
 * replaceable seam. `assertMayTransition` throws an AbstractException subclass (TaskForbiddenException,
 * or a widened authority's own) to refuse the transition. This is an abstract class rather than an
 * interface so a concrete authority is a real, named extension point, matching this codebase's own
 * convention for ports (KeycloakClient, AbstractException) over plain interfaces.
 */
export abstract class CompletionAuthority {
  abstract assertMayTransition(record: TaskRecord, actorId: string, action: CompletionAction): void;
}

/**
 * The default: only the owner may complete or reopen their own task. This is what br.task.single-owner
 * describes today, before any `share` authority is registered.
 */
export class OwnerOnlyCompletionAuthority extends CompletionAuthority {
    assertMayTransition(record: TaskRecord, actorId: string): void {
        if (record.owner !== actorId) {
            throw new TaskForbiddenException({
            })
        }
    }
}
