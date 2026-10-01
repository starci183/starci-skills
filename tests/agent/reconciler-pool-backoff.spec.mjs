// reconciler-pool-backoff.spec.mjs — adaptive per-pool concurrency (AIMD) after provider rate limits: the pure step
// (scripts/machine/pool-backoff.mjs), route preferring the next eligible pool (scripts/agent/models.mjs selectPool), the
// Resource controller's resource:pools key (shadow writes nothing, active publishes, a persisting limit opens the
// circuit) and `api provider-backoff`. Every host seam is injected.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { aimdStep, backoffPersists, capsOf, poolRowOf, entriesOfRows } from '../../scripts/machine/pool-backoff.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { selectPool } from '../../scripts/agent/models.mjs';
import { createResourceController, POOLS_KEY } from '../../scripts/reconciler/controllers/resource.mjs';

const T = 2_000_000_000_000;
const MIN = 60_000;

test('AIMD: halve on a rate limit (floor 2, once per cooldown), +1 per step after 15 quiet minutes, back to max', () => {
  let e = aimdStep(null, { max: 14, rateLimitAt: T, now: T });
  assert.equal(e.cap, 7);
  e = aimdStep(e, { max: 14, rateLimitAt: T + 30_000, now: T + 30_000 });
  assert.equal(e.cap, 7, 'a burst inside the decrease cooldown counts once');
  e = aimdStep(e, { max: 14, rateLimitAt: T + 3 * MIN, now: T + 3 * MIN });
  assert.equal(e.cap, 3);
  e = aimdStep(e, { max: 14, rateLimitAt: T + 6 * MIN, now: T + 6 * MIN });
  assert.equal(e.cap, 2, 'floor');
  e = aimdStep(e, { max: 14, rateLimitAt: T + 9 * MIN, now: T + 9 * MIN });
  assert.equal(e.cap, 2, 'never below the floor');
  assert.equal(aimdStep(e, { max: 14, now: T + 20 * MIN }).cap, 2, 'not yet 15 quiet minutes');
  let now = T + 9 * MIN + 15 * MIN;
  e = aimdStep(e, { max: 14, now });
  assert.equal(e.cap, 3, '+1 after 15 quiet minutes');
  assert.equal(aimdStep(e, { max: 14, now: now + MIN }).cap, 3, 'one step per increaseStepMs');
  for (let i = 0; i < 20 && e; i++) { now += 5 * MIN; e = aimdStep(e, { max: 14, now }); }
  assert.equal(e, null, 'back at max: the entry is dropped');
  assert.equal(aimdStep(null, { max: 10, now: T }), null, 'no signal, no entry');
});

test('persistence: at the floor and still rate limited for persistMs', () => {
  const e = { cap: 2, max: 10, lastRateLimitAt: T + 14 * MIN, lastDecreaseAt: T, floorSince: T };
  assert.equal(backoffPersists(e, { now: T + 16 * MIN, persistMs: 15 * MIN }).persists, true);
  assert.equal(backoffPersists(e, { now: T + 10 * MIN, persistMs: 15 * MIN }).persists, false);
  assert.equal(backoffPersists({ ...e, cap: 5 }, { now: T + 16 * MIN, persistMs: 15 * MIN }).persists, false);
});

test('capsOf: only backed-off pools of a fresh publication', () => {
  const row = (pool, e) => { const r = poolRowOf(pool, e, { now: T, staleMs: 10 * MIN }); return { pool: r.pool, until_at: r.untilAt, strikes: r.strikes, reason: r.reason }; };
  const rows = [row('devin-agent', { cap: 5, max: 10, halvings: 1 }), row('codex-agent', { cap: 10, max: 10 })];
  assert.deepEqual(capsOf(rows, { now: T + MIN }), { 'devin-agent': 5 });
  assert.deepEqual(capsOf(rows, { now: T + 11 * MIN }), {}, 'stale: a dead engine never pins a pool');
  assert.equal(entriesOfRows(rows)['devin-agent'].halvings, 1, 'strikes carry the halvings');
});

test('route: a pool at its backed-off cap is rejected and the next eligible pool takes the job', () => {
  const runtimes = parseYaml(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'modules', 'models', 'runtimes.yaml'), 'utf8'));
  const capacity = { 'devin-agent': { running: 5, auth: 'ok' }, 'codex-agent': { running: 1, auth: 'ok' } };
  const base = { kind: 'backend.implement', difficulty: 'medium', runtimes, capacity };
  const free = selectPool({ ...base, backoff: {} });
  const backed = selectPool({ ...base, backoff: { 'devin-agent': 5 } });
  if (free.error) { assert.fail(`fixture route failed: ${free.error}`); }
  assert.equal(free.target, 'devin-agent');
  assert.equal(backed.target, 'codex-agent', 'devin at 5/5 backed off: codex takes it');
  assert.ok((backed.rejected ?? []).some((r) => r.target === 'devin-agent' && /backed off/.test(r.reason)));
});

function ledgerDb({ events = [], health = [], logs = [] }) {
  return { prepare: (sql) => ({
    all: () => (/FROM events e/.test(sql) ? events : /signals/.test(sql) ? health : /FROM logs/.test(sql) ? logs : []),
    get: () => ({ s: events.reduce((m, e) => Math.max(m, e.seq), 0) }),
  }) };
}
const poolDirs = [];
after(() => { for (const d of poolDirs) fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
function setup({ events = [], health = [], logs = [] } = {}) {
  const poolDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-pool-'));
  poolDirs.push(poolDir);
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(poolDir, 'machine.sqlite') };
  // The Job controller's rate-limit rows live in machine_logs (actor reconciler).
  if (logs.length) withMachine((m) => m.log(logs.map((l) => ({ actor: 'reconciler', kind: 'reconciler.provider-rate-limited', msg: 'rate limited', at: l.at, data: JSON.parse(l.d) }))), { env });
  const c = createResourceController({ env, pools: async () => [{ target: 'devin-agent', provider: 'devin', maxParallel: 10 }, { target: 'codex-agent', provider: 'codex', maxParallel: 10 }] });
  const calls = { api: [], log: [] };
  const src = { events, health, logs };
  let now = T;
  const ctxOf = (mode) => ({ mode, now: () => now, ledgers: [{ ledgerId: 'nivo-backend' }, { ledgerId: 'supervisor' }],
    read: (id, fn) => fn(ledgerDb(src)), api: async (...a) => { calls.api.push(a); return { ok: true }; }, run: async () => ({ ok: true }),
    clock() {}, clear() {}, openDecision: async () => ({ ok: true }), log: (kind, msg, data) => calls.log.push({ kind, msg, data }) });
  const backoff = () => entriesOfRows(readMachine((m) => m.poolBackoff(), [], { env }));
  return { c, env, backoff, calls, src, ctxOf, advance: (ms) => { now += ms; }, at: () => now };
}

test('resource:pools in shadow: a provider-rate-limited event halves devin, a would-row, nothing written', async () => {
  const s = setup({ events: [{ seq: 5, at: T - 10_000, p: JSON.stringify({ provider: 'devin', evidence: 'Reached free model rate limit' }), jobPool: 'devin-agent' }] });
  const r = await s.c.reconcile(POOLS_KEY, s.ctxOf('shadow'));
  assert.deepEqual(r.caps, { 'devin-agent': 5 });
  assert.deepEqual(s.backoff(), {}, 'shadow writes nothing');
  assert.ok(s.calls.log.some((l) => l.kind === 'reconciler.would' && /devin-agent 5\/10/.test(l.msg)));
  assert.equal(s.calls.api.length, 0);
});

test('resource:pools in active: publishes poolBackoff; a limit persisting at the floor opens the circuit once', async () => {
  const s = setup();
  const ctx = s.ctxOf('active');
  let seq = 0;
  const limit = () => { seq += 1; s.src.events = [{ seq, at: s.at(), p: JSON.stringify({ pool: 'devin-agent' }) }]; };
  limit(); await s.c.reconcile(POOLS_KEY, ctx);
  assert.equal(s.backoff()['devin-agent'].cap, 5);
  assert.ok(readMachine((m) => m.poolBackoff('devin-agent').until_at, null, { env: s.env }) > s.at(), 'until_at: the staleness horizon');
  for (let i = 0; i < 12; i++) { s.advance(3 * MIN); limit(); await s.c.reconcile(POOLS_KEY, ctx); }
  assert.equal(s.backoff()['devin-agent'].cap, 2);
  const opened = s.calls.api.filter((a) => a[1] === 'provider-backoff');
  assert.equal(opened.length, 1, 'one circuit per floor episode, on the one product ledger');
  assert.deepEqual(opened[0].slice(0, 2), ['nivo-backend', 'provider-backoff']);
  assert.ok(opened[0][2].includes('devin') && opened[0][2].includes('--open-circuit'));
  // Quiet: +1 after 15 minutes.
  s.src.events = [];
  s.advance(16 * MIN); await s.c.reconcile(POOLS_KEY, ctx);
  assert.equal(s.backoff()['devin-agent'].cap, 3);
});

test('api provider-backoff opens the provider circuit once (idempotent)', async (t) => {
  // The circuit is a machine.sqlite provider_health row: a scratch machine store, injected into the verb.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-provider-backoff-'));
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const verb = (await import('../../scripts/kernel/verbs/provider-backoff.mjs')).default;
  const outs = [];
  withMachine((machine) => {
    const run = () => verb.run({ ledger: null, machine, args: { provider: 'devin-agent', 'open-circuit': true, reason: 'held at 2/10', by: 'reconciler/resource' }, emit: (o) => outs.push(o) });
    run(); run();
  }, { env });
  assert.equal(outs[0].opened, true);
  assert.equal(outs[1].alreadyOpen, true);
  const row = readMachine((m) => m.providerHealth().find((r) => r.provider === 'devin'), null, { env });
  assert.equal(row.status, 'unavailable');
  assert.equal(row.failure_kind, 'quota');
  assert.equal(readMachine((m) => m.db.prepare("SELECT count(*) n FROM provider_health_events WHERE provider='devin'").get().n, null, { env }), 1);
});

test('resource:pools reads the Job controller reconciler.provider-rate-limited log rows (lane B worker-health probe)', async () => {
  const d = { jobId: 'op-1', workflowId: 'wf-1', provider: 'Devin', pool: 'devin', model: 'devin-agent', resetMs: null };
  const s = setup({ logs: [{ seq: 9, at: T - 5_000, d: JSON.stringify(d) }] });
  const r = await s.c.reconcile(POOLS_KEY, s.ctxOf('shadow'));
  assert.deepEqual(r.caps, { 'devin-agent': 5 });
  // By provider only (no pool target named): every pool of that provider.
  const p = setup({ logs: [{ seq: 3, at: T - 5_000, d: JSON.stringify({ provider: 'codex' }) }] });
  assert.deepEqual((await p.c.reconcile(POOLS_KEY, p.ctxOf('shadow'))).caps, { 'codex-agent': 5 });
});
