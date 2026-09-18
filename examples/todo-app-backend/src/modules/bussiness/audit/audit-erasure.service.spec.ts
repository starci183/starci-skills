import { AuditErasureRequestEntity, AuditLogLineEntity } from '../../platform/databases/postgresql/primary';
import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService, SYSTEM_ACTOR_ID } from './audit-keystore.service';
import { AuditLogService } from './audit-log.service';
import { AuditErasureService } from './audit-erasure.service';

const build = () => {
  const manager = createFakeAuditEntityManager();
  const keystore = new AuditKeystoreService(manager as never);
  const log = new AuditLogService(manager as never, keystore);
  const erasure = new AuditErasureService(manager as never, log, keystore);
  return { manager, keystore, log, erasure };
};

describe('AuditErasureService', () => {
  it('sds.audit.erasure-request t-request/t-verify: request() creates the row directly verified, since the caller is always the subject', async () => {
    const { erasure } = build();

    const record = await erasure.request('person-1');

    expect(record.state).toBe('verified');
    expect(record.personId).toBe('person-1');
    expect(record.verifiedAt).not.toBeNull();
  });

  it('sds.audit.erasure-request t-verify as its own second round: confirm() on the still-pending request verifies it for its subject', async () => {
    const { log, keystore, erasure } = build();
    await log.append('person-1', 'sign-in', null); // a line first, so the subject has a key to keep
    const requested = await (erasure as unknown as {
      tRequest(personId: string): Promise<{ requestId: string }>;
    }).tRequest('person-1'); // the state tRequest leaves behind, before chained verification

    const verified = await erasure.confirm(requested.requestId, 'person-1');

    expect(verified.state).toBe('verified');
    expect(verified.personId).toBe('person-1');
    expect(verified.verifiedAt).not.toBeNull();
    expect(await keystore.getKeyIdForPerson('person-1')).not.toBeNull(); // t-verify touches no keys
  });

  it('sds.audit.erasure-request t-verify: confirm() by a stranger of a still-pending request refuses it (t-refuse), and nothing about the subject\'s keys is touched', async () => {
    const { log, keystore, erasure } = build();
    await log.append('person-1', 'sign-in', null);
    const requested = await (erasure as unknown as {
      tRequest(personId: string): Promise<{ requestId: string }>;
    }).tRequest('person-1');
    const keyIdBefore = await keystore.getKeyIdForPerson('person-1');

    await expect(erasure.confirm(requested.requestId, 'someone-else')).rejects.toMatchObject({
      code: 'ERASURE_REQUEST_FORBIDDEN',
    });
    expect(await keystore.getKeyIdForPerson('person-1')).toBe(keyIdBefore);
  });

  it('ac.audit.erasure.logged.request-and-completion-are-lines: an erasure-requested line and an erasure-completed line both exist, in that order, and neither names the erased person', async () => {
    const { log, erasure } = build();
    await log.append('person-1', 'sign-in', null); // some ordinary activity first

    const requested = await erasure.request('person-1');
    await erasure.execute(requested.requestId, 'person-1');

    const systemLines = await log.findLinesForPerson(SYSTEM_ACTOR_ID);
    expect(systemLines.map(line => line.action)).toEqual(['audit.erasure.requested', 'audit.erasure.completed']);
    expect(systemLines.every(line => line.target === requested.requestId)).toBe(true);
    expect(systemLines.every(line => line.actor === SYSTEM_ACTOR_ID)).toBe(true);

    // Neither line's actor resolves to the erased person.
    const personLines = await log.findLinesForPerson('person-1');
    expect(personLines.some(line => line.action.startsWith('audit.erasure'))).toBe(false);
  });

  describe('br.audit.erasure.right / fr.audit.erasure.complete', () => {
    it('ac.audit.erasure.right.identifying-fields-unreadable: after completion, no reader (including export) resolves the subject\'s identity from any line they produced, and every line\'s bytes, position and hash stay unchanged', async () => {
      const { manager, log, erasure } = build();
      await log.append('person-1', 'task.created', 'task-1');
      await log.append('person-1', 'task.completed', 'task-1');
      const beforeChain = await log.verifyChain();
      const rowsBefore = manager._rowsFor(AuditLogLineEntity)
        .filter(row => row.action === 'task.created' || row.action === 'task.completed')
        .map(row => ({ ...row }));

      const requested = await erasure.request('person-1');
      await erasure.execute(requested.requestId, 'person-1');

      expect(await log.findLinesForPerson('person-1')).toEqual([]);
      expect(await log.exportForPerson('person-1')).toEqual([]);

      const rowsAfter = manager._rowsFor(AuditLogLineEntity)
        .filter(row => row.action === 'task.created' || row.action === 'task.completed');
      expect(rowsAfter).toEqual(rowsBefore);
      const afterChain = await log.verifyChain();
      expect(afterChain.valid).toBe(true);
      expect(afterChain.totalLines).toBeGreaterThanOrEqual(beforeChain.totalLines);
    });

    it('data.audit.erasure-request invariant: personId is dropped from the request row once state reaches complete', async () => {
      const { erasure } = build();
      const requested = await erasure.request('person-1');

      const completed = await erasure.execute(requested.requestId, 'person-1');

      expect(completed.state).toBe('complete');
      expect(completed.personId).toBeNull();
    });

    it('a caller who is not the request\'s own subject is forbidden from completing it', async () => {
      const { erasure } = build();
      const requested = await erasure.request('person-1');

      await expect(erasure.execute(requested.requestId, 'someone-else')).rejects.toMatchObject({
        code: 'ERASURE_REQUEST_FORBIDDEN',
      });
    });

    it('completing an unknown requestId is refused as not found', async () => {
      const { erasure } = build();

      await expect(erasure.execute('does-not-exist', 'person-1')).rejects.toMatchObject({
        code: 'ERASURE_REQUEST_NOT_FOUND',
      });
    });

    it('a request already complete cannot be completed again', async () => {
      const { erasure } = build();
      const requested = await erasure.request('person-1');
      await erasure.execute(requested.requestId, 'person-1');

      await expect(erasure.execute(requested.requestId, 'person-1')).rejects.toMatchObject({
        code: 'ERASURE_REQUEST_INVALID_STATE',
      });
    });
  });

  it('t-refuse: a mismatched requester at verification time is refused, and nothing about the subject\'s keys is touched', async () => {
    const { manager, keystore, erasure } = build();
    await keystore.getOrCreateKey('person-1');

    // Simulate a request row created for person-1 but "verified" by a different caller by writing
    // directly to the store (the only way to reach t-verify's mismatch branch without a second
    // identity channel this example does not have).
    const row = manager._rowsFor(AuditErasureRequestEntity);
    row.push({
      requestId: 'req-mismatch',
      personId: 'person-1',
      state: 'requested',
      requestedAt: new Date(),
      verifiedAt: null,
      refusedAt: null,
      executingAt: null,
      completedAt: null,
    });

    await expect((erasure as unknown as { tVerify(id: string, caller: string): Promise<unknown> }).tVerify('req-mismatch', 'someone-else'))
      .rejects.toMatchObject({ code: 'ERASURE_REQUEST_FORBIDDEN' });

    const refused = row.find(r => r.requestId === 'req-mismatch');
    expect(refused?.state).toBe('refused');
    expect(await keystore.getKeyIdForPerson('person-1')).not.toBeNull(); // key untouched
  });
});
