import { TaskRepository } from '../../../modules/domain/task';
import { TaskRow, TaskRowStore } from '../../../modules/domain/task/task-row-store';
import { ListTasksUseCase } from './list-tasks.use-case';

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

describe('ListTasksUseCase', () => {
  it('ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears', async () => {
    const taskRepository = new TaskRepository(new FakeTaskStore());
    const useCase = new ListTasksUseCase(taskRepository);
    await taskRepository.create('owner-1', 'Owner one task');
    await taskRepository.create('owner-2', 'Owner two task');

    const result = await useCase.execute({ ownerId: 'owner-1' });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Owner one task');
  });
});
