import { Repository } from 'typeorm';
import { TaskEntity } from '../../integrations/postgres';
import { CompletionAction, CompletionAuthority } from './completion-authority';
import { CompletionAuthorityRegistry } from './completion-authority.registry';
import { TaskRecord } from './task-record.types';
import { TaskRepository } from './task.repository';

class FakeTaskRepository {
  private readonly byId = new Map<string, TaskEntity>();

  async findOneBy(where: { id: string }): Promise<TaskEntity | null> {
    return this.byId.get(where.id) ?? null;
  }

  async findBy(where: { owner: string }): Promise<TaskEntity[]> {
    return [...this.byId.values()].filter(row => row.owner === where.owner);
  }

  async save(row: Partial<TaskEntity>): Promise<TaskEntity> {
    const entity = row as TaskEntity;
    this.byId.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

/** A future `share` feature's widened authority: any registered collaborator, not only the owner, may complete/reopen. */
class WidenedCompletionAuthority implements CompletionAuthority {
  constructor(private readonly collaborators: Set<string>) {}

  assertMayTransition(record: TaskRecord, actorId: string, _action: CompletionAction): void {
    if (record.owner === actorId || this.collaborators.has(actorId)) return;
    throw new Error('not authorized');
  }
}

describe('CompletionAuthorityRegistry', () => {
  it('br.task.single-owner (default): only the owner may complete or reopen; a stranger is refused', async () => {
    const registry = new CompletionAuthorityRegistry();
    const repository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>, registry);
    const record = await repository.create('owner-1', 'Ship it');

    await expect(repository.complete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(repository.reopen(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
  });

  it('a registered widened authority lets a non-owner complete/reopen once registered', async () => {
    const registry = new CompletionAuthorityRegistry();
    const repository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>, registry);
    const record = await repository.create('owner-1', 'Ship it');

    registry.register(new WidenedCompletionAuthority(new Set(['collaborator-1'])));

    const completed = await repository.complete(record.id, 'collaborator-1');
    expect(completed.complete).toBe(true);
    const reopened = await repository.reopen(record.id, 'collaborator-1');
    expect(reopened.complete).toBe(false);
  });

  it('delete stays owner-only through OwnershipGuard even after a widened CompletionAuthority is registered', async () => {
    const registry = new CompletionAuthorityRegistry();
    const repository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>, registry);
    const record = await repository.create('owner-1', 'Ship it');
    registry.register(new WidenedCompletionAuthority(new Set(['collaborator-1'])));

    await expect(repository.delete(record.id, 'collaborator-1')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
  });
});
