import { AuditLogLineEntity } from '../../platform/databases/postgresql/primary';
import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';
import { AuditLogService, Clock } from './audit-log.service';

const build = (clock?: Clock) => {
  const manager = createFakeAuditEntityManager();
  const keystore = new AuditKeystoreService(manager as never);
  const log = new AuditLogService(manager as never, keystore, clock);
  return { manager, keystore, log };
};

describe('AuditLogService', () => {
  it('fr.audit.log.append: appending increases the line count by exactly one and the chain stays valid', async () => {
    const { log } = build();

    await log.append('person-1', 'sign-in', null);
    const result = await log.verifyChain();

    expect(result.totalLines).toBe(1);
    expect(result.valid).toBe(true);
  });

  it("sds.audit.log-chain's t-append: the acting person's id is sealed, never stored in the clear", async () => {
    const { manager, log } = build();

    await log.append('person-1', 'task.created', 'task-1');

    const [row] = await manager.find(AuditLogLineEntity);
    expect(String(row.actor)).not.toContain('person-1');
    expect(row.keyId).not.toBe('person-1');
  });

  describe('ac.audit.append-only.chain-detects-tamper', () => {
    it('an untouched log of several lines recomputes as fully valid', async () => {
      const { log } = build();
      await log.append('person-1', 'sign-in', null);
      await log.append('person-1', 'task.created', 'task-1');
      await log.append('person-2', 'sign-in', null);
      await log.append('person-1', 'task.completed', 'task-1');

      const result = await log.verifyChain();

      expect(result.valid).toBe(true);
      expect(result.totalLines).toBe(4);
    });

    it('mutating one stored field on an already-appended line surfaces a content mismatch at that line\'s index', async () => {
      const { manager, log } = build();
      await log.append('person-1', 'sign-in', null);
      await log.append('person-1', 'task.created', 'task-1');
      await log.append('person-2', 'sign-in', null);
      await log.append('person-1', 'task.completed', 'task-1');

      // Out-of-band mutation: bypasses AuditLogService's own append path entirely, the way a rogue
      // admin or a compromised disk would.
      const rows = manager._rowsFor(AuditLogLineEntity);
      rows[2].action = 'task.deleted';

      const result = await log.verifyChain();

      expect(result.valid).toBe(false);
      expect(result.break).toEqual({ index: 2, reason: 'content-mismatch' });
    });

    it('removing a line from the middle of the store surfaces a broken prevHash link at the line that followed it', async () => {
      const { manager, log } = build();
      await log.append('person-1', 'sign-in', null);
      await log.append('person-1', 'task.created', 'task-1');
      await log.append('person-2', 'sign-in', null);
      await log.append('person-1', 'task.completed', 'task-1');

      const rows = manager._rowsFor(AuditLogLineEntity);
      rows.splice(2, 1); // remove the third appended line out-of-band

      const result = await log.verifyChain();

      expect(result.valid).toBe(false);
      // The removed line's successor is now at index 2 (it shifted down by one).
      expect(result.break).toEqual({ index: 2, reason: 'broken-prev-hash' });
    });

    it('fuzzes every line and every mutable field: each single out-of-band mutation is detected, and each is undone before the next', async () => {
      const mutableFields = ['at', 'action', 'target', 'keyId', 'actor', 'prevHash', 'hash'] as const;
      let attempted = 0;

      for (let lineIndex = 0; lineIndex < 4; lineIndex++) {
        for (const field of mutableFields) {
          const { manager, log } = build();
          await log.append('person-1', 'sign-in', 'target-a');
          await log.append('person-1', 'task.created', 'task-1');
          await log.append('person-2', 'sign-in', 'target-b');
          await log.append('person-1', 'task.completed', 'task-1');

          const rows = manager._rowsFor(AuditLogLineEntity);
          const original = rows[lineIndex][field];
          rows[lineIndex][field] = field === 'at' ? new Date(Date.now() + 1) : `${String(original)}-tampered`;

          const result = await log.verifyChain();
          attempted++;

          expect(result.valid).toBe(false);
          expect((result.break as { index: number }).index).toBe(lineIndex);
        }
      }

      expect(attempted).toBeGreaterThan(0);
    });

    it('a fuzz over every middle line-removal index is detected, with zero false positives on the untouched baseline', async () => {
      // Only indices with a successor line are fuzzed here: removing the very last line truncates the
      // chain without breaking any prevHash link (there is no "line that followed it" to surface the
      // break at), which is a known, inherent limit of hash-chaining alone - not a gap in this
      // acceptance criterion, whose own wording ("removed from the middle of the store") only commits
      // to detecting a removal that a later line's prevHash can still witness.
      for (let removeIndex = 0; removeIndex < 3; removeIndex++) {
        const { manager, log } = build();
        await log.append('person-1', 'sign-in', null);
        await log.append('person-1', 'task.created', 'task-1');
        await log.append('person-2', 'sign-in', null);
        await log.append('person-1', 'task.completed', 'task-1');

        expect((await log.verifyChain()).valid).toBe(true); // baseline: no false positive before mutation

        manager._rowsFor(AuditLogLineEntity).splice(removeIndex, 1);

        expect((await log.verifyChain()).valid).toBe(false);
      }
    });
  });

  describe('nfr.audit.retention', () => {
    it('a line survives its full 400-day retention window untouched, proven with a fake clock, never real elapsed time', async () => {
      let now = new Date('2026-01-01T00:00:00.000Z');
      const { log } = build(() => now);

      await log.append('person-1', 'sign-in', null);
      now = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000 + 1000);

      const swept = await log.sweepRetention();

      expect(swept.lineCount).toBe(1);
      expect(swept.valid).toBe(true);
    });

    it('retention and erasure are independent axes: past the window, an erased line still exists but no longer decrypts', async () => {
      let now = new Date('2026-01-01T00:00:00.000Z');
      const { keystore, log } = build(() => now);

      const line = await log.append('person-1', 'sign-in', null);
      await keystore.destroyKey('person-1');
      now = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000 + 1000);

      const swept = await log.sweepRetention();
      expect(swept.lineCount).toBe(1); // still exists
      expect(swept.valid).toBe(true); // chain untouched by the erasure

      const rows = await log.findLinesForPerson('person-1');
      expect(rows).toHaveLength(0); // no longer decrypts through the person's own read

      void line;
    });
  });

  describe('findLinesForPerson / exportForPerson', () => {
    it('returns only the lines that person produced, oldest first, never another person\'s lines', async () => {
      const { log } = build();
      await log.append('person-1', 'sign-in', null);
      await log.append('person-2', 'sign-in', null);
      await log.append('person-1', 'task.created', 'task-1');

      const lines = await log.findLinesForPerson('person-1');

      expect(lines.map(line => line.action)).toEqual(['sign-in', 'task.created']);
      expect(lines.every(line => line.actor === 'person-1')).toBe(true);
    });

    it('returns an empty list for a person who never produced a line', async () => {
      const { log } = build();

      expect(await log.findLinesForPerson('nobody')).toEqual([]);
      expect(await log.exportForPerson('nobody')).toEqual([]);
    });
  });
});
