import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../modules/domain/task';
import { ReopenTaskParams, ReopenTaskResult } from './reopen-task.contracts';

/**
 * br.task.complete.once (rev 2, still todo): "the owner may reopen a task they completed" is the
 * reversible statement this record is waiting on proof for. This use case is that reopen path: the task
 * reads incomplete again and its completion timestamp is cleared.
 */
@Injectable()
export class ReopenTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: ReopenTaskParams): Promise<ReopenTaskResult> {
    const record = await this.taskRepository.reopen(params.taskId, params.actorId);
    return { taskId: record.id, complete: record.complete };
  }
}
