import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { PlatformEventBus, TaskCompletedEvent } from '../../platform/events';
import { CompleteTaskCommand } from './complete-task.command';
import { CompleteTaskHandler } from './complete-task.handler';

describe('CompleteTaskHandler', () => {
  let taskService: TaskService;
  let handler: CompleteTaskHandler;

  beforeEach(() => {
    taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
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
