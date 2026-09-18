import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OwnershipGuard } from './ownership.guard';
import { TaskRecord } from './task-record.types';
import { TaskNotFoundException, TaskTitleRequiredException } from './task.exception';

/**
 * data.task.task: owner is bound at creation and never rewritten; completedAt is set if and only if
 * complete is true. Completion method names mirror sds.task.completion-state's transitions
 * (t-complete, t-complete-again, t-reopen) so a reader can hold the record beside the code.
 */
@Injectable()
export class TaskRepository {
  private readonly rows = new Map<string, TaskRecord>();
  private readonly guard = new OwnershipGuard();

  create(owner: string, title: string): TaskRecord {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new TaskTitleRequiredException();
    }
    const record = new TaskRecord(randomUUID(), owner, trimmed, false, null);
    this.rows.set(record.id, record);
    return record;
  }

  findById(id: string): TaskRecord {
    const record = this.rows.get(id);
    if (!record) {
      throw new TaskNotFoundException();
    }
    return record;
  }

  listOwnedBy(owner: string): TaskRecord[] {
    return [...this.rows.values()].filter(row => row.owner === owner);
  }

  complete(id: string, actorId: string): TaskRecord {
    const record = this.findById(id);
    this.guard.assert(record, actorId);
    return this.tComplete(record);
  }

  reopen(id: string, actorId: string): TaskRecord {
    const record = this.findById(id);
    this.guard.assert(record, actorId);
    return this.tReopen(record);
  }

  delete(id: string, actorId: string): void {
    const record = this.findById(id);
    this.guard.assert(record, actorId);
    this.rows.delete(id);
  }

  private tComplete(record: TaskRecord): TaskRecord {
    if (record.complete) {
      return this.tCompleteAgain(record);
    }
    record.complete = true;
    record.completedAt = new Date();
    return record;
  }

  private tCompleteAgain(record: TaskRecord): TaskRecord {
    return record;
  }

  private tReopen(record: TaskRecord): TaskRecord {
    record.complete = false;
    record.completedAt = null;
    return record;
  }
}
