// A gate that is newer than a job's admission is the runtime's proof to produce, not an op failure and not a choice of the Kernel. One seam
// (scripts/kernel/gate-admission.mjs ownedByRuntime, called by every judged phase of the settle preflight) classifies the refusal; the settler holds
// such a settle bounded and tells the Supervisor; the Kernel's menu offers nothing for it. The runtime Critic's run is visible in the status and the digest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../../engine/db/ledger.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { GATE_NEWER_CODE, RUNTIME_OWED_CODES, admissionTaught, ownedByRuntime } from '../../scripts/kernel/gate-admission.mjs';
import { settlePreflight } from '../../scripts/kernel/verbs/shared/settle-preflight.mjs';
import { reconcileJobSettle } from '../../scripts/kernel/settle/job-settle.mjs';
import { settlerSettings } from '../../scripts/kernel/settle/job-settle-verify.mjs';
import { runtimeCriticsOf, runtimeCriticLine } from '../../scripts/kernel/verbs/shared/status-critic.mjs';
import { RUNTIME_CRITIC_EVENT } from '../../scripts/kernel/settle/critic-run.mjs';
import { loadQuestions, answerQuestions } from '../../scripts/reconciler/debug-questions.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';
import { eventFacts } from '../../scripts/reconciler/debug-digest-ledger.mjs';

const OP = 'unit.verify';

/** One reported job whose admitted contract (`markdown`) is the prompt it was given. */
function world(ledger, markdown, { jobId = 'op-u', outcome = 'done' } = {}) {
  seedWorkflow(ledger, { id: 'wf-g', goal: { revision: 1, markdown: '# g' }, jobs: [{ jobId, opId: OP, status: 'reported', payload: { opId: OP, owned_paths: [] } }] });
  const { attempt_id: attemptId, dispatch_id: dispatchId } = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(jobId);
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,'wf-g',?,?,?)").run(attemptId, jobId, markdown, Date.now());
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES('wf-g',?,?,?,?,?,?)")
    .run(attemptId, dispatchId, jobId, outcome, JSON.stringify({ head: 'abc', checks: [] }), Date.now() - 60_000);
  return { attemptId };
}

const missing = { status: 'missing', code: 'op-unit-proof-missing', detail: 'no unit run summary is attached', findings: [] };

test('a missing proof the admitted contract never taught is classified once, for every gate; a taught one and a red one are not', (t) => withLedger(t, ({ ledger }) => {
  world(ledger, 'machines:\n  starci-gate → starci gate run\n');
  const owned = ownedByRuntime(ledger.db, 'op-u', missing);
  assert.equal(owned.code, GATE_NEWER_CODE);
  assert.equal(owned.gate, 'op-unit-proof-missing', 'the proof that refused is kept');
  assert.equal(owned.status, 'missing');
  assert.match(owned.detail, /nothing is asked of the op or the Kernel/);
  assert.equal(admissionTaught(ledger.db, 'op-u', 'op-gate-proof-missing'), true, 'the loop step is in this contract');
  assert.equal(admissionTaught(ledger.db, 'op-u', 'op-test-world-proof-missing'), false);
  const red = { status: 'red', code: 'op-unit-run-red', detail: 'x', findings: [] };
  assert.equal(ownedByRuntime(ledger.db, 'op-u', red), red, 'a proof that ran red is the error-work of the op, whatever the age of the gate');
  const unlisted = { status: 'missing', code: 'op-critic-verdict-missing', detail: 'x', findings: [] };
  assert.equal(ownedByRuntime(ledger.db, 'op-u', unlisted), unlisted, 'a proof no op step teaches keeps its own code (the runtime owes it: RUNTIME_OWED_CODES)');
  assert.ok(RUNTIME_OWED_CODES.has('op-critic-verdict-missing') && RUNTIME_OWED_CODES.has(GATE_NEWER_CODE));
}));

test('a contract that taught the step keeps the refusal of the op', (t) => withLedger(t, ({ ledger }) => {
  world(ledger, 'machines:\n  starci-unit-run → starci gate unit --root <app>\n');
  assert.equal(ownedByRuntime(ledger.db, 'op-u', missing), missing);
}));

test('the settle preflight reports the classified code for the proof phase', (t) => withLedger(t, async ({ ledger }) => {
  const { attemptId } = world(ledger, 'machines: nothing about proofs');
  const none = () => null;
  const settleOpProofs = () => ({ op: OP, jobId: 'op-u', attemptId, status: 'reported', proof: 'unit-kit', proofs: ['unit-kit'], judged: { ...missing } });
  const emitted = [];
  let exit = null;
  try {
    await settlePreflight({ ledger, args: { json: false }, repo: '.', emit: (...a) => emitted.push(a), replay: false, verdict: 'pass', jobId: 'op-u',
      internals: { settleProofMedia: none, settleSonarGate: none, settleOpGate: none, settleOpProofs, settleCriticVerdict: none, settleDrawAcceptance: none, settleDrawMetrics: none, settleWorkHygiene: none } });
  } catch (error) { exit = error.exitCode; }
  assert.equal(exit, 1);
  assert.equal(emitted[0][0].code, GATE_NEWER_CODE);
}));

test('the settler holds such a refusal bounded and opens a Supervisor item, never a Kernel handover', async (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  world(ledger, 'machines: nothing about proofs');
  ledger.close();
  const settings = { ...settlerSettings(), tail: { retryMs: 0, maxAttempts: 2 } };
  const api = () => ({ ok: false, code: GATE_NEWER_CODE, error: 'the gate is newer' });
  let now = Date.now() + 60_000;
  const pass = () => reconcileJobSettle({ repo: repoRoot, jobId: 'op-u', verify: async () => ({ green: true, via: 'declared' }), locks: false, api, settings, now: () => (now += 1000) });
  const first = await pass();
  const second = await pass();
  assert.deepEqual([first.kernel.length, second.kernel.length], [0, 0], 'never a handover to the Kernel');
  const reader = openLedger({ file: ledgerFile });
  try {
    assert.equal(reader.db.prepare("SELECT count(*) n FROM events WHERE kind='job-settle-needs-kernel'").get().n, 0);
    assert.equal(reader.db.prepare("SELECT count(*) n FROM events WHERE kind='job-settle-check-unavailable'").get().n, 2, 'each pass is one counted try');
    const item = reader.db.prepare("SELECT decider, kind FROM decision_items WHERE kind='runtime-defect'").get();
    assert.deepEqual([item?.decider, item?.kind], ['supervisor', 'runtime-defect'], 'after the bound the Supervisor is told');
  } finally { reader.close(); }
}));

test('a runtime Critic run is on the status with who, model, time, tokens and verdict, and in the digest answer', (t) => withLedger(t, ({ ledger }) => {
  world(ledger, 'machines: x');
  const body = { jobId: 'op-u', op: 'architecture.decide', digest: 'd1', maker: 'claude', try: 1, critic: { provider: 'codex', model: 'gpt-x', dispatchId: 'ctx_c', durationMs: 91_000, tokens: null }, outcome: 'verdict', pass: true };
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-g', entityType: 'job', entityId: 'op-u', kind: RUNTIME_CRITIC_EVENT, payload: body }));
  const runs = runtimeCriticsOf(ledger.db, 'wf-g');
  assert.equal(runs.length, 1);
  const line = runtimeCriticLine(runs[0]);
  for (const part of ['op-u', 'codex/gpt-x', '91000ms', 'tokens unmeasured', 'verdict pass', 'maker claude']) assert.ok(line.includes(part), `${part} in: ${line}`);
  const hold = runtimeCriticLine({ ...runs[0], outcome: 'hold', code: 'CRITIC_QUOTA_OUT', try: 2, maxAttempts: 5 });
  assert.match(hold, /hold CRITIC_QUOTA_OUT, try 2 of 5 \(then a Supervisor item\)/);
  const events = eventFacts(ledger.db, 'wf-g');
  assert.equal(events[0].kind, RUNTIME_CRITIC_EVENT);
  assert.deepEqual([events[0].criticProvider, events[0].opProvider, events[0].independent, events[0].criticModel, events[0].durationMs], ['codex', 'claude', true, 'gpt-x', 91_000]);
  const groups = loadQuestions().map((g) => ({ ...g, questions: g.questions.filter((q) => q.id === 'co-critic-independent') }));
  const answer = answerQuestions(groups, {}, { now: Date.now(), workflows: [{ events }] }, digestNumbers()).flatMap((g) => g.questions)[0];
  assert.equal(answer.state, 'ok');
  assert.match(answer.evidence, /runtime runs: op-u codex\/gpt-x 91000ms tokens unmeasured pass \(try 1\)/);
}));
