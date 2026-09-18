import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { ListTasksQuery } from './list-tasks.query';
import { ListTasksHandler } from './list-tasks.handler';

describe('ListTasksHandler', () => {
  it('ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const handler = new ListTasksHandler(taskService);
    await taskService.create('owner-1', 'Owner one task');
    await taskService.create('owner-2', 'Owner two task');

    const result = await handler.execute(new ListTasksQuery({ ownerId: 'owner-1' }));

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Owner one task');
  });
});
