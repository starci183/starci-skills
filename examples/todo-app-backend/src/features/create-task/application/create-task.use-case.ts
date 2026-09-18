import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { TaskCreationPolicyRegistry, TaskRepository } from '../../../modules/domain/task';
import { PlatformEventBus, TaskCreatedEvent } from '../../../modules/platform/events';
import { CreateTaskParams, CreateTaskResult } from './create-task.contracts';

/**
 * fr.task.create composes br.task.single-owner (the submitter owns the new task) and
 * br.task.title.required (an empty or whitespace-only title is refused and nothing is written). Before
 * writing, every policy registered in TaskCreationPolicyRegistry is consulted (empty by default, so
 * nothing blocks creation until a feature such as `plan` registers a capacity guard). After the write
 * succeeds, event.task.created is published on the PlatformEventBus.
 */
@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly creationPolicyRegistry: TaskCreationPolicyRegistry = new TaskCreationPolicyRegistry(),
    private readonly events: PlatformEventBus = new PlatformEventBus(),
  ) {}

  async execute(params: CreateTaskParams): Promise<CreateTaskResult> {
    await this.creationPolicyRegistry.assertMayCreate({ actorId: params.ownerId }, { title: params.title });
    const record = await this.taskRepository.create(params.ownerId, params.title);
    this.events.publish(new TaskCreatedEvent(record.id, record.owner, new Date(), randomUUID()));
    return { taskId: record.id, title: record.title };
  }
}
