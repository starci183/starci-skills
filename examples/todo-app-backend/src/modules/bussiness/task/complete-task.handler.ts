import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { PlatformEventBus, TaskCompletedEvent } from '../../platform/events';
import { TaskService } from './task.service';
import { CompleteTaskCommand, CompleteTaskCommandResult } from './complete-task.command';

/**
 * fr.task.complete composes br.task.single-owner (a non-owner attempt is refused, via the
 * CompletionAuthority the service consults) and br.task.complete.once (completing an already-complete
 * task is unchanged and not an error). event.task.completed is published after the write succeeds,
 * including on the idempotent re-complete path.
 *
 * Ported from the former `CompleteTaskUseCase`; see create-task.handler.ts's comment for why this is now
 * a CQRS handler owned by `bussiness/task` rather than a `features/complete-task/application` use case.
 */
@Injectable()
@CommandHandler(CompleteTaskCommand)
export class CompleteTaskHandler implements ICommandHandler<CompleteTaskCommand, CompleteTaskCommandResult> {
  constructor(
    private readonly taskService: TaskService,
    private readonly events: PlatformEventBus,
  ) {}

  async execute(command: CompleteTaskCommand): Promise<CompleteTaskCommandResult> {
    const { params } = command;
    const record = await this.taskService.complete(params.taskId, params.actorId);
    this.events.publish(new TaskCompletedEvent(record.id, record.owner, record.completedAt ?? new Date(), randomUUID()));
    return { taskId: record.id, complete: record.complete };
  }
}
