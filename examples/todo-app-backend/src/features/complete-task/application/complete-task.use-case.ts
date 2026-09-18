import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TaskRepository } from '../../../modules/domain/task';
import { PlatformEventBus, TaskCompletedEvent } from '../../../modules/platform/events';
import { CompleteTaskParams, CompleteTaskResult } from './complete-task.contracts';

/**
 * fr.task.complete composes br.task.single-owner (a non-owner attempt is refused, via the
 * CompletionAuthority the repository consults) and br.task.complete.once (completing an already-complete
 * task is unchanged and not an error). event.task.completed is published after the write succeeds,
 * including on the idempotent re-complete path: the row is complete either way, and the record does not
 * distinguish a fresh completion from a repeated one.
 */
@Injectable()
export class CompleteTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly events: PlatformEventBus = new PlatformEventBus(),
  ) {}

  async execute(params: CompleteTaskParams): Promise<CompleteTaskResult> {
    const record = await this.taskRepository.complete(params.taskId, params.actorId);
    this.events.publish(new TaskCompletedEvent(record.id, record.owner, record.completedAt ?? new Date(), randomUUID()));
    return { taskId: record.id, complete: record.complete };
  }
}
