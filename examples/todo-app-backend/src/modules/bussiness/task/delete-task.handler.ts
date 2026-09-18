import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { PlatformEventBus, TaskDeletedEvent } from '../../platform/events';
import { TaskService } from './task.service';
import { DeleteTaskCommand, DeleteTaskCommandResult } from './delete-task.command';

/**
 * br.task.delete.final: deleting a task removes it; there is no recovery path in this product. The
 * service's delete removes the row outright rather than marking it, so a later read of the same
 * identifier resolves to nothing. event.task.deleted is published after the row is gone.
 *
 * Ported from the former `DeleteTaskUseCase`; see create-task.handler.ts's comment for the CQRS move.
 */
@Injectable()
@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand, DeleteTaskCommandResult> {
  constructor(
    private readonly taskService: TaskService,
    private readonly events: PlatformEventBus,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<DeleteTaskCommandResult> {
    const { params } = command;
    const deleted = await this.taskService.delete(params.taskId, params.actorId);
    this.events.publish(new TaskDeletedEvent(deleted.id, deleted.owner, new Date(), randomUUID()));
    return { deleted: true };
  }
}
