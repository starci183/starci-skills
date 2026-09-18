import { Repository } from 'typeorm';
import { TaskService } from './task.service';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { ListTasksQuery } from './list-tasks.query';
import { ListTasksHandler } from './list-tasks.handler';

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

describe('ListTasksHandler', () => {
  it('ac.task.list.owned.excludes-others: every row belongs to the reader, no row of the other person appears', async () => {
    const taskService = new TaskService(new FakeTaskRepository() as unknown as Repository<TaskEntity>);
    const handler = new ListTasksHandler(taskService);
    await taskService.create('owner-1', 'Owner one task');
    await taskService.create('owner-2', 'Owner two task');

    const result = await handler.execute(new ListTasksQuery({ ownerId: 'owner-1' }));

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Owner one task');
  });
});
