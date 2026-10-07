// The op-incident policy table (modules/kernel/op-incident-policy.yaml) and its first closed gap: a launch the provider refused
// spends no try, so the retry lineage never saw it and the Kernel kept dispatching the same job on the same agent
// (Nivo 2026-10-07: op-business.decide-58d0a31e7e answered no-eligible-candidate on claude four times while the pool admitted other jobs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { lineageRouteAdjust } from '../../scripts/kernel/lineage-route.mjs';
import { incidentPolicy, boundValue, policyStepOf, queuedBecauseKinds, INCIDENT_CODES } from '../../scripts/kernel/op-incident-policy.mjs';

const WF = 'wf-policy';
const OP = 'business.decide';
const FIRST = 'op-business.decide-19b37f6c00';
const RETRY = 'op-business.decide-58d0a31e7e';
const SITUATIONS = ['ask', 'rate-limit', 'error', 'hang', 'restart'];

const withLedger = (t, fn) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-policy-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_PROJECTS_ROOT: path.join(repo, '.starciwork', 'projects'), STARCI_TEST_MACHINE_FILE: path.join(repo, '.starciwork', 'machine.sqlite'),
    STARCI_LOCAL_ROOT: path.join(repo, '.starciwork', 'localappdata') };
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try { return fn(ledger); } finally { ledger.close(); }
};

const seed = (ledger, { rejections }) => {
  const at = Date.now();
  const payload = (extra = {}) => ({ opId: OP, owned_paths: ['.starciwork/features/authentication/br'], ...extra });
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'policy' }, goalIdentity: 'policygoal',
    goal: { revision: 0, identity: 'policygoal', markdown: '# goal', json: {} },
    jobs: [
      { jobId: FIRST, unitId: 'unit-a', opId: OP, tryNo: 1, retryOf: null, status: 'failed', pool: 'claude-agent', payload: payload({ model: 'claude-agent' }), createdAt: at },
      { jobId: RETRY, unitId: 'unit-a', opId: OP, tryNo: 2, retryOf: FIRST, status: 'ready', payload: payload(), createdAt: at + 1 }] });
  for (const rejected of rejections) {
    ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: RETRY, kind: 'dispatch-rejected',
      payload: { op: OP, effectState: 'none', attemptConsumed: false, retryable: true, model: 'claude-agent', provider: 'claude', ...rejected } });
  }
};
const adjustOf = (t, rejections) => withLedger(t, (ledger) => {
  seed(ledger, { rejections });
  return lineageRouteAdjust(ledger.db, ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(RETRY));
});

test('every situation has a row with a handler, a bound, a next handler and a code, and every bound ref resolves', () => {
  const policy = incidentPolicy();
  assert.deepEqual(SITUATIONS.filter((s) => !policy.rows.some((row) => row.situation === s)), []);
  assert.equal(new Set(policy.rows.map((row) => row.id)).size, policy.rows.length);
  for (const row of policy.rows) {
    assert.ok(policy.handlers[row.handler], `${row.id}: handler ${row.handler} is declared`);
    assert.ok(policy.handlers[row.next], `${row.id}: next ${row.next} is declared`);
    assert.ok(row.code && row.action && row.detector, `${row.id}: code, action and detector are named`);
    const bounds = Object.entries(row.bound ?? {});
    assert.ok(bounds.length > 0, `${row.id}: declares a bound`);
    for (const [name, bound] of bounds) assert.ok(boundValue(bound) > 0, `${row.id}.${name} resolves to a positive number`);
  }
});

test('the codes the policy records are the ones its table declares', () => {
  assert.deepEqual(INCIDENT_CODES, incidentPolicy().codes);
});

test('Nivo: a job whose launches claude refused leaves claude for the next eligible agent, by the route and not a gate', (t) => {
  const first = adjustOf(t, [{ step: 'worker-start', error: 'turn_start_unobserved' }]);
  assert.deepEqual(first.demote, ['claude-agent'], 'one refusal demotes the agent for this job: the next member is preferred');
  assert.deepEqual(first.exclude, []);
  const spent = adjustOf(t, [{ step: 'worker-start', error: 'turn_start_unobserved' }, { step: 'admission', error: 'no-eligible-candidate' }]);
  assert.deepEqual(spent.exclude, ['claude-agent'], 'the bound of the table (agentSwitch.excludeAfter) excludes it');
  assert.equal(spent.pools['claude-agent'].failures, boundValue({ ref: 'modules/kernel/op-incident-policy.yaml#agentSwitch.excludeAfter' }));
});

test('a refusal that is a wait or an unknown effect never moves the job off its agent', (t) => {
  const adjust = adjustOf(t, [{ step: 'reserve', error: 'path lease held' }, { step: 'depth', error: 'worker-depth-exceeded' },
    { step: 'admission', error: 'x', effectState: 'unknown' }, { step: 'admission', error: 'x', model: null }]);
  assert.deepEqual(adjust?.demote ?? [], []);
  assert.deepEqual(adjust?.exclude ?? [], []);
});

test('the step line names the attempt, the count, who acts and who is next', () => {
  const step = policyStepOf('error-launch', { attempt: 1, of: 2, detail: 'claude-agent: admission no-eligible-candidate' });
  assert.equal(step.handler, 'runtime-auto');
  assert.equal(step.next, 'supervisor');
  assert.match(step.line, /attempt 1 of 2 \(claude-agent: admission no-eligible-candidate\)/);
  assert.match(step.line, /escalate to supervisor \(op-incident-escalate-supervisor\)/);
  assert.throws(() => policyStepOf('nope', { attempt: 1, of: 1, detail: '' }), /no op-incident policy row/);
});

// One standard for every hold: the table lists each hold the runtime can put on a job, a seat or a workflow, and a hold that does
// not meet an invariant names it in `gap` with its reason, so nothing is silently unlisted or silently unbounded.
const INVARIANTS = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8'];
const SCOPES = ['job', 'workflow', 'machine'];

test('every hold meets I1-I8 or names the invariant it misses, with its reason', () => {
  const policy = incidentPolicy();
  const handlers = Object.keys(policy.handlers);
  assert.equal(new Set(policy.holds.map((hold) => hold.id)).size, policy.holds.length, 'a hold kind is listed once');
  for (const hold of policy.holds) {
    const gap = new Set(hold.gap ?? []);
    assert.deepEqual([...gap].filter((id) => !INVARIANTS.includes(id)), [], `${hold.id}: gap names invariants I1-I8`);
    if (gap.size) assert.ok(String(hold.gapWhy ?? '').length > 20, `${hold.id}: a documented gap carries its reason`);
    assert.ok(hold.cause, `${hold.id}: I1 names its cause`);
    assert.ok(handlers.includes(hold.handler), `${hold.id}: I2 has exactly one declared handler`);
    assert.ok(gap.has('I3') || hold.reeval, `${hold.id}: I3 declares the condition that is re-evaluated`);
    const bounds = Object.values(hold.bound ?? {});
    assert.ok(gap.has('I4') || bounds.length > 0, `${hold.id}: I4 declares a bound`);
    for (const bound of bounds) assert.ok(boundValue(bound) > 0, `${hold.id}: its bound resolves to a positive number`);
    assert.ok(SCOPES.includes(hold.scope), `${hold.id}: I5 declares job, workflow or machine scope`);
    if (hold.scope !== 'job' && !gap.has('I5')) assert.ok(hold.workflowWide, `${hold.id}: a wider scope names the cause that is wide by nature`);
    assert.ok(gap.has('I7') || hold.visible, `${hold.id}: I7 names where status shows it`);
    assert.ok(Array.isArray(hold.chain) && hold.chain.every((handler) => handlers.includes(handler)), `${hold.id}: its chain names declared handlers`);
    assert.ok(gap.has('I8') || hold.chain.at(-1) === 'owner', `${hold.id}: I8 the chain ends at the owner`);
  }
});

test('the status projection values of a held job are the table\'s queuedBecause list, each a listed hold', () => {
  const kinds = queuedBecauseKinds();
  assert.ok(kinds.includes('ready') && kinds.includes('supervisor-gate') && kinds.includes('host-resources-low'));
  assert.equal(new Set(kinds).size, kinds.length);
});

test('the tier chain takes the switch: one refusal moves the member last in its tier, two drop it, and the pick says so', async (t) => {
  const { fakePoolSelection } = await import('../helpers/fake-admission.mjs');
  const { loadRuntimes } = await import('../../scripts/agent/models.mjs');
  const runtimes = loadRuntimes(path.join(path.resolve(import.meta.dirname, '..', '..'), 'modules', 'models'));
  const pick = (lineage) => fakePoolSelection({ runtimes, capacity: {}, scopeId: 'policy-tier', kind: 'backend.scaffold', difficulty: 'hard', lineage });
  const refusals = (n) => adjustOf(t, Array.from({ length: n }, () => ({ step: 'admission', error: 'no-eligible-candidate', model: 'claude-agent' })));
  const first = pick(null).target;
  assert.equal(first, 'claude-agent', 'the hard tier opens on claude');
  const one = refusals(1), two = refusals(2);
  assert.deepEqual(one.demote, ['claude-agent']);
  const demoted = pick(one);
  assert.notEqual(demoted.target, 'claude-agent', 'the next eligible member of the tier takes the job');
  assert.equal(demoted.chain.at(-1).startsWith('claude/'), true, 'the demoted member is tried last');
  const excluded = pick(two);
  assert.notEqual(excluded.target, 'claude-agent');
  assert.match(JSON.stringify(excluded.rejected), /excluded for this retry lineage: failed 2x on it/);
});

test('every member spent: the runtime opens one supervisor-gate holding only that job, once, with the per-member refusals', async (t) => {
  const { escalateExhaustedMembers } = await import('../../scripts/kernel/verbs/shared/member-exhaustion.mjs');
  const { supervisorGatesOf } = await import('../../scripts/kernel/autopilot-budget.mjs');
  withLedger(t, (ledger) => {
    seed(ledger, { rejections: [] });
    const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(RETRY);
    const lineage = { exclude: ['claude-agent', 'codex-agent'], pools: { 'claude-agent': { failures: 2, causes: ['x'] } } };
    const spent = { error: 'agent admission refused', chain: ['claude/a', 'codex/b'], rejected: [
      { target: 'claude/a', reason: 'excluded for this retry lineage: failed 2x on it', reasons: ['excluded for this retry lineage: failed 2x on it'] },
      { target: 'codex/b', reason: 'excluded for this retry lineage: failed 2x on it', reasons: ['excluded for this retry lineage: failed 2x on it'] }] };
    assert.equal(escalateExhaustedMembers(ledger, { job, decision: { ...spent, rejected: spent.rejected.slice(1) }, lineage }), null, 'a member still unlisted is not exhaustion');
    const id = escalateExhaustedMembers(ledger, { job, decision: spent, lineage });
    assert.ok(id);
    assert.equal(escalateExhaustedMembers(ledger, { job, decision: spent, lineage }), null, 'once per (job, cause)');
    const gates = supervisorGatesOf(ledger.db, WF);
    assert.deepEqual(gates.map((g) => [g.incidentId, g.holds]), [[id, [RETRY]]]);
    const raised = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE kind='incident-raised'").get().payload_json);
    assert.equal(raised.evidence.cause, 'op-incident-escalate-supervisor');
    assert.equal(raised.evidence.members.length, 2);
  });
});
