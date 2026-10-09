// An event that carries a launch admission decision or an admission refusal keeps a bounded summary inline and the whole payload behind
// payload_sha, so the seat publication of a Kernel launch never fails for the size of the decision (a live Kernel launch: 16962 bytes > 16384).
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { getBlob } from '../../engine/db/blob.mjs';
import { verifyEventChain } from '../../engine/db/ledger.mjs';
import { EVENT_LIMITS, ADMISSION_SCHEMA } from '../../engine/db/event-compact.mjs';
import { admissionRefusalOf } from '../../scripts/kernel/admission-refusal.mjs';

const WF = 'wf-event-compact';
const quota = () => ({ schema: 'starci/quota-snapshot@1', windows: Array.from({ length: 6 }, (_, i) => ({ name: `window-${i}`, usedPercent: i, resetsAt: 1760000000000 + i, detail: 'x'.repeat(120) })) });
const candidate = (i) => ({ id: `codex/model-${i}/${i}`, provider: 'codex', model: `model-${i}`, pool: `pool-${i}`, effort: 'high', quota: quota() });
const decision = (count) => ({ schema: ADMISSION_SCHEMA, policyVersion: 3, ok: true, reason: 'admitted-plan', chosenBy: 'quality',
  request: { attemptId: 'a1', scopeId: 's1', role: 'kernel', tier: 'strong' },
  selected: candidate(0), eligible: Array.from({ length: count }, (_, i) => candidate(i)),
  rejected: Array.from({ length: count }, (_, i) => ({ id: candidate(i).id, provider: 'codex', model: `model-${i}`, codes: ['quota-low'], detail: 'x'.repeat(100) })),
  pick: { steps: Array.from({ length: count }, (_, i) => ({ step: `s${i}`, chain: [candidate(i)] })) },
  receipt: { id: 'cap-1', fence: 2, role: 'kernel', provider: 'codex', scope: { workflowId: WF } } });

const fixture = (t, run) => withLedger(t, ({ ledger }) => { seedWorkflow(ledger, { id: WF, state: { phase: 'queued' }, generation: 0 }); return run(ledger); });
const rowOf = (ledger, kind) => ledger.db.prepare('SELECT payload_json, payload_sha FROM events WHERE kind=?').get(kind);
const append = (ledger, kind, payload) => ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: WF, kind, payload }));

test('a Kernel seat event whose admission decision is 40 KB publishes, stays under the bound and keeps the whole decision behind payload_sha', (t) => fixture(t, (ledger) => {
  const full = decision(60);
  assert.ok(JSON.stringify(full).length > 40000);
  append(ledger, 'kernel-booted', { terminal: 't1', managed: { dispatchId: 'd1', admission: full } });
  const row = rowOf(ledger, 'kernel-booted');
  assert.ok(row.payload_json.length < EVENT_LIMITS.payloadBytes / 2, `inline view is ${row.payload_json.length} bytes`);
  const inline = JSON.parse(row.payload_json);
  assert.equal(inline.managed.admission.selected.id, 'codex/model-0/0');
  assert.equal(inline.managed.admission.selected.quota, undefined, 'the quota snapshot stays out of the row');
  assert.equal(inline.managed.admission.rejectedCount, 60);
  assert.equal(inline.managed.admission.receipt.fence, 2);
  assert.equal(inline.terminal, 't1');
  const whole = JSON.parse(getBlob(row.payload_sha).toString('utf8'));
  assert.equal(whole.managed.admission.eligible.length, 60);
  assert.equal(whole.managed.admission.selected.quota.windows.length, 6);
  assert.equal(verifyEventChain(ledger.db, WF).ok, true);
}));

test('kernel-start-failed (also the fall-through record) carries the same bounded view of the decision', (t) => fixture(t, (ledger) => {
  append(ledger, 'kernel-start-failed', { step: 'attestation', error: 'late', admission: decision(80), fellThroughTo: { agent: 'claude' } });
  const row = rowOf(ledger, 'kernel-start-failed');
  assert.ok(row.payload_json.length < EVENT_LIMITS.payloadBytes / 2);
  assert.equal(JSON.parse(row.payload_json).step, 'attestation');
  assert.equal(JSON.parse(getBlob(row.payload_sha).toString('utf8')).admission.rejected.length, 80);
}));

test('a dispatch rejection with many refused candidates keeps a bounded refusal and the whole refusal behind payload_sha', (t) => fixture(t, (ledger) => {
  const rejected = Array.from({ length: 300 }, (_, i) => ({ id: `codex/model-${i}/${i}`, provider: 'codex', model: `model-${i}`, codes: ['capacity-full'] }));
  const refusal = admissionRefusalOf({ step: 'admission', decision: { rejected } }, { routeChain: Array.from({ length: 100 }, (_, i) => `agent-${i}`) }, { target: 'agent-0' });
  append(ledger, 'dispatch-rejected', { op: 'code.refactor', step: 'admission', admission: refusal });
  const row = rowOf(ledger, 'dispatch-rejected');
  assert.ok(row.payload_json.length < EVENT_LIMITS.payloadBytes / 2);
  const inline = JSON.parse(row.payload_json).admission;
  assert.deepEqual([inline.class, inline.queuedBecause, inline.rejectedCount, inline.rejected.length], ['wait', 'pool-full', 300, EVENT_LIMITS.rows]);
  assert.equal(JSON.parse(getBlob(row.payload_sha).toString('utf8')).admission.rejected.length, 300);
}));

test('an event without an admission record is stored as it was: inline, no blob', (t) => fixture(t, (ledger) => {
  append(ledger, 'kernel-start-failed', { step: 'x', admission: { receipt: { id: 'capacity-old', fence: 1 } } });
  const row = rowOf(ledger, 'kernel-start-failed');
  assert.equal(row.payload_sha, null);
  assert.deepEqual(JSON.parse(row.payload_json).admission, { receipt: { id: 'capacity-old', fence: 1 } });
}));
