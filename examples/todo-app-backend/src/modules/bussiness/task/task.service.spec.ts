import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { TaskService } from './task.service';

const buildService = () => new TaskService(createFakeEntityManager<TaskEntity>('id') as never);

describe('TaskService', () => {
  it('br.task.single-owner: a task belongs to exactly one person, and only that person may complete or delete it', async () => {
    const service = buildService();
    const record = await service.create('owner-1', 'Ship it');

    await expect(service.complete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(service.delete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    expect((await service.findById(record.id)).complete).toBe(false);
  });

  it('br.task.delete.final: deleting a task removes it; there is no recovery path', async () => {
    const service = buildService();
    const record = await service.create('owner-1', 'Ship it');

    await service.delete(record.id, 'owner-1');

    await expect(service.findById(record.id)).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' });
  });

  it('ac.task.title.required.refuses-empty: a creation request with an empty or whitespace title is refused', async () => {
    const service = buildService();

    await expect(service.create('owner-1', '   ')).rejects.toMatchObject({ code: 'TASK_TITLE_REQUIRED' });
  });
});
