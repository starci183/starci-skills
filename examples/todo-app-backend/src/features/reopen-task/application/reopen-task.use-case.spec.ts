import { TaskRepository } from '../../../modules/domain/task';
import { TaskRow, TaskRowStore } from '../../../modules/domain/task/task-row-store';
import { ReopenTaskUseCase } from './reopen-task.use-case';

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

describe('ReopenTaskUseCase', () => {
  it('ac.task.complete.once.is-reversible: the task reads incomplete and its completion timestamp is cleared', async () => {
    const taskRepository = new TaskRepository(new FakeTaskStore());
    const useCase = new ReopenTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');
    await taskRepository.complete(created.id, 'owner-1');

    const result = await useCase.execute({ actorId: 'owner-1', taskId: created.id });

    expect(result.complete).toBe(false);
    expect((await taskRepository.findById(created.id)).completedAt).toBeNull();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot reopen somebody else's task", async () => {
    const taskRepository = new TaskRepository(new FakeTaskStore());
    const useCase = new ReopenTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');
    await taskRepository.complete(created.id, 'owner-1');

    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
  });
});
