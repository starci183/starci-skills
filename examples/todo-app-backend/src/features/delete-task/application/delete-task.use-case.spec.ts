import { TaskRepository } from '../../../modules/domain/task';
import { TaskRow, TaskRowStore } from '../../../modules/domain/task/task-row-store';
import { DeleteTaskUseCase } from './delete-task.use-case';

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

describe('DeleteTaskUseCase', () => {
  it('ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion', async () => {
    const taskRepository = new TaskRepository(new FakeTaskStore());
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');

    const result = await useCase.execute({ actorId: 'owner-1', taskId: created.id });

    expect(result.deleted).toBe(true);
    await expect(taskRepository.findById(created.id)).rejects.toThrow();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else's task", async () => {
    const taskRepository = new TaskRepository(new FakeTaskStore());
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');

    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(await taskRepository.findById(created.id)).toBeDefined();
  });
});
