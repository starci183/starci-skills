import {
    Injectable 
} from "@nestjs/common"
import {
    CollaboratorCache 
} from "./collaborator-cache"

/** Contract naming the access subject task shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface AccessSubjectTask {
  readonly id: string;
  readonly owner: string;
}

/** Contract naming the access decision shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * contract.share.completion-guard-for-task's provider-side surface, implemented directly: `mayComplete`
 * and `mayDelete` each answer `{allowed, reason}` for a given actor and task, matching the contract's
 * shape `(actor, task) -> {allowed, reason}` exactly. `mayComplete` is also what ShareCompletionAuthority
 * (completion-authority.ts) delegates to when it is registered into task's CompletionAuthorityRegistry.
 *
 * `mayDelete` is true only for the owner, unconditionally - br.share.editor.no-delete - and is exposed
 * here for its own acceptance criterion's proof even though task's own TaskService.delete never calls it:
 * task already enforces delete through its own unconditional OwnershipGuard rather than through the
 * replaceable CompletionAuthorityRegistry (see task.service.ts's comment on the rev-2 split), so this
 * method's answer for a non-owner is always refusal by construction, never by a widened authority.
 */
@Injectable()
/** Injectable service owning the access logic the share capability exposes; wired by the capability's own module. */
export class AccessService {
    constructor(private readonly cache: CollaboratorCache) {}

    mayComplete(actorId: string, task: AccessSubjectTask): AccessDecision {
        if (task.owner === actorId) {
            return {
                allowed: true 
            }
        }
        if (this.cache.roleOf(task.id,
            actorId).role === "editor") {
            return {
                allowed: true 
            }
        }
        return {
            allowed: false, reason: "not the owner and not an accepted editor collaborator" 
        }
    }

    mayDelete(actorId: string, task: AccessSubjectTask): AccessDecision {
        if (task.owner === actorId) {
            return {
                allowed: true 
            }
        }
        return {
            allowed: false, reason: "delete is owner-only; no role sharing grants ever widens it" 
        }
    }
}
