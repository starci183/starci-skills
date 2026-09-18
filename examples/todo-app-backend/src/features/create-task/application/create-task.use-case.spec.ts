import { TaskRepository } from '../../../modules/domain/task';
import { CreateTaskUseCase } from './create-task.use-case';

describe('CreateTaskUseCase', () => {
  let taskRepository: TaskRepository;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    taskRepository = new TaskRepository();
    useCase = new CreateTaskUseCase(taskRepository);
  });

  it('fr.task.create: the task is created, owned by the submitter, not complete', async () => {
    const result = await useCase.execute({ ownerId: 'owner-1', title: 'Write the report' });
    const stored = taskRepository.findById(result.taskId);
    expect(stored.owner).toBe('owner-1');
    expect(stored.complete).toBe(false);
    expect(result.title).toBe('Write the report');
  });

  it('ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written', async () => {
    await expect(useCase.execute({ ownerId: 'owner-1', title: '   ' })).rejects.toMatchObject({
      code: 'TASK_TITLE_REQUIRED',
    });
    expect(taskRepository.listOwnedBy('owner-1')).toHaveLength(0);
  });
});
