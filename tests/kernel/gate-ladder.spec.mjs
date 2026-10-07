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

// I4 / I8: a gate is one Decision Item on the Supervisor ladder; the Supervisor answers with one of three typed resolutions.
const openGate = (repo, extra = ['--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path'], holds = STARCI_JOB) => {
  const raised = run(repo, 'incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', holds, '--detail', 'settle held waiting for a runtime fix to record-checks cwd', ...extra);
  assert.equal(raised.status, 0, raised.stderr);
  return json(raised).incidentId;
};
const answer = (repo, incidentId, ...flags) => run(repo, 'incident', '--workflow', WF, '--resolve', incidentId, '--by', 'supervisor', ...flags);
const gateStatus = (repo, db, incidentId) => db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(incidentId).status;

test('I4, the three typed resolutions: a Supervisor answer names fixed (commit), workaround (route) or not-runtime-fault (why)', (t) => {
  const repo = world(t);
  const id = openGate(repo);
  assert.equal(json(answer(repo, id, '--detail', 'fixed by something')).code, 'gate-resolution-required');
  assert.equal(json(answer(repo, id, '--resolution', 'fixed')).code, 'gate-resolution-incomplete');
  assert.equal(json(answer(repo, id, '--resolution', 'fixed', '--commit', 'zzz')).code, 'until-invalid');
  assert.equal(json(answer(repo, id, '--resolution', 'workaround')).code, 'gate-resolution-incomplete');
  assert.equal(json(answer(repo, id, '--resolution', 'not-runtime-fault', '--detail', 'short')).code, 'gate-resolution-incomplete');
  assert.equal(read(repo, (db) => gateStatus(repo, db, id)), 'open', 'no refused answer resolved the gate');
  // fixed, the commit not in the live runtime yet: the gate stays open and the status pass resolves it when the land arrives.
  const waiting = json(answer(repo, id, '--resolution', 'fixed', '--commit', NOT_LANDED, '--detail', 'fix landing'));
  assert.deepEqual([waiting.status, waiting.answered.resolution], ['open', 'fixed']);
  assert.equal(read(repo, (db) => gateStatus(repo, db, id)), 'open');
  const answered = read(repo, (db) => db.prepare("SELECT payload_json FROM events WHERE kind='gate-answered'").all().map((row) => JSON.parse(row.payload_json)));
  assert.deepEqual([answered[0].resolution, answered[0].cause, answered[0].holds], ['fixed', 'runtime-defect', [STARCI_JOB]]);
  // The commit is in the live runtime: fixed resolves at once.
  const landed = json(answer(repo, id, '--resolution', 'fixed', '--commit', headSha(), '--detail', 'fix is in main'));
  assert.deepEqual([landed.status, landed.answered.resolution], ['resolved', 'fixed']);
  assert.equal(read(repo, (db) => db.prepare("SELECT payload_json FROM events WHERE kind='incident-resolved' AND json_extract(payload_json,'$.by')='supervisor'").get().payload_json.includes('"resolution":"fixed"')), true);
});

test('I4, workaround: the gate resolves and the Kernel is told the route to dispatch with', (t) => {
  const repo = world(t);
  const id = openGate(repo, ['--cause', 'no-eligible-agent', '--workaround', 'dispatch --model codex-agent was refused at launch-trust'], NIVO_JOB);
  const done = json(answer(repo, id, '--resolution', 'workaround', '--route', 'codex-agent', '--detail', 'codex runs the leg with the guard bypassed'));
  assert.deepEqual([done.status, done.answered.route], ['resolved', 'codex-agent']);
  const [event] = read(repo, (db) => db.prepare("SELECT payload_json FROM events WHERE kind='gate-answered'").all().map((row) => JSON.parse(row.payload_json)));
  assert.deepEqual([event.resolution, event.route, event.cause], ['workaround', 'codex-agent', 'no-eligible-agent']);
});

test('I4, not-runtime-fault: back to the Kernel, and the same cause and scope is not raised again without new evidence', (t) => {
  const repo = world(t);
  const id = openGate(repo);
  const back = json(answer(repo, id, '--resolution', 'not-runtime-fault', '--detail', 'the checks ran in the right worktree, the red is the leg\'s own'));
  assert.equal(back.status, 'resolved');
  const again = run(repo, 'incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', STARCI_JOB, '--detail', 'settle held waiting for a runtime fix to record-checks cwd', '--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path');
  assert.equal(json(again).code, 'gate-reraise-without-evidence');
  const same = run(repo, 'incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', STARCI_JOB, '--detail', 'settle held waiting for a runtime fix to record-checks cwd', '--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path', '--evidence', 'settle held waiting for a runtime fix to record-checks cwd');
  assert.equal(json(same).code, 'gate-reraise-without-evidence', 'the old evidence repeated is not new');
  const other = run(repo, 'incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', NIVO_JOB, '--detail', 'x', '--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path');
  assert.equal(other.status, 0, 'another scope is not refused');
  const fresh = run(repo, 'incident', '--workflow', WF, '--kind', 'owner-gate', '--holds', STARCI_JOB, '--detail', 'x', '--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path', '--evidence', 'record-checks exit 2 with ENOENT in the leg worktree after your reply');
  assert.equal(fresh.status, 0, fresh.stderr);
});

// The pieces of the ladder: the Decision Item a gate opens, the levels it climbs, the close with its gate, and the defer only after the owner was told.
const T0 = 1_800_000_000_000;
const gateRow = (extra = {}) => ({ incidentId: 'inc-gate0001', opId: null, holds: [NIVO_JOB], detail: 'admission answers no-eligible-candidate', since: T0,
  workaround: { cause: 'no-eligible-agent', attempt: 'dispatch --model codex-agent was refused at launch-trust' }, ...extra });
const noEvents = { prepare: () => ({ get: () => undefined }) };

test('I4: an open gate in the status opens one Supervisor Decision Item that leads with what was tried and offers the three resolutions', async () => {
  const { planWorkflow } = await import('../../scripts/reconciler/workflow-plan.mjs');
  const { gateViewOf } = await import('../../scripts/kernel/gate-ladder.mjs');
  const view = { ...gateViewOf(noEvents, WF, gateRow(), { now: T0 + 60_000, timeoutMs: 6 * 3_600_000 }), subject: 'gate-no-eligible-agent-op-x-0' };
  const plan = planWorkflow({ ledgerId: 'ledger-a', workflowId: WF, status: { autopilot: { supervisorGates: [view] } }, now: T0 + 60_000, settings: { decisionDueMs: 900_000 } });
  const [di] = plan.decisions.filter((entry) => entry.refs?.gateIncident === 'inc-gate0001');
  assert.equal(di.decider, 'supervisor');
  assert.equal(di.ledger, 'supervisor', 'the Supervisor ledger, where the ladder reads it');
  assert.equal(di.idempotencyKey, `runtime-defect:${WF}:gate-no-eligible-agent-op-x-0`);
  assert.equal(di.dueAt - di.openedAt, 900_000, 'the acknowledgement deadline is the ackMs of the table');
  assert.match(di.evidence[0].ref, /^tried: dispatch --model codex-agent was refused/);
  assert.match(di.evidence[1].ref, /^watching: /);
  assert.deepEqual(di.options.map((option) => option.key), ['fixed', 'workaround', 'not-runtime-fault']);
  assert.deepEqual(di.allowedVerbs, ['starci kernel incident']);
});

test('I7: the gate view names its handler, step, deadline and watched condition, and moves up the ladder with its age', async () => {
  const { gateViewOf, gatePolicyOf } = await import('../../scripts/kernel/gate-ladder.mjs');
  const { ladderOf } = await import('../../scripts/kernel/supervisor-di-ladder.mjs');
  const { ackMs } = gatePolicyOf();
  const { stepMs, ownerAfter } = ladderOf();
  const timeoutMs = 6 * 3_600_000;
  const at = (age, typed = []) => gateViewOf(noEvents, WF, gateRow(), { now: T0 + age, typed, timeoutMs });
  const fresh = at(0);
  assert.deepEqual([fresh.handler, fresh.step, fresh.steps, fresh.deadlineAt], ['supervisor', 1, ownerAfter + 1, T0 + ackMs]);
  assert.equal(fresh.condition, null);
  assert.match(fresh.conditionNote, /^none.*the ladder carries it/);
  const second = at(ackMs);
  assert.deepEqual([second.handler, second.step, second.deadlineAt], ['supervisor', 2, T0 + ackMs + stepMs]);
  const owner = at(ackMs + ownerAfter * stepMs);
  assert.deepEqual([owner.handler, owner.step, owner.deadlineAt], ['owner', ownerAfter + 1, T0 + timeoutMs]);
  const results = [{ condition: 'admission holds no receipt for x', met: false, evidence: '1 receipt holds a slot' }];
  const watched = at(0, [{ incidentId: 'inc-gate0001', results }]);
  assert.deepEqual(watched.condition, results);
  assert.equal(watched.conditionNote, null);
});

test('I4/I8: the gate item climbs one level per step to the owner level, where the owner is told once with what was tried; it closes with its gate', async () => {
  const { escalateSupervisorDis, ladderOf } = await import('../../scripts/kernel/supervisor-di-ladder.mjs');
  const { overdueUrgent } = await import('../../scripts/reconciler/controllers/workers.mjs');
  const { closeResolvedGateDis, gateSightOf } = await import('../../scripts/reconciler/gate-close.mjs');
  const numbers = ladderOf();
  const calls = [];
  const m = { setSupDecision: (id, set) => calls.push([id, set.status]), supEvent: () => {} };
  let di = { id: 'sdi-gate', status: 'open', dueAt: T0, escalations: 0, summary: 'supervisor-gate inc-gate0001 (no-eligible-agent) holds x',
    evidence: [{ ref: 'tried: dispatch --model codex-agent was refused' }, { ref: 'watching: admission' }], refs: { gateIncident: 'inc-gate0001', ledgerId: 'ledger-a', cause: 'no-eligible-agent' } };
  for (let level = 1; level <= numbers.ownerAfter; level += 1) {
    assert.deepEqual(escalateSupervisorDis(m, [di], { now: T0 + (level - 1) * numbers.stepMs, ...numbers }), ['sdi-gate']);
    di = { ...di, status: 'escalated', escalations: level };
  }
  const [urgent] = overdueUrgent([di], { now: T0 + 1, min: numbers.ownerAfter });
  assert.match(urgent.text, /tried: dispatch --model codex-agent was refused/);
  assert.equal(urgent.key, 'di:sdi-gate', 'one notice per item');
  // The item closes when its incident is no longer open in a ledger the pass read; an unread ledger closes nothing.
  const reader = (ledgerId, open) => ({ ledgerId, db: { prepare: () => ({ all: () => open.map((incident_id) => ({ incident_id })) }) } });
  assert.deepEqual(closeResolvedGateDis(m, [di], gateSightOf([reader('ledger-a', ['inc-gate0001'])])), [], 'still open: stays on the ladder');
  assert.deepEqual(closeResolvedGateDis(m, [di], gateSightOf([reader('ledger-b', [])])), [], 'its ledger was not read');
  assert.deepEqual(closeResolvedGateDis(m, [di], gateSightOf([reader('ledger-a', [])])), ['sdi-gate']);
  assert.deepEqual(calls.at(-1), ['sdi-gate', 'resolved']);
});

test('I8: the silent defer-to-handover happens only after the owner was told: the gate item reached the owner level', async (t) => {
  const { withMachine } = await import('../../engine/db/machine.mjs');
  const { deferTimedOutGates } = await import('../../scripts/kernel/autopilot-state.mjs');
  const { ladderOf } = await import('../../scripts/kernel/supervisor-di-ladder.mjs');
  const { gateSubjectOf } = await import('../../scripts/kernel/gate-ladder.mjs');
  const repo = world(t);
  const timeoutMs = 6 * 3_600_000;
  const id = openGate(repo, ['--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path'], NIVO_JOB);
  const sweep = (now) => seed(repo, (l) => {
    const out = { timedOut: [] };
    l.transaction(() => deferTimedOutGates({ ledger: l, db: l.db, workflowId: WF, settings: { supervisorGateTimeoutMs: timeoutMs }, out, now }));
    return out.timedOut;
  });
  const late = Date.now() + timeoutMs + 60_000;
  assert.deepEqual(sweep(late), [], 'past the timeout but the owner was not told: nothing is deferred');
  const subject = seed(repo, (l) => gateSubjectOf(l.db, WF, { incidentId: id, holds: [NIVO_JOB], workaround: { cause: 'runtime-defect' } }));
  withMachine((m) => {
    const opened = m.openSupDecision({ keyParts: { kind: 'runtime-defect', workflow: WF, subject }, kind: 'runtime-defect', summary: 'gate', workflowId: WF, openedBy: 'spec', dueAt: 1, payload: {} });
    for (let level = 0; level < ladderOf().ownerAfter; level += 1) m.setSupDecision(opened.diId, { status: 'escalated', by: 'spec' });
  });
  assert.deepEqual(sweep(late).map((entry) => entry.incidentId), [id], 'the owner was told: the held job is deferred to the handover list');
  assert.deepEqual(sweep(Date.now() + 60_000), [], 'a gate younger than the timeout never defers');
});
