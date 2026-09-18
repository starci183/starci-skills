import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, OccurrenceEntity, TaskEntity } from '../../platform/databases/postgresql/primary';
import { RecurOccurrenceForbiddenException, RecurOccurrenceNotFoundException } from '@modules/shared/exceptions';
import { OccurrenceRecord, OccurrenceStatus } from './types/occurrence-record';

export interface MaterialiseOccurrenceInput {
  /** The id of the task row already created (through CreateTaskCommand) for this occurrence. */
  readonly id: string;
  readonly ruleId: string;
  readonly windowKey: string;
  readonly localDate: string;
  readonly dueAtUtc: Date;
}

/**
 * sds.recur.occurrence-lifecycle: holds one row per materialised occurrence, joined to the `tasks` row
 * `CreateTaskCommand` wrote for it (data.recur.occurrence `extends data.task.task`). This is the only
 * writer of an occurrence row (that record's own interfaces statement). Persistence only through
 * `@InjectPrimaryEntityManager()`.
 */
@Injectable()
export class OccurrenceService {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

  /** br.recur.generation.once: a second call for a windowKey that already has a row changes nothing and
   * returns that same row untouched - the caller (GeneratorService) is expected to check
   * `existsByWindowKey` before even creating the underlying task, but this method is idempotent on its
   * own terms too so a race between two generator runs can never produce a second row for one window. */
  async materialise(input: MaterialiseOccurrenceInput): Promise<OccurrenceRecord> {
    const existing = await this.entityManager.findOneBy(OccurrenceEntity, { windowKey: input.windowKey });
    if (existing) {
      return this.toRecord(existing);
    }
    const saved = await this.entityManager.save(OccurrenceEntity, {
      id: input.id,
      ruleId: input.ruleId,
      windowKey: input.windowKey,
      localDate: input.localDate,
      dueAtUtc: input.dueAtUtc,
      status: 'materialised' satisfies OccurrenceStatus,
    });
    return this.toRecord(saved);
  }

  async existsByWindowKey(windowKey: string): Promise<boolean> {
    const row = await this.entityManager.findOneBy(OccurrenceEntity, { windowKey });
    return row !== null;
  }

  async findById(id: string): Promise<OccurrenceRecord> {
    const row = await this.entityManager.findOneBy(OccurrenceEntity, { id });
    if (!row) {
      throw new RecurOccurrenceNotFoundException({ occurrenceId: id });
    }
    return this.toRecord(row);
  }

  async listByRule(ruleId: string): Promise<OccurrenceRecord[]> {
    const rows = await this.entityManager.findBy(OccurrenceEntity, { ruleId });
    const records = await Promise.all(rows.map(row => this.toRecord(row)));
    return records.sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
  }

  /** br.recur.occurrence.owned-by-rule-owner / sds.recur.occurrence-lifecycle's t-complete: materialised
   * -> completed, owner-only. Completing an already-completed occurrence again is a no-op, matching
   * task's own idempotent-complete convention. */
  async complete(id: string, actorId: string): Promise<OccurrenceRecord> {
    const { occurrenceRow, taskRow } = await this.findRowsForOwner(id, actorId);
    if (occurrenceRow.status === 'completed') {
      return this.toRecord(occurrenceRow);
    }
    taskRow.complete = true;
    taskRow.completedAt = new Date();
    await this.entityManager.save(TaskEntity, taskRow);
    occurrenceRow.status = 'completed';
    const saved = await this.entityManager.save(OccurrenceEntity, occurrenceRow);
    return this.toRecord(saved);
  }

  /** sds.recur.occurrence-lifecycle's t-skip: materialised -> skipped, owner-only, without marking the
   * underlying task complete. */
  async skip(id: string, actorId: string): Promise<OccurrenceRecord> {
    const { occurrenceRow } = await this.findRowsForOwner(id, actorId);
    if (occurrenceRow.status === 'skipped') {
      return this.toRecord(occurrenceRow);
    }
    occurrenceRow.status = 'skipped';
    const saved = await this.entityManager.save(OccurrenceEntity, occurrenceRow);
    return this.toRecord(saved);
  }

  /** br.recur.ending.preserves-history / sds.recur.occurrence-lifecycle's t-orphan: every occurrence of
   * `ruleId` dated on or after `endedAtLocalDate` that is still `materialised` becomes `orphaned`.
   * Already-completed or already-skipped occurrences are left exactly as they are; nothing is deleted. */
  async orphanEndedOccurrences(ruleId: string, endedAtLocalDate: string): Promise<number> {
    const rows = await this.entityManager.findBy(OccurrenceEntity, { ruleId });
    const toOrphan = rows.filter(row => row.status === 'materialised' && row.localDate >= endedAtLocalDate);
    for (const row of toOrphan) {
      row.status = 'orphaned';
      await this.entityManager.save(OccurrenceEntity, row);
    }
    return toOrphan.length;
  }

  private async findRowsForOwner(id: string, actorId: string): Promise<{ occurrenceRow: OccurrenceEntity; taskRow: TaskEntity }> {
    const occurrenceRow = await this.entityManager.findOneBy(OccurrenceEntity, { id });
    if (!occurrenceRow) {
      throw new RecurOccurrenceNotFoundException({ occurrenceId: id });
    }
    const taskRow = await this.entityManager.findOneBy(TaskEntity, { id });
    if (!taskRow) {
      throw new RecurOccurrenceNotFoundException({ occurrenceId: id });
    }
    if (taskRow.owner !== actorId) {
      throw new RecurOccurrenceForbiddenException({ occurrenceId: id, actorId });
    }
    return { occurrenceRow, taskRow };
  }

  private async toRecord(row: OccurrenceEntity): Promise<OccurrenceRecord> {
    const taskRow = await this.entityManager.findOneBy(TaskEntity, { id: row.id });
    if (!taskRow) {
      throw new RecurOccurrenceNotFoundException({ occurrenceId: row.id });
    }
    return new OccurrenceRecord(
      row.id,
      taskRow.owner,
      taskRow.title,
      taskRow.complete,
      taskRow.completedAt,
      row.ruleId,
      row.windowKey,
      row.localDate,
      row.dueAtUtc,
      row.status as OccurrenceStatus,
    );
  }
}
