import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { PlatformEventBus, TaskDeletedEvent } from '../../platform/events';
import { DeleteTaskCommand } from './delete-task.command';
import { DeleteTaskHandler } from './delete-task.handler';

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

describe('DeleteTaskHandler', () => {
  it('ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion', async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const handler = new DeleteTaskHandler(taskService, new PlatformEventBus());
    const created = await taskService.create('owner-1', 'Ship it');

    const result = await handler.execute(new DeleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(result.deleted).toBe(true);
    await expect(taskService.findById(created.id)).rejects.toThrow();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else's task", async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const handler = new DeleteTaskHandler(taskService, new PlatformEventBus());
    const created = await taskService.create('owner-1', 'Ship it');

    await expect(handler.execute(new DeleteTaskCommand({ actorId: 'owner-2', taskId: created.id }))).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(await taskService.findById(created.id)).toBeDefined();
  });

  it('event.task.deleted: publishes on the PlatformEventBus after the row is gone', async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const created = await taskService.create('owner-1', 'Ship it');
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));
    const handler = new DeleteTaskHandler(taskService, events);

    await handler.execute(new DeleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(received).toHaveLength(1);
    const [published] = received as [TaskDeletedEvent];
    expect(published).toBeInstanceOf(TaskDeletedEvent);
    expect(published.taskId).toBe(created.id);
    expect(published.ownerId).toBe('owner-1');
  });
});
