import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger, openLedgerReader, LEDGER_VERSION } from '../../engine/db/ledger.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { quickCheck, backupDue, backupLedger } from '../../scripts/reconciler/ledger-health.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const NOW = new Date(2026, 9, 4, 4).getTime();
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-snapshot-'));
  let ledger=null;
  t.after(() => { try { ledger?.close(); } finally { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }); } });
  const file = path.join(root, 'runtime.sqlite'), dir = path.join(root, 'snapshots');
  ledger = openLedger({ file, now: () => NOW });
  const ledgerId = ledger.ledgerId;
  seedWorkflow(ledger,{id:'snapshot-workflow',now:()=>NOW});
  ledger.appendEvent({ workflowId:'snapshot-workflow', entityType: 'fixture', entityId: 'snapshot', kind: 'snapshot-fixture', payload: { value: 'retained' } });
  ledger.close(); ledger=null;
  return { root, file, dir, ledgerId, keep: 1, now: NOW };
}

test('ledger health distinguishes an intact future schema, SQLite downgrade and inaccessible file from damaged pages', (t) => {
  const f = fixture(t), ledger = openLedger({ file: f.file });
  ledger.db.exec(`PRAGMA user_version=${LEDGER_VERSION + 1}`); ledger.close();
  const before = sha256File(f.file);
  assert.equal(quickCheck(f.file).reason, 'schema-incompatible');
  assert.equal(sha256File(f.file), before, 'the probe preserves original database bytes');
  const refused = quickCheck(f.file, { verifiedOpen: () => { throw Object.assign(Error('newer SQLite'), { code: 'STARCI_LEDGER_SQLITE_DOWNGRADE' }); } });
  assert.equal(refused.reason, 'sqlite-downgrade');
  assert.equal(quickCheck(f.file, { open: () => { throw Object.assign(Error('access denied'), { code: 'EACCES' }); } }).reason, 'inaccessible');
  const garbage = path.join(f.root, 'garbage.sqlite'); fs.writeFileSync(garbage, 'not a database'.repeat(400));
  assert.equal(quickCheck(garbage).reason, 'integrity-failed');
  assert.equal(quickCheck(path.join(f.root, 'absent.sqlite')).reason, 'absent');
});

test('a published ledger snapshot reopens with its identity and semantic event bytes intact', (t) => {
  const f = fixture(t), r = backupLedger(f);
  assert.equal(r.ok, true, r.error); assert.equal(r.verified, true);
  assert.equal(r.ledgerId, f.ledgerId); assert.equal(r.sha256, sha256File(r.file));
  const db = openLedgerReader(r.file);
  try {
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get().value, f.ledgerId);
    assert.deepEqual(JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='snapshot-fixture'").get().payload_json), { value: 'retained' });
  } finally { db.close(); }
  assert.equal(backupDue({ ...f, backupHour: 3 }), false);
  assert.equal(backupDue({ ...f, ledgerId: 'different-ledger', backupHour: 3, exists: () => true, check: () => ({ ok: false }) }), true);
});

test('wrong source identity produces no published snapshot and preserves prior restore points', (t) => {
  const f = fixture(t), good = backupLedger(f), before = sha256File(good.file);
  const r = backupLedger({ ...f, ledgerId: 'wrong-id', now: NOW + 86_400_000 });
  assert.equal(r.ok, false); assert.equal(r.stage, 'source'); assert.deepEqual(r.pruned, []);
  assert.equal(sha256File(good.file), before);
});

for (const failure of ['verification', 'publication', 'digest']) {
  test(`failed snapshot ${failure} preserves the prior verified restore point`, (t) => {
    const f = fixture(t), good = backupLedger(f), before = sha256File(good.file);
    const seam = failure === 'verification' ? { check: () => ({ ok: false, reason: 'schema-incompatible', result: ['wrong schema'] }) }
      : failure === 'publication' ? { publish: () => { throw Object.assign(Error('rename denied'), { code: 'EACCES' }); } }
        : { publish: (from, to) => { fs.renameSync(from, to); fs.writeFileSync(to, 'changed after verification'); } };
    const r = backupLedger({ ...f, now: NOW + 86_400_000, ...seam });
    assert.equal(r.ok, false); assert.equal(r.verified, false); assert.deepEqual(r.pruned, []);
    assert.equal(sha256File(good.file), before);
  });
}

test('a prune failure is visible separately from a verified usable new snapshot', (t) => {
  const f = fixture(t), good = backupLedger(f);
  const r = backupLedger({ ...f, now: NOW + 86_400_000, remove: () => { throw Error('delete denied'); } });
  assert.equal(r.ok, true, r.error); assert.equal(r.verified, true);
  assert.equal(r.retentionErrors.length, 1); assert.equal(r.pruned.length, 0);
  assert.equal(fs.existsSync(good.file), true); assert.equal(quickCheck(r.file, { expectedLedgerId: f.ledgerId }).ok, true);
});
