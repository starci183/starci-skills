// A launch admission that refuses a job while the pool admits other jobs (Nivo 2026-10-07: op-business.decide-58d0a31e7e answered
// no-eligible-candidate on claude four times in two hours). The dispatch-rejected record kept only that string, so the Kernel could not
// tell a full pool from an agent that cannot serve the job, and every refusal counted as the agent's fault. The refusal now records the
// per-candidate codes and the untried members of the route chain; a capacity-only refusal is a wait that spends no pool strike.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { lineageRouteAdjust } from '../../scripts/kernel/lineage-route.mjs';
import { admissionRefusalOf, isAdmissionWait, untriedRouteMembers } from '../../scripts/kernel/admission-refusal.mjs';

const WF = 'wf-admission-refusal';
const OP = 'business.decide';
const FIRST = 'op-business.decide-19b37f6c00';
const RETRY = 'op-business.decide-58d0a31e7e';
const MODEL = { target: 'claude-agent', provider: 'claude' };
const CHAIN_PAYLOAD = { model: 'claude-agent', routeChain: ['claude-agent', 'codex-agent', 'devin-agent'], routeRejected: [{ target: 'devin-agent', reason: 'no-host-tool' }] };
const refused = (codes, extra = {}) => ({ step: 'admission', error: 'no-eligible-candidate', decision: { ok: false, rejected: [{ id: 'claude/claude-opus-5-5/0', provider: 'claude', model: 'claude-opus-5-5', codes, ...extra }] } });

test('a capacity-only refusal is a wait that reads as the pool-full hold and names the untried route member', () => {
  const refusal = admissionRefusalOf(refused(['capacity-full']), CHAIN_PAYLOAD, MODEL);
  assert.equal(refusal.class, 'wait');
  assert.equal(refusal.queuedBecause, 'pool-full');
  assert.deepEqual(refusal.alternatives, ['codex-agent'], 'the refused pool and the route-rejected member are not offered');
  assert.match(refusal.line, /claude\/claude-opus-5-5\/0: capacity-full/);
  assert.match(refusal.line, /admissible alternatives in the route chain: codex-agent/);
  assert.equal(isAdmissionWait({ admission: refusal }), true);
});

test('an open provider circuit or a blocked provider is the circuit-open hold; a mix with a candidate code is not a wait', () => {
  assert.equal(admissionRefusalOf(refused(['incident-open', 'provider-blocked']), CHAIN_PAYLOAD, MODEL).queuedBecause, 'circuit-open');
  const mixed = admissionRefusalOf(refused(['capacity-full', 'quota-exhausted']), CHAIN_PAYLOAD, MODEL);
  assert.equal(mixed.class, 'candidate');
  assert.equal(mixed.queuedBecause, null);
  assert.equal(isAdmissionWait({ admission: mixed }), false);
});

test('a chain with no other member says so; a launch result that is not an admission plan records nothing', () => {
  assert.match(admissionRefusalOf(refused(['quota-stale']), { model: 'claude-agent', routeChain: ['claude-agent'] }, MODEL).line, /the route chain holds no untried member/);
  assert.equal(admissionRefusalOf({ step: 'launch-trust', error: 'x' }, CHAIN_PAYLOAD, MODEL), null);
  assert.equal(admissionRefusalOf({ step: 'admission', error: 'x', decision: { rejected: [] } }, CHAIN_PAYLOAD, MODEL), null);
  assert.deepEqual(untriedRouteMembers(null, 'claude-agent'), []);
});

const withLedger = (t, fn) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-admission-refusal-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { ...process.env, STARCI_PROJECTS_ROOT: path.join(repo, '.starciwork', 'projects'), STARCI_TEST_MACHINE_FILE: path.join(repo, '.starciwork', 'machine.sqlite'),
    STARCI_LOCAL_ROOT: path.join(repo, '.starciwork', 'localappdata') };
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try { return fn(ledger); } finally { ledger.close(); }
};

// The Nivo ledger state: a retry of a blocked first try, ready, with N admission refusals of claude on its event stream.
const adjustAfter = (t, refusals) => withLedger(t, (ledger) => {
  const at = Date.now();
  const payload = (extra = {}) => ({ opId: OP, owned_paths: ['.starciwork/features/authentication/br'], ...extra });
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'refusal' }, goalIdentity: 'refusalgoal',
    goal: { revision: 0, identity: 'refusalgoal', markdown: '# goal', json: {} },
    jobs: [
      { jobId: FIRST, unitId: 'unit-a', opId: OP, tryNo: 1, retryOf: null, status: 'failed', pool: 'claude-agent', payload: payload({ model: 'claude-agent' }), createdAt: at },
      { jobId: RETRY, unitId: 'unit-a', opId: OP, tryNo: 2, retryOf: FIRST, status: 'ready', payload: payload(), createdAt: at + 1 }] });
  for (const admission of refusals) {
    ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: RETRY, kind: 'dispatch-rejected',
      payload: { op: OP, step: 'admission', error: 'no-eligible-candidate', effectState: 'none', attemptConsumed: false, retryable: true,
        model: 'claude-agent', provider: 'claude', ...(admission ? { admission } : {}) } });
  }
  return lineageRouteAdjust(ledger.db, ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(RETRY));
});

test('the Nivo ledger state: four capacity waits never exclude claude, four candidate refusals do', (t) => {
  const wait = admissionRefusalOf(refused(['capacity-full']), CHAIN_PAYLOAD, MODEL);
  const waited = adjustAfter(t, [wait, wait, wait, wait]);
  assert.deepEqual(waited?.exclude ?? [], [], 'a full pool is a wait: the job stays on its pool and holds');
  assert.deepEqual(waited?.demote ?? [], []);
  const candidate = admissionRefusalOf(refused(['quota-exhausted']), CHAIN_PAYLOAD, MODEL);
  assert.deepEqual(adjustAfter(t, [candidate, candidate, candidate, candidate]).exclude, ['claude-agent'], 'a candidate refusal still switches the agent');
  assert.deepEqual(adjustAfter(t, [null, null]).exclude, ['claude-agent'], 'a record without the plan (an old event) counts as before');
});
