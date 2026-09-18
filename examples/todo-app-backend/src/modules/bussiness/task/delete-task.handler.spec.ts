import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { PlatformEventBus, TaskDeletedEvent } from '../../platform/events';
import { DeleteTaskCommand } from './delete-task.command';
import { DeleteTaskHandler } from './delete-task.handler';

describe('DeleteTaskHandler', () => {
  it('ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const handler = new DeleteTaskHandler(taskService, new PlatformEventBus());
    const created = await taskService.create('owner-1', 'Ship it');

    const result = await handler.execute(new DeleteTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(result.deleted).toBe(true);
    await expect(taskService.findById(created.id)).rejects.toThrow();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else's task", async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const handler = new DeleteTaskHandler(taskService, new PlatformEventBus());
    const created = await taskService.create('owner-1', 'Ship it');

    await expect(handler.execute(new DeleteTaskCommand({ actorId: 'owner-2', taskId: created.id }))).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(await taskService.findById(created.id)).toBeDefined();
  });

  it('event.task.deleted: publishes on the PlatformEventBus after the row is gone', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
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
