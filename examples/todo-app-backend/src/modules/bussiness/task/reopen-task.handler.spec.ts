import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { ReopenTaskCommand } from './reopen-task.command';
import { ReopenTaskHandler } from './reopen-task.handler';

describe('ReopenTaskHandler', () => {
  it('ac.task.complete.once.is-reversible: the task reads incomplete and its completion timestamp is cleared', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const handler = new ReopenTaskHandler(taskService);
    const created = await taskService.create('owner-1', 'Ship it');
    await taskService.complete(created.id, 'owner-1');

    const result = await handler.execute(new ReopenTaskCommand({ actorId: 'owner-1', taskId: created.id }));

    expect(result.complete).toBe(false);
    expect((await taskService.findById(created.id)).completedAt).toBeNull();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot reopen somebody else's task", async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const handler = new ReopenTaskHandler(taskService);
    const created = await taskService.create('owner-1', 'Ship it');
    await taskService.complete(created.id, 'owner-1');

    await expect(handler.execute(new ReopenTaskCommand({ actorId: 'owner-2', taskId: created.id }))).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
  });
});
