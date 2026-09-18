import { Repository } from 'typeorm';
import { TaskRepository } from '../../../modules/domain/task';
import { TaskEntity } from '../../../modules/integrations/postgres';
import { CompleteTaskUseCase } from './complete-task.use-case';

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

describe('CompleteTaskUseCase', () => {
  let taskRepository: TaskRepository;
  let useCase: CompleteTaskUseCase;

  beforeEach(() => {
    taskRepository = new TaskRepository(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    useCase = new CompleteTaskUseCase(taskRepository);
  });

  it('ac.task.complete.once.is-idempotent: completing an already-complete task is unchanged and succeeds again', async () => {
    const created = await taskRepository.create('owner-1', 'Ship it');
    const first = await useCase.execute({ actorId: 'owner-1', taskId: created.id });
    const second = await useCase.execute({ actorId: 'owner-1', taskId: created.id });
    expect(first.complete).toBe(true);
    expect(second.complete).toBe(true);
    const stored = await taskRepository.findById(created.id);
    expect(stored.completedAt).not.toBeNull();
  });

  it("ac.task.single-owner.refuses-stranger: a stranger cannot complete somebody else's task", async () => {
    const created = await taskRepository.create('owner-1', 'Ship it');
    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect((await taskRepository.findById(created.id)).complete).toBe(false);
  });
});
