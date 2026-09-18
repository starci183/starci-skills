import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, AuditLogLineEntity } from '../../platform/databases/postgresql/primary';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogLineRecord } from './types/audit-log-line-record';
import type { ResolvedAuditLine } from './types/resolved-audit-line';

const GENESIS = 'GENESIS';

/** Injected so a test can advance time without a real 400-day wait (nfr.audit.retention's measurement). */
export type Clock = () => Date;
const systemClock: Clock = () => new Date();

interface ChainBreak {
  index: number;
  reason: 'broken-prev-hash' | 'content-mismatch';
}

export interface VerifyChainResult {
  readonly valid: boolean;
  readonly totalLines: number;
  readonly break: ChainBreak | null;
}

const hashContent = (prevHash: string, at: Date, action: string, target: string | null, keyId: string, actor: string): string =>
  createHash('sha256').update(`${prevHash}|${at.toISOString()}|${action}|${target ?? ''}|${keyId}|${actor}`).digest('hex');

/**
 * sds.audit.log-chain: appends one hash-chained, per-person-sealed line per tracked action.
 * br.audit.append-only: once appended, a line's stored bytes and its position in the chain never change
 * - this service never issues an UPDATE or DELETE against `audit_log_lines`, only INSERT and read.
 * br.audit.retention: there is correspondingly no eviction path here at all; `sweepRetention` exists
 * only as the named hook nfr.audit.retention's fake-clock harness calls, and it never deletes anything -
 * retention holds by the absence of any code path that could shorten a line's life, not by a flag.
 */
@Injectable()
export class AuditLogService {
  private readonly clock: Clock;

  constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    private readonly keystore: AuditKeystoreService,
    @Optional() clock?: Clock,
  ) {
    // Nest's DI always passes a third argument once the constructor declares one (there is no
    // provider for the bare `Clock` function type, so `@Optional()` resolves it to `undefined` rather
    // than throwing) - a JS default parameter never gets the chance to apply in that case, unlike a
    // plain `new AuditLogService(...)` call in a spec, so the fallback is applied explicitly here.
    this.clock = clock ?? systemClock;
  }

  /** fr.audit.log.append / sds.audit.log-chain's t-append. `actorPersonId` may be the real subject or
   * AuditKeystoreService.SYSTEM_ACTOR_ID for the two lines br.audit.erasure.logged requires. */
  async append(actorPersonId: string, action: string, target: string | null = null): Promise<AuditLogLineRecord> {
    const { keyId, key } = await this.keystore.getOrCreateKey(actorPersonId);
    const at = this.clock();
    const sealedActor = this.keystore.seal(key, actorPersonId);
    const prevHash = await this.lastHash();
    const hash = hashContent(prevHash, at, action, target, keyId, sealedActor);
    const saved = await this.entityManager.save(AuditLogLineEntity, {
      at,
      action,
      target,
      keyId,
      actor: sealedActor,
      prevHash,
      hash,
    });
    return new AuditLogLineRecord(saved.id, at, action, target, actorPersonId, false);
  }

  private async lastHash(): Promise<string> {
    const [last] = await this.entityManager.find(AuditLogLineEntity, { order: { id: 'DESC' }, take: 1 });
    return last?.hash ?? GENESIS;
  }

  /**
   * ac.audit.append-only.chain-detects-tamper: recomputes the chain from the first line forward,
   * re-deriving `prevHash` from the *previous row's actual stored hash* (never trusting a row's own
   * stored `prevHash` blindly) so a removed line surfaces as a broken link at the line that followed it,
   * and a changed field surfaces as a content mismatch at that line - exactly the two failure shapes the
   * acceptance criterion names. `break.index` is the 0-based position in the chain as currently stored,
   * which is where a fuzz test finds the row it mutated once a removed line has shifted every later
   * position down by one.
   */
  async verifyChain(): Promise<VerifyChainResult> {
    const rows = await this.entityManager.find(AuditLogLineEntity, { order: { id: 'ASC' } });
    let expectedPrev = GENESIS;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (row.prevHash !== expectedPrev) {
        return { valid: false, totalLines: rows.length, break: { index, reason: 'broken-prev-hash' } };
      }
      const expectedHash = hashContent(row.prevHash, row.at, row.action, row.target, row.keyId, row.actor);
      if (expectedHash !== row.hash) {
        return { valid: false, totalLines: rows.length, break: { index, reason: 'content-mismatch' } };
      }
      expectedPrev = row.hash;
    }
    return { valid: true, totalLines: rows.length, break: null };
  }

  /** nfr.audit.retention's named hook: a fake-clock test advances `clock`, calls this, and asserts the
   * count and chain validity are unchanged. It deliberately performs no eviction - see the class comment. */
  async sweepRetention(): Promise<{ lineCount: number; valid: boolean }> {
    const result = await this.verifyChain();
    return { lineCount: result.totalLines, valid: result.valid };
  }

  /** fr.audit.log.read's per-line resolution: a tombstoned line (destroyed key) reads back as
   * tombstoned rather than throwing. */
  async readLine(row: AuditLogLineEntity): Promise<ResolvedAuditLine> {
    const key = await this.keystore.getKeyMaterial(row.keyId);
    if (!key) {
      return { at: row.at, action: row.action, target: row.target, actor: null, tombstoned: true };
    }
    const actor = this.keystore.unseal(key, row.actor);
    if (actor === null) {
      return { at: row.at, action: row.action, target: row.target, actor: null, tombstoned: true };
    }
    return { at: row.at, action: row.action, target: row.target, actor, tombstoned: false };
  }

  /**
   * Every line the log holds, oldest first, each resolved through readLine - the whole-chain read
   * fr.audit.log.read's operator path (audit-operator-read.ts's filter/summary pair) runs over. Like
   * findLinesForPerson it returns only resolved shapes: the response keeps the record's postcondition
   * (no sealed actor blob, no keyId) by construction, tombstoned or not.
   */
  async readAllLines(): Promise<ResolvedAuditLine[]> {
    const rows = await this.entityManager.find(AuditLogLineEntity, { order: { id: 'ASC' } });
    return Promise.all(rows.map(row => this.readLine(row)));
  }

  /**
   * The lines a given person produced, oldest first. Filters by `keyId` (opaque, never the person's own
   * id) rather than decrypting every row in the table - efficient, and it is exactly the boundary
   * fr.audit.log.read's postcondition draws: the response this feeds never carries that `keyId` back out,
   * only the decrypted `actor` (which here always equals `personId`, since the filter already selected
   * their own key) or a tombstoned line if erasure raced this same read.
   */
  async findLinesForPerson(personId: string): Promise<ResolvedAuditLine[]> {
    const keyId = await this.keystore.getKeyIdForPerson(personId);
    if (!keyId) return [];
    const rows = await this.entityManager.find(AuditLogLineEntity, { where: { keyId }, order: { id: 'ASC' } });
    return Promise.all(rows.map(row => this.readLine(row)));
  }

  /** fr.audit.export: identical resolution to findLinesForPerson - once a completed erasure destroys the
   * subject's key, this and the own-lines read agree by construction, both finding no keyId to filter on. */
  async exportForPerson(personId: string): Promise<ResolvedAuditLine[]> {
    return this.findLinesForPerson(personId);
  }
}
