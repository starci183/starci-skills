// A Devin capacity outage opens the devin provider-health circuit (failureKind capacity), and a retry routes
// around Devin.
//
// Live defect: three sibling
// interface.audit workers on devin-agent (SWE-2 Max) worked for 20 minutes, then every turn failed with
// "Client error: Protocol error (unimplemented): We are currently experiencing capacity issues with this
// serving model." Nudges failed again with fresh traces. The Kernel settled them failed with no report, and
// the retries routed to Devin again: no circuit opened (only quota codes did), and the lineage read each
// failed attempt as "the work or its environment, not the pool".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { outageInText, outageOnScreen, outageSpecsOf, quotaSpecOf } from '../../scripts/agent/provider-outage.mjs';
import { attemptCauseOf, lineageRouteAdjust } from '../../scripts/kernel/lineage-route.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openMachineReader } from '../../engine/db/machine.mjs';
import { readProviderCircuit } from '../../scripts/machine/provider-circuit.mjs';
import { JOB_ROW } from '../../scripts/machine/job-row.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const runtimes = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'models', 'runtimes.yaml'), 'utf8'));
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const CAPACITY_ROW = 'Client error: Protocol error (unimplemented): We are currently experiencing capacity issues with this serving model. Please switch to a different model or try again later. (trace ID: 068a07abe316fe5c299e31dc5871a0bb)';
const CLIPPED_ROW = CAPACITY_ROW.slice(0, 200); // evidence keeps the first 200 characters of the row
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};

test('the Devin card classifies its capacity error as a capacity outage, from text and from an anchored screen row only', () => {
  assert.deepEqual(outageSpecsOf('devin-agent').map((s) => s.failureKind), ['capacity']);
  assert.equal(quotaSpecOf('devin'), null, 'Devin declares no quota outage');
  assert.deepEqual(outageInText('devin', [`ACP: agent error (Internal): ${CAPACITY_ROW}`]),
    { provider: 'devin', failureKind: 'capacity', source: 'text', match: 'experiencing capacity issues with this serving model' });
  const screen = ['  ⎿ Read .starciwork/features/profiles/ui/index.yaml', CAPACITY_ROW, '❭ Ask Devin to build features...'].join('\n');
  assert.deepEqual(outageOnScreen('devin', screen), { provider: 'devin', failureKind: 'capacity', source: 'screen', match: CLIPPED_ROW });
  // The CLI wraps a long error row; the words still match across the break.
  const wrapped = outageOnScreen('devin', '✗ Error: Client error: Protocol error (unimplemented): We are currently experiencing\n  capacity issues with this serving model.');
  assert.equal(wrapped?.failureKind, 'capacity');
  // A worker reading or editing text about the error is no evidence: the row must start with the CLI's own error.
  for (const frame of [`  12 | signal: '${CAPACITY_ROW}'`, "    - 'experiencing capacity issues with this serving model'",
    `2026-09-25T13:15:05.197771Z  WARN run_acp_server: agent error (Internal): ${CAPACITY_ROW}`])
    assert.equal(outageOnScreen('devin', frame), null, frame);
  assert.equal(outageOnScreen('codex', CAPACITY_ROW), null, 'a card without an outage key is never classified');
  assert.equal(runtimes.allocation.cooldownMs.capacity, 600000, 'a capacity circuit is short: the outage clears in minutes');
});

/* ------------------------------------------------------------ kernel integration */

const WF = 'wf-devin-capacity';
const runApi = (env, ...args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, ...args], { cwd: ROOT, env, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill(), 180000);
  child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr, value: json(stdout) }); });
});
const fixture = (t) => {
  const root = tmp(t, 'starci-devin-cap-');
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'); fs.writeFileSync(stateFile, '{}');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_MODE: 'healthy',
    STARCI_LOCAL_ROOT: path.join(root, 'localappdata'), STARCI_PROJECTS_ROOT:path.join(root,'projects'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const at = Date.now() - 20 * 60000;
  const ledgerFile=ledgerFileFor(repo,{env});
  const ledger = openLedger({ file: ledgerFile });
  try {
    seedWorkflow(ledger,{id:WF,state:{phase:'running',job:'capacity'},jobs:[
      {jobId:`kernel-${WF}`,kind:'kernel',status:'running',workerId:'fake-kernel-terminal'},
      {jobId:'op-impl-a1',unitId:'impl-a',opId:'interface.implement',status:'running',workerId:'term-devin-worker',
        createdAt:at,payload:{opId:'interface.implement',owned_paths:['apps/web/src/features/profile/'],difficulty:'medium',model:'devin-agent',
          hierarchy:{runtime:{terminalHandle:'term-devin-worker',provider:'devin',runtimePool:'devin-agent'}}}}
    ]});
  } finally { ledger.close(); }
  const writeState = (fn) => { const s = json(fs.readFileSync(stateFile, 'utf8')) ?? {}; fn(s); fs.writeFileSync(stateFile, JSON.stringify(s)); };
  const db = (fn) => { const l = inspectLedger({ file: ledgerFile }); try { return fn(l.db); } finally { l.close(); } };
  const row = () => {const m=openMachineReader({file:env.STARCI_TEST_MACHINE_FILE});try{const r=readProviderCircuit('devin',{machine:m});return r?{...r.value,expiresAt:r.expiresAt}:null;}finally{m.close();}};
  return { repo, env, ledgerFile, writeState, db, row, run: (...args) => runApi(env, ...args) };
};

test('a Devin worker screen showing the capacity error opens the devin capacity circuit; the retry routes around Devin and counts the outage against it', async (t) => {
  const fx = fixture(t);
  fx.writeState((s) => { s.terminals = { 'term-devin-worker': { handle: 'term-devin-worker', connected: true, writable: true, command: 'devin', lastOutputAt: Date.now() - 60000,
    screen: ['  ⎿ Wrote .starciwork/features/profiles/operations/audit/evidence/draw-lineage.json', CAPACITY_ROW, '─'.repeat(20), '❭ Ask Devin to build features...'].join('\n') } }; });
  const before = Date.now();
  const status = await fx.run('status', '--repo', fx.repo, '--workflow', WF, '--json');
  assert.equal(status.status, 0, status.stderr || status.stdout);
  assert.deepEqual(status.value.workers.find((w) => w.jobId === 'op-impl-a1').providerOutage,
    { provider: 'devin', failureKind: 'capacity', source: 'screen', match: CLIPPED_ROW });
  assert.deepEqual(status.value.outageCircuits.map((c) => [c.provider, c.failureKind, c.jobId]), [['devin', 'capacity', 'op-impl-a1']]);
  const circuit = fx.row();
  assert.deepEqual([circuit.status, circuit.failureKind, circuit.step, circuit.jobId, circuit.model], ['unavailable', 'capacity', 'worker-screen', 'op-impl-a1', 'devin-agent']);
  assert.ok(circuit.expiresAt >= before + 600000 && circuit.expiresAt <= Date.now() + 600000, 'the capacity cooldown, not a quota reset');
  assert.equal(circuit.resetAt, undefined);
  // A re-read of the same frame is no new strike.
  const again = await fx.run('status', '--repo', fx.repo, '--workflow', WF, '--json');
  assert.equal(again.value.outageCircuits, undefined);
  assert.equal(fx.db((d) => d.prepare("SELECT count(*) n FROM events WHERE kind='provider-unavailable'").get().n), 1);

  // The Kernel settles the dead attempt failed with no report and enqueues its retry, as it did live.
  const l = openLedger({ file: fx.ledgerFile });
  try {
    l.write.recordJobResult({jobId:'op-impl-a1',result:{verdict:'fail',report:null,checkEvidence:{observed:0,passed:0,failed:0,green:false}}});
    l.write.setJobStatus({jobId:'op-impl-a1',to:'failed',reason:'capacity outage'});
    l.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-impl-a1', kind: 'op-settled',
      payload: { verdict: 'fail', status: 'failed', report: null, reportFiled: false, reportOutcome: null } });
    l.enqueueJob({ jobId: 'op-impl-a2', workflowId: WF, unitId:'impl-a',tryNo:2,retryOf:'op-impl-a1',opId: 'interface.implement', kind: 'op',
      payload: { opId: 'interface.implement', owned_paths: ['apps/web/src/features/profile/'], difficulty: 'medium', retry: { retryOf: 'op-impl-a1', businessAttempt: 2 } } });
  } finally { l.close(); }
  const route = await fx.run('route', '--repo', fx.repo, '--job', 'op-impl-a2', '--json');
  assert.equal(route.status, 0, route.stderr || route.stdout);
  assert.notEqual(route.value.decision.model, 'devin-agent', 'the open capacity circuit skips Devin');
  assert.match(route.value.rejected.find((r) => r.target === 'devin/swe-2-max')?.reason ?? '', /out of capacity/);

  // The lineage counts the outage against Devin, so the retry keeps it last once the circuit expires.
  const cause = fx.db((d) => attemptCauseOf(d, d.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id='op-impl-a1'`).get()));
  assert.deepEqual([cause.cause, cause.attributable], ['provider-outage', true]);
  assert.match(cause.detail, /devin was out of capacity/);
  const adjust = fx.db((d) => lineageRouteAdjust(d, d.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id='op-impl-a2'`).get()));
  assert.deepEqual(adjust.demote, ['devin-agent']);
});

test('a failed attempt with no report and no outage of its pool is still the work, not the pool', (t) => {
  const repo = tmp(t, 'starci-devin-cap-none-');
  const l = openLedger({ file: ledgerFileFor(repo) });
  try {
    const at = Date.now();
    seedWorkflow(l,{id:WF,state:{phase:'running',job:'no outage'},jobs:[{jobId:'op-impl-b1',opId:'interface.implement',
      status:'failed',createdAt:at-60000,updatedAt:at-1000,payload:{model:'devin-agent'},result:{verdict:'fail',report:null}}]});
    // An outage of ANOTHER pool, a devin launch-path strike, and a devin outage after this attempt settled
    // prove nothing about it.
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'codex', kind: 'provider-unavailable',
      payload: { provider: 'codex', model: 'codex-agent', failureKind: 'quota' },createdAt:at-30000 });
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'devin', kind: 'provider-unavailable',
      payload: { provider: 'devin', model: 'devin-agent', failureKind: 'readiness' },createdAt:at-30000 });
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'devin', kind: 'provider-unavailable',
      payload: { provider: 'devin', model: 'devin-agent', failureKind: 'capacity' } });
    const cause = attemptCauseOf(l.db, l.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id='op-impl-b1'`).get());
    assert.deepEqual([cause.cause, cause.attributable], ['fail', false]);
  } finally { l.close(); }
});
