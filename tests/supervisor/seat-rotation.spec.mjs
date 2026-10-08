// The Supervisor seat past its bound is replaced by a fresh session while idle: it keeps no memory outside the stores, so the boot text is generated
// from them; nothing in flight, the minimum interval and the quarantine counters hold. Temp supervisor home, fake Orca: never the live runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { launchSupervisor } from '../../scripts/supervisor/start-supervisor.mjs';
import { readSupervisor, SUPERVISOR_ID, SKILL_ROOT } from '../../scripts/machine/home.mjs';
import { registerSupervisor } from '../../scripts/supervisor/telegram-bridge.mjs';
import { appendInbox } from '../../scripts/machine/sup-messages.mjs';
import { watchdogPass } from '../../scripts/supervisor/supervisor-watchdog.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { inFlightOf, rotationHandover, rotationVerdict, supervisorRule, supervisorSinceBoot } from '../../scripts/supervisor/seat-rotation.mjs';
import { seatStateOf } from '../../scripts/reconciler/host-seats.mjs';
import { REPLACED } from '../../scripts/reconciler/controllers/host.mjs';

const MIN = 60_000;
const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sup-rot-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* an open handle closes after this hook */ } });
  return { STARCI_LOCAL_ROOT: path.join(dir, 'la'), STARCI_SUPERVISOR_MODE: 'kernel' };
};
const prompts = [];
function fakeHost() {
  let n = 0;
  const live = new Set();
  return {
    list: () => ({ ok: true, terminals: [{ handle: 'term_entry', title: 'pwsh', worktreePath: SKILL_ROOT, writable: true }], visualLayouts: [] }),
    tabTitles: (_layouts, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null])), show: () => ({ ok: true, state: 'ready' }),
    stop: () => ({ ok: true }), release: (_dispatch, handle) => ({ ok: true, handle, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } }), bindSeat: () => 'seat.json', screen: () => '> ', exitedRow: () => null, close: () => ({ ok: true }), quit: () => ({ sent: true }),
    start: (opts) => { prompts.push(opts.prompt); const h = `term_new${++n}`; live.add(h); return { ok: true, terminal: h, dispatchId: `ctx_${n}`, runId: 'run', taskId: `task_${n}` }; },
  };
}
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared' } };
const seed = (env) => launchSupervisor({ env, deps: fakeHost(), settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } } });
function seatDeps() {
  const seat = { order: [], rotated: null };
  const d = { show: () => ({ ok: true, state: 'ready' }), screen: () => '❯ ', settleMs: 0, sleep: () => {}, state: () => 'turn-idle', outputAge: () => null, escape: () => ({ ok: true }),
    wake: () => { seat.order.push('wake'); return { action: 'kernel-woken', delivered: true }; }, enter: () => ({ ok: true }), quit: () => null, close: () => ({ ok: true }),
    replace: () => { seat.order.push('replace'); return { ok: true, action: 'restarted', terminal: 'term_r' }; },
    rotate: (handover) => { seat.order.push('rotate'); seat.rotated = handover; return { ok: true, action: 'restarted', terminal: 'term_rot' }; } };
  return { seat, d };
}
const pass = async (t, { wakesAfterBoot, mutate = () => {} } = {}) => {
  const env = tmp(t);
  const booted = await seed(env);
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'status?' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: booted.terminal }, { env });
  withMachine((m) => {
    const bootAt = Number(m.db.prepare("SELECT MAX(created_at) AS at FROM sup_events WHERE kind IN ('supervisor-booted','supervisor-restarted')").get().at);
    for (let i = 0; i < wakesAfterBoot; i += 1) m.supEvent({ entityType: 'supervisor', entityId: SUPERVISOR_ID, kind: 'supervisor-wake', payload: { tags: ['inbox'], delivered: true, action: 'kernel-woken' }, at: bootAt + i + 1 });
    mutate(m, bootAt);
  }, { env });
  return { env, ...seatDeps() };
};
const eventsOf = (env, kind) => readSupervisor((m) => m.supEvents({ kind, order: 'asc', limit: -1 }).map((e) => ({ ...e.payload, at: e.created_at })), [], { env });

test('an idle seat past its wake bound is rotated, with a handover read from the stores, and the wake is not typed into the old session', async (t) => {
  const rule = supervisorRule();
  const { env, seat, d } = await pass(t, { wakesAfterBoot: rule.afterWakes, mutate: (m, at) => m.supEvent({ entityType: 'supervisor', entityId: SUPERVISOR_ID, kind: 'supervisor-action', payload: { item: 'runtime-defect:x', action: 'recorded' }, at: at + 5 }) });
  const result = await watchdogPass({ env, d });
  assert.equal(result.action, 'rotated');
  assert.deepEqual(seat.order, ['rotate'], 'no wake typed into the long session, no failure-replacement');
  assert.match(seat.rotated, /rotation of a long session \(\d+ wakes since its boot/);
  assert.match(seat.rotated, /read the menu first \(starci supervisor status --json\), then starci supervisor actions digest/);
  assert.match(seat.rotated, /runtime-defect:x recorded/);
  const [event] = eventsOf(env, 'supervisor-rotated');
  assert.equal(event.since.wakes, rule.afterWakes);
});

test('a seat under its bound is woken as before', async (t) => {
  const { env, seat, d } = await pass(t, { wakesAfterBoot: supervisorRule().afterWakes - 1 });
  assert.equal((await watchdogPass({ env, d })).action, 'woken');
  assert.deepEqual(seat.order, ['wake']);
});

test('the minimum interval holds: a rotation inside it is not repeated', async (t) => {
  const rule = supervisorRule();
  const { env, seat, d } = await pass(t, { wakesAfterBoot: rule.afterWakes, mutate: (m) => m.supEvent({ entityType: 'supervisor', entityId: SUPERVISOR_ID, kind: rule.event, payload: { reason: 'earlier' }, at: Date.now() - 5 * MIN }) });
  assert.equal((await watchdogPass({ env, d })).action, 'woken');
  assert.deepEqual(seat.order, ['wake']);
  assert.equal(eventsOf(env, rule.event).length, 1);
});

test('the quarantine counters are untouched: a rotation is not a replacement and writes no refused input', async (t) => {
  const { env, d } = await pass(t, { wakesAfterBoot: supervisorRule().afterWakes });
  const before = readSupervisor((m) => m.db.prepare("SELECT input_failures_consecutive AS n FROM seats WHERE seat_id='supervisor'").get(), null, { env });
  assert.equal((await watchdogPass({ env, d })).action, 'rotated');
  const after = readSupervisor((m) => m.db.prepare("SELECT input_failures_consecutive AS n FROM seats WHERE seat_id='supervisor'").get(), null, { env });
  assert.equal(after.n, before.n);
  assert.equal(REPLACED.has('rotated'), false, 'the Host counts only restarted toward the replacements an hour allows');
  assert.equal(seatStateOf('rotated'), 'reserving');
});

function fakeStore() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE sup_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, created_at INTEGER, payload_json TEXT);
    CREATE TABLE sup_messages(direction TEXT, at INTEGER);
    CREATE TABLE llm_usage(subject_type TEXT, turn_ref TEXT, at INTEGER, turns INTEGER, input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER);
    CREATE TABLE sup_decision_items(di_id TEXT, kind TEXT, summary TEXT, status TEXT, claim_at INTEGER, claim_ttl_ms INTEGER, due_at INTEGER, opened_at INTEGER);
    CREATE TABLE sup_jobs(job_id TEXT, status TEXT);
    CREATE TABLE land_queue(ticket_id TEXT, state TEXT, finished_at INTEGER);`);
  return db;
}

test('a claimed item in flight, a running worker job or a running land each hold a due rotation; an expired claim does not', () => {
  const rule = supervisorRule();
  const NOW = 10_000_000_000;
  const db = fakeStore();
  const boot = (at) => db.prepare("INSERT INTO sup_events(kind,created_at,payload_json) VALUES('supervisor-booted',?,'{}')").run(at);
  boot(NOW - 5 * 3_600_000);
  for (let i = 0; i < rule.afterWakes; i += 1) db.prepare("INSERT INTO sup_events(kind,created_at,payload_json) VALUES('supervisor-wake',?,?)").run(NOW - 4 * 3_600_000 + i, JSON.stringify({ delivered: true, tags: ['land'] }));
  assert.equal(rotationVerdict(db, NOW).blocked, null, 'idle and past the bound: due, nothing holds it');
  db.prepare("INSERT INTO sup_decision_items VALUES('d1','gate-ruling','s','claimed',?,900000,NULL,0)").run(NOW - 2 * MIN);
  assert.match(rotationVerdict(db, NOW).blocked, /1 claimed/);
  db.exec("DELETE FROM sup_decision_items");
  db.prepare("INSERT INTO sup_decision_items VALUES('d2','gate-ruling','s','claimed',?,900000,NULL,0)").run(NOW - 3_600_000);
  assert.equal(rotationVerdict(db, NOW).blocked, null, 'a claim past its ttl is abandoned, not in flight');
  db.prepare("INSERT INTO sup_jobs VALUES('j1','running')").run();
  assert.match(rotationVerdict(db, NOW).blocked, /1 jobs/);
  db.exec('DELETE FROM sup_jobs');
  db.prepare("INSERT INTO land_queue VALUES('t1','running',NULL)").run();
  assert.deepEqual(inFlightOf(db, NOW).lands, ['t1']);
  assert.match(rotationVerdict(db, NOW).blocked, /1 lands/);
  db.close();
});

test('the tokens since the boot do not count the session that was replaced, and the handover names open items from the store', () => {
  const NOW = 10_000_000_000;
  const db = fakeStore();
  db.prepare("INSERT INTO sup_events(kind,created_at,payload_json) VALUES('supervisor-restarted',?,'{}')").run(NOW - 3_600_000);
  const row = (session, at, tokens) => db.prepare("INSERT INTO llm_usage VALUES('supervisor-turn',?,?,3,0,0,?,0)").run(`supervisor:${session}@9`, at, tokens);
  row('old', NOW - 4_000_000, 90_000_000); row('old', NOW - 3_000_000, 1_000_000); row('new', NOW - 1_000_000, 7_000_000);
  assert.deepEqual(supervisorSinceBoot(db), { bootAt: NOW - 3_600_000, wakes: 0, tokens: 7_000_000 });
  db.prepare("INSERT INTO sup_decision_items VALUES('sdi-1','runtime-defect','a defect of the runtime','open',NULL,NULL,NULL,1)").run();
  const text = rotationHandover(db, { reason: 'x', now: NOW });
  assert.match(text, /open Decision Items: sdi-1 \[runtime-defect\] a defect of the runtime/);
  assert.match(text, /it recorded no action/);
  db.close();
});

test('start --rotate closes the live seat with proof, keeps it enabled and boots the standing prompt with the handover', async (t) => {
  const env = tmp(t);
  const host = fakeHost();
  const doc = { kernelSeat: { does: ['x'] } };
  const first = await launchSupervisor({ env, deps: host, settings, template: '{launchAuthority}', doc });
  assert.equal(first.action, 'booted');
  const refused = await launchSupervisor({ mode: 'replace', env, deps: host, settings, template: '{launchAuthority}', doc });
  assert.equal(refused.action, 'already-live', 'replace alone never touches a live seat');
  prompts.length = 0;
  const rotated = await launchSupervisor({ mode: 'replace', rotate: true, reason: 'rotation of a long session (9 wakes). read the menu first', env, deps: host, settings, template: '{launchAuthority}', doc });
  assert.equal(rotated.action, 'restarted');
  assert.notEqual(rotated.terminal, first.terminal);
  assert.match(prompts[0], /REPLACEMENT \[Supervisor\]: rotation of a long session \(9 wakes\)\. read the menu first/);
  assert.notEqual(readSupervisor((m) => m.supSignal('supervisor-enabled', 'supervisor')?.value?.enabled ?? null, null, { env }), false, 'the seat stays enabled');
});
