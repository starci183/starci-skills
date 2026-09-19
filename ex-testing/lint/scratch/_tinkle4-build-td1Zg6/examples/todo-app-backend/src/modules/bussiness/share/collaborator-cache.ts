import {
    Injectable 
} from "@nestjs/common"
import {
    ShareRole 
} from "./types/invitation-record"

/**
 * br.share.revoke.on-read's "immediately, not by a sweep" guarantee, for the one call
 * (CompletionAuthority.assertMayTransition) that the seam contract fixes as synchronous - see
 * completion-authority.contracts.ts in bussiness/task: it returns `void`, not a Promise, so it cannot
 * itself await a database read. This cache is the in-process, synchronous mirror of "which (taskId,
 * personId) pairs currently hold an accepted invitation and at what role", written by InvitationService
 * at the exact moment its own Postgres write commits (accept adds, revoke removes), and hydrated from
 * Postgres once at boot (InvitationService.onModuleInit) so a process restart does not lose it. Expiry
 * never needs a cache entry: per sds.share.invitation-lifecycle's state machine, an accepted invitation
 * moves only to revoked, never spontaneously to expired, so this map is exact for as long as the process
 * that wrote it is alive.
 */
/** A named result contract for CollaboratorCache.roleOf, matching AccessService's own AccessDecision
 * convention (a named type, never an inline object/union return). */
export interface CollaboratorLookup {
  readonly role: ShareRole | null;
}

@Injectable()
/** Class for the collaborator cache concern the bussiness/share capability owns; the file header names the business rule it implements. */
export class CollaboratorCache {
    private readonly roles = new Map<string, ShareRole>()

    private key(taskId: string, personId: string): string {
        return `${taskId}:${personId}`
    }

    set(taskId: string, personId: string, role: ShareRole): void {
        this.roles.set(this.key(taskId,
            personId),
        role)
    }

    delete(taskId: string, personId: string): void {
        this.roles.delete(this.key(taskId,
            personId))
    }

    roleOf(taskId: string, personId: string): CollaboratorLookup {
        return {
            role: this.roles.get(this.key(taskId,
                personId)) ?? null 
        }
    }
}
