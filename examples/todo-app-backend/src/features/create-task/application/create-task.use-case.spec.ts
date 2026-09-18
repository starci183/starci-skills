import { TaskRepository } from '../../../modules/domain/task';
import { TaskRow, TaskRowStore } from '../../../modules/domain/task/task-row-store';
import { CreateTaskUseCase } from './create-task.use-case';

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

describe('CreateTaskUseCase', () => {
  let taskRepository: TaskRepository;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    taskRepository = new TaskRepository(new FakeTaskStore());
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
