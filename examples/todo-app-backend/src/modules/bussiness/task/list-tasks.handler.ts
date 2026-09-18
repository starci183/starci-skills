import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TaskService } from './task.service';
import { ListTasksQuery, ListTasksQueryResult, TaskSummaryResult } from './list-tasks.query';

/**
 * br.task.list.owned: a task list contains exactly the tasks owned by the person reading it. Ported
 * from the former `ListTasksUseCase` into a CQRS query handler - task's one read, following nivo's own
 * split of writes onto the CommandBus and reads onto the QueryBus.
 */
@Injectable()
@QueryHandler(ListTasksQuery)
export class ListTasksHandler implements IQueryHandler<ListTasksQuery, ListTasksQueryResult> {
  constructor(private readonly taskService: TaskService) {}

  async execute(query: ListTasksQuery): Promise<ListTasksQueryResult> {
    const records = await this.taskService.listOwnedBy(query.params.ownerId);
    const tasks: TaskSummaryResult[] = records.map(record => ({
      taskId: record.id,
      title: record.title,
      complete: record.complete,
    }));
    return { tasks };
  }
}
