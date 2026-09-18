import { TaskRow, TaskRowStore } from './task-row-store';
import { TaskRepository } from './task.repository';

class FakeTaskStore implements TaskRowStore {
  private readonly byId = new Map<string, TaskRow>();

  async findOneBy(where: { id: string }): Promise<TaskRow | null> {
    return this.byId.get(where.id) ?? null;
  }

  async findBy(where: { owner: string }): Promise<TaskRow[]> {
    return [...this.byId.values()].filter(row => row.owner === where.owner);
  }

  async save(row: TaskRow): Promise<TaskRow> {
    this.byId.set(row.id, row);
    return row;
  }

  async delete(id: string): Promise<unknown> {
    return this.byId.delete(id);
  }
}

describe('TaskRepository', () => {
  it('br.task.single-owner: a task belongs to exactly one person, and only that person may complete or delete it', async () => {
    const repository = new TaskRepository(new FakeTaskStore());
    const record = await repository.create('owner-1', 'Ship it');

    await expect(repository.complete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    await expect(repository.delete(record.id, 'owner-2')).rejects.toMatchObject({ code: 'TASK_FORBIDDEN' });
    expect((await repository.findById(record.id)).complete).toBe(false);
  });

  it('br.task.delete.final: deleting a task removes it; there is no recovery path', async () => {
    const repository = new TaskRepository(new FakeTaskStore());
    const record = await repository.create('owner-1', 'Ship it');

    await repository.delete(record.id, 'owner-1');

    await expect(repository.findById(record.id)).rejects.toMatchObject({ code: 'TASK_NOT_FOUND' });
  });

  it('ac.task.title.required.refuses-empty: a creation request with an empty or whitespace title is refused', async () => {
    const repository = new TaskRepository(new FakeTaskStore());

    await expect(repository.create('owner-1', '   ')).rejects.toMatchObject({ code: 'TASK_TITLE_REQUIRED' });
  });
});
