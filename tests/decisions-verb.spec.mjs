// decisions-verb.spec.mjs — `api decisions` and its store (scripts/reconciler/decisions.mjs; lane rc-decisions,
// reconciler DESIGN §10.3 / §11.3): open is idempotent on its key, a second claimer is refused, resolve honours
// allowedVerbs, escalate hands a Kernel DI to the Supervisor, a supervisor-ruling supersedes the Kernel's live DIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { CLAIM_TTL_MS, openDecision, ringDoorbell, claimDecision, dueStep, escalateDecision, escalateDue, getDecision, listDecisions, openDecisionRow, resolveDecision } from '../scripts/reconciler/decisions.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const WF = 'wf-di';

const repoWithLedger = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-di-'));
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  ledger.ensureWorkflow({ workflowId: WF, title: 'di' });
  return { repo, ledger };
};
const settle = (extra = {}) => ({ workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: 'op-x-1' }, summary: 'report blocked',
  idempotencyKey: 'settle-nongreen:op-x-1:report-1', allowedVerbs: ['settle', 'graph-edit'], by: 'reconciler/job', ...extra });

test('open is idempotent on the key; a new key is a new DI; events record the open', (t) => {
  const { ledger } = repoWithLedger(t);
  const a = openDecisionRow(ledger, settle(), { now: 1000 });
  assert.equal(a.created, true);
  assert.match(a.di.id, /^di-[0-9a-f]{8}$/);
  assert.equal(a.di.schema, 'starci/decision-item@1');
  assert.equal(a.di.dueAt, 1000 + 30 * 60_000, 'a Kernel DI is due in 30 minutes by default');
  const b = openDecisionRow(ledger, settle({ summary: 'same key, other words' }), { now: 2000 });
  assert.equal(b.created, false);
  assert.equal(b.existing, true);
  assert.equal(b.di.id, a.di.id);
  const c = openDecisionRow(ledger, settle({ idempotencyKey: 'settle-nongreen:op-x-1:report-2' }), { now: 3000 });
  assert.notEqual(c.di.id, a.di.id);
  assert.equal(listDecisions(ledger.db, { workflowId: WF, now: 3000 }).length, 2);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-opened'").get().n, 2);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM inbox WHERE kind='decision' AND status='pending'").get().n, 0, 'a DI never counts as a pending inbox row');
});

test('the decider defaults by kind: cap-starved and the other policy kinds go to the Supervisor', (t) => {
  const { ledger } = repoWithLedger(t);
  const starved = openDecisionRow(ledger, { workflowId: WF, kind: 'cap-starved', entity: { type: 'workflow', id: WF }, summary: 'pool claude starved 40 min under its cap', by: 'reconciler/resource' }, { now: 0 }).di;
  assert.equal(starved.decider, 'supervisor');
  assert.equal(starved.escalateTo, 'owner');
  assert.equal(starved.dueAt, 60 * 60_000, 'a Supervisor DI is due in 60 minutes by default');
  assert.equal(openDecisionRow(ledger, { workflowId: WF, kind: 'quota-exhausted', summary: 'codex quota out', by: 'reconciler/resource' }, { now: 0 }).di.decider, 'supervisor');
  assert.equal(openDecisionRow(ledger, { workflowId: WF, kind: 'worker-question', entity: { type: 'job', id: 'j' }, summary: 'q', by: 'reconciler/job' }, { now: 0 }).di.decider, 'kernel');
  assert.equal(claimDecision(ledger, starved.id, { by: 'supervisor', now: 1 }).claim.by, 'supervisor', 'its own DI: the Supervisor claims it without an escalation');
});

test('open refuses an unknown kind, decider or workflow', (t) => {
  const { ledger } = repoWithLedger(t);
  assert.throws(() => openDecisionRow(ledger, settle({ kind: 'whatever' })), { code: 'decision-kind-invalid' });
  assert.throws(() => openDecisionRow(ledger, settle({ decider: 'op' })), { code: 'decision-decider-invalid' });
  assert.throws(() => openDecisionRow(ledger, settle({ workflowId: 'wf-nope' })), { code: 'workflow-unknown' });
});

test('claim: a second claimer is refused until the TTL; the Supervisor claims a Kernel DI only escalated or cross-workflow', (t) => {
  const { ledger } = repoWithLedger(t);
  const { di } = openDecisionRow(ledger, settle(), { now: 0 });
  assert.throws(() => claimDecision(ledger, di.id, { by: 'supervisor', now: 10 }), { code: 'decision-not-escalated' });
  const held = claimDecision(ledger, di.id, { by: `kernel:${WF}`, now: 10 });
  assert.equal(held.status, 'claimed');
  assert.equal(held.claim.ttlMs, CLAIM_TTL_MS);
  assert.throws(() => claimDecision(ledger, di.id, { by: 'kernel:other', now: 20 }), { code: 'decision-held-by-other' });
  assert.equal(claimDecision(ledger, di.id, { by: `kernel:${WF}`, now: 30 }).claim.by, `kernel:${WF}`, 'the holder may re-claim');
  const later = 30 + CLAIM_TTL_MS + 1;
  assert.equal(getDecision(ledger.db, di.id, { now: later }).status, 'open', 'an expired claim reads open again');
  assert.equal(claimDecision(ledger, di.id, { by: 'kernel:other', now: later }).claim.by, 'kernel:other');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-expired'").get().n, 1);
  const cross = openDecisionRow(ledger, { workflowId: WF, kind: 'cross-workflow', entity: { type: 'workflow', id: WF }, summary: 'two workflows share a seam', by: 'reconciler/fleet' }, { now: 0 });
  assert.equal(claimDecision(ledger, cross.di.id, { by: 'supervisor', now: 5 }).claim.by, 'supervisor', 'cross-workflow: the Supervisor may claim');
});

test('resolve: allowedVerbs hold, a resolved DI is closed, the resolution names the decision', (t) => {
  const { ledger } = repoWithLedger(t);
  const { di } = openDecisionRow(ledger, settle(), { now: 0 });
  claimDecision(ledger, di.id, { by: `kernel:${WF}`, now: 1 });
  assert.throws(() => resolveDecision(ledger, di.id, { by: 'kernel:other', verb: 'settle --verdict fail', now: 2 }), { code: 'decision-held-by-other' });
  assert.throws(() => resolveDecision(ledger, di.id, { by: `kernel:${WF}`, verb: 'nudge --job x', now: 2 }), { code: 'decision-verb-not-allowed' });
  const done = resolveDecision(ledger, di.id, { by: `kernel:${WF}`, verb: 'api settle --job op-x-1 --verdict fail', decisionId: 'dec-1', now: 3 });
  assert.equal(done.status, 'resolved');
  assert.deepEqual({ by: done.resolution.by, decisionId: done.resolution.decisionId }, { by: `kernel:${WF}`, decisionId: 'dec-1' });
  assert.throws(() => resolveDecision(ledger, di.id, { by: `kernel:${WF}`, verb: 'settle', now: 4 }), { code: 'decision-closed' });
  assert.equal(listDecisions(ledger.db, { workflowId: WF }).length, 0);
  assert.equal(listDecisions(ledger.db, { workflowId: WF, all: true }).length, 1);
});

test('escalate: an explicit escalation hands the DI to the Supervisor and drops the claim', (t) => {
  const { ledger } = repoWithLedger(t);
  const { di } = openDecisionRow(ledger, settle(), { now: 0 });
  claimDecision(ledger, di.id, { by: `kernel:${WF}`, now: 1 });
  const up = escalateDecision(ledger, di.id, { to: 'supervisor', by: `kernel:${WF}`, now: 2 });
  assert.equal(up.status, 'escalated');
  assert.equal(up.claim, null);
  assert.equal(up.escalations, 1);
  assert.equal(claimDecision(ledger, di.id, { by: 'supervisor', now: 3 }).claim.by, 'supervisor', 'escalated: the Supervisor may claim');
});

test('a supervisor-ruling supersedes the live Kernel DIs on the same entity, and only those', (t) => {
  const { ledger } = repoWithLedger(t);
  const onJob = openDecisionRow(ledger, settle(), { now: 0 }).di;
  const onWf = openDecisionRow(ledger, { workflowId: WF, kind: 'progress-stall', entity: { type: 'workflow', id: WF }, summary: 'no unit passed in 60 min', by: 'reconciler/workflow' }, { now: 0 }).di;
  const ruling = openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', entity: { type: 'workflow', id: WF }, summary: '[supervisor] drop the canon leg and re-cut', by: 'supervisor' }, { now: 5 });
  assert.deepEqual(ruling.superseded, [onWf.id]);
  assert.equal(getDecision(ledger.db, onWf.id).status, 'superseded');
  assert.equal(getDecision(ledger.db, onJob.id).status, 'open', 'another entity keeps its DI');
  assert.equal(listDecisions(ledger.db, { workflowId: WF })[0].kind, 'settle-nongreen');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='decision-superseded'").get().n, 1);
});

test('the SLA ladder: past dueAt one reminder, past dueAt x2 a Supervisor DI (plan only unless applied)', async (t) => {
  const { repo, ledger } = repoWithLedger(t);
  const { di } = openDecisionRow(ledger, settle({ dueMs: 1000 }), { now: 0 });
  ledger.close();
  assert.equal(dueStep(di, 500), null);
  assert.deepEqual(dueStep(di, 1000), { step: 'remind' });
  assert.deepEqual(dueStep({ ...di, escalations: 1 }, 1500), null, 'reminded once');
  assert.deepEqual(dueStep(di, 2000), { step: 'supervisor' });
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-di-sup-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_SUPERVISOR_HOME: home };
  const plan = await escalateDue({ now: 2500, repos: [repo], env });
  assert.deepEqual(plan.actions.map((a) => [a.step, a.applied]), [['supervisor', false]], 'shadow: planned, nothing written');
  const run = await escalateDue({ now: 2500, repos: [repo], env, apply: true });
  assert.equal(run.actions[0].applied, true);
  assert.match(run.actions[0].supervisorDi, /^di-/);
  const again = await escalateDue({ now: 2600, repos: [repo], env, apply: true });
  assert.equal(again.actions.length, 0, 'an escalated DI is no longer due');
  const l2 = openLedger({ file: ledgerFileFor(repo) });
  try { assert.equal(getDecision(l2.db, di.id).status, 'escalated'); } finally { l2.close(); }
  const sup = openLedger({ file: ledgerFileFor(home) });
  try {
    const rows = listDecisions(sup.db, { workflowId: 'wf-supervisor' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].decider, 'supervisor');
    assert.equal(sup.db.prepare("SELECT count(*) n FROM events WHERE kind='supervisor-decision-opened'").get().n, 1);
  } finally { sup.close(); }
});

test('api decisions is an extension verb: open, list and claim through the CLI', (t) => {
  const { repo, ledger } = repoWithLedger(t);
  ledger.close();
  const run = (...args) => spawnSync(process.execPath, [API, 'decisions', '--repo', repo, ...args, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, env: { ...process.env, NODE_NO_WARNINGS: '1' } });
  const opened = run('--open', '--workflow', WF, '--kind', 'worker-question', '--entity-type', 'job', '--entity-id', 'op-y-1', '--summary', 'which token file?', '--by', 'reconciler/job');
  assert.equal(opened.status, 0, opened.stderr);
  const id = JSON.parse(opened.stdout).decision.id;
  const listed = JSON.parse(run('--workflow', WF).stdout);
  assert.deepEqual(listed.decisions.map((d) => d.id), [id]);
  assert.equal(listed.open, 1);
  const refused = run('--claim', id, '--by', 'supervisor');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /decision-not-escalated/);
  const ext = spawnSync(process.execPath, [API, 'extensions', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  assert.match(ext.stdout, /"decisions"/);
});

test('a controller-shaped DI with ledger supervisor lands in the supervisor ledger (lane rc-gc-resource cap-starved)', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-di-sup-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_SUPERVISOR_HOME: home };
  const di = { schema: 'starci/decision-item@1', kind: 'cap-starved', decider: 'supervisor', ledger: 'supervisor', workflowId: 'wf-prio',
    idempotencyKey: 'cap-starved:wf-prio:2026-09-28T09:00:00.000Z', entity: { type: 'workflow', id: 'wf-prio' }, summary: 'priority workflow held 0 of 2 reserve slots for 40 min',
    evidence: [{ ref: 'throttle:ok' }], options: [{ key: 'ram-cap-prioritize', verb: 'node scripts/supervisor/ram-cap.mjs prioritize --workflow wf-prio', recommended: true }],
    allowedVerbs: ['ram-cap prioritize', 'ram-cap unprioritize'], openedBy: 'resource-controller', escalateTo: 'owner', dueAt: 5_000 + 600_000 };
  const r = await openDecision(null, di, { env, now: 5_000 });
  assert.equal(r.ok, true, JSON.stringify(r.json));
  assert.equal(r.json.decision.decider, 'supervisor');
  assert.equal(r.json.decision.workflowId, 'wf-supervisor');
  assert.equal(r.json.decision.productWorkflowId, 'wf-prio');
  assert.equal(r.json.decision.dueAt, 5_000 + 600_000, 'the dueAt of the controller holds');
  assert.equal(r.json.decision.openedBy, 'resource-controller');
  assert.equal((await openDecision(null, di, { env, now: 6_000 })).json.existing, true, 'idempotent on the key');
  assert.deepEqual(await ringDoorbell({ mode: 'shadow', ledgers: [] }, { ledgerId: 'x', workflowId: 'wf-prio', decider: 'kernel' }), { action: 'shadow', delivered: false }, 'the engine form never rings in shadow');
});
