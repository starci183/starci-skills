import { TaskRepository } from '../../../modules/domain/task';
import { CompleteTaskUseCase } from './complete-task.use-case';

describe('CompleteTaskUseCase', () => {
  let taskRepository: TaskRepository;
  let useCase: CompleteTaskUseCase;

  beforeEach(() => {
    taskRepository = new TaskRepository();
    useCase = new CompleteTaskUseCase(taskRepository);
  });

  it('ac.task.complete.once.is-idempotent: completing an already-complete task is unchanged and succeeds again', async () => {
    const created = taskRepository.create('owner-1', 'Ship it');
    const first = await useCase.execute({ actorId: 'owner-1', taskId: created.id });
    const second = await useCase.execute({ actorId: 'owner-1', taskId: created.id });
    expect(first.complete).toBe(true);
    expect(second.complete).toBe(true);
    expect(taskRepository.findById(created.id).completedAt).toEqual(taskRepository.findById(created.id).completedAt);
  });

  it('ac.task.single-owner.refuses-stranger: a stranger cannot complete somebody else\'s task', async () => {
    const created = taskRepository.create('owner-1', 'Ship it');
    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(taskRepository.findById(created.id).complete).toBe(false);
  });
});
