import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../modules/domain/task';
import { ListTasksParams, ListTasksResult, TaskSummaryResult } from './list-tasks.contracts';

/** br.task.list.owned: a task list contains exactly the tasks owned by the person reading it. */
@Injectable()
export class ListTasksUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: ListTasksParams): Promise<ListTasksResult> {
    const tasks: TaskSummaryResult[] = this.taskRepository.listOwnedBy(params.ownerId).map(record => ({
      taskId: record.id,
      title: record.title,
      complete: record.complete,
    }));
    return { tasks };
  }
}
