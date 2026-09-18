import { Repository } from 'typeorm';
import { TaskRepository } from '../../../modules/domain/task';
import { TaskEntity } from '../../../modules/integrations/postgres';
import { DeleteTaskUseCase } from './delete-task.use-case';

class FakeTaskRepository {
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

describe('DeleteTaskUseCase', () => {
  it('ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion', async () => {
    const taskRepository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');

    const result = await useCase.execute({ actorId: 'owner-1', taskId: created.id });

    expect(result.deleted).toBe(true);
    await expect(taskRepository.findById(created.id)).rejects.toThrow();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else's task", async () => {
    const taskRepository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = await taskRepository.create('owner-1', 'Ship it');

    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(await taskRepository.findById(created.id)).toBeDefined();
  });
});
