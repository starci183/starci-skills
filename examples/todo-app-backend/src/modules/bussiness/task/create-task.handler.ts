import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { PlatformEventBus, TaskCreatedEvent } from '../../platform/events';
import { TaskService } from './task.service';
import { TaskCreationPolicyRegistry } from './creation-policy.providers';
import { CreateTaskCommand, CreateTaskCommandResult } from './create-task.command';

/**
 * fr.task.create composes br.task.single-owner (the submitter owns the new task) and
 * br.task.title.required (an empty or whitespace-only title is refused and nothing is written). Before
 * writing, every policy registered in TaskCreationPolicyRegistry is consulted (empty by default, so
 * nothing blocks creation until a feature such as `plan` registers a capacity guard). After the write
 * succeeds, event.task.created is published on the PlatformEventBus.
 *
 * Ported from the former `CreateTaskUseCase` (under `features/create-task/application`) into a CQRS
 * command handler owned by the `bussiness/task` capability module, matching nivo's
 * `apply-paid-agent-workspace-plan-change.handler.ts` shape: the handler lives beside the service it
 * orchestrates, not in a separate feature/application folder.
 */
@Injectable()
@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand, CreateTaskCommandResult> {
  constructor(
    private readonly taskService: TaskService,
    private readonly creationPolicyRegistry: TaskCreationPolicyRegistry,
    private readonly events: PlatformEventBus,
  ) {}

  async execute(command: CreateTaskCommand): Promise<CreateTaskCommandResult> {
    const { params } = command;
    await this.creationPolicyRegistry.assertMayCreate({ actorId: params.ownerId }, { title: params.title });
    const record = await this.taskService.create(params.ownerId, params.title);
    this.events.publish(new TaskCreatedEvent(record.id, record.owner, new Date(), randomUUID()));
    return { taskId: record.id, title: record.title };
  }
}
