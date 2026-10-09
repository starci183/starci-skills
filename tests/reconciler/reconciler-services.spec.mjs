import test from 'node:test';
import assert from 'node:assert/strict'; import path from 'node:path';
import {
  hostSettings, servicePorts, serviceRegistry, harnessIngress, stepService, newRecord, backoffDelay, memoryStore, machineStore,
  orcaRestartScript, cleanEnv, DOWN_STATES, seatAgentOf, httpUp, OUTAGE_STATES, startService, servicePlatformProblem,
} from '../../scripts/reconciler/services.mjs';
import { tempState } from '../../scripts/reconciler/testing.mjs';
import { TASK_DEFINITIONS } from '../../scripts/machine/task-register.mjs';

// Lane D rc-host: the ONE host-service registry (scripts/reconciler/services.mjs). The DESIGN 9.7 state machine,
// its backoff, the quarantine after more than five restarts in thirty minutes, and one source per port.

const S = hostSettings();
const HARNESS_YML = 'tunnel: x\ningress:\n  - hostname: harness.example.org\n    service: http://127.0.0.1:4547\n  - service: http_status:404\n';
const ALLOC = { supervisorTick: { statusApp: { port: 4547 } } };
const CONFIG = { connectors: { gateway: { port: 7070 } } };
const entryOf = (name, over = {}) => ({ name, restart: true, ...S.services[name], ...over });
// The Windows task a service restarts through: the harness app's is declared once, by TASK_DEFINITIONS; the tunnel's by host.yaml.
const taskNameOf = (name) => (name === 'harness-ui' ? TASK_DEFINITIONS['harness-app'].taskName : S.services[name].task);
const opts = (entry, now) => ({ now, entry, backoff: S.backoff, quarantine: S.quarantine });

test('host.yaml carries every number the registry needs', () => {
  for (const name of ['orca', 'harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge', 'sched-task:StarCi-Reconciler']) {
    assert.ok(S.services[name], name);
    for (const k of ['everyMs', 'probeTimeoutMs', 'failAfter', 'startTimeoutMs', 'slaMs']) assert.ok(S.services[name][k] > 0, `${name}.${k}`);
  }
  assert.deepEqual(S.backoff, { minMs: 1000, maxMs: 300000 });
  assert.deepEqual(S.quarantine, { maxRestarts: 5, windowMs: 1800000, retryMs: 3600000 });
  assert.equal(S.allowTaskRepair, false, 'the scheduled task is never re-created unless the owner flips allowTaskRepair');
  assert.throws(() => hostSettings({ resyncMs: 0 }), /resyncMs must be a positive number/);
});

test('one port source: the harness port, the tunnel ingress and the gateway port each come from one place', () => {
  const p = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  assert.deepEqual(p.problems, []);
  assert.equal(p.harnessUrl, 'http://127.0.0.1:4547');
  assert.equal(p.harnessPublicUrl, 'https://harness.example.org');
  assert.equal(p.gatewayPort, 7070);
  const drift = servicePorts({ allocation: { supervisorTick: { statusApp: { port: 4548 } } }, config: CONFIG, harnessYml: HARNESS_YML });
  assert.match(drift.problems.join(), /port-drift: .*ingress points at port 4547, the harness serves on 4548/);
  assert.deepEqual(harnessIngress('not: [yaml'), { hostname: null, originPort: null });
});

test('the probes read the one port source; a drifted tunnel ingress fails the tunnel probe', async () => {
  const seen = [];
  const http = async (url) => { seen.push(url); return { ok: true, status: 200 }; };
  const reg = serviceRegistry({ platform: 'win32', settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), http, run: async () => ({ status: 0, stdout: '{"running":true,"port":7070}' }) });
  assert.equal((await reg.find((e) => e.name === 'harness-ui').probe()).ok, true);
  assert.equal((await reg.find((e) => e.name === 'harness-tunnel').probe()).ok, true);
  assert.deepEqual(seen, ['http://127.0.0.1:4547/healthz', 'https://harness.example.org/healthz'], 'the lightweight /healthz, not the snapshot page');
  assert.equal((await reg.find((e) => e.name === 'ask-gateway').probe()).ok, true);
  const wrongPort = serviceRegistry({ platform: 'win32', settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), http, run: async () => ({ status: 0, stdout: '{"running":true,"port":7071}' }) });
  assert.equal((await wrongPort.find((e) => e.name === 'ask-gateway').probe()).ok, false, 'a gateway on another port than config.yaml says is down');
  const drifted = serviceRegistry({ platform: 'win32', settings: S, ports: servicePorts({ allocation: { supervisorTick: { statusApp: { port: 4548 } } }, config: CONFIG, harnessYml: HARNESS_YML }), http });
  const t = await drifted.find((e) => e.name === 'harness-tunnel').probe();
  assert.equal(t.ok, false);
  assert.match(t.error, /port-drift/);
  for (const e of reg) {
    const a = e.start();
    if (e.name.startsWith('sched-task:')) {
      assert.match(a.cmd, /[\\/]\.starci[\\/]bin[\\/]starci(?:\.cmd)?$/i);
      assert.deepEqual(a.args.slice(0, 4), ['task', 'register', 'reconciler', '--apply']);
    }
    else assert.deepEqual(a.args.slice(0, 3), ['scripts/reconciler/services.mjs', '--start', e.name], 'every actuator is one CLI');
  }
});

test('state machine: healthy -> degraded -> healthy, degraded -> failed after failAfter, failed -> backoff -> starting -> healthy', () => {
  const e = entryOf('harness-ui', { failAfter: 2 });
  let t = 0;
  let r = stepService(newRecord('harness-ui', 0), { ok: true }, opts(e, t));
  assert.equal(r.to, 'healthy');
  r = stepService(r.rec, { ok: false }, opts(e, t += 60_000));
  assert.equal(r.to, 'degraded');
  r = stepService(r.rec, { ok: true }, opts(e, t += 60_000));
  assert.equal(r.to, 'healthy');
  r = stepService(r.rec, { ok: false }, opts(e, t += 60_000));
  r = stepService(r.rec, { ok: false }, opts(e, t += 60_000));
  assert.equal(r.to, 'backoff', `failAfter ${e.failAfter}: failed, then straight into backoff`);
  assert.equal(r.act, null);
  assert.equal(r.rec.nextAttemptAt, t + 1000);
  r = stepService(r.rec, { ok: false }, opts(e, t += 60_000));
  assert.equal(r.to, 'starting');
  assert.equal(r.act, 'start');
  assert.equal(r.rec.restarts.length, 1);
  r = stepService(r.rec, { ok: false }, opts(e, t += 60_000));
  assert.equal(r.to, 'starting', 'within startTimeoutMs a starting service is waited on');
  assert.equal(r.act, null);
  r = stepService(r.rec, { ok: true }, opts(e, t += 60_000));
  assert.equal(r.to, 'healthy');
  assert.equal(r.rec.downSince, null);
  assert.ok(!DOWN_STATES.has('healthy') && DOWN_STATES.has('backoff'));
});

test('starting -> failed when no probe passes within startTimeoutMs; a first failed probe of a declared service is failed', () => {
  const e = entryOf('harness-ui');
  let r = stepService(newRecord('harness-ui', 0), { ok: false }, opts(e, 0));
  assert.equal(r.from, 'declared');
  assert.equal(r.to, 'backoff');
  r = stepService(r.rec, { ok: false }, opts(e, 5_000));
  assert.equal(r.act, 'start');
  r = stepService(r.rec, { ok: false }, opts(e, 5_000 + e.startTimeoutMs));
  assert.equal(r.to, 'backoff', 'timed out: failed, backoff again');
  assert.equal(r.rec.nextAttemptAt, 5_000 + e.startTimeoutMs + backoffDelay(1, S.backoff));
});

test('backoff is 1 s doubling to at most 5 min', () => {
  assert.deepEqual([0, 1, 2, 3, 8, 9, 20].map((n) => backoffDelay(n, S.backoff)), [1000, 2000, 4000, 8000, 256000, 300000, 300000]);
});

test('more than 5 restarts in 30 minutes: quarantined (once), then retried after retryMs', () => {
  const e = entryOf('ask-gateway', { startTimeoutMs: 1 });
  let rec = newRecord('ask-gateway', 0), t = 0, starts = 0, quarantines = 0, r;
  for (let i = 0; i < 30 && rec.state !== 'quarantined'; i += 1) {
    r = stepService(rec, { ok: false }, opts(e, t += 60_000));
    rec = r.rec; if (r.act === 'start') starts += 1; if (r.quarantined) quarantines += 1;
  }
  assert.equal(rec.state, 'quarantined');
  assert.equal(starts, 5, 'five restarts ran; the sixth needed one quarantines instead');
  assert.equal(quarantines, 1);
  r = stepService(rec, { ok: false }, opts(e, t += 60_000));
  assert.equal(r.to, 'quarantined');
  assert.equal(r.quarantined, false, 'a quarantine is reported once');
  r = stepService(r.rec, { ok: false }, opts(e, rec.since + S.quarantine.retryMs));
  assert.equal(r.to, 'starting');
  assert.equal(r.act, 'start');
  assert.deepEqual(r.rec.restarts, [rec.since + S.quarantine.retryMs]);
  const healed = stepService(rec, { ok: true }, opts(e, t + 1));
  assert.equal(healed.to, 'healthy', 'a quarantined service that answers again is healthy');
});

test('restarts older than the window do not count toward the quarantine', () => {
  const e = entryOf('ask-gateway', { startTimeoutMs: 1 });
  const old = { ...newRecord('ask-gateway', 0), state: 'failed', restarts: [0, 1, 2, 3, 4] };
  const r = stepService(old, { ok: false }, opts(e, S.quarantine.windowMs + 10));
  assert.equal(r.to, 'backoff');
  assert.deepEqual(r.rec.restarts, []);
});

test('restart:false (checkers, the task while allowTaskRepair is false) never starts or quarantines; a missing task is unmanaged', () => {
  const e = entryOf('harness-ui', { restart: false });
  let rec = newRecord('checker:sonar', 0), t = 0;
  for (let i = 0; i < 20; i += 1) { const r = stepService(rec, { ok: false }, opts(e, t += 60_000)); assert.equal(r.act, null); rec = r.rec; }
  assert.equal(rec.state, 'failed');
  const u = stepService(newRecord('sched-task:StarCi-Reconciler', 0), { ok: false, unmanaged: true }, opts(entryOf('sched-task:StarCi-Reconciler', { restart: false }), 1));
  assert.equal(u.to, 'unmanaged');
  assert.ok(!DOWN_STATES.has('unmanaged'));
});

test('the registry marks the scheduled task unmanaged when it is absent and repair is not allowed', async () => {
  const audit = async () => ({ ok: true, audits: { reconciler: { name: 'reconciler', taskName: 'StarCi-Reconciler', ok: false, problem: 'missing', reason: 'not registered', fix: 'starci task register reconciler --apply' } } });
  const reg = serviceRegistry({ platform: 'win32', settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), audit });
  const task = reg.find((e) => e.name === 'sched-task:StarCi-Reconciler');
  assert.equal(task.restart, false);
  const p = await task.probe();
  assert.equal(p.unmanaged, true);
  assert.equal(p.audit.problem, 'missing');
});

test('Orca restarts through explorer.exe with no agent session variables', async () => {
  const script = orcaRestartScript({ app: path.join(path.parse(process.cwd()).root, 'Orca', 'Orca.exe'), closeWaitMs: 30000 });
  assert.match(script, /Start-Process -FilePath "\$env:WINDIR\\explorer\.exe"/);
  assert.doesNotMatch(script, /Start-Process -FilePath \$app/);
  const env = await cleanEnv({ PATH: 'x', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDECODE: '1', CLAUDE_AGENT_SDK_VERSION: '1', STARCI_ACTOR: 'reconciler/host', STARCI_RECONCILER_EPOCH: '3' });
  assert.deepEqual(env, { PATH: 'x' });
});

test('the services table round-trips a record (machine.sqlite and memory stores); restarts and transitions are service_events', (t) => {
  const st = tempState();
  t.after(() => st.close());
  for (const store of [machineStore(st.m), memoryStore()]) {
    const rec = { ...newRecord('orca', 5), state: 'backoff', restarts: [1, 2], failStreak: 3, nextAttemptAt: 9, lastProbe: { ok: false, at: 5, verdict: 'timeout' } };
    store.put(rec);
    assert.deepEqual(store.get('orca'), rec);
    assert.equal(store.get('nope'), null);
    assert.equal(store.all().length, 1);
  }
  // The rows carry the fixture times 1, 2 and 7: a window wider than the epoch by a day keeps them in, however far the
  // store's clock moved past this test's (a window of exactly Date.now() lost the at=1 row under load).
  const ALL_HISTORY = Date.now() + 86_400_000;
  const store = machineStore(st.m);
  store.put({ ...store.get('orca'), state: 'starting', restarts: [1, 2, 7] });
  store.put({ ...store.get('orca'), state: 'healthy', restarts: [7] });
  assert.deepEqual(store.get('orca').restarts, [7], 'the quarantine window moved: earlier restarts leave the record, never the history');
  const events = st.m.serviceEvents({ name: 'orca', sinceMs: ALL_HISTORY });
  assert.deepEqual(events.map((e) => [e.to_state, e.action]), [['backoff', 'restart'], ['backoff', 'restart'], ['starting', 'restart'], ['healthy', null]]);
  assert.equal(st.m.services().find((r) => r.name === 'orca').state, 'healthy');
  store.remove('orca');
  assert.equal(store.get('orca'), null);
  assert.equal(st.m.serviceEvents({ name: 'orca', sinceMs: ALL_HISTORY }).length, 5, 'a removal keeps the history');
});

test('a seat agent is Orca agentIdentity, then the tab title, then the frame (Devin needs Esc twice)', () => {
  assert.equal(seatAgentOf({ agentIdentity: 'devin', title: 'x' }), 'devin');
  assert.equal(seatAgentOf({ title: '⠼ Devin' }), 'devin');
  assert.equal(seatAgentOf({ title: '✳ Claude Code' }), 'claude');
  assert.equal(seatAgentOf({ title: 'shell' }, 'Running tools · 5m 52s (esc twice to interrupt)'), 'devin');
  assert.equal(seatAgentOf({ title: 'shell' }), 'claude');
  assert.deepEqual(S.turnBudget.interruptKeys.devin, ['esc', 'esc']);
  assert.deepEqual(S.turnBudget.interruptKeys.claude, ['esc']);
});

test('one probe pass retries a slow first request: the harness 5 s idle wake-up is not a failure', async () => {
  let n = 0;
  const slowFirst = async () => { n += 1; if (n === 1) throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); return { status: 200 }; };
  const r = await httpUp('http://127.0.0.1:4547/healthz', { timeoutMs: 10, tries: 3, fetchImpl: slowFirst });
  assert.equal(r.ok, true);
  assert.equal(r.tries, 2);
  let m = 0;
  const down = await httpUp('http://x/healthz', { timeoutMs: 10, tries: 3, fetchImpl: async () => { m += 1; throw Object.assign(new Error('refused'), { cause: { code: 'ECONNREFUSED' } }); } });
  assert.deepEqual([down.ok, down.tries, down.error, m], [false, 3, 'ECONNREFUSED', 3]);
  assert.ok(S.services['harness-ui'].probeTries >= 3 && S.services['harness-ui'].probeTimeoutMs >= 10000);
  assert.deepEqual(down.failures.length, 3, 'each failed try is kept for the log');
  assert.equal(S.services['harness-ui'].probePath, '/healthz');
  assert.ok(OUTAGE_STATES.has('failed') && !OUTAGE_STATES.has('degraded'), 'one bad pass is not an outage');
});

test('harness readiness requires actual 200 JSON health while connector liveness retains HTTP semantics', async () => {
  const healthy = { data: { ok: true, rev: 'fixture-current', dbs: { machine: true, ledgers: { shop: true } } } };
  const reply = (status, body = healthy, type = 'application/json') => ({ status, headers: new Headers({ 'content-type': type }), json: async () => body });
  const probe = (response) => httpUp('https://harness.example.org/healthz', { timeoutMs: 1000, health: true, fetchImpl: async () => response });
  for (const status of [302, 401, 403, 404, 500, 503]) assert.equal((await probe(reply(status))).ok, false, `${status}`);
  for (const body of [{}, { data: { ok: true } }, { data: { ...healthy.data, ok: false } },
    { data: { ...healthy.data, dbs: { machine: false, ledgers: {} } } },
    { data: { ...healthy.data, dbs: { machine: true, ledgers: { shop: false } } } }]) assert.equal((await probe(reply(200, body))).ok, false);
  assert.equal((await probe(reply(200, healthy, 'text/html'))).ok, false);
  assert.equal((await probe({ status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => { throw Error('invalid JSON'); } })).ok, false);
  assert.equal((await probe(reply(200))).ok, true);
  assert.equal((await httpUp('http://gateway.example.org/', { timeoutMs: 1000, fetchImpl: async () => reply(404) })).ok, true);
});

test('both harness registry probes request strict health semantics at their configured URLs', async () => {
  const calls = [];
  const registry = serviceRegistry({ platform: 'win32', settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }),
    http: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200 }; } });
  await registry.find((entry) => entry.name === 'harness-ui').probe();
  await registry.find((entry) => entry.name === 'harness-tunnel').probe();
  assert.deepEqual(calls.map((call) => call.url), ['http://127.0.0.1:4547/healthz', 'https://harness.example.org/healthz']);
  assert.ok(calls.every((call) => call.options.health === true));
});

test('service capability classifications limit Windows refusals to their actual actuators', () => {
  const windows = ['orca', 'harness-ui', 'harness-tunnel', 'sched-task:StarCi-Reconciler'];
  const portable = ['ask-gateway', 'ask-tunnel', 'telegram-bridge'];
  for (const name of [...windows, ...portable]) assert.equal(servicePlatformProblem(name, 'win32'), null, name);
  for (const platform of ['darwin', 'linux']) {
    assert.equal(servicePlatformProblem('orca', platform), `Windows desktop restart is unsupported on ${platform}`);
    for (const name of windows.slice(1)) assert.equal(servicePlatformProblem(name, platform), `Windows Task Scheduler is unsupported on ${platform}`, name);
    for (const name of portable) assert.equal(servicePlatformProblem(name, platform), null, name);
  }
});

test('unsupported direct starts refuse before launch environment, actuator settings or Windows APIs', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const platform of ['darwin', 'linux']) {
    for (const name of ['orca', 'harness-ui', 'harness-tunnel']) {
      const calls = [];
      const settings = { ...S, services: new Proxy(S.services, { get: () => assert.fail('unsupported starts must refuse before actuator settings') }) };
      const env = new Proxy({}, { ownKeys: () => assert.fail('unsupported starts must refuse before launch environment') });
      const result = await startService(name, {
        platform, settings, ports, env,
        tasks: (...args) => { calls.push(['tasks', ...args]); return { status: 0 }; },
        powershell: (...args) => { calls.push(['powershell', ...args]); return { status: 0 }; },
      });
      assert.deepEqual(result, { ok: false, unsupported: true, error: servicePlatformProblem(name, platform) }, `${platform}:${name}`);
      assert.deepEqual(calls, [], `${platform}:${name}`);
    }
  }
});

test('unsupported registry entries remain unmanaged even when task repair is allowed', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const platform of ['darwin', 'linux']) {
    const calls = [];
    const registry = serviceRegistry({
      platform, settings: { ...S, allowTaskRepair: true }, ports,
      run: async (...args) => { calls.push(['run', ...args]); return { status: 0, stdout: '' }; },
      http: async (...args) => { calls.push(['http', ...args]); return { ok: true, status: 200 }; },
    });
    for (const name of ['orca', 'harness-ui', 'harness-tunnel', 'sched-task:StarCi-Reconciler']) {
      const entry = registry.find((candidate) => candidate.name === name);
      assert.equal(entry.restart, false, `${platform}:${name}`);
      assert.equal(entry.start(), null, `${platform}:${name}`);
      const probe = await entry.probe();
      assert.deepEqual(probe, { ok: false, unsupported: true, unmanaged: true, error: servicePlatformProblem(name, platform) }, `${platform}:${name}`);
      const step = stepService(newRecord(name, 0), probe, opts(entry, 1));
      assert.equal(step.to, 'unmanaged', `${platform}:${name}`);
      assert.equal(step.act, null, `${platform}:${name}`);
    }
    assert.deepEqual(calls, [], platform);
  }
});

test('portable connector registry probes and start commands remain available off Windows', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const platform of ['darwin', 'linux']) {
    const calls = [];
    const registry = serviceRegistry({
      platform, settings: S, ports, config: ON,
      run: async (_cmd, args) => {
        calls.push([path.basename(args[0]), ...args.slice(1)]);
        return { status: 0, stdout: JSON.stringify({ running: true, port: ports.gatewayPort, health: { problems: [] } }) };
      },
      http: async () => assert.fail('connector status probes must use their injected child runner'),
    });
    for (const name of ['ask-gateway', 'ask-tunnel', 'telegram-bridge']) {
      const entry = registry.find((candidate) => candidate.name === name);
      assert.equal(entry.restart, true, `${platform}:${name}`);
      const result = await entry.probe();
      assert.equal(result.ok, true, `${platform}:${name}`);
      assert.notEqual(result.unsupported, true, `${platform}:${name}`);
      assert.deepEqual(entry.start(), { cmd: 'node', args: ['scripts/reconciler/services.mjs', '--start', name, '--json'] });
    }
    assert.deepEqual(calls, [['ask-gateway.mjs', 'status'], ['tunnel.mjs', 'status', '--fast'], ['telegram-bridge.mjs', 'status']], platform);
  }
});

const ON = { connectors: { gateway: { port: 7070 }, cloudflare: { mode: 'quick' }, telegram: { enabled: true } } };
const OFF = { connectors: { gateway: { port: 7070 }, cloudflare: { mode: 'off' }, telegram: { enabled: false } } };

test('a connector config.yaml turns off is not an outage: never restarted, no failStreak, no SERVICE_DOWN state', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  const down = async () => ({ status: 0, stdout: '{"running":false}' });
  for (const name of ['telegram-bridge', 'ask-tunnel']) {
    const off = serviceRegistry({ platform: 'win32', settings: S, ports, run: down, config: OFF }).find((e) => e.name === name);
    const p = await off.probe();
    assert.equal(p.ok, false, name);
    assert.equal(p.unmanaged, true, `${name}: off in config.yaml is unmanaged, not down`);
    let rec = newRecord(name, 0), t = 0;
    for (let i = 0; i < 10; i += 1) {
      const r = stepService(rec, { ok: p.ok, unmanaged: p.unmanaged }, opts(entryOf(name), t += 60_000));
      assert.equal(r.act, null, `${name}: an owner-disabled connector is never restarted`);
      rec = r.rec;
    }
    assert.equal(rec.state, 'unmanaged');
    assert.equal(rec.failStreak, 0);
    assert.ok(!OUTAGE_STATES.has(rec.state), `${name}: no SERVICE_DOWN clock`);
    // A live connector the owner turned off still reads healthy (the probe answers first).
    const up = serviceRegistry({ platform: 'win32', settings: S, ports, config: OFF, run: async () => ({ status: 0, stdout: '{"running":true,"health":{"problems":[]}}' }) });
    assert.equal((await up.find((e) => e.name === name).probe()).ok, true, name);
  }
});

test('an enabled connector that is down is still an outage: failed, then backoff and a restart', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const name of ['telegram-bridge', 'ask-tunnel']) {
    const on = serviceRegistry({ platform: 'win32', settings: S, ports, config: ON, run: async () => ({ status: 0, stdout: '{"running":false}' }) }).find((e) => e.name === name);
    const p = await on.probe();
    assert.equal(p.ok, false, name);
    assert.notEqual(p.unmanaged, true, name);
    const first = stepService(newRecord(name, 0), { ok: false }, opts(entryOf(name), 1));
    assert.equal(first.to, 'backoff', name);
    assert.ok(OUTAGE_STATES.has(first.to));
    assert.equal(stepService(first.rec, { ok: false }, opts(entryOf(name), 1 + S.backoff.minMs)).act, 'start', name);
  }
});

test('Windows harness starts preserve End, listener stop, then Run ordering', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const name of ['harness-ui', 'harness-tunnel']) {
    const task = taskNameOf(name);
    const calls = [];
    const result = await startService(name, {
      platform: 'win32', settings: S, ports, env: {},
      tasks: (args) => {
        calls.push(['tasks', ...args]);
        return args[0] === '/End' ? { status: 1, stdout: '', stderr: 'already stopped' } : { status: 0, stdout: ' started \n', stderr: '' };
      },
      powershell: () => { calls.push(['powershell']); return { status: 0 }; },
    });
    assert.deepEqual(result, { ok: true, task, output: 'started' }, name);
    assert.deepEqual(calls, [['tasks', '/End', '/TN', task], ...(name === 'harness-ui' ? [['powershell']] : []), ['tasks', '/Run', '/TN', task]], name);
  }
});

test('Windows harness starts retain the raw Run failure instead of reporting success', async () => {
  const ports = servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML });
  for (const name of ['harness-ui', 'harness-tunnel']) {
    const task = taskNameOf(name);
    const calls = [];
    const result = await startService(name, {
      platform: 'win32', settings: S, ports, env: {},
      tasks: (args) => {
        calls.push(['tasks', ...args]);
        return args[0] === '/Run' ? { status: 5, stdout: '', stderr: ' access denied \n' } : { status: 0, stdout: '', stderr: '' };
      },
      powershell: () => { calls.push(['powershell']); return { status: 0 }; },
    });
    assert.deepEqual(result, { ok: false, task, output: 'access denied' }, name);
    assert.deepEqual(calls, [['tasks', '/End', '/TN', task], ...(name === 'harness-ui' ? [['powershell']] : []), ['tasks', '/Run', '/TN', task]], name);
  }
});
