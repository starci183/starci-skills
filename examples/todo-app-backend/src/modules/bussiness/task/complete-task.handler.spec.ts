import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { PlatformEventBus, TaskCompletedEvent } from '../../platform/events';
import { CompleteTaskCommand } from './complete-task.command';
import { CompleteTaskHandler } from './complete-task.handler';

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

describe('CompleteTaskHandler', () => {
  let taskService: TaskService;
  let handler: CompleteTaskHandler;

  beforeEach(() => {
    taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    handler = new CompleteTaskHandler(taskService, new PlatformEventBus());
  });

  it('ac.task.complete.once.is-idempotent: completing an already-complete task is unchanged and succeeds again', async () => {
    const created = await taskService.create('owner-1', 'Ship it');
    const first = await handler.execute(new CompleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));
    const second = await handler.execute(new CompleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));
    expect(first.complete).toBe(true);
    expect(second.complete).toBe(true);
    const stored = await taskService.findById(created.id);
    expect(stored.completedAt).not.toBeNull();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot complete somebody else's task", async () => {
    const created = await taskService.create('owner-1', 'Ship it');
    await expect(handler.execute(new CompleteTaskCommand({ actorId: 'owner-2', taskId: created.id }))).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect((await taskService.findById(created.id)).complete).toBe(false);
  });

  it('event.task.completed: publishes on the PlatformEventBus after the write succeeds', async () => {
    const created = await taskService.create('owner-1', 'Ship it');
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));
    const withEvents = new CompleteTaskHandler(taskService, events);

    await withEvents.execute(new CompleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(received).toHaveLength(1);
    const [published] = received as [TaskCompletedEvent];
    expect(published).toBeInstanceOf(TaskCompletedEvent);
    expect(published.taskId).toBe(created.id);
    expect(published.ownerId).toBe('owner-1');
  });
});
