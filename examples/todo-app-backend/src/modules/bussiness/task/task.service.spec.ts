import { Repository } from 'typeorm';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { TaskService } from './task.service';

/**
 * A minimal in-memory stand-in for Repository<TaskEntity>: only the methods TaskService actually
 * calls. It is not a real TypeORM repository, so it is cast through `unknown` at the injection site
 * rather than claimed to satisfy the full Repository surface.
 */
class FakeTaskService {
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

const buildRepository = () => new TaskService(new FakeTaskService() as unknown as Repository<TaskEntity>);

describe('TaskService', () => {
  it('br.task.single-owner: a task belongs to exactly one person, and only that person may complete or delete it', async () => {
    const repository = buildRepository();
    const record = await repository.create('owner-1', 'Ship it');

    await expect(repository.complete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(repository.delete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    expect((await repository.findById(record.id)).complete).toBe(false);
  });

  it('br.task.delete.final: deleting a task removes it; there is no recovery path', async () => {
    const repository = buildRepository();
    const record = await repository.create('owner-1', 'Ship it');

    await repository.delete(record.id, 'owner-1');

    await expect(repository.findById(record.id)).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' });
  });

  it('ac.task.title.required.refuses-empty: a creation request with an empty or whitespace title is refused', async () => {
    const repository = buildRepository();

    await expect(repository.create('owner-1', '   ')).rejects.toMatchObject({ code: 'TASK_TITLE_REQUIRED' });
  });
});
