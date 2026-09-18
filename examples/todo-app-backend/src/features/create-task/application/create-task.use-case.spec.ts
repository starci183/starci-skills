import { Repository } from 'typeorm';
import { TaskRepository } from '../../../modules/domain/task';
import { TaskEntity } from '../../../modules/integrations/postgres';
import { CreateTaskUseCase } from './create-task.use-case';

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

describe('CreateTaskUseCase', () => {
  let taskRepository: TaskRepository;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    taskRepository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    useCase = new CreateTaskUseCase(taskRepository);
  });

  it('fr.task.create: the task is created, owned by the submitter, not complete', async () => {
    const result = await useCase.execute({ ownerId: 'owner-1', title: 'Write the report' });
    const stored = await taskRepository.findById(result.taskId);
    expect(stored.owner).toBe('owner-1');
    expect(stored.complete).toBe(false);
    expect(result.title).toBe('Write the report');
  });

  it('ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written', async () => {
    await expect(useCase.execute({ ownerId: 'owner-1', title: '   ' })).rejects.toMatchObject({
      code: 'TASK_TITLE_REQUIRED',
    });
    expect(await taskRepository.listOwnedBy('owner-1')).toHaveLength(0);
  });
});
