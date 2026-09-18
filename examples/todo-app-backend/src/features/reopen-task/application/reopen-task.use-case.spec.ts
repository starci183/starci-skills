import { TaskRepository } from '../../../modules/domain/task';
import { ReopenTaskUseCase } from './reopen-task.use-case';

describe('ReopenTaskUseCase', () => {
  it('ac.task.complete.once.is-reversible: the task reads incomplete and its completion timestamp is cleared', async () => {
    const taskRepository = new TaskRepository();
    const useCase = new ReopenTaskUseCase(taskRepository);
    const created = taskRepository.create('owner-1', 'Ship it');
    taskRepository.complete(created.id, 'owner-1');

    const result = await useCase.execute({ actorId: 'owner-1', taskId: created.id });

    expect(result.complete).toBe(false);
    expect(taskRepository.findById(created.id).completedAt).toBeNull();
  });

  it('ac.task.single-owner.refuses-stranger: a stranger cannot reopen somebody else\'s task', async () => {
    const taskRepository = new TaskRepository();
    const useCase = new ReopenTaskUseCase(taskRepository);
    const created = taskRepository.create('owner-1', 'Ship it');
    taskRepository.complete(created.id, 'owner-1');

    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
  });
});
