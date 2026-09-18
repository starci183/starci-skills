import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { TaskEntity } from '../../integrations/postgres';
import { OwnershipGuard } from './ownership.guard';
import { TaskRecord } from './task-record.types';
import { TaskNotFoundException, TaskTitleRequiredException } from './task.exception';

/**
 * data.task.task: owner is bound at creation and never rewritten; completedAt is set if and only if
 * complete is true. Completion method names mirror sds.task.completion-state's transitions
 * (t-complete, t-complete-again, t-reopen) so a reader can hold the record beside the code. The row lives
 * in Postgres, through the platform database module's TaskEntity.
 */
@Injectable()
export class TaskRepository {
  private readonly guard = new OwnershipGuard();

  constructor(@InjectRepository(TaskEntity) private readonly rows: Repository<TaskEntity>) {}

  async create(owner: string, title: string): Promise<TaskRecord> {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new TaskTitleRequiredException();
    }
    const saved = await this.rows.save({ id: randomUUID(), owner, title: trimmed, complete: false, completedAt: null });
    return toRecord(saved);
  }

  async findById(id: string): Promise<TaskRecord> {
    const row = await this.rows.findOneBy({ id });
    if (!row) {
      throw new TaskNotFoundException();
    }
    return toRecord(row);
  }

  async listOwnedBy(owner: string): Promise<TaskRecord[]> {
    const rows = await this.rows.findBy({ owner });
    return rows.map(toRecord);
  }

  async complete(id: string, actorId: string): Promise<TaskRecord> {
    const row = await this.findOwnedRow(id, actorId);
    return this.tComplete(row);
  }

  async reopen(id: string, actorId: string): Promise<TaskRecord> {
    const row = await this.findOwnedRow(id, actorId);
    return this.tReopen(row);
  }

  async delete(id: string, actorId: string): Promise<void> {
    const row = await this.findOwnedRow(id, actorId);
    await this.rows.delete(row.id);
  }

  private async findOwnedRow(id: string, actorId: string): Promise<TaskEntity> {
    const row = await this.rows.findOneBy({ id });
    if (!row) {
      throw new TaskNotFoundException();
    }
    this.guard.assert(toRecord(row), actorId);
    return row;
  }

  private async tComplete(row: TaskEntity): Promise<TaskRecord> {
    if (row.complete) {
      return this.tCompleteAgain(row);
    }
    row.complete = true;
    row.completedAt = new Date();
    const saved = await this.rows.save(row);
    return toRecord(saved);
  }

  private async tCompleteAgain(row: TaskEntity): Promise<TaskRecord> {
    return toRecord(row);
  }

  private async tReopen(row: TaskEntity): Promise<TaskRecord> {
    row.complete = false;
    row.completedAt = null;
    const saved = await this.rows.save(row);
    return toRecord(saved);
  }
}

function toRecord(row: TaskEntity): TaskRecord {
  return new TaskRecord(row.id, row.owner, row.title, row.complete, row.completedAt);
}
