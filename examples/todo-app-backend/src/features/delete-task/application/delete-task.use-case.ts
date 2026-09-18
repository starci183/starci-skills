import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../modules/domain/task';
import { DeleteTaskParams, DeleteTaskResult } from './delete-task.contracts';

/**
 * br.task.delete.final: deleting a task removes it; there is no recovery path in this product. The
 * repository's delete removes the row outright rather than marking it, so a later read of the same
 * identifier resolves to nothing.
 */
@Injectable()
export class DeleteTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: DeleteTaskParams): Promise<DeleteTaskResult> {
    await this.taskRepository.delete(params.taskId, params.actorId);
    return { deleted: true };
  }
}
