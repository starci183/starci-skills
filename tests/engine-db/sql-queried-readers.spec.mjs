// A column the runtime queries with SQL (jobs.payload_json holds the dispatch refusal memo the digest reads) gives the same bytes through every reader
// kind: the writer's handle (get, all, iterate), a read-only handle, a machine-style raw handle and json_extract in the statement itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openLedger, openLedgerReader, updateJob } from '../../engine/db/ledger.mjs';

const memo = { code: 'grammar-context-missing', step: 'dispatch', fingerprint: 'f'.repeat(16), firstAt: 1, lastAt: 2, count: 1, nextAt: 3 };

test('a refusal memo written through updateJob reads back identically through every reader kind', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sql-queried-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const file = path.join(dir, 'runtime.sqlite');
  const ledger = openLedger({ file });
  ledger.ensureWorkflow({ workflowId: 'wf' });
  ledger.write.createUnit({ workflowId: 'wf', unitId: 'j1', opId: 'op', subjectKey: 'j1', goalRevision: 1 });
  ledger.enqueueJob({ jobId: 'j1', workflowId: 'wf', unitId: 'j1', opId: 'op', tryNo: 1, kind: 'op', payload: { opId: 'op' } });
  ledger.transaction(() => updateJob(ledger.db, { jobId: 'j1', payload: { opId: 'op', dispatchRefusal: memo } }));
  const sql = 'SELECT payload_json FROM jobs WHERE job_id=?';
  const want = JSON.stringify({ opId: 'op', dispatchRefusal: memo });
  const bytes = [ledger.db.prepare(sql).get('j1').payload_json, ledger.db.prepare(sql).all('j1')[0].payload_json, [...ledger.db.prepare(sql).iterate('j1')][0].payload_json];
  const reader = openLedgerReader(file);
  try { bytes.push(reader.prepare(sql).get('j1').payload_json); } finally { reader.close(); }
  const raw = new DatabaseSync(file, { readOnly: true });
  try {
    bytes.push(raw.prepare(sql).get('j1').payload_json);
    assert.equal(raw.prepare("SELECT json_extract(payload_json,'$.dispatchRefusal.code') AS c FROM jobs WHERE job_id=?").get('j1').c, memo.code, 'json_extract sees the memo inline');
  } finally { raw.close(); }
  ledger.close();
  for (const b of bytes) assert.equal(b, want);
});
