import { Repository } from 'typeorm';
import { TaskRepository } from '../../../modules/domain/task';
import { TaskEntity } from '../../../modules/integrations/postgres';
import { ListTasksUseCase } from './list-tasks.use-case';

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

describe('ListTasksUseCase', () => {
  it('ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears', async () => {
    const taskRepository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const useCase = new ListTasksUseCase(taskRepository);
    await taskRepository.create('owner-1', 'Owner one task');
    await taskRepository.create('owner-2', 'Owner two task');

    const result = await useCase.execute({ ownerId: 'owner-1' });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Owner one task');
  });
});
