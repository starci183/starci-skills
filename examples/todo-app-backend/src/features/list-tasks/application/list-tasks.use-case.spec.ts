import { TaskRepository } from '../../../modules/domain/task';
import { ListTasksUseCase } from './list-tasks.use-case';

describe('ListTasksUseCase', () => {
  it('ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears', async () => {
    const taskRepository = new TaskRepository();
    const useCase = new ListTasksUseCase(taskRepository);
    taskRepository.create('owner-1', 'Owner one task');
    taskRepository.create('owner-2', 'Owner two task');

    const result = await useCase.execute({ ownerId: 'owner-1' });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Owner one task');
  });
});
