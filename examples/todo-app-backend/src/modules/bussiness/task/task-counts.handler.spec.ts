import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { TaskService } from './task.service';
import { TaskCountsQuery } from './task-counts.query';
import { TaskCountsHandler } from './task-counts.handler';

describe('TaskCountsHandler', () => {
  let taskService: TaskService;
  let handler: TaskCountsHandler;

  beforeEach(() => {
    taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    handler = new TaskCountsHandler(taskService);
  });

  it('contract.task.list-for-dashboard.counts-obey-owned-list: the two counts cover exactly the reader\'s own tasks', async () => {
    const own = await taskService.create('owner-1', 'Mine');
    await taskService.create('owner-1', 'Also mine');
    await taskService.create('owner-2', 'Theirs');
    await taskService.create('owner-2', 'Also theirs');
    await taskService.complete(own.id, 'owner-1');

    const result = await handler.execute(new TaskCountsQuery({ ownerId: 'owner-1' }));

    expect(result).toEqual({ open: 1, complete: 1 });
    expect(Object.keys(result).sort()).toEqual(['complete', 'open']);
  });

  it('contract.task.list-for-dashboard.counts-track-completion: completing and reopening move a task between the two counters', async () => {
    const first = await taskService.create('owner-1', 'Ship it');
    await taskService.create('owner-1', 'Write it');

    expect(await handler.execute(new TaskCountsQuery({ ownerId: 'owner-1' }))).toEqual({ open: 2, complete: 0 });
    await taskService.complete(first.id, 'owner-1');
    expect(await handler.execute(new TaskCountsQuery({ ownerId: 'owner-1' }))).toEqual({ open: 1, complete: 1 });
    await taskService.reopen(first.id, 'owner-1');
    expect(await handler.execute(new TaskCountsQuery({ ownerId: 'owner-1' }))).toEqual({ open: 2, complete: 0 });
  });
});
