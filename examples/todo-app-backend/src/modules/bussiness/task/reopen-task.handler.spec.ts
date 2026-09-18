import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { ReopenTaskCommand } from './reopen-task.command';
import { ReopenTaskHandler } from './reopen-task.handler';

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

describe('ReopenTaskHandler', () => {
  it('ac.task.complete.once.is-reversible: the task reads incomplete and its completion timestamp is cleared', async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const handler = new ReopenTaskHandler(taskService);
    const created = await taskService.create('owner-1', 'Ship it');
    await taskService.complete(created.id, 'owner-1');

    const result = await handler.execute(new ReopenTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(result.complete).toBe(false);
    expect((await taskService.findById(created.id)).completedAt).toBeNull();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot reopen somebody else's task", async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const handler = new ReopenTaskHandler(taskService);
    const created = await taskService.create('owner-1', 'Ship it');
    await taskService.complete(created.id, 'owner-1');

    await expect(handler.execute(new ReopenTaskCommand({ actorId: 'owner-2', taskId: created.id }))).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
  });
});
