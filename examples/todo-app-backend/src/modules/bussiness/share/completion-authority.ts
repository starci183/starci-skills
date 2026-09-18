import { Injectable, OnModuleInit } from '@nestjs/common';
import { CompletionAuthority, CompletionAuthorityRegistry } from '@modules/bussiness/task';
import type { TaskRecord } from '@modules/bussiness/task';

/** Mirrors bussiness/task's own (unexported) CompletionAction literal union structurally - the abstract
 * method's override only needs a structurally compatible type, not the name itself. */
type CompletionAction = 'complete' | 'reopen';
import { TaskForbiddenException } from '@modules/shared/exceptions';
import { AccessService } from './access.service';

/**
 * gap.task.collaborator-completion / contract.share.completion-guard-for-task: the CompletionAuthority
 * subclass share registers into task's CompletionAuthorityRegistry (the sanctioned seam - see
 * task.module.ts's own comment on why this registry, rather than task importing share, is how the two
 * capabilities meet). The owner keeps completing/reopening unconditionally; a non-owner is allowed only
 * when AccessService.mayComplete says so (an accepted editor collaborator on this exact task, re-checked
 * live through the synchronous CollaboratorCache - see that file's comment on why this can be synchronous
 * at all). Delete is untouched: OwnershipGuard remains task's own, sole, unconditional authority for it
 * (br.share.editor.no-delete), so registering this authority never widens who may delete.
 */
export class ShareCompletionAuthority extends CompletionAuthority {
  constructor(private readonly access: AccessService) {
    super();
  }

  assertMayTransition(record: TaskRecord, actorId: string, _action: CompletionAction): void {
    const decision = this.access.mayComplete(actorId, { id: record.id, owner: record.owner });
    if (!decision.allowed) {
      throw new TaskForbiddenException({ taskId: record.id, actorId });
    }
  }
}

/**
 * Registers ShareCompletionAuthority once, at boot, into the single app-wide
 * CompletionAuthorityRegistry instance (see share.module.ts's comment on why importing
 * `TaskModule.register()` with the same options as app.module.ts's own call shares that one instance
 * instead of constructing a second, independent module graph).
 */
@Injectable()
export class ShareCompletionAuthoritySetup implements OnModuleInit {
  constructor(
    private readonly registry: CompletionAuthorityRegistry,
    private readonly access: AccessService,
  ) {}

  onModuleInit(): void {
    this.registry.register(new ShareCompletionAuthority(this.access));
  }
}
