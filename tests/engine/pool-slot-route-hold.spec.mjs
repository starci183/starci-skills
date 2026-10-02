// A routed-but-queued job holds its pool slot only while its latest route decision is younger than
// runtimes.yaml allocation.routeHoldMs; running jobs always hold theirs; starci kernel route and starci kernel status count alike.
//
// Live defect: starci kernel route and starci kernel status counted every
// non-settled job with a payload.model toward its pool. Jobs routed and then parked for hours (owner gate,
// Supervisor hold, peer-wait, dependency, readiness-timeout loop) kept their slot forever: devin-agent 10/10
// with 5 running, codex-agent 10/10 with 3 running, claude-agent 6/6 with 0 running, so fe-canon's four ready
// code.refactor slices read "no eligible pool for role 'implement'".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const runtimes = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'models', 'runtimes.yaml'), 'utf8'));
const registry = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'models', 'registry.yaml'), 'utf8'));
const POOL = 'claude-agent';
const MAX = registry.pools[POOL].maxParallel;
const HOLD = runtimes.allocation.routeHoldMs;
const WF = 'wf-pool-hold', OTHER = 'wf-pool-hold-other';
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };

const runApi = (env, ...args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, ...args], { cwd: ROOT, env, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill(), 180000);
  child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr, value: json(stdout) }); });
});

// A ledger with a running Kernel, a queued unrouted job to route, and `occupants` on POOL in another workflow:
// [{status, routedAgoMs?, via: 'payload'|'event'}].
const fixture = (t, occupants) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pool-hold-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'); fs.writeFileSync(stateFile, '{}');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_MODE: 'healthy',
    LOCALAPPDATA: path.join(root, 'localappdata'), STARCI_STATUS_MEMO: 'off' };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const now = Date.now();
  // ledgerFileFor resolves under env.LOCALAPPDATA — seed the file the spawned api will open.
  const ledgerFile = ledgerFileFor(repo, { env });
  const ledger = openLedger({ file: ledgerFile });
  try {
    seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: WF },
      jobs: [
        { jobId: `kernel-${WF}`, kind: 'kernel', status: 'running', workerId: 'fake-kernel-terminal',
          payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${WF}`, parentNodeId: `workflow:${WF}`, role: 'kernel' } } },
        { jobId: 'route-me', opId: 'interface.implement', kind: 'op',
          payload: { opId: 'interface.implement', owned_paths: ['apps/web/src/features/route-me/'], difficulty: 'medium' } },
      ] });
    seedWorkflow(ledger, { id: OTHER, state: { phase: 'running', job: OTHER },
      jobs: occupants.map((o, n) => {
        const routedAt = o.routedAgoMs == null ? null : now - o.routedAgoMs;
        return { jobId: `occupant-${n + 1}`, opId: 'interface.implement', kind: 'op', status: o.status,
          payload: { opId: 'interface.implement', owned_paths: [`apps/web/src/features/o${n + 1}/`], model: POOL, ...(o.via === 'payload' && routedAt ? { routedAt } : {}) } };
      }) });
    occupants.forEach((o, n) => {
      const jobId = `occupant-${n + 1}`, routedAt = o.routedAgoMs == null ? null : now - o.routedAgoMs;
      ledger.db.prepare('UPDATE jobs SET created_at=?,updated_at=? WHERE job_id=?').run(now - 3 * 3600000, now - 3 * 3600000, jobId);
      if (o.via === 'event' && routedAt) {
        ledger.appendEvent({ workflowId: OTHER, entityType: 'job', entityId: jobId, kind: 'route-decided', payload: { kind: 'interface.implement', model: POOL }, createdAt: routedAt });
      }
    });
  } finally { ledger.close(); }
  const db = (fn) => { const l = inspectLedger({ file: ledgerFile }); try { return fn(l.db); } finally { l.close(); } };
  return {
    repo, db, ledgerFile,
    status: async () => { const r = await runApi(env, 'status', '--repo', repo, '--workflow', WF, '--json'); assert.equal(r.status, 0, r.stderr || r.stdout); return r.value; },
    route: (jobId = 'route-me') => runApi(env, 'route', '--repo', repo, '--job', jobId, '--json'),
  };
};
const fullOf = (route) => (route.value?.rejected ?? []).find((r) => r.target === POOL && /pool at capacity/.test(r.reason));

test('the route hold is a runtimes.yaml allocation key, 15 minutes by default', () => {
  assert.equal(HOLD, 900000);
  assert.ok(Number.isInteger(MAX) && MAX > 0);
});

test(`queued jobs routed 2 h ago no longer fill ${POOL}; route and status agree`, async (t) => {
  const stale = Array.from({ length: MAX }, (_, n) => ({ status: 'queued', routedAgoMs: 2 * 3600000, via: n % 2 ? 'payload' : 'event' }));
  const fx = fixture(t, stale);
  const status = await fx.status();
  assert.equal(status.poolLoad.running[POOL] ?? 0, 0, 'a route decision older than routeHoldMs holds no slot');
  const route = await fx.route();
  assert.equal(route.value?.poolLoad?.running?.[POOL] ?? 0, 0, route.stderr || route.stdout);
  assert.equal(fullOf(route), undefined, `${POOL} is not rejected as full: ${JSON.stringify(route.value?.rejected)}`);
});

test(`queued jobs routed 1 min ago still fill ${POOL}; running jobs always do; route and status agree`, async (t) => {
  const fresh = Array.from({ length: MAX - 2 }, (_, n) => ({ status: 'queued', routedAgoMs: 60000, via: n % 2 ? 'payload' : 'event' }));
  const running = [{ status: 'running' }, { status: 'running', routedAgoMs: 5 * 3600000, via: 'payload' }];
  const stale = [{ status: 'queued', routedAgoMs: HOLD + 60000, via: 'payload' }, { status: 'queued' }];
  const fx = fixture(t, [...fresh, ...running, ...stale]);
  const status = await fx.status();
  assert.equal(status.poolLoad.running[POOL], MAX, 'fresh routes and running jobs hold; the stale and never-stamped queued ones do not');
  const route = await fx.route();
  assert.equal(route.value?.poolLoad?.running?.[POOL], status.poolLoad.running[POOL], 'starci kernel route counts what starci kernel status counts');
  assert.ok(fullOf(route), `${POOL} is full: ${route.stdout}`);
});

test('routing stamps routedAt, so a re-routed queued job holds its slot again from now', async (t) => {
  const fx = fixture(t, []);
  const before = Date.now();
  const first = await fx.route();
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const payload = fx.db((d) => json(d.prepare("SELECT payload_json FROM jobs WHERE job_id='route-me'").get().payload_json));
  assert.ok(payload.routedAt >= before && payload.routedAt <= Date.now(), 'starci kernel route stamps payload.routedAt');
  const pool = payload.model;
  assert.equal((await fx.status()).poolLoad.running[pool], 1, 'the freshly routed queued job holds its slot');
  // Age it past the hold: the slot frees; a re-route stamps it again (and does not count itself while routing).
  const l = openLedger({ file: fx.ledgerFile });
  try {
    // events are append-only — the hold reads payload.routedAt first (poolLoadOf), so aging the payload ages the hold.
    l.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='route-me'").run(JSON.stringify({ ...payload, routedAt: before - HOLD - 1000 }));
  } finally { l.close(); }
  assert.equal((await fx.status()).poolLoad.running[pool] ?? 0, 0, 'past routeHoldMs the parked job frees its slot');
  const again = await fx.route();
  assert.equal(again.status, 0, again.stderr || again.stdout);
  assert.equal(again.value.poolLoad.running[again.value.decision.model] ?? 0, 0, 'the job being routed holds nothing in its own route');
  assert.equal((await fx.status()).poolLoad.running[again.value.decision.model], 1, 're-routing refreshes the hold');
});
