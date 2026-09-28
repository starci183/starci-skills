import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  hostSettings, servicePorts, serviceRegistry, harnessIngress, stepService, newRecord, backoffDelay, memoryStore, sqliteStore,
  orcaRestartScript, cleanEnv, DOWN_STATES,
} from '../scripts/reconciler/services.mjs';

// Lane D rc-host: the ONE host-service registry (scripts/reconciler/services.mjs). The DESIGN 9.7 state machine,
// its backoff, the quarantine after more than five restarts in thirty minutes, and one source per port.

const require = createRequire(import.meta.url);
const S = hostSettings();
const HARNESS_YML = 'tunnel: x\ningress:\n  - hostname: harness.example.org\n    service: http://127.0.0.1:4547\n  - service: http_status:404\n';
const ALLOC = { supervisorTick: { statusApp: { port: 4547 } } };
const CONFIG = { connectors: { gateway: { port: 7070 } } };
const entryOf = (name, over = {}) => ({ name, restart: true, ...S.services[name], ...over });
const opts = (entry, now) => ({ now, entry, backoff: S.backoff, quarantine: S.quarantine });

test('host.yaml carries every number the registry needs', () => {
  for (const name of ['orca', 'harness-ui', 'harness-tunnel', 'ask-gateway', 'ask-tunnel', 'telegram-bridge', 'sched-task:StarCi-Reconciler']) {
    assert.ok(S.services[name], name);
    for (const k of ['everyMs', 'probeTimeoutMs', 'failAfter', 'startTimeoutMs', 'slaMs']) assert.ok(S.services[name][k] > 0, `${name}.${k}`);
  }
  assert.deepEqual(S.backoff, { minMs: 1000, maxMs: 300000, factor: 2 });
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
  const reg = serviceRegistry({ settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), http, run: async () => ({ status: 0, stdout: '{"running":true,"port":7070}' }) });
  assert.equal((await reg.find((e) => e.name === 'harness-ui').probe()).ok, true);
  assert.equal((await reg.find((e) => e.name === 'harness-tunnel').probe()).ok, true);
  assert.deepEqual(seen, ['http://127.0.0.1:4547/', 'https://harness.example.org/']);
  assert.equal((await reg.find((e) => e.name === 'ask-gateway').probe()).ok, true);
  const wrongPort = serviceRegistry({ settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), http, run: async () => ({ status: 0, stdout: '{"running":true,"port":7071}' }) });
  assert.equal((await wrongPort.find((e) => e.name === 'ask-gateway').probe()).ok, false, 'a gateway on another port than config.yaml says is down');
  const drifted = serviceRegistry({ settings: S, ports: servicePorts({ allocation: { supervisorTick: { statusApp: { port: 4548 } } }, config: CONFIG, harnessYml: HARNESS_YML }), http });
  const t = await drifted.find((e) => e.name === 'harness-tunnel').probe();
  assert.equal(t.ok, false);
  assert.match(t.error, /port-drift/);
  for (const e of reg) {
    const a = e.start();
    if (e.name.startsWith('sched-task:')) assert.deepEqual(a.args.slice(0, 3), ['scripts/reconciler/boot.mjs', '--install-task', '--apply']);
    else assert.deepEqual(a.args.slice(0, 3), ['scripts/reconciler/services.mjs', '--start', e.name], 'every actuator is one CLI');
  }
});

test('state machine: healthy -> degraded -> healthy, degraded -> failed after failAfter, failed -> backoff -> starting -> healthy', () => {
  const e = entryOf('harness-ui');
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
  const reg = serviceRegistry({ settings: S, ports: servicePorts({ allocation: ALLOC, config: CONFIG, harnessYml: HARNESS_YML }), run: async () => ({ status: 1, stdout: '' }) });
  const task = reg.find((e) => e.name === 'sched-task:StarCi-Reconciler');
  assert.equal(task.restart, false);
  const p = await task.probe();
  if (process.platform === 'win32') assert.equal(p.unmanaged, true);
});

test('Orca restarts through explorer.exe with no agent session variables', async () => {
  const script = orcaRestartScript({ app: 'C:\\Orca\\Orca.exe', closeWaitMs: 30000 });
  assert.match(script, /Start-Process -FilePath "\$env:WINDIR\\explorer\.exe"/);
  assert.doesNotMatch(script, /Start-Process -FilePath \$app/);
  const env = await cleanEnv({ PATH: 'x', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDECODE: '1', CLAUDE_AGENT_SDK_VERSION: '1', STARCI_ACTOR: 'reconciler/host', STARCI_RECONCILER_EPOCH: '3' });
  assert.deepEqual(env, { PATH: 'x' });
});

test('the services table round-trips a record (sqlite and memory stores)', () => {
  const { DatabaseSync } = require('node:sqlite');
  for (const store of [sqliteStore(new DatabaseSync(':memory:')), memoryStore()]) {
    const rec = { ...newRecord('orca', 5), state: 'backoff', restarts: [1, 2], failStreak: 3, nextAttemptAt: 9, lastProbe: { ok: false, at: 5, verdict: 'timeout' } };
    store.put(rec);
    assert.deepEqual(store.get('orca'), rec);
    assert.equal(store.get('nope'), null);
    assert.equal(store.all().length, 1);
  }
});
