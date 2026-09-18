import { TaskRepository } from '../../../modules/domain/task';
import { DeleteTaskUseCase } from './delete-task.use-case';

describe('DeleteTaskUseCase', () => {
  it('ac.task.delete.final.stays-gone: the identifier resolves to nothing after deletion', async () => {
    const taskRepository = new TaskRepository();
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = taskRepository.create('owner-1', 'Ship it');

    const result = await useCase.execute({ actorId: 'owner-1', taskId: created.id });

    expect(result.deleted).toBe(true);
    expect(() => taskRepository.findById(created.id)).toThrow();
  });

  it('ac.task.single-owner.refuses-stranger: a stranger cannot delete somebody else\'s task', async () => {
    const taskRepository = new TaskRepository();
    const useCase = new DeleteTaskUseCase(taskRepository);
    const created = taskRepository.create('owner-1', 'Ship it');

    await expect(useCase.execute({ actorId: 'owner-2', taskId: created.id })).rejects.toMatchObject({
      code: 'TASK_FORBIDDEN',
    });
    expect(taskRepository.findById(created.id)).toBeDefined();
  });
});
