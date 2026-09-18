import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IsNull } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, NotifyDigestWindowEntity } from '../../platform/databases/postgresql/primary';
import { DigestWindowRecord } from './types/digest-window-record';

/** decision.notify.digest-window's chosen default: one rolling window per person per channel, 10 minutes
 * unless a preference overrides it. */
export const DEFAULT_DIGEST_WINDOW_MINUTES = 10;

export interface AdmitIntoWindowResult {
  readonly windowId: string;
  /** True only when this call opened a brand-new window; false when the notification joined one that
   * was already open. Callers use this to decide whether to schedule the one flush timer for the
   * window - a join must never schedule a second one. */
  readonly opened: boolean;
  readonly closesAt: Date;
}

export interface FlushedWindow {
  readonly windowId: string;
  readonly personId: string;
  readonly channel: string;
}

/**
 * br.notify.digest.window / decision.notify.digest-window ("one-rolling-window-per-channel"): every
 * notification admitted for one person and one channel before their window closes joins the same group;
 * the group's content is read at close, never at open. This service owns only the window's own
 * bookkeeping (open/close/flushed); which notifications belong to a window is data.notify.notification's
 * own `digestGroupId` field, assigned by whoever calls this service (see notify.service.ts), so this
 * class never needs to know about NotifyNotificationEntity.
 */
@Injectable()
export class DigestService {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

  /** Joins the person+channel's currently open window, or opens a fresh one if none is open or the one
   * that was open has already closed (fr.notify.digest's exception flow: a closed window is never
   * joined, even if nothing has flushed it yet). */
  async admit(personId: string, channel: string, now: Date, windowMinutes: number = DEFAULT_DIGEST_WINDOW_MINUTES): Promise<AdmitIntoWindowResult> {
    // A literal `flushedAt: null` is silently dropped by TypeORM's real `findOneBy` (verified against
    // the real dev Postgres: it returned an already-flushed row) rather than translated to `IS NULL`, so
    // `IsNull()` is required here, not a style preference. `fake-entity-manager.ts`'s `matches()`
    // duck-types this exact operator so a unit spec sees the same "not yet flushed" semantics.
    const open = await this.entityManager.findOneBy(NotifyDigestWindowEntity, { personId, channel, flushedAt: IsNull() });
    if (open && open.closesAt.getTime() > now.getTime()) {
      return { windowId: open.id, opened: false, closesAt: open.closesAt };
    }
    const closesAt = new Date(now.getTime() + windowMinutes * 60_000);
    const saved = await this.entityManager.save(NotifyDigestWindowEntity, {
      id: randomUUID(),
      personId,
      channel,
      opensAt: now,
      closesAt,
      flushedAt: null,
    });
    return { windowId: saved.id, opened: true, closesAt: saved.closesAt };
  }

  /** Reads the window's content at close. Returns null (and writes nothing) when the window does not
   * exist, has already been flushed, or has not closed yet (ac.notify.digest.window.collapses-into-one-message:
   * "Flushing before the window closes returns nothing."). */
  async flush(windowId: string, now: Date): Promise<FlushedWindow | null> {
    const row = await this.entityManager.findOneBy(NotifyDigestWindowEntity, { id: windowId });
    if (!row || row.flushedAt || row.closesAt.getTime() > now.getTime()) {
      return null;
    }
    row.flushedAt = now;
    await this.entityManager.save(NotifyDigestWindowEntity, row);
    return { windowId: row.id, personId: row.personId, channel: row.channel };
  }

  async findById(windowId: string): Promise<DigestWindowRecord | null> {
    const row = await this.entityManager.findOneBy(NotifyDigestWindowEntity, { id: windowId });
    return row ? new DigestWindowRecord(row.id, row.personId, row.channel, row.opensAt, row.closesAt, row.flushedAt) : null;
  }
}
