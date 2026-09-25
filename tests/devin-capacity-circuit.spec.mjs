// A Devin capacity outage opens the devin provider-health circuit (failureKind capacity), and a retry routes
// around Devin.
//
// Live defect (starci-next wf-sn-foundation, inc-d1385efd312f / inc-8ef8c5b48e15, 2026-09-25): three sibling
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
import { parseYaml } from '../engine/yaml.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { outageInText, outageOnScreen, outageSpecsOf, quotaSpecOf } from '../scripts/agent/provider-outage.mjs';
import { attemptCauseOf, lineageRouteAdjust } from '../scripts/kernel/lineage-route.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
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
  assert.deepEqual(outageSpecsOf('qwen').map((s) => s.failureKind), ['quota'], 'Qwen keeps its quota outage');
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
    LOCALAPPDATA: path.join(root, 'localappdata') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const at = Date.now() - 20 * 60000;
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.enqueueJob({ jobId: `kernel-${WF}`, workflowId: WF, kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${WF}`, parentNodeId: `workflow:${WF}`, role: 'kernel' } } });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${WF}`);
    // The running first attempt on Devin, and its retry queued behind it.
    ledger.enqueueJob({ jobId: 'op-impl-a1', workflowId: WF, opId: 'interface.implement', kind: 'op',
      payload: { opId: 'interface.implement', owned_paths: ['apps/web/src/features/profile/'], difficulty: 'medium', model: 'devin-agent',
        hierarchy: { runtime: { terminalHandle: 'term-devin-worker', provider: 'devin', runtimePool: 'devin-agent' } } } });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-devin-worker',created_at=? WHERE job_id='op-impl-a1'").run(at);
  } finally { ledger.close(); }
  const writeState = (fn) => { const s = json(fs.readFileSync(stateFile, 'utf8')) ?? {}; fn(s); fs.writeFileSync(stateFile, JSON.stringify(s)); };
  const db = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const row = () => db((d) => {
    const r = d.prepare("SELECT value_json,expires_at FROM signals WHERE scope='provider-health' AND key='devin'").get();
    return r ? { ...json(r.value_json), expiresAt: r.expires_at } : null;
  });
  return { repo, env, writeState, db, row, run: (...args) => runApi(env, ...args) };
};

test('a Devin worker screen showing the capacity error opens the devin capacity circuit; the retry routes around Devin and counts the outage against it', async (t) => {
  const fx = fixture(t);
  fx.writeState((s) => { s.terminals = { 'term-devin-worker': { handle: 'term-devin-worker', connected: true, writable: true, command: 'devin', lastOutputAt: Date.now() - 60000,
    screen: ['  ⎿ Wrote .starciwork/features/profiles/operations/audit/E/draw-lineage.json', CAPACITY_ROW, '─'.repeat(20), '❭ Ask Devin to build features...'].join('\n') } }; });
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
  const l = openLedger({ file: ledgerFileFor(fx.repo) });
  try {
    l.db.prepare("UPDATE jobs SET status='failed',worker_id=NULL,result_json=?,updated_at=? WHERE job_id='op-impl-a1'")
      .run(JSON.stringify({ verdict: 'fail', report: null, checkEvidence: { observed: 0, passed: 0, failed: 0, green: false } }), Date.now());
    l.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-impl-a1', kind: 'op-settled',
      payload: { verdict: 'fail', status: 'failed', report: null, reportFiled: false, reportOutcome: null } });
    l.enqueueJob({ jobId: 'op-impl-a2', workflowId: WF, opId: 'interface.implement', kind: 'op',
      payload: { opId: 'interface.implement', owned_paths: ['apps/web/src/features/profile/'], difficulty: 'medium', retry: { retryOf: 'op-impl-a1', businessAttempt: 2 } } });
  } finally { l.close(); }
  const route = await fx.run('route', '--repo', fx.repo, '--job', 'op-impl-a2', '--json');
  assert.equal(route.status, 0, route.stderr || route.stdout);
  assert.notEqual(route.value.decision.model, 'devin-agent', 'the open capacity circuit skips Devin');
  assert.match(route.value.rejected.find((r) => r.target === 'devin-agent')?.reason ?? '', /out of capacity/);

  // The lineage counts the outage against Devin, so the retry keeps it last once the circuit expires.
  const cause = fx.db((d) => attemptCauseOf(d, d.prepare("SELECT * FROM jobs WHERE job_id='op-impl-a1'").get()));
  assert.deepEqual([cause.cause, cause.attributable], ['provider-outage', true]);
  assert.match(cause.detail, /devin was out of capacity/);
  const adjust = fx.db((d) => lineageRouteAdjust(d, d.prepare("SELECT * FROM jobs WHERE job_id='op-impl-a2'").get()));
  assert.deepEqual(adjust.demote, ['devin-agent']);
});

test('a failed attempt with no report and no outage of its pool is still the work, not the pool', (t) => {
  const repo = tmp(t, 'starci-devin-cap-none-');
  const l = openLedger({ file: ledgerFileFor(repo) });
  try {
    l.ensureWorkflow({ workflowId: WF, title: 'no outage' });
    const at = Date.now();
    l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,result_json,status,created_at,updated_at)
      VALUES('op-impl-b1',?,'interface.implement',1,0,'op','op',?,?,'failed',?,?)`)
      .run(WF, JSON.stringify({ model: 'devin-agent' }), JSON.stringify({ verdict: 'fail', report: null }), at - 60000, at - 1000);
    // An outage of ANOTHER pool, a devin launch-path strike, and a devin outage after this attempt settled
    // prove nothing about it.
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'qwen', kind: 'provider-unavailable',
      payload: { provider: 'qwen', model: 'qwen-agent', failureKind: 'quota' } });
    l.db.prepare("UPDATE events SET created_at=? WHERE kind='provider-unavailable'").run(at - 30000);
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'devin', kind: 'provider-unavailable',
      payload: { provider: 'devin', model: 'devin-agent', failureKind: 'readiness' } });
    l.db.prepare("UPDATE events SET created_at=? WHERE kind='provider-unavailable' AND entity_id='devin'").run(at - 30000);
    l.appendEvent({ workflowId: WF, entityType: 'provider', entityId: 'devin', kind: 'provider-unavailable',
      payload: { provider: 'devin', model: 'devin-agent', failureKind: 'capacity' } });
    const cause = attemptCauseOf(l.db, l.db.prepare("SELECT * FROM jobs WHERE job_id='op-impl-b1'").get());
    assert.deepEqual([cause.cause, cause.attributable], ['fail', false]);
  } finally { l.close(); }
});
