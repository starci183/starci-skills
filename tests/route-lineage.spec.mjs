// The router decides, the Kernel does not bias: api route refuses --prefer/--avoid, and a retry learns
// from its own lineage (scripts/kernel/lineage-route.mjs).
//
// Live defect (starci-next wf-sn-foundation, owner decision 2026-09-25): the Kernel routed
// op-interface.implement-c3bcc0d5e4 with --avoid devin-agent,devin-agent; route-decided carried the avoid
// and the job went to codex gpt-6-luna, defeating the evidence routing that sends implementation to Devin
// first. Now a Kernel's per-route bias is refused as an unknown option; the router
// skips pools with an open provider-health circuit, demotes a pool the retry's lineage failed on once for a
// pool-attributable cause and excludes it after two, never for a product or environment failure, and the
// owner's goal routing_bias still applies.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { openMachine } from '../engine/machine-db.mjs';
import { seedWorkflow as seedLedgerWorkflow } from './_ledger-fixture.mjs';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { EXCLUDE_AFTER, attemptCauseOf, lineageRouteAdjust } from '../scripts/kernel/lineage-route.mjs';
import { selectPool } from '../scripts/agent/models.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (v) => JSON.stringify(v ?? null);
const WF = 'wf-sn-foundation';
const OP = 'interface.implement';
const JOB = 'op-interface.implement-c3bcc0d5e4';
const P1 = 'op-interface.implement-a1a1a1a1a1';
const P2 = 'op-interface.implement-b2b2b2b2b2';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const worldEnv = (repo) => ({ ...process.env,
  STARCI_PROJECTS_ROOT: path.join(repo,'.starciwork','projects'),
  STARCI_TEST_MACHINE_FILE: path.join(repo,'.starciwork','machine.sqlite'),
  LOCALAPPDATA: path.join(repo,'.starciwork','localappdata') });
const seed = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo,{env:worldEnv(repo)}) }); try { return fn(l); } finally { l.close(); } };
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo,{env:worldEnv(repo)}) }); try { return fn(l); } finally { l.close(); } };
const ownerRoot = (t, policy) => {
  const dir = tmp(t, 'starci-owner-');
  const example = path.join(ROOT, 'config.example.yaml');
  fs.copyFileSync(example, path.join(dir, 'config.example.yaml'));
  const config = parseYaml(fs.readFileSync(example, 'utf8'));
  fs.writeFileSync(path.join(dir, 'config.yaml'), stringifyYaml({ ...config,
    allocation: { ...(config.allocation ?? {}), policy, preferredProvider: null },
    budgets: { maxOps: null } }));
  return dir;
};
const env = (t, policy, repo) => {
  const dir = tmp(t, 'starci-fake-orca-');
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  fs.writeFileSync(path.join(dir, 'state.json'), '{}');
  const e = { ...worldEnv(repo), STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json'),
    STARCI_OWNER_ROOT: ownerRoot(t, policy) };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete e[key];
  return e;
};
// prefer-then-overflow: the walked order alone decides, so a demotion or exclusion is observable.
const route = (t, repo, args = [], { policy = 'prefer-then-overflow' } = {}) => {
  const r = spawnSync(process.execPath, [API, 'route', '--repo', repo, '--job', JOB, ...args, '--json'],
    { cwd: ROOT, env: env(t, policy, repo), encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return { ...JSON.parse(r.stdout), stderr: r.stderr };
};
const routeDecided = (repo) => read(repo, (l) => JSON.parse(l.db.prepare(
  "SELECT payload_json FROM events WHERE kind='route-decided' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(JOB).payload_json));

// `prior` are the earlier attempts of the lineage, oldest first: {pool, result, outcome?, red?[], gateLoop?}.
// The queued job retries the newest of them.
const seedWorkflow = (repo, { goalBias = null, prior = [] } = {}) => seed(repo, (l) => {
  const at = Date.now();
  const ids = [P1, P2];
  const payload=(extra={})=>({opId:OP,owned_paths:['apps/web/src/features/interface/'],...extra});
  const jobs=prior.map((p,i)=>({jobId:ids[i],unitId:'route-unit',opId:OP,tryNo:i+1,
    retryOf:i?ids[i-1]:null,status:p.status??'failed',pool:p.pool,payload:payload({model:p.pool}),result:p.result,createdAt:at+i}));
  jobs.push({jobId:JOB,unitId:'route-unit',opId:OP,tryNo:prior.length+1,
    retryOf:prior.length?ids[prior.length-1]:null,status:'queued',payload:payload(),createdAt:at+prior.length});
  seedLedgerWorkflow(l,{id:WF,state:{phase:'running',job:'lineage routing'},goalIdentity:'lineagegoal',
    goal:{revision:0,identity:'lineagegoal',markdown:'# goal',json:{routing_bias:goalBias}},jobs});
  prior.forEach((p, i) => {
    if (p.outcome) l.appendEvent({ workflowId: WF, entityType: 'job', entityId: ids[i], kind: 'op-settled', payload: { verdict: 'fail', status: 'failed', reportOutcome: p.outcome } });
    const attempt=l.db.prepare('SELECT attempt_id,dispatch_id FROM op_attempts WHERE job_id=?').get(ids[i]);
    if(p.outcome)l.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(WF,attempt.attempt_id,attempt.dispatch_id,ids[i],p.outcome,json({outcome:p.outcome,summary:'lineage fixture'}),at+i);
    for(const name of p.red??[])l.write.recordCheckRun({attemptId:attempt.attempt_id,name,phase:'verify',runner:'kernel',status:'fail',exitCode:1});
    if (p.gateLoop) l.appendEvent({ workflowId: WF, entityType: 'job', entityId: ids[i], kind: 'op-worker-gate-loop', payload: { opId: OP, attempt: i + 1, gate: 'trust' } });
  });
});
const noReport = { verdict: 'fail', reason: 'failed-no-report', reportFiled: false, worker: { liveness: 'exited' } };
const openCircuit = (repo, provider, failureKind = 'auth') => {
  const at = Date.now();
  const machine=openMachine({file:worldEnv(repo).STARCI_TEST_MACHINE_FILE,env:worldEnv(repo)});
  try{machine.setProviderHealth({provider,status:'unavailable',failureKind,strikes:1,strikeLimit:1,circuitOpenUntil:at+3600000,
    detail:{schema:'starci/provider-health@1',provider,status:'unavailable',failureKind,strikeLimit:1,
      model:`${provider}-agent`,jobId:'op-seeded',step:'attestation',detail:`${failureKind} rejected`,failures:1,trips:1}});}
  finally{machine.close();}
};

test('a Kernel --avoid/--prefer is an unknown option on api route: refused, nothing routed', (t) => {
  const repo = tmp(t, 'starci-route-ignored-');
  seedWorkflow(repo);
  for (const args of [['--avoid', 'devin-agent'], ['--prefer', 'codex-agent']]) {
    const r = spawnSync(process.execPath, [API, 'route', '--repo', repo, '--job', JOB, ...args, '--json'],
      { cwd: ROOT, env: env(t, 'prefer-then-overflow', repo), encoding: 'utf8', windowsHide: true, timeout: 120000 });
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /unknown-option|unknown option/);
    assert.equal(read(repo, (l) => l.db.prepare("SELECT count(*) n FROM events WHERE kind='route-decided'").get().n), 0, 'no route was decided');
  }
  const ok = route(t, repo);
  assert.equal(ok.decision.model, 'devin-agent', 'implementation routes to Devin first');
  assert.deepEqual(ok.bias, { prefer: [], avoid: [] }, 'no Kernel bias is applied');
  assert.equal(routeDecided(repo).lineageAdjust, undefined, 'a first attempt has no lineage');
});

test('api dispatch refuses --prefer/--avoid as unknown options', (t) => {
  const repo = tmp(t, 'starci-dispatch-ignored-');
  seedWorkflow(repo);
  route(t, repo);
  const r = spawnSync(process.execPath, [API, 'dispatch', '--repo', repo, '--job', JOB, '--avoid', 'devin-agent', '--json'],
    { cwd: ROOT, env: env(t, 'prefer-then-overflow', repo), encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.notEqual(r.status, 0);
  assert.match(`${r.stderr}${r.stdout}`, /unknown-option|unknown option/);
});

test('the router still skips a pool whose provider-health circuit is open, naming its failureKind', (t) => {
  const repo = tmp(t, 'starci-route-circuit-');
  seedWorkflow(repo);
  openCircuit(repo, 'devin', 'readiness');
  const r = route(t, repo);
  assert.notEqual(r.decision.model, 'devin-agent');
  const reason = r.rejected.find((x) => x.target === 'devin-agent')?.reason ?? '';
  assert.match(reason, /^provider readiness is unavailable: readiness rejected \(circuit open until /);
  assert.doesNotMatch(reason, /auth/, 'a readiness, quota or capacity circuit is not an auth failure');
  openCircuit(repo, 'devin', 'capacity');
  assert.match(route(t, repo).rejected.find((x) => x.target === 'devin-agent')?.reason ?? '', /^provider capacity is unavailable: /);
});

test('a retry whose previous attempt died with no report on Devin moves Devin to the end of the order', (t) => {
  const repo = tmp(t, 'starci-route-demote-');
  seedWorkflow(repo, { prior: [{ pool: 'devin-agent', result: noReport }] });
  const r = route(t, repo);
  assert.notEqual(r.decision.model, 'devin-agent');
  assert.equal(r.decision.routeChain.at(-1), 'devin-agent', 'the demoted pool is last in the walked order');
  const ev = routeDecided(repo);
  assert.deepEqual(ev.lineageAdjust.demoted, ['devin-agent']);
  assert.deepEqual(ev.lineageAdjust.excluded, []);
  assert.deepEqual(ev.lineageAdjust.pools, { 'devin-agent': { failures: 1, causes: [`no-report (${P1})`] } });
  assert.equal(ev.lineageAdjust.attempts[0].cause, 'no-report');
  assert.equal(ev.lineageAdjust.demotedTaken, false);
});

test('a demotion also holds under the balanced policy', (t) => {
  const repo = tmp(t, 'starci-route-demote-balanced-');
  seedWorkflow(repo, { prior: [{ pool: 'devin-agent', result: noReport, gateLoop: true }] });
  const r = route(t, repo, [], { policy: 'balanced' });
  assert.notEqual(r.decision.model, 'devin-agent');
  assert.equal(routeDecided(repo).lineageAdjust.attempts[0].cause, 'gate-loop');
});

test('a demoted pool is still taken when no other pool of the order is eligible', (t) => {
  const repo = tmp(t, 'starci-route-demote-last-');
  seedWorkflow(repo, { prior: [{ pool: 'devin-agent', result: noReport }] });
  const order = route(t, repo).decision.routeChain;
  seed(repo, (l) => l.db.prepare("UPDATE jobs SET status='queued' WHERE job_id=?").run(JOB));
  for (const pool of order.filter((p) => p !== 'devin-agent')) openCircuit(repo, pool.replace(/-agent$/, ''));
  const r = route(t, repo);
  assert.equal(r.decision.model, 'devin-agent');
  assert.equal(routeDecided(repo).lineageAdjust.demotedTaken, true);
});

test('two pool-attributable failures in the lineage exclude the pool for the retry', (t) => {
  const repo = tmp(t, 'starci-route-exclude-');
  seedWorkflow(repo, { prior: [
    { pool: 'devin-agent', result: noReport },
    { pool: 'devin-agent', result: { reason: 'dispatch-rejected', step: 'readiness', effectState: 'unknown', providerHealth: { provider: 'devin', failureKind: 'quota' } } },
  ] });
  const order = route(t, repo).decision.routeChain;
  seed(repo, (l) => l.db.prepare("UPDATE jobs SET status='queued' WHERE job_id=?").run(JOB));
  for (const pool of order.filter((p) => p !== 'devin-agent')) openCircuit(repo, pool.replace(/-agent$/, ''));
  const r = spawnSync(process.execPath, [API, 'route', '--repo', repo, '--job', JOB, '--json'],
    { cwd: ROOT, env: env(t, 'prefer-then-overflow', repo), encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 1, 'with every other pool down, the excluded pool is not taken either');
  const body = JSON.parse(r.stdout);
  assert.match(body.error, /no eligible pool/);
  assert.deepEqual(body.lineageAdjust.excluded, ['devin-agent']);
  assert.equal(EXCLUDE_AFTER, 2);
  const rejected = read(repo, (l) => selectPool({ kind: OP, difficulty: 'medium', capacity: {}, policy: 'prefer-then-overflow',
    lineage: lineageRouteAdjust(l.db, l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB)) }));
  assert.match(rejected.rejected?.find((x) => x.target === 'devin-agent')?.reason ?? '',
    new RegExp(`excluded for this retry lineage: failed 2x on it \\(quota \\(${P2}\\), no-report \\(${P1}\\)\\)`), 'newest attempt first');
});

test('product or environment failures never move a pool', (t) => {
  const repo = tmp(t, 'starci-route-env-');
  seedWorkflow(repo, { prior: [
    { pool: 'devin-agent', result: { verdict: 'blocked' }, outcome: 'blocked' },
    { pool: 'devin-agent', result: { reason: 'dispatch-rejected', step: 'reserve', effectState: 'unknown', providerHealth: null } },
  ] });
  const r = route(t, repo);
  assert.equal(r.decision.model, 'devin-agent');
  const adjust = routeDecided(repo).lineageAdjust;
  assert.deepEqual([adjust.demoted, adjust.excluded], [[], []]);
  assert.deepEqual(adjust.attempts.map((a) => [a.cause, a.attributable]), [['dispatch-rejected', false], ['blocked', false]]);
});

test('attempt causes: model-quality fails count, a failed report or a first red check does not', (t) => {
  const repo = tmp(t, 'starci-route-causes-');
  seedWorkflow(repo, { prior: [
    { pool: 'devin-agent', result: { verdict: 'fail' }, outcome: 'partial', red: ['typecheck'] },
    { pool: 'devin-agent', result: { verdict: 'fail' }, outcome: 'partial', red: ['typecheck', 'e2e'] },
  ] });
  read(repo, (l) => {
    const row = (id) => l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(id);
    assert.deepEqual(attemptCauseOf(l.db, row(P1)).attributable, false, 'a first partial on a red check is the work, not the pool');
    const repeat = attemptCauseOf(l.db, row(P2), row(P1));
    assert.deepEqual([repeat.cause, repeat.attributable, repeat.detail], ['repeat-red-check', true, 'partial again on typecheck']);
    const overruled = attemptCauseOf(l.db, { ...row(P2), result_json: json({ verdict: 'fail', claimOverruled: true }) });
    assert.deepEqual([overruled.cause, overruled.attributable], ['report-rejected', true]);
    const failedReport = attemptCauseOf(l.db, { ...row(P2), job_id: 'op-none', result_json: json({ verdict: 'fail' }) });
    assert.equal(failedReport.attributable, false, 'a failed report (a missing secret, a peer\'s red tests) is not the pool');
    const crash = attemptCauseOf(l.db, { ...row(P2), result_json: json({ reason: 'dispatch-rejected', step: 'worker-start', providerHealth: { provider: 'devin', failureKind: 'worker-start' } }) });
    assert.deepEqual([crash.cause, crash.attributable], ['agent-crash', true]);
    // A prompt lost on two stalled sends is a launch fault like a worker-start refusal: its first strike
    // opens no circuit and moves no pool; the strike that opens the circuit counts against the pool.
    const stalled = { reason: 'dispatch-rejected', step: 'send', signal: 'prompt-delivery-stalled', providerHealth: null };
    const strike = attemptCauseOf(l.db, { ...row(P2), result_json: json(stalled) });
    assert.deepEqual([strike.cause, strike.attributable], ['dispatch-rejected', false]);
    const repeated = attemptCauseOf(l.db, { ...row(P2), result_json: json({ ...stalled, providerHealth: { provider: 'codex', failureKind: 'prompt-delivery-stalled' } }) });
    assert.deepEqual([repeated.cause, repeated.attributable, repeated.detail], ['agent-crash', true, 'launch failed at send (prompt-delivery-stalled)']);
    const adjust = lineageRouteAdjust(l.db, row(JOB));
    assert.deepEqual([adjust.demote, adjust.exclude], [['devin-agent'], []]);
  });
});

test('the goal routing_bias (the owner\'s) is always honoured', (t) => {
  const repo = tmp(t, 'starci-route-goal-');
  seedWorkflow(repo, { goalBias: { prefer: [], avoid: ['devin-agent'] } });
  const r = route(t, repo);
  assert.notEqual(r.decision.model, 'devin-agent');
  assert.deepEqual(r.bias.avoid, ['devin-agent'], 'the owner\'s avoid applies');
});
