// decisions-doorbell.spec.mjs — the doorbell (scripts/reconciler/decisions.mjs ringDoorbellWith; reconciler DESIGN §10.4)
// and notify.mjs as a supervisor-ruling DI: a busy seat is deferred, never failed; an idle seat gets one ring; the
// rate limit holds; the same text is never rung twice in a row; a notice to a busy Kernel is queued (delivered).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { RING_MIN_GAP_MS, openDecisionRow, planRing, ringDoorbellWith } from '../scripts/reconciler/decisions.mjs';
import { notifyKernel } from '../scripts/supervisor/notify.mjs';
import { readMachine } from '../engine/machine-db.mjs';

const WF = 'wf-bell';
const temp = (t, prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const cleanup = (t, dir, ledger) => t.after(() => { try { ledger?.close(); } catch { /* closed */ } fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
const withOpenDi = (t) => {
  const repo = temp(t, 'starci-bell-');
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  cleanup(t, repo, ledger);
  ledger.ensureWorkflow({ workflowId: WF, title: 'bell' });
  openDecisionRow(ledger, { workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: 'op-1' }, summary: 'blocked', by: 'reconciler/job' }, { now: 0 });
  return { repo, ledger };
};
const seat = (state) => {
  const calls = [];
  const wake = (args) => { calls.push(args.text); return state === 'turn-idle' ? { action: 'kernel-woken', delivered: true, terminal: 'term_1', state } : { action: 'kernel-busy', delivered: false, terminal: 'term_1', state }; };
  return { wake, calls };
};

test('a busy seat is deferred, not failed, and does not use up the rate limit', (t) => {
  const { ledger } = withOpenDi(t);
  const busy = seat('active');
  const r = ringDoorbellWith({ ledger, workflowId: WF, wake: busy.wake, now: 1000 });
  assert.equal(r.action, 'deferred');
  assert.equal(r.delivered, false);
  assert.equal(r.open, 1);
  const idle = seat('turn-idle');
  assert.equal(ringDoorbellWith({ ledger, workflowId: WF, wake: idle.wake, now: 2000 }).action, 'rung', 'the seat turned idle: ring now');
});

test('an idle seat gets exactly one ring with the fixed line; the rate limit holds', (t) => {
  const { ledger } = withOpenDi(t);
  const idle = seat('turn-idle');
  const first = ringDoorbellWith({ ledger, workflowId: WF, wake: idle.wake, now: 10_000 });
  assert.equal(first.action, 'rung');
  assert.deepEqual(idle.calls, [`[decide] 1 việc chờ: api decisions --workflow ${WF}`]);
  const soon = ringDoorbellWith({ ledger, workflowId: WF, wake: idle.wake, now: 10_000 + RING_MIN_GAP_MS - 1 });
  assert.equal(soon.action, 'rate-limited');
  assert.equal(idle.calls.length, 1, 'no second ring inside the gap');
  const later = ringDoorbellWith({ ledger, workflowId: WF, wake: idle.wake, now: 10_000 + RING_MIN_GAP_MS });
  assert.equal(later.action, 'rung');
  assert.notEqual(idle.calls[1], idle.calls[0], 'never the same text twice in a row');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-doorbell'").get().n, 2);
});

test('nothing open: no ring', (t) => {
  const repo = temp(t, 'starci-bell-');
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  cleanup(t, repo, ledger);
  ledger.ensureWorkflow({ workflowId: WF, title: 'bell' });
  const idle = seat('turn-idle');
  assert.equal(ringDoorbellWith({ ledger, workflowId: WF, wake: idle.wake, now: 1 }).action, 'nothing-open');
  assert.equal(idle.calls.length, 0);
  assert.deepEqual(planRing({ open: 2, workflowId: WF, last: { at: 0, text: 'x', count: 3 }, now: RING_MIN_GAP_MS }).count, 4);
});

test('notify.mjs opens a supervisor-ruling DI and rings; a busy Kernel is queued and delivered', (t) => {
  const home = temp(t, 'starci-bell-sup-');
  cleanup(t, home, null);
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(home, 'machine.sqlite') };
  const opened = [];
  const open = (repo, di) => { opened.push(di); return { ok: true, json: { ok: true, decision: { id: 'di-0000beef' }, superseded: ['di-0000cafe'] } }; };
  const busy = notifyKernel({ repo: 'D:/fixture', workflowId: WF, text: 'fixed by .claude abc123: resolve inc-1', item: `gate|${WF}|inc-1`, env, open, ring: () => ({ action: 'deferred', wake: 'kernel-busy' }) });
  assert.equal(busy.action, 'queued');
  assert.equal(busy.delivered, true);
  assert.equal(busy.decision, 'di-0000beef');
  assert.deepEqual(busy.superseded, ['di-0000cafe']);
  assert.equal(opened[0].kind, 'supervisor-ruling');
  assert.equal(opened[0].decider, 'kernel');
  assert.match(opened[0].summary, /^\[supervisor\] fixed by/);
  const idle = notifyKernel({ repo: 'D:/fixture', workflowId: WF, text: 'second', env, open, ring: () => ({ action: 'rung' }) });
  assert.equal(idle.action, 'kernel-woken');
  const failed = notifyKernel({ repo: 'D:/fixture', workflowId: WF, text: 'third', env, open: () => ({ ok: false, json: { ok: false, error: 'ledger-missing', code: 'ledger-missing' } }), ring: () => { throw new Error('never rung'); } });
  assert.equal(failed.action, 'decision-open-failed');
  assert.equal(failed.delivered, false);
  const events = readMachine((m) => m.supEvents({ kinds: ['supervisor-action', 'supervisor-notice'], order: 'asc' }), [], { env });
  assert.deepEqual(events.filter((e) => e.kind === 'supervisor-action').map((e) => e.payload.item), [`gate|${WF}|inc-1`], '--item stops the owed-action SLA (recordAction)');
  assert.equal(events.filter((e) => e.kind === 'supervisor-notice' && e.payload.delivered === true).length, 2);
});
