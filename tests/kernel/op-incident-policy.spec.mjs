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
import { incidentPolicy, boundValue, policyStepOf, INCIDENT_CODES } from '../../scripts/kernel/op-incident-policy.mjs';

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
