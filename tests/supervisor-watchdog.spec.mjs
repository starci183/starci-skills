// The [Supervisor] seat watchdog's frozen-frame rule (scripts/supervisor/watchdog.mjs):
// a busy frame whose signature repeats across watchdog reads is FROZEN, not busy — the pending
// wake is delivered (Escape first when the input row targets a subagent), and a frame still
// frozen after that wake restarts the seat through start-supervisor --replace. Specs run on a
// temp supervisor home and a temp LOCALAPPDATA: no Orca, no agent, never the live runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { launchSupervisor } from '../scripts/supervisor/start-supervisor.mjs';
import { withSupervisorRead, supervisorSettings, SUPERVISOR_ID, SUPERVISOR_WF } from '../scripts/supervisor/home.mjs';
import { appendInbox, registerSupervisor } from '../scripts/connectors/telegram-bridge.mjs';
import { watchdogPass, busyScreen, busySignature, frozenBusyFrame, SUBAGENT_INPUT } from '../scripts/supervisor/watchdog.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* an open ledger handle closes after this hook */ } });
  return dir;
};
// The watchdog serves the optional [Supervisor] kernel only: config.yaml supervisor.mode kernel (the default is chat).
const envOf = (t) => { const root = tmp(t, 'sup-wd-'); return { LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_SUPERVISOR_MODE: 'kernel' }; };

/* ------------------------------------------------------------ fake Orca (launch) */

function fakeHost({ terminals = [], live = new Set(), screens = {} } = {}) {
  const calls = { spawn: [], close: [], quit: [] };
  let n = 0;
  return {
    calls, live,
    list: () => ({ ok: true, terminals, visualLayouts: [] }),
    tabTitles: (_layouts, rows) => new Map(rows.map((r) => [r.handle, r.tab ?? null])),
    verdict: (h) => (live.has(h) ? { verdict: 'live', reason: 'ok' } : { verdict: 'gone', reason: 'gone' }),
    screen: (h) => screens[h] ?? '> ',
    exitedRow: () => null,
    close: (h) => { calls.close.push(h); live.delete(h); return { ok: true }; },
    quit: (h) => { calls.quit.push(h); return { sent: true, exited: false }; },
    spawn: (opts) => { calls.spawn.push(opts); const h = `term_new${++n}`; live.add(h); return { ok: true, terminal: h, modelAttested: opts.model }; },
  };
}
const settings = { agent: 'claude', model: 'claude-opus-5-5', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };
const launch = (env, host) => launchSupervisor({ env, deps: host, settings, template: '{launchAuthority}\n{doctrine}', doc: { kernelSeat: { does: ['x'] } } });

/* ------------------------------------------------------------ fake seat (watchdog pass) */

// The seat deps the watchdog pass uses. `seat` holds the mutable frame/state so a spec can move
// the pane between reads; `order` records the escape/wake/replace sequence.
function seatDeps({ state = 'turn-idle', frame = '❯ ', outputAge = null, wakeResult = null, replaceResult = null } = {}) {
  const seat = {
    state, frame, outputAge, order: [],
    wakeResult: wakeResult ?? { action: 'kernel-woken', delivered: true },
    replaceResult: replaceResult ?? { ok: true, action: 'restarted', terminal: 'term_replaced' },
  };
  const d = {
    verdict: () => ({ verdict: 'live', reason: 'ok' }),
    screen: () => seat.frame,
    exitedRow: () => null,
    settleMs: 0,
    sleep: () => {},
    state: () => seat.state,
    outputAge: () => seat.outputAge,
    escape: () => { seat.order.push('escape'); return { ok: true }; },
    wake: (_terminal, text) => { seat.order.push('wake'); seat.wakeText = text; return seat.wakeResult; },
    enter: () => ({ ok: true }),
    quit: () => null,
    close: () => ({ ok: true }),
    closeExited: () => null,
    replace: () => { seat.order.push('replace'); return seat.replaceResult; },
  };
  return { seat, d };
}

const eventsOf = (env, kind) => withSupervisorRead(
  (db) => db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(SUPERVISOR_WF, kind).map((e) => JSON.parse(e.payload_json)),
  [], { env });

const pane = (timer) => [
  '❯ Message @general-purpose…',
  '  ⏵⏵ bypass permissions on · 1 shell · ← for agents',
  '  ◯ main',
  `  ● general-purpose  Checking awaitSubmission import… ${timer} · ↓ 154.0k tokens`,
].join('\n');

test('watchdog: an identical subagent pane on two reads is frozen — Escape, the wake lands, and a still-frozen frame replaces the seat', async (t) => {
  const env = envOf(t);
  const seed = await launch(env, fakeHost());
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'status?' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  const frozen = pane('12m 2s');
  const { seat, d } = seatDeps({ state: 'turn-idle', frame: frozen });

  const first = await watchdogPass({ env, d });
  assert.equal(first.action, 'busy');
  assert.equal(first.state, 'subagents-running');
  assert.deepEqual(seat.order, [], 'the first sighting of a busy frame is still busy');

  const second = await watchdogPass({ env, d });
  assert.deepEqual(seat.order.slice(0, 2), ['escape', 'wake'], 'the input targeted @general-purpose: Escape first, then the wake');
  assert.match(seat.wakeText ?? '', /\[inbox\]/, 'the pending wake was delivered, not skipped as busy');
  assert.equal(second.action, 'restarted', 'the frame never moved after the wake: the seat is replaced');
  assert.deepEqual(seat.order.at(-1), 'replace');

  const wakes = eventsOf(env, 'supervisor-wake');
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].frozen.state, 'subagents-running');
  assert.equal(wakes[0].frozen.signature, busySignature(frozen));
  assert.equal(wakes[0].frozen.escaped, true);
  const replaced = eventsOf(env, 'supervisor-frozen-replace');
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].signature, busySignature(frozen));
});

test('watchdog: a subagent timer that still advances is busy, not frozen; a wake that moves the pane is not replaced', async (t) => {
  const env = envOf(t);
  const seed = await launch(env, fakeHost());
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'hi' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  const { seat, d } = seatDeps({ state: 'turn-idle', frame: pane('12m 2s') });

  assert.equal((await watchdogPass({ env, d })).action, 'busy');
  seat.frame = pane('12m 3s');   // the timer ticks: turn progress, a new signature
  assert.equal((await watchdogPass({ env, d })).action, 'busy');
  assert.deepEqual(seat.order, [], 'a changing frame is never frozen');

  // The same frame once more is frozen; the wake moves the pane, so nothing is replaced.
  const origWake = d.wake;
  d.wake = (terminal, text) => { const r = origWake(terminal, text); seat.frame = '❯ \n  ⏵⏵ bypass permissions on'; return r; };
  const third = await watchdogPass({ env, d });
  assert.equal(third.action, 'frozen-woken');
  assert.deepEqual(seat.order, ['escape', 'wake'], 'the wake went through; no replace while the pane moved');
  assert.equal(eventsOf(env, 'supervisor-frozen-replace').length, 0);
});

test('watchdog: a frozen spinner (active) with no @-targeted input is woken without an Escape; no turn progress for frozenMinutes freezes the first sighting', async (t) => {
  const env = envOf(t);
  const seed = await launch(env, fakeHost());
  appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: 'hi' }, { env });
  registerSupervisor({ id: SUPERVISOR_ID, label: 'S', terminal: seed.terminal }, { env });
  const spinner = '✽ Thinking… (11m 5s · ↓ 40.0k tokens)\n❯ ';
  const { seat, d } = seatDeps({ state: 'active', frame: spinner, outputAge: 11 * 60_000 });
  const origWake = d.wake;
  d.wake = (terminal, text) => { const r = origWake(terminal, text); seat.frame = '❯ '; return r; };

  // The terminal printed nothing for 11 minutes (> supervisor.frozenMinutes default 10): the very
  // first read of this busy frame already counts as frozen.
  const r = await watchdogPass({ env, d });
  assert.deepEqual(seat.order, ['wake'], 'no subagent input row: no Escape is sent');
  assert.equal(r.action, 'frozen-woken');
  assert.equal(eventsOf(env, 'supervisor-wake').at(-1).frozen.state, 'active');
});

test('frozenBusyFrame: a repeated signature is frozen; a fresh one needs output older than frozenMs', () => {
  const sig = busySignature('❯ \n  ● general-purpose  Working… 12m 2s · ↓ 154.0k tokens');
  const first = frozenBusyFrame({ signature: sig, prev: null, now: 1000 });
  assert.equal(first.frozen, false);
  assert.deepEqual(first.state, { signature: sig, since: 1000, reads: 1 });
  const again = frozenBusyFrame({ signature: sig, prev: first.state, now: 2000 });
  assert.equal(again.frozen, true, 'the same text across two reads is frozen');
  assert.equal(again.state.since, 1000, 'since keeps the first sighting');
  assert.equal(again.state.reads, 2);
  assert.equal(frozenBusyFrame({ signature: 'other', prev: first.state, now: 2000, outputAgeMs: 599_999, frozenMs: 600_000 }).frozen, false);
  assert.equal(frozenBusyFrame({ signature: 'other', prev: first.state, now: 2000, outputAgeMs: 600_000, frozenMs: 600_000 }).frozen, true,
    'no turn progress for frozenMinutes freezes even a first sighting');
  assert.equal(busySignature('a\nb \n'), busySignature('a\nb\n'), 'trailing whitespace does not change the signature');
  assert.notEqual(busySignature('x'), busySignature('y'));
});

test('supervisorSettings: supervisor.frozenMinutes sets the freeze threshold, default 10', () => {
  assert.equal(supervisorSettings({ config: {} }).frozenMinutes, 10);
  assert.equal(supervisorSettings({ config: { supervisor: { frozenMinutes: 25 } } }).frozenMinutes, 25);
  assert.equal(supervisorSettings({ config: { supervisor: { frozenMinutes: 0 } } }).frozenMinutes, 10, 'a non-positive value falls back to the default');
});

test('busyScreen and SUBAGENT_INPUT read the frozen pane shapes from the incident', () => {
  const frozen = pane('12m 2s');
  assert.ok(busyScreen(frozen));
  assert.ok(SUBAGENT_INPUT.test(frozen), 'the input row targeting @general-purpose needs the Escape');
  assert.ok(!SUBAGENT_INPUT.test('❯ \n  ⏵⏵ bypass permissions on'), 'a plain idle input is not subagent-targeted');
  assert.ok(!SUBAGENT_INPUT.test('✽ Thinking… (11m 5s)\n❯ '), 'a spinner frame has no @-targeted input');
});
