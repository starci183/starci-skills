import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { CompletionAction, CompletionAuthority } from './completion-authority.contracts';
import { CompletionAuthorityRegistry } from './completion-authority.providers';
import { TaskRecord } from './types/task-record';
import { TaskService } from './task.service';

/** A future `share` feature's widened authority: any registered collaborator, not only the owner, may complete/reopen. */
class WidenedCompletionAuthority extends CompletionAuthority {
  constructor(private readonly collaborators: Set<string>) {
    super();
  }

  assertMayTransition(record: TaskRecord, actorId: string, _action: CompletionAction): void {
    if (record.owner === actorId || this.collaborators.has(actorId)) return;
    throw new Error('not authorized');
  }
}

describe('CompletionAuthorityRegistry', () => {
  it('br.task.single-owner (default): only the owner may complete or reopen; a stranger is refused', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');

    await expect(service.complete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(service.reopen(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
  });

  it('a registered widened authority lets a non-owner complete/reopen once registered', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');

    registry.register(new WidenedCompletionAuthority(new Set(['collaborator-1'])));

    const completed = await service.complete(record.id, 'collaborator-1');
    expect(completed.complete).toBe(true);
    const reopened = await service.reopen(record.id, 'collaborator-1');
    expect(reopened.complete).toBe(false);
  });

  it('delete stays owner-only through OwnershipGuard even after a widened CompletionAuthority is registered', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');
    registry.register(new WidenedCompletionAuthority(new Set(['collaborator-1'])));

    await expect(service.delete(record.id, 'collaborator-1')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
  });

  it('sds.task.ownership-guard.t-owner: with the default authority the owner passes the completion authority and the delete guard', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');

    const completed = await service.complete(record.id, 'owner-1');
    expect(completed.complete).toBe(true);
    const deleted = await service.delete(record.id, 'owner-1');
    expect(deleted.id).toBe(record.id);
  });

  it('sds.task.ownership-guard.t-collaborator: a widened authority proceeds with complete and reopen, while delete is still refused', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');
    registry.register(new WidenedCompletionAuthority(new Set(['collaborator-1'])));

    const completed = await service.complete(record.id, 'collaborator-1');
    expect(completed.complete).toBe(true);
    const reopened = await service.reopen(record.id, 'collaborator-1');
    expect(reopened.complete).toBe(false);
    await expect(service.delete(record.id, 'collaborator-1')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(service.findById(record.id)).resolves.toMatchObject({ id: record.id });
  });

  it('sds.task.ownership-guard.t-stranger: a stranger is refused on both paths before anything is written', async () => {
    const registry = new CompletionAuthorityRegistry();
    const service = new TaskService(createFakeEntityManager<TaskEntity>('id') as never, registry);
    const record = await service.create('owner-1', 'Ship it');

    await expect(service.complete(record.id, 'actor-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(service.delete(record.id, 'actor-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    const stored = await service.findById(record.id);
    expect(stored.complete).toBe(false);
    expect(stored.title).toBe('Ship it');
  });
});
