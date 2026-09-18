import { Injectable } from '@nestjs/common';
import { TaskRepository } from '../../../modules/domain/task';
import { CreateTaskParams, CreateTaskResult } from './create-task.contracts';

/**
 * fr.task.create composes br.task.single-owner (the submitter owns the new task) and
 * br.task.title.required (an empty or whitespace-only title is refused and nothing is written).
 */
@Injectable()
export class CreateTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: CreateTaskParams): Promise<CreateTaskResult> {
    const record = this.taskRepository.create(params.ownerId, params.title);
    return { taskId: record.id, title: record.title };
  }
}
