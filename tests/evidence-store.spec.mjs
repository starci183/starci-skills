import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { ARTIFACT_ROOT_ENV, artifactRoot, putBlob, getBlob, blobPath, hasBlob, statBlob, putJson } from '../scripts/lib/artifact-store.mjs';
import { openLedger, ledgerFileFor, EVIDENCE_SCHEMA_VERSION, EVIDENCE_SCHEMA_MIGRATE_ENV } from '../engine/ledger-db.mjs';

const fixture = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-evidence-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const withEnv = (t, key, value) => {
  const before = process.env[key];
  process.env[key] = value;
  t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
};

test('blob store publishes immutable bytes and a sidecar, and canonical JSON is stable', t => {
  const root = fixture(t);
  withEnv(t, ARTIFACT_ROOT_ENV, path.join(root, 'artifacts'));
  const body = Buffer.from('evidence\n');
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const first = putBlob(body, { mediaType: 'text/plain' });
  assert.deepEqual(first, { sha, size: body.length, mediaType: 'text/plain' });
  assert.equal(blobPath(sha), path.join(artifactRoot(), sha.slice(0, 2), sha));
  assert.equal(hasBlob(sha), true);
  assert.deepEqual(getBlob(sha), body);
  assert.equal(statBlob(sha).createdAt.length > 0, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${blobPath(sha)}.json`, 'utf8')).size, body.length);
  const source = path.join(root, 'source.txt');
  fs.writeFileSync(source, body);
  assert.deepEqual(putBlob(source, { mediaType: 'application/octet-stream' }), first, 'first media type wins');
  assert.equal(putJson({ z: 1, a: { y: 2, x: 3 } }), putJson({ a: { x: 3, y: 2 }, z: 1 }));
  assert.equal(hasBlob('0'.repeat(64)), false);
  assert.throws(() => blobPath('../escape'), /sha256/);
});

test('fresh and existing ledgers gain the owner evidence schema idempotently with a verified backup', t => {
  const root = fixture(t);
  const backups = path.join(root, 'backups');
  withEnv(t, 'STARCI_LEDGER_BACKUP_ROOT', backups);
  withEnv(t, EVIDENCE_SCHEMA_MIGRATE_ENV, '1');
  const file = ledgerFileFor(path.join(root, 'repo'));
  let ledger = openLedger({ file });
  try {
    const db = ledger.db;
    for (const name of ['blobs', 'job_artifacts_v2', 'check_runs', 'report_attachments', 'artifact_proofs_v2', 'op_attempts', 'unit_edges'])
      assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name), name);
    for (const name of ['blob_refs', 'v_op_history', 'v_media', 'v_timeline', 'v_workflow_progress'])
      {
        assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='view' AND name=?").get(name), name);
        db.prepare(`SELECT * FROM ${name} LIMIT 0`).all();
      }
    for (const name of ['file_uri', 'http_path'])
      assert.ok(db.prepare('PRAGMA table_info(blobs)').all().some(row => row.name === name));
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='evidence_schema_version'").get().value, EVIDENCE_SCHEMA_VERSION);
    ledger.ensureWorkflow({ workflowId: 'wf' });
    db.prepare('INSERT INTO job_artifacts(workflow_id,job_id,kind,path,sha256,bytes,created_at) VALUES(?,?,?,?,?,?,?)')
      .run('wf', 'job', 'file', '.starciwork/kernel-evidence/x', 'a'.repeat(64), 1, 1);
    assert.equal(db.prepare("SELECT units_total FROM v_workflow_progress WHERE workflow_id='wf'").get().units_total, 0);
    db.prepare("DELETE FROM meta WHERE key='evidence_schema_version'").run();
  } finally { ledger.close(); }
  ledger = openLedger({ file });
  try {
    assert.equal(ledger.db.prepare('SELECT count(*) AS n FROM job_artifacts').get().n, 1);
    assert.equal(ledger.db.prepare("SELECT value FROM meta WHERE key='evidence_schema_version'").get().value, EVIDENCE_SCHEMA_VERSION);
  } finally { ledger.close(); }
  const names = fs.readdirSync(backups);
  assert.equal(names.length, 1);
  const backup = new DatabaseSync(path.join(backups, names[0]), { readOnly: true });
  try {
    assert.equal(backup.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    assert.equal(backup.prepare('SELECT count(*) AS n FROM job_artifacts').get().n, 1);
  } finally { backup.close(); }
  openLedger({ file }).close();
  assert.equal(fs.readdirSync(backups).length, 1, 'reopen does not create another backup');
});
