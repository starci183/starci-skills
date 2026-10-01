// decisions-archived-workflow.spec.mjs — archive/finish close a workflow's live Decision Items
// (cluster decisions-archived-workflow). Evidence 2026-09-30 nivo-backend: 7 DIs open/claimed on workflows
// archived by owner ruling; `api decisions --resolve` on them refuses 'workflow-archived: no further writes'
// (events_refuse_archived), so they could never close yet kept being counted, escalated and digested.
//   1. api archive | api finish resolves every live DI (open|claimed|escalated) of the workflow inside its own
//      transaction, BEFORE the phase flips: resolution by 'runtime', verb workflow-archived|workflow-finished,
//      event decision-resolved auto:true.
//   2. A leftover DI locked open on an already-archived workflow is never listed, blocking, escalated or rung.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { changeWorkflowPhase, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { blockingDecisions, claimDecision, escalateDecision, escalateDue, listDecisions, openDecisionRow, resolveDecision, ringDoorbellWith } from '../../scripts/machine/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const WF = 'wf-di-archive', OTHER = 'wf-di-other', WF_ARCH = 'wf-di-archived', WF_FIN = 'wf-di-finished';

const repoWithLedger = (t, workflowIds) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-di-arch-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-di-arch-sup-'));
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => {
    try { ledger.close(); } catch { /* closed */ }
    fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(home, 'machine.sqlite'), NODE_NO_WARNINGS: '1' };
  const api = (...args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, env });
  for (const id of workflowIds) ledger.ensureWorkflow({ workflowId: id, title: 'di-arch' });
  const di = ({ id }) => ledger.db.prepare('SELECT status, resolved_by, resolution_verb, claim_by FROM decision_items WHERE di_id=?').get(id);
  return { repo, ledger, env, api, di };
};

/** Walk phase along workflow_transitions the way the verbs do (lifecycle row, then the update). */
const toPhase = (ledger, workflowId, chain) => {
  for (const to of chain) changeWorkflowPhase(ledger.db, { workflowId, to, by: 'test', reason: `seed-${to}`, at: Date.now() });
};
const openDi = (ledger, workflowId, extra = {}) => openDecisionRow(ledger, {
  workflowId, kind: 'progress-stall', entity: { type: 'workflow', id: workflowId },
  summary: 'no unit passed in 60 min', by: 'reconciler/workflow', ...extra,
}, { now: 0 }).di;

test('api archive resolves every live DI of the workflow (open|claimed|escalated) before the phase flips', (t) => {
  const { ledger, api, di } = repoWithLedger(t, [WF, OTHER]);
  const open = openDi(ledger, WF, { idempotencyKey: 'progress-stall:wf:a' });
  const claimed = openDi(ledger, WF, { kind: 'worker-question', idempotencyKey: 'worker-question:wf:b' });
  claimDecision(ledger, claimed.id, { by: `kernel:${WF}`, now: 1 });
  const escalated = openDi(ledger, WF, { kind: 'checks-needed', idempotencyKey: 'checks-needed:wf:c' });
  escalateDecision(ledger, escalated.id, { to: 'supervisor', by: `kernel:${WF}`, now: 2 });
  const done = openDi(ledger, WF, { kind: 'retry-decision', idempotencyKey: 'retry-decision:wf:d' });
  resolveDecision(ledger, done.id, { by: `kernel:${WF}`, verb: 'settle --verdict fail', now: 3 });
  const other = openDi(ledger, OTHER, { idempotencyKey: 'progress-stall:wf:e' });
  assert.equal(listDecisions(ledger.db, { workflowId: WF }).length, 3);

  const r = api('archive', '--workflow', WF, '--reason', 'owner ruled: archive hết', '--by', 'owner');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = JSON.parse(r.stdout);
  assert.equal(body.archived, true);
  assert.equal(ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(WF).phase, 'archived');
  assert.deepEqual((body.decisionsClosed ?? []).sort(), [open.id, claimed.id, escalated.id].sort());
  assert.equal(listDecisions(ledger.db, { workflowId: WF }).length, 0, 'no live DI remains');
  for (const d of [open, claimed, escalated]) {
    assert.deepEqual([di(d).status, di(d).resolved_by, di(d).resolution_verb], ['resolved', 'runtime', 'workflow-archived']);
  }
  assert.equal(di(claimed).claim_by, null, 'the close drops a held claim');
  assert.equal(di(done).status, 'resolved', 'an already-resolved DI is untouched');
  assert.equal(di(other).status, 'open', "another workflow's DI is untouched");
  const resolved = ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='decision-resolved'").all(WF)
    .map((e) => JSON.parse(e.payload_json));
  assert.equal(resolved.filter((e) => e.verb === 'workflow-archived' && e.auto === true && e.by === 'runtime').length, 3);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM decisions WHERE workflow_id=? AND choice='workflow-archived'").get(WF).n, 3,
    'each auto-close records its decision row');
});

test('a leftover DI locked open on an already-archived workflow is never listed, escalated, rung or blocking', async (t) => {
  const { repo, ledger, env, api } = repoWithLedger(t, [WF_ARCH]);
  openDi(ledger, WF_ARCH, { idempotencyKey: 'progress-stall:wf:leftover', dueMs: 60_000 });
  // The pre-fix shape: the phase flips with the DI still open, locked forever (events_refuse_archived).
  toPhase(ledger, WF_ARCH, ['stopped', 'archived']);
  assert.equal(ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(WF_ARCH).phase, 'archived');
  assert.equal(ledger.db.prepare("SELECT status FROM decision_items WHERE workflow_id=?").get(WF_ARCH).status, 'open', 'the leftover stays open in the row');

  assert.equal(listDecisions(ledger.db, { workflowId: WF_ARCH }).length, 0, 'never listed');
  assert.equal(listDecisions(ledger.db).length, 0, 'never counted across the ledger');
  assert.equal(blockingDecisions(ledger.db, WF_ARCH, { now: 120_000, minAgeMs: 0 }).length, 0, 'never decisions-first blocking');
  const idle = () => ({ action: 'kernel-woken', delivered: true, terminal: 'term-1' });
  assert.equal(ringDoorbellWith({ ledger, workflowId: WF_ARCH, wake: idle, now: 120_000 }).action, 'nothing-open', 'never a doorbell');
  const plan = await escalateDue({ now: 10 * 60_000, repos: [repo], env });
  assert.equal(plan.actions.length, 0, 'never escalated');
  const listed = api('decisions', '--workflow', WF_ARCH);
  assert.equal(listed.status, 0, listed.stderr || listed.stdout);
  assert.equal(JSON.parse(listed.stdout).decisions.length, 0, 'api decisions lists none');
});

test('api finish resolves the live DIs of a finished workflow (a re-finish repairs leftovers)', (t) => {
  const { ledger, api, di } = repoWithLedger(t, [WF_FIN]);
  const a = openDi(ledger, WF_FIN, { idempotencyKey: 'progress-stall:fin:a' });
  const b = openDi(ledger, WF_FIN, { kind: 'stale-wait', idempotencyKey: 'stale-wait:fin:b' });
  toPhase(ledger, WF_FIN, ['running', 'finished']);
  const r = api('finish', '--workflow', WF_FIN);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = JSON.parse(r.stdout);
  assert.equal(body.alreadyFinished, true);
  assert.deepEqual((body.decisionsClosed ?? []).sort(), [a.id, b.id].sort());
  assert.equal(listDecisions(ledger.db, { workflowId: WF_FIN }).length, 0);
  assert.deepEqual([di(a).status, di(a).resolved_by, di(a).resolution_verb], ['resolved', 'runtime', 'workflow-finished']);
  const resolved = ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='decision-resolved'").all(WF_FIN)
    .map((e) => JSON.parse(e.payload_json));
  assert.equal(resolved.filter((e) => e.verb === 'workflow-finished' && e.auto === true).length, 2);
});
