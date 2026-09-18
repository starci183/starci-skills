import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TaskRepository } from '../../../modules/domain/task';
import { PlatformEventBus, TaskDeletedEvent } from '../../../modules/platform/events';
import { DeleteTaskParams, DeleteTaskResult } from './delete-task.contracts';

/**
 * br.task.delete.final: deleting a task removes it; there is no recovery path in this product. The
 * repository's delete removes the row outright rather than marking it, so a later read of the same
 * identifier resolves to nothing. event.task.deleted is published after the row is gone.
 */
@Injectable()
export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly events: PlatformEventBus = new PlatformEventBus(),
  ) {}

  async execute(params: DeleteTaskParams): Promise<DeleteTaskResult> {
    const deleted = await this.taskRepository.delete(params.taskId, params.actorId);
    this.events.publish(new TaskDeletedEvent(deleted.id, deleted.owner, new Date(), randomUUID()));
    return { deleted: true };
  }
}
