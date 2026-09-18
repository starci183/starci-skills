import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TaskService } from './task.service';
import { ReopenTaskCommand, ReopenTaskCommandResult } from './reopen-task.command';

/**
 * br.task.complete.once (rev 2, done): "the owner may reopen a task they completed" is the
 * reversible statement that record now carries proof for. This handler is that reopen path: the task
 * reads incomplete again and its completion timestamp is cleared.
 *
 * No event is published here: unlike created/completed/deleted, the work tree declares no
 * event.task.reopened (or equivalent) record under features/task/event/**, so there is no declared
 * payload to emit against - unchanged from the former `ReopenTaskUseCase`'s own comment on this gap.
 */
@Injectable()
@CommandHandler(ReopenTaskCommand)
export class ReopenTaskHandler implements ICommandHandler<ReopenTaskCommand, ReopenTaskCommandResult> {
  constructor(private readonly taskService: TaskService) {}

  async execute(command: ReopenTaskCommand): Promise<ReopenTaskCommandResult> {
    const { params } = command;
    const record = await this.taskService.reopen(params.taskId, params.actorId);
    return { taskId: record.id, complete: record.complete };
  }
}
