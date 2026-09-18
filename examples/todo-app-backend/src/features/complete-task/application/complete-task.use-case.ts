import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../modules/domain/task';
import { CompleteTaskParams, CompleteTaskResult } from './complete-task.contracts';

/**
 * fr.task.complete composes br.task.single-owner (a non-owner attempt is refused) and
 * br.task.complete.once (completing an already-complete task is unchanged and not an error).
 */
@Injectable()
export class CompleteTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: CompleteTaskParams): Promise<CompleteTaskResult> {
    const record = this.taskRepository.complete(params.taskId, params.actorId);
    return { taskId: record.id, complete: record.complete };
  }
}
