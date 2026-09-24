// The Qwen base pool (owner ruling 2026-09-24: "coi như cái đó là base - task nào cũng xài. dead rồi thì
// chặn, vì nó cũng rẻ mà"): qwen-agent (DeepSeek V4.1 Flash on the Token Plan) is eligible for every kind at
// every difficulty and takes the largest default share; it is not metered, and is blocked only REACTIVELY -
// a launch failure or a worker screen that shows its plan quota spent opens the qwen provider-health circuit
// (failureKind quota), routing skips the pool, and a real 1-token completion (at most hourly, and right after
// the plan reset) clears it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { configuredAllocationPolicy, validateConfig } from '../engine/config.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { selectPool, kindRoute, providerCircuitOf } from '../scripts/agent/models.mjs';
import { quotaSpecOf, quotaExhaustedInText, quotaExhaustedOnScreen, quotaProbeProviders } from '../scripts/agent/quota-exhausted.mjs';
import { probeProviderQuota } from '../scripts/agent/credential-probe.mjs';
import { probeQuotaCircuits } from '../scripts/kernel/watchdog.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const read = (file) => parseYaml(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const runtimes = read('modules/models/runtimes.yaml');
const QWEN_CARD = read('modules/models/agents/qwen.yaml');
const DIFFICULTY = ['easy', 'medium', 'hard', 'insane'];
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};

/* ------------------------------------------------------------ (2) the base pool */

test('qwen-agent serves every role at every difficulty and every tier/role order lists it', () => {
  const pool = runtimes.runtimes['qwen-agent'];
  assert.deepEqual(pool.roles, ['implement', 'verify', 'write', 'decide', 'plan']);
  for (const d of DIFFICULTY) assert.equal(pool.models[d], 'deepseek-v4.1-flash', d);
  for (const [tier, orders] of Object.entries(runtimes.allocation.tiers))
    for (const [role, order] of Object.entries(orders)) assert.ok(order.includes('qwen-agent'), `tiers.${tier}.${role}`);
  for (const [role, order] of Object.entries(runtimes.allocation.preference)) assert.ok(order.includes('qwen-agent'), `preference.${role}`);
  assert.deepEqual(runtimes.allocation.frontier, ['claude-agent', 'codex-agent'], 'kernel functions and audit families stay frontier');
  const profile = read('modules/models/profiles/qwen-agent.yaml');
  assert.deepEqual(profile.capacity.roles, pool.roles, 'the profile roles route-model reads agree');
  const index = read('modules/models/index.yaml').pools.find((p) => p.target === 'qwen-agent');
  assert.deepEqual(index.roles, pool.roles);
});

test('every op kind at every difficulty can route to qwen-agent, except the host-tool image/browser kinds', () => {
  const registry = read('modules/models/registry.yaml');
  const hostToolKinds = new Set(['interface.draw', 'interface.asset', 'interface.audit']);
  for (const kind of Object.keys(runtimes.roleOfKind)) {
    if (hostToolKinds.has(kind)) continue;
    for (const d of DIFFICULTY) {
      const r = selectPool({ kind, difficulty: d, runtimes, bias: { prefer: ['qwen-agent'] } });
      assert.equal(r.target, 'qwen-agent', `${kind}@${d} -> ${r.target ?? r.error}`);
      assert.equal(r.modelId, 'deepseek-v4.1-flash');
    }
    const chain = registry.operators[kind]?.chain;
    if (chain) assert.ok(chain.includes('qwen-agent'), `registry operators.${kind}.chain ${chain}`);
  }
  // The host-tool kinds stay structural refusals for an agent card without the tool.
  const draw = selectPool({ kind: 'interface.draw', difficulty: 'hard', runtimes, bias: { prefer: ['qwen-agent'] } });
  assert.notEqual(draw.target, 'qwen-agent');
});

test('the shipped allocation gives the base pool the largest share and keeps the balanced policy', () => {
  const example = configuredAllocationPolicy(validateConfig(read('config.example.yaml')));
  assert.equal(example.policy, 'balanced');
  assert.deepEqual(example.shares, { 'qwen-agent': 40, 'claude-agent': 20, 'codex-agent': 20, 'devin-agent': 20 });
  // No history: the largest target wins, hands-on and think alike.
  const shares = example.shares;
  assert.equal(selectPool({ kind: 'backend.implement', difficulty: 'medium', runtimes, policy: 'balanced', shares, recent: {} }).target, 'qwen-agent');
  assert.equal(selectPool({ kind: 'architecture.decide', difficulty: 'hard', runtimes, policy: 'balanced', shares, recent: {} }).target, 'qwen-agent');
  // At 40% of the recent jobs it is at its share and the others catch up.
  const recent = { 'qwen-agent': 40, 'claude-agent': 5, 'codex-agent': 30, 'devin-agent': 25 };
  assert.equal(selectPool({ kind: 'architecture.decide', difficulty: 'hard', runtimes, policy: 'balanced', shares, recent }).target, 'claude-agent');
  // An open quota circuit (capacity auth dead) is the one thing that blocks it.
  const blocked = selectPool({ kind: 'backend.implement', difficulty: 'medium', runtimes, policy: 'balanced', shares, recent: {},
    capacity: { 'qwen-agent': { auth: 'dead', authDetail: 'provider circuit open (quota)' } } });
  assert.notEqual(blocked.target, 'qwen-agent');
  assert.match(blocked.rejected.find((r) => r.target === 'qwen-agent').reason, /circuit open \(quota\)/);
  assert.equal(kindRoute('backend.implement', runtimes).work, 'hands-on');
});

/* ------------------------------------------------------------ (3) classification */

test('the card classifies Qwen Code quota answers, from text and from an anchored screen row only', () => {
  const spec = quotaSpecOf('qwen-agent');
  assert.equal(spec.probe.kind, 'openai-chat');
  assert.equal(spec.probe.everyMs, 3600000);
  assert.deepEqual(quotaProbeProviders(), ['qwen']);
  for (const text of [
    'HTTP 429 {"code":"Throttling.AllocationQuota","message":"Allocated quota exceeded"}',
    '429 insufficient_quota: Free allocated quota exceeded.',
    'error: quota-exhausted',
    'status 429 quota exceeded for the plan',
    'Your monthly quota has been exhausted and will reset at 2026-10-11 23:00',
  ]) assert.ok(quotaExhaustedInText('qwen', [text]), text);
  for (const text of ['429 Throttling.RateQuota: Requests rate limit exceeded', 'HTTP 401 Invalid API-key', 'quota ok'])
    assert.equal(quotaExhaustedInText('qwen', [text]), null, text);
  assert.equal(quotaExhaustedInText('codex', ['429 insufficient_quota']), null, 'a card without quotaExhausted is never classified');

  const screen = ['> implement the thing', '✕ [API Error: 429 Throttling.AllocationQuota: Allocated quota exceeded]', '*   Type your message'].join('\n');
  assert.equal(quotaExhaustedOnScreen('qwen', screen)?.match, '✕ [API Error: 429 Throttling.AllocationQuota: Allocated quota exceeded]');
  assert.ok(quotaExhaustedOnScreen('qwen', 'Quota exhausted: monthly quota exceeded, will reset at 2026-10-11\n\nPlease retry after the reset time'));
  // A worker reading or editing text about quotas is no evidence: the row must start with the CLI's own error.
  for (const frame of ['  12 | const QUOTA_EXHAUSTED_PREFIX = "Quota exhausted: ";', '  ✓ ReadFile qwen.yaml (insufficient_quota, Throttling.AllocationQuota)',
    '+ quotaExhausted: [Throttling.AllocationQuota]'])
    assert.equal(quotaExhaustedOnScreen('qwen', frame), null, frame);
});

/* ------------------------------------------------------------ the 1-token probe */

const chatServer = async (t, answer) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: json(body) });
      const [status, payload] = answer(seen.length);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, seen };
};
const credentialRoot = (t, key) => {
  const dir = tmp(t, 'starci-qb-cred-');
  fs.mkdirSync(path.join(dir, '.secrets'));
  fs.writeFileSync(path.join(dir, '.secrets', 'models.env'), `QWENCLOUD_API_KEY=${key}\n`);
  return dir;
};
const qwenHome = (t, baseUrl) => {
  const home = tmp(t, 'starci-qb-home-');
  fs.mkdirSync(path.join(home, '.qwen'));
  fs.writeFileSync(path.join(home, '.qwen', 'settings.json'), JSON.stringify({ modelProviders: { openai: [{ id: QWEN_CARD.model, baseUrl }] } }));
  return home;
};
const withEnv = (t, vars) => {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
};

test('the quota probe is one real max_tokens-1 completion for the card model; the body is never echoed', async (t) => {
  const answers = [[200, { choices: [{ message: { content: 'p' } }] }],
    [429, { error: { code: 'Throttling.AllocationQuota', message: 'Allocated quota exceeded for sk-secret-echo' } }],
    [401, { code: 'InvalidApiKey', message: 'Invalid API-key provided.' }],
    [500, { message: 'boom' }]];
  const server = await chatServer(t, (n) => answers[n - 1]);
  const home = qwenHome(t, server.baseUrl);
  withEnv(t, { STARCI_CREDENTIAL_ROOT: credentialRoot(t, 'sk-probe-key'), USERPROFILE: home, HOME: home });
  const ok = await probeProviderQuota('qwen-agent');
  assert.deepEqual([ok.ok, ok.state, ok.status], [true, 'ok', 200]);
  const req = server.seen[0];
  assert.deepEqual([req.method, req.url, req.auth], ['POST', '/v1/chat/completions', 'Bearer sk-probe-key']);
  assert.deepEqual([req.body.model, req.body.max_tokens, req.body.messages.length], [QWEN_CARD.model, 1, 1]);
  const spent = await probeProviderQuota('qwen');
  assert.deepEqual([spent.ok, spent.state, spent.status, spent.code], [false, 'quota-exhausted', 429, 'Throttling.AllocationQuota']);
  const auth = await probeProviderQuota('qwen');
  assert.deepEqual([auth.state, auth.code], ['auth', 'InvalidApiKey']);
  const other = await probeProviderQuota('qwen');
  assert.equal(other.state, 'inconclusive');
  for (const r of [ok, spent, auth, other]) assert.doesNotMatch(JSON.stringify(r), /sk-probe-key|sk-secret-echo|Allocated quota exceeded/);
  const none = await probeProviderQuota('codex');
  assert.deepEqual([none.ok, none.state], [false, 'inconclusive'], 'no probe declared, no request');
  assert.equal(server.seen.length, 4);
});

/* ------------------------------------------------------------ kernel integration */

const RESET = '2099-01-15T00:00:00Z';
const ownerRoot = (t) => {
  const dir = tmp(t, 'starci-qb-owner-');
  const config = read('config.example.yaml');
  fs.writeFileSync(path.join(dir, 'config.yaml'), stringifyYaml({ ...config, quota: { qwen: { planQuota: 180000, unit: 'requests', resetAt: RESET,
    calibratedRemainingPercent: 50, calibratedAt: '2026-09-24T20:35:50+07:00' } } }));
  return dir;
};
const runApi = (env, ...args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, ...args], { cwd: ROOT, env, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill(), 180000);
  child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr, value: json(stdout) }); });
});
const fixture = (t, { mode = 'healthy' } = {}) => {
  const root = tmp(t, 'starci-qb-');
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'); fs.writeFileSync(stateFile, '{}');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_MODE: mode,
    STARCI_OWNER_ROOT: ownerRoot(t), LOCALAPPDATA: path.join(root, 'localappdata'), BAILIAN_TOKEN_PLAN_API_KEY: 'presence-only' };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const workflowId = 'wf-qwen-base';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.enqueueJob({ jobId: `kernel-${workflowId}`, workflowId, kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`, role: 'kernel' } } });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({ jobId: 'job-qwen-a', workflowId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/a/'], difficulty: 'medium' } });
    ledger.enqueueJob({ jobId: 'job-qwen-b', workflowId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/b/'], difficulty: 'medium' } });
  } finally { ledger.close(); }
  const orcaState = () => json(fs.readFileSync(stateFile, 'utf8')) ?? {};
  const writeState = (fn) => { const s = orcaState(); fn(s); fs.writeFileSync(stateFile, JSON.stringify(s)); };
  const db = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const row = () => db((d) => {
    const r = d.prepare("SELECT value_json,expires_at FROM signals WHERE scope='provider-health' AND key='qwen'").get();
    return r ? { ...json(r.value_json), expiresAt: r.expires_at } : null;
  });
  return { repo, env, workflowId, orcaState, writeState, db, row, run: (...args) => runApi(env, ...args) };
};

test('a dispatch refused on a quota screen opens the qwen quota circuit until the plan reset, and route skips Qwen', async (t) => {
  const fx = fixture(t, { mode: 'quota' });
  const d = await fx.run('dispatch', '--repo', fx.repo, '--job', 'job-qwen-a', '--model', 'qwen-agent', '--spawn', '--json');
  assert.notEqual(d.status, 0, 'the quota screen refuses the launch');
  const circuit = fx.row();
  assert.equal(circuit?.status, 'unavailable', d.stdout + d.stderr);
  assert.equal(circuit.failureKind, 'quota');
  assert.equal(circuit.resetAt, Date.parse(RESET));
  assert.equal(circuit.expiresAt, Date.parse(RESET) + 3600000, 'held until the plan reset plus one probe interval');
  assert.match(circuit.recover, /provider-health --provider qwen --quota-probe/);
  assert.equal(fx.db((x) => x.prepare("SELECT status FROM jobs WHERE job_id='job-qwen-a'").get().status), 'queued', 'no-effect: the attempt is kept');
  assert.equal(fx.db((x) => x.prepare("SELECT count(*) n FROM incidents WHERE last_progress LIKE '[infra-provider]%'").get().n), 0, 'no incident for a quota circuit');
  assert.equal(fx.db((x) => x.prepare("SELECT count(*) n FROM events WHERE kind='provider-auth-unavailable'").get().n), 0, 'not an auth circuit');

  const route = await fx.run('route', '--repo', fx.repo, '--job', 'job-qwen-b', '--prefer', 'qwen-agent', '--json');
  assert.equal(route.status, 0, route.stderr || route.stdout);
  assert.notEqual(route.value.decision.model, 'qwen-agent');
  const rejected = route.value.rejected.find((r) => r.target === 'qwen-agent');
  assert.match(rejected?.reason ?? '', /quota/);
  assert.match(rejected.reason, /quota probe clears it/);
  const health = await fx.run('provider-health', '--repo', fx.repo, '--provider', 'qwen', '--json');
  assert.equal(health.value.open, true);
});

test('a worker screen showing the quota row opens the circuit from api status once, and not again for the same frame', async (t) => {
  const fx = fixture(t);
  const at = Date.now() - 60000;
  fx.db(() => null);
  const ledger = openLedger({ file: ledgerFileFor(fx.repo) });
  try {
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='term-qwen-worker',payload_json=? WHERE job_id='job-qwen-a'")
      .run(JSON.stringify({ opId: 'code.refactor', owned_paths: ['docs/a/'], difficulty: 'medium', model: 'qwen-agent',
        hierarchy: { runtime: { terminalHandle: 'term-qwen-worker', provider: 'qwen', runtimePool: 'qwen-agent' } } }));
  } finally { ledger.close(); }
  fx.writeState((s) => { s.terminals = { 'term-qwen-worker': { handle: 'term-qwen-worker', connected: true, writable: true, command: 'qwen --yolo', lastOutputAt: at,
    screen: ['  ✓ Shell npm test', '✕ [API Error: 429 insufficient_quota: Free allocated quota exceeded.]', '─'.repeat(20), '*   Type your message or @path/to/file',
      '  ➜ repo · deepseek-v4.1-flash (Token Plan Singapore)'].join('\n') } }; });
  const status = await fx.run('status', '--repo', fx.repo, '--workflow', fx.workflowId, '--json');
  assert.equal(status.status, 0, status.stderr || status.stdout);
  const worker = status.value.workers.find((w) => w.jobId === 'job-qwen-a');
  assert.equal(worker.quotaExhausted?.provider, 'qwen');
  assert.deepEqual(status.value.quotaCircuits.map((c) => [c.provider, c.jobId]), [['qwen', 'job-qwen-a']]);
  const first = fx.row();
  assert.deepEqual([first.status, first.failureKind, first.step, first.jobId], ['unavailable', 'quota', 'worker-screen', 'job-qwen-a']);
  assert.equal(fx.db((x) => x.prepare("SELECT count(*) n FROM events WHERE kind='provider-unavailable'").get().n), 1);
  // A re-read of the same frame is no new strike.
  const again = await fx.run('status', '--repo', fx.repo, '--workflow', fx.workflowId, '--json');
  assert.equal(again.value.quotaCircuits, undefined);
  assert.equal(fx.row().observedAt, first.observedAt);
  assert.equal(fx.db((x) => x.prepare("SELECT count(*) n FROM events WHERE kind='provider-unavailable'").get().n), 1);
  // After a recovery the same old frame reopens nothing; only newer output counts.
  const ledger2 = openLedger({ file: ledgerFileFor(fx.repo) });
  try {
    ledger2.db.prepare("UPDATE signals SET value_json=?, expires_at=? WHERE scope='provider-health' AND key='qwen'")
      .run(JSON.stringify({ status: 'recovered', recoveredAt: Date.now(), previous: { failureKind: 'quota', observedAt: first.observedAt } }), Date.now());
  } finally { ledger2.close(); }
  const recovered = await fx.run('status', '--repo', fx.repo, '--workflow', fx.workflowId, '--json');
  assert.equal(recovered.value.quotaCircuits, undefined, 'the frame printed before the recovery is old evidence');
  // An active turn is getting completions: an old error row above it proves nothing.
  fx.writeState((s) => { Object.assign(s.terminals['term-qwen-worker'], { lastOutputAt: Date.now(),
    screen: ['✕ [API Error: 429 insufficient_quota: Free allocated quota exceeded.]', '  ⠙ Thinking… (3s · esc to cancel)'].join('\n') }); });
  const active = await fx.run('status', '--repo', fx.repo, '--workflow', fx.workflowId, '--json');
  assert.equal(active.value.workers.find((w) => w.jobId === 'job-qwen-a').quotaExhausted, undefined);
});

test('provider-health --quota-probe: throttled hourly, due after the reset, a pass clears the circuit and route admits Qwen', async (t) => {
  const fx = fixture(t);
  let answer = [429, { error: { code: 'Throttling.AllocationQuota', message: 'spent' } }];
  const server = await chatServer(t, () => answer);
  const home = qwenHome(t, server.baseUrl);
  Object.assign(fx.env, { STARCI_CREDENTIAL_ROOT: credentialRoot(t, 'sk-quota-probe'), USERPROFILE: home, HOME: home });
  const now = Date.now();
  const seedCircuit = (value, expiresAt) => {
    const l = openLedger({ file: ledgerFileFor(fx.repo) });
    try {
      l.db.prepare(`INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health','qwen',NULL,NULL,?,?,?)`)
        .run(JSON.stringify({ schema: 'starci/provider-health@1', provider: 'qwen', status: 'unavailable', failureKind: 'quota', strikeLimit: 1,
          jobId: 'job-qwen-a', step: 'worker-screen', observedAt: now - 1000, failures: 1, trips: 1, ...value }), now - 1000, expiresAt);
    } finally { l.close(); }
  };
  seedCircuit({ resetAt: now + 86400000 }, now + 90000000);

  const spent = await fx.run('provider-health', '--repo', fx.repo, '--quota-probe', '--workflow', fx.workflowId, '--json');
  assert.equal(spent.status, 0, spent.stderr || spent.stdout);
  assert.deepEqual(spent.value.results.map((r) => [r.provider, r.probed, r.recovered, r.probe?.state]), [['qwen', true, false, 'quota-exhausted']]);
  assert.equal(fx.row().status, 'unavailable');
  assert.equal(fx.row().quotaProbe.state, 'quota-exhausted');
  assert.equal(fx.db((x) => x.prepare("SELECT count(*) n FROM events WHERE kind='provider-quota-probe-failed'").get().n), 1);

  const throttled = await fx.run('provider-health', '--repo', fx.repo, '--quota-probe', '--json');
  assert.equal(throttled.value.results[0].reason, 'throttled');
  assert.equal(server.seen.length, 1, 'at most one real completion per probe interval');

  // Past the recorded reset the probe is due at once, whatever the throttle.
  seedCircuit({ resetAt: now - 60000, quotaProbe: { at: now - 120000, state: 'quota-exhausted' } }, now + 3000000);
  answer = [200, { choices: [{ message: { content: 'p' } }] }];
  const passed = await fx.run('provider-health', '--repo', fx.repo, '--quota-probe', '--json');
  assert.deepEqual(passed.value.results.map((r) => [r.probed, r.recovered, r.probe?.why]), [[true, true, 'after-reset']]);
  const cleared = fx.row();
  assert.equal(cleared.status, 'recovered');
  assert.equal(cleared.reason, 'quota probe passed');
  assert.equal(cleared.previous.failureKind, 'quota');
  assert.ok(cleared.expiresAt <= Date.now());
  assert.equal(fx.db((x) => x.prepare("SELECT workflow_id FROM events WHERE kind='provider-health-recovered'").get()?.workflow_id), fx.workflowId,
    'the recovery event lands on the circuit job workflow');
  const route = await fx.run('route', '--repo', fx.repo, '--job', 'job-qwen-b', '--prefer', 'qwen-agent', '--json');
  assert.equal(route.value?.decision?.model, 'qwen-agent', route.stderr || route.stdout);

  const nothing = await fx.run('provider-health', '--repo', fx.repo, '--quota-probe', '--json');
  assert.equal(nothing.value.results[0].reason, 'no-open-quota-circuit');
  assert.equal(server.seen.length, 2);
  for (const r of [spent, throttled, passed, nothing]) assert.doesNotMatch(r.stdout + r.stderr, /sk-quota-probe/);
});

test('a still-spent plan past its reset rolls the circuit to the next reset', async (t) => {
  const fx = fixture(t);
  const server = await chatServer(t, () => [429, { error: { code: 'insufficient_quota', message: 'free allocated quota exceeded' } }]);
  const home = qwenHome(t, server.baseUrl);
  Object.assign(fx.env, { STARCI_CREDENTIAL_ROOT: credentialRoot(t, 'sk-roll'), USERPROFILE: home, HOME: home });
  // The owner config's resetAt lies in the past: the next reset is the same day-of-month rolled forward.
  const past = new Date(Date.now() - 3 * 86400000);
  fs.writeFileSync(path.join(fx.env.STARCI_OWNER_ROOT, 'config.yaml'),
    stringifyYaml({ ...read('config.example.yaml'), quota: { qwen: { planQuota: 1, resetAt: past.toISOString() } } }));
  const l = openLedger({ file: ledgerFileFor(fx.repo) });
  try {
    l.db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health','qwen',NULL,NULL,?,?,?)`)
      .run(JSON.stringify({ provider: 'qwen', status: 'unavailable', failureKind: 'quota', jobId: 'job-qwen-a', resetAt: past.getTime(), observedAt: past.getTime() - 1000 }),
        past.getTime() - 1000, Date.now() + 600000);
  } finally { l.close(); }
  const r = await fx.run('provider-health', '--repo', fx.repo, '--provider', 'qwen', '--quota-probe', '--json');
  assert.equal(r.value.results[0].probe.state, 'quota-exhausted');
  const row = fx.row();
  const next = new Date(past); next.setMonth(next.getMonth() + 1);
  assert.equal(row.resetAt, next.getTime());
  assert.equal(row.expiresAt, next.getTime() + 3600000);
});

test('the kernel watchdog asks for the quota probe every --repair tick', () => {
  const calls = [];
  const probed = probeQuotaCircuits({ repoPath: 'D:/x', workflow: 'wf-1',
    run: (args) => { calls.push(args); return { ok: true, value: { ok: true, results: [{ provider: 'qwen', probed: true, recovered: true, probe: { state: 'ok' } }, { provider: 'x', probed: false }] } }; } });
  assert.deepEqual(calls[0], ['provider-health', '--repo', path.resolve('D:/x'), '--quota-probe', '--workflow', 'wf-1', '--json']);
  assert.deepEqual(probed, [{ provider: 'qwen', recovered: true, state: 'ok' }]);
  assert.equal(probeQuotaCircuits({ run: () => ({ ok: true, value: { ok: true, results: [] } }), repoPath: 'D:/x', workflow: 'w' }), null, 'nothing probed, nothing reported');
  // The circuit reader closes on expiry like any other.
  assert.equal(typeof providerCircuitOf, 'function');
});
