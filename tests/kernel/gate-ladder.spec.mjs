// The supervisor-gate hold meets the standard hold policy (owner goal G10 round 3; modules/kernel/op-incident-policy.yaml `gateCauses` and `holds`):
// the shapes below are the four real gates of 2026-10-07 (Nivo inc-8682f80b8b34, inc-51f1e22789e5, inc-ce67aea64fab; StarCi inc-5c97fdeac27e).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const baseEnv = (() => { const e = { ...process.env, STARCI_CONNECTORS_OFF: '1', ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: '' }; delete e.STARCI_OP_JOB; delete e.STARCI_AUTOPILOT; return e; })();
const WF = 'wf-gate-ladder';
const NIVO_JOB = 'op-business.decide-58d0a31e7e';
const STARCI_JOB = 'op-scope.define-f5c663aa85';

const run = (repo, ...args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: baseEnv });
const json = (r) => { const s = r.stdout || r.stderr; try { return JSON.parse(s); } catch { return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)); } };
const seed = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };

/** A repo whose ledger holds the Nivo job (queued, route chain claude + codex, claude pinned) and the StarCi settle job. */
const world = (t, { chain = ['claude-agent', 'codex-agent'], rejected = [] } = {}) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gate-ladder-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  if (process.env.STARCI_TEST_TEMP_DIR) t.after(() => fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR, 'starci-git-memo'), { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  seed(repo, (l) => {
    l.ensureWorkflow({ workflowId: WF, title: 'gate ladder spec' });
    l.write.changeWorkflowPhase({ workflowId: WF, to: 'running', by: 'test', reason: 'seed gate workflow' });
    const legs = [{ op: 'business.decide' }, { op: 'scope.define' }];
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WF, 0, 'agoal', '# goal', JSON.stringify({ opChain: { legs }, derivedPlan: { legs, edges: [['business.decide', 'scope.define']] } }), Date.now());
    const at = Date.now();
    seedWorkflow(l, { id: WF, jobs: [
      { jobId: NIVO_JOB, opId: 'business.decide', status: 'queued', dispatchId: 'seed:nivo', createdAt: at,
        payload: { opId: 'business.decide', owned_paths: ['.starciwork/evidence/a'], model: 'claude-agent', routeChain: chain, routeRejected: rejected } },
      { jobId: STARCI_JOB, opId: 'scope.define', status: 'queued', dispatchId: 'seed:starci', createdAt: at + 1,
        payload: { opId: 'scope.define', owned_paths: ['.starciwork/evidence/b'] } }] });
  });
  return repo;
};
const gateArgs = (extra, holds = NIVO_JOB) => ['incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', holds, '--detail', 'admission answers no-eligible-candidate for this job only', ...extra];
const raisedOf = (repo) => read(repo, (db) => db.prepare("SELECT entity_id,payload_json FROM events WHERE kind='incident-raised' AND json_extract(payload_json,'$.kind')='supervisor-gate'").all()
  .map((row) => ({ id: row.entity_id, ...JSON.parse(row.payload_json) })));

test('I6, Nivo inc-8682f80b8b34: a gate for a job whose route chain still has another agent is refused, naming that agent and the workaround', (t) => {
  const repo = world(t);
  const bare = run(repo, ...gateArgs([]));
  assert.equal(bare.status, 1);
  assert.equal(json(bare).code, 'gate-cause-required');
  const noWorkaround = run(repo, ...gateArgs(['--cause', 'no-eligible-agent']));
  assert.equal(json(noWorkaround).code, 'gate-workaround-required');
  assert.match(JSON.stringify(json(noWorkaround)), /starci kernel dispatch --model/);
  const claimed = run(repo, ...gateArgs(['--cause', 'no-eligible-agent', '--no-workaround', 'chain-spent']));
  const refusal = json(claimed);
  assert.equal(refusal.code, 'gate-workaround-available');
  assert.match(JSON.stringify(refusal), /codex-agent/, 'the untried member is named');
  assert.deepEqual(raisedOf(repo), [], 'no gate was opened by any refused raise');
});

test('I6: a recorded workaround attempt, or a typed reason the chain has no other member, opens the gate for that one job', (t) => {
  const tried = world(t);
  const attempt = run(tried, ...gateArgs(['--cause', 'no-eligible-agent', '--workaround', 'dispatch --model codex-agent was refused at launch-trust (codex guard)']));
  assert.equal(attempt.status, 0, attempt.stderr);
  const [raised] = raisedOf(tried);
  assert.deepEqual(raised.holds, [NIVO_JOB]);
  assert.equal(raised.workaround.cause, 'no-eligible-agent');
  assert.match(raised.workaround.attempt, /codex-agent was refused/);
  const spent = world(t, { chain: ['claude-agent'] });
  const typed = run(spent, ...gateArgs(['--cause', 'no-eligible-agent', '--no-workaround', 'single-member-chain']));
  assert.equal(typed.status, 0, typed.stderr);
  assert.equal(raisedOf(spent)[0].workaround.none, 'single-member-chain');
  const wrong = run(spent, ...gateArgs(['--cause', 'no-eligible-agent', '--no-workaround', 'because-i-say-so']));
  assert.equal(json(wrong).code, 'gate-no-workaround-invalid');
});

test('I6, Nivo inc-51f1e22789e5 and inc-ce67aea64fab: a plan divergence after a provisional answer is a revisitable handover decision and opens no gate', (t) => {
  const repo = world(t);
  const redirected = run(repo, ...gateArgs(['--cause', 'plan-divergence']));
  assert.equal(redirected.status, 0, redirected.stderr);
  assert.equal(json(redirected).redirected, 'handover-decision');
  assert.deepEqual(raisedOf(repo), []);
  const decisions = read(repo, (db) => db.prepare("SELECT payload_json FROM events WHERE kind='autopilot-decision'").all().map((row) => JSON.parse(row.payload_json)));
  assert.equal(decisions.length, 1);
  assert.deepEqual([decisions[0].cause, decisions[0].revisit, decisions[0].holds], ['plan-divergence', true, [NIVO_JOB]]);
  const irreversible = run(repo, ...gateArgs(['--cause', 'plan-divergence', '--no-workaround', 'answer-not-reversible']));
  assert.equal(irreversible.status, 0, irreversible.stderr);
  assert.equal(raisedOf(repo).length, 1, 'a typed reason that the answer cannot stay provisional does open the gate');
});

test('I6, StarCi inc-5c97fdeac27e: a runtime defect gate holds one job and names the route that avoids it, or why none does', (t) => {
  const repo = world(t);
  const bare = run(repo, ...gateArgs(['--cause', 'runtime-defect'], STARCI_JOB));
  assert.equal(json(bare).code, 'gate-workaround-required');
  const ok = run(repo, ...gateArgs(['--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path', '--because', 'record-checks reruns in the main checkout for every leg'], STARCI_JOB));
  assert.equal(ok.status, 0, ok.stderr);
  const [raised] = raisedOf(repo);
  assert.deepEqual(raised.holds, [STARCI_JOB]);
  assert.equal(raised.workaround.because, 'record-checks reruns in the main checkout for every leg');
});

test('the runtime\'s own raises pass their typed reason: a gate opened without one is refused by openSupervisorGate', async (t) => {
  const { openSupervisorGate } = await import('../../scripts/kernel/autopilot-budget.mjs');
  const repo = world(t);
  seed(repo, (l) => {
    assert.throws(() => openSupervisorGate(l, { workflowId: WF, holds: [NIVO_JOB], detail: 'x' }), (e) => e.code === 'gate-cause-required');
    assert.throws(() => openSupervisorGate(l, { workflowId: WF, holds: [NIVO_JOB], detail: 'x', workaround: { cause: 'retry-cap' } }), (e) => e.code === 'gate-workaround-required');
    assert.ok(openSupervisorGate(l, { workflowId: WF, holds: [NIVO_JOB], detail: 'x', workaround: { cause: 'retry-cap', noWorkaround: 'retry-cap-spent' } }));
  });
});

// I3: a gate carries a machine-checkable condition where its cause allows; the status pass resolves it with an evidence event.
const headSha = () => spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
const NOT_LANDED = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const defectGate = (repo, extra = []) => run(repo, ...gateArgs(['--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path', ...extra], STARCI_JOB));
const statusOf = (repo) => json(run(repo, 'status', '--workflow', WF));
const resolvedEvents = (repo) => read(repo, (db) => db.prepare("SELECT kind,payload_json FROM events WHERE kind IN ('incident-resolved','incident-auto-resolved') ORDER BY seq").all()
  .map((row) => ({ kind: row.kind, ...JSON.parse(row.payload_json) })).filter((event) => event.by));

test('I3, StarCi inc-5c97fdeac27e: the gate waits on "the live runtime contains the fix" and the status pass resolves it once it does', async (t) => {
  const { CONDITIONS_ATTACHED_EVENT } = await import('../../scripts/kernel/gate-conditions.mjs');
  const repo = world(t);
  const raised = json(defectGate(repo, ['--until-runtime-has', NOT_LANDED]));
  assert.equal(raised.status, 'open');
  assert.deepEqual(resolvedEvents(repo), [], 'the fix is not in the runtime yet, so the gate stays open');
  // The land arrives: the Supervisor's fix commit is now in the runtime. The next status read resolves the gate itself.
  seed(repo, (l) => l.appendEvent({ workflowId: WF, entityType: 'incident', entityId: raised.incidentId, kind: CONDITIONS_ATTACHED_EVENT, payload: { until: [{ type: 'runtime-has', commit: headSha() }] } }));
  statusOf(repo);
  const [byRuntime] = resolvedEvents(repo);
  assert.equal(byRuntime.by, 'until-conditions');
  assert.match(byRuntime.detail, /the live runtime \(.{12}\) contains /);
  assert.equal(read(repo, (db) => db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(raised.incidentId).status), 'resolved');
});

test('I3: a condition that already holds resolves the gate at once, with the evidence event; a malformed or unknown one is refused', (t) => {
  const repo = world(t);
  const met = json(defectGate(repo, ['--until-runtime-has', headSha()]));
  assert.equal(met.status, 'resolved');
  assert.match(met.autoResolved.evidence.join(' '), /contains/);
  assert.equal(json(defectGate(repo, ['--until-runtime-has', 'not-a-sha'])).code, 'until-invalid');
  assert.equal(json(defectGate(repo, ['--until-admission', 'op-nothing-0123456789'])).code, 'until-job-unknown');
  assert.equal(json(defectGate(repo, ['--until-check', 'nocolon'])).code, 'until-invalid');
});

test('I3, Nivo inc-8682f80b8b34: the admission gate carries "no provider receipt of the job holds a slot" and ends when the receipt is released', async (t) => {
  const { withMachine } = await import('../../engine/db/machine.mjs');
  const repo = world(t, { chain: ['claude-agent'] });
  withMachine((m) => {
    const reserved = m.reserveProvider({ provider: 'claude', account: 'default', attemptId: 'att-stale-1', role: 'op', model: 'claude-opus-5-5', maxParallel: 4, scope: { scopeId: `ledger:${NIVO_JOB}:attempt:2` } });
    assert.equal(reserved.ok, true);
    assert.equal(m.markProviderReservation({ ...reserved.reservation, state: 'unknown' }).ok, true);
  });
  const raised = json(run(repo, ...gateArgs(['--cause', 'no-eligible-agent', '--no-workaround', 'single-member-chain'])));
  assert.equal(raised.status, 'open');
  assert.match(JSON.stringify(raised.until), /admission/);
  const [event] = read(repo, (db) => db.prepare("SELECT payload_json FROM events WHERE kind='incident-raised'").all().map((row) => JSON.parse(row.payload_json)));
  assert.equal(event.until[0].jobId, NIVO_JOB, 'the cause class attached the condition: the raise named none');
  assert.deepEqual(resolvedEvents(repo), []);
  // The Supervisor's fix releases the stale receipt (reconcile proves no effect); the next status pass resolves the gate.
  withMachine((m) => {
    const [row] = m.providerReservations({ activeOnly: true });
    assert.equal(m.releaseProviderReservation({ ...row, proof: { kind: 'reconciled-no-effect', confirmed: true, source: 'spec', dispatchId: 'ctx_spec', scopeId: row.scope.scopeId, effectState: 'none' } }).ok, true);
  });
  statusOf(repo);
  const [auto] = resolvedEvents(repo);
  assert.equal(auto.by, 'until-conditions');
  assert.match(auto.detail, /holds a slot/);
});
