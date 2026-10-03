#!/usr/bin/env node
// starci debug pass — debug-loop state: one loop per host, one pass per tick, one lane per alert.
//
//   starci debug pass setup                     reserve the host slot; never starts a scheduler
//   starci debug pass bind --loop-id <id> --scheduler <kind> --scheduler-id <id> --confirmed
//   starci debug pass block --loop-id <id> --reason <text>  report unsupported native recurrence
//   starci debug pass pass [--snapshot <file>]  one pass: core-watch snapshot -> alerts to dispatch
//     [--child-timeout <sec>] [--token-window <min>] [--token-spike <n>]   passed to the core-watch snapshot
//   starci debug pass claim --key <alert> --lane <lane>     a lane now fixes that alert
//   starci debug pass note --key <alert> --reason <text>    diagnosed, no core fix owed while it lasts
//   starci debug pass release --key <alert>                 forget a fix (lane died, fix did not help)
//   starci debug pass stop --loop-id <id> --scheduler-id <id> --confirmation cancelled|ended --confirmed
//   starci debug pass status
// Every verb prints one JSON object. The loop interval is config.yaml coreDebug.interval (engine/config.mjs
// coreDebugSettings); code carries no default.
//
// State: <state root>/debug/state.json (engine/db/machine.mjs starciLocalRoot, so STARCI_LOCAL_ROOT moves it). It is
// chat-side bookkeeping, not engine state, so it stays out of machine.sqlite (whose writers are the engine's own):
//   loop   {id, intervalMs, status, scheduler, lastPassAt} — the slot stays held until exact native cancellation or
//          closure is confirmed. Only a matching scheduled pass renews liveness; stale ticks never authorize replacement.
//   fixes  {<alert key>: {state: dispatching|fixing|noted, text, since, lane?, reason?}} — keyed by the core-watch fact key
//          (its text carries changing numbers). An alert with a fix is never dispatched again; a fix closes when its alert
//          clears; a `dispatching` reservation nobody claimed within CLAIM_TTL_MS is dispatched again.
// It never restarts, fixes or types into anything; dispatch is the chat's (a lane agent), recorded here with `claim`.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import { starciLocalRoot } from '../../engine/db/machine.mjs';
import { coreDebugSettings } from '../../engine/config.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
import { renameOver } from '../api/fs/rename-over.mjs';
import { withHostLock } from '../machine/host-lock.mjs';
import { snapshot, watchOptions } from './core-watch.mjs';

export const LOOP_GRACE_MS = 5 * 60_000;
export const CLAIM_TTL_MS = 30 * 60_000;

/** The state file of this host (or of STARCI_LOCAL_ROOT). */
export const statePath = (env = process.env) => path.join(starciLocalRoot(env), 'debug', 'state.json');

/** The state in `file`, or an empty one. */
export function loadState(file) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return { loop: null, fixes: {} };
    throw error;
  }
  if (!s || typeof s !== 'object' || Array.isArray(s) || !Object.hasOwn(s, 'loop') ||
      (s.loop !== null && (typeof s.loop !== 'object' || Array.isArray(s.loop))) ||
      !s.fixes || typeof s.fixes !== 'object' || Array.isArray(s.fixes)) throw new Error('invalid debug state; existing scheduler custody is unknown');
  return { loop: s.loop, fixes: s.fixes };
}

/** Replace `file` whole with `state`. */
function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameOver(tmp, file);
}

/**
 * Who fixes an alert by default, for the diagnosis table: `owner` for an open owner ask and for the owner's own
 * config.yaml; `core` (a lane of this chat) for everything else. The chat's diagnosis may still note a core alert.
 */
export function fixOwnerOf(key) {
  return /^wf:.*:owner$/.test(key) || key.startsWith('config:') ? 'owner' : 'core';
}

/** True while the loop record still passes on time. */
export function loopLive(loop, now) {
  if (loop?.status !== 'scheduled' || !loop.scheduler?.id || !(loop.intervalMs > 0) || !Number.isFinite(loop.lastPassAt)) return false;
  const age = now - loop.lastPassAt;
  return age >= 0 && age <= 2 * loop.intervalMs + LOOP_GRACE_MS;
}

/**
 * Reserve a host slot. Any existing reservation, including stale or uncertain creation, is held.
 * No external scheduler is called here; its actual receipt must later bind the reservation.
 */
export function setupLoop(state, { now, settings }) {
  if (state.loop) return { created: false, loop: state.loop, scheduled: state.loop.status === 'scheduled', live: loopLive(state.loop, now) };
  const loop = { id: `loop-${randomUUID()}`, interval: settings.interval, intervalMs: settings.intervalMs, reservedAt: now, status: 'reserved', scheduler: null, lastPassAt: null };
  state.loop = loop;
  return { created: true, loop, scheduled: false, live: false };
}

function matchingLoop(state, loopId) {
  if (!loopId || !state.loop?.id || state.loop.id !== loopId) throw new Error('debug loop ID does not match the held reservation');
  return state.loop;
}

/** Bind only a confirmed receipt from a supported native scheduler; retries cannot change its identity. */
export function bindLoop(state, { now, loopId, scheduler, schedulerId, confirmed }) {
  const loop = matchingLoop(state, loopId);
  if (confirmed !== true || !['codex-heartbeat', 'claude-loop'].includes(scheduler) || typeof schedulerId !== 'string' || !schedulerId.trim()) {
    throw new Error('bind needs a confirmed native codex-heartbeat or claude-loop scheduler ID');
  }
  if (loop.scheduler) {
    if (loop.status !== 'scheduled' || loop.scheduler.kind !== scheduler || loop.scheduler.id !== schedulerId) throw new Error('debug scheduler binding already exists; confirm its cancellation before replacement');
    return { bound: false, loop };
  }
  if (loop.status !== 'reserved') throw new Error('debug recurrence is blocked; resolve the reservation before binding');
  loop.scheduler = { kind: scheduler, id: schedulerId, boundAt: now };
  loop.status = 'scheduled';
  return { bound: true, loop };
}

/** An unsupported local scheduler is visible and retains the slot without pretending recurrence started. */
export function blockLoop(state, { loopId, reason }) {
  const loop = matchingLoop(state, loopId);
  if (loop.scheduler || !['reserved', 'blocked'].includes(loop.status) || typeof reason !== 'string' || !reason.trim()) throw new Error('block needs an unbound reservation and a reason');
  loop.status = 'blocked';
  loop.reason = reason;
  return { blocked: true, loop, scheduled: false, live: false };
}

/** A scheduled tick must match the current bound loop before collecting anything or recording fixes. */
export function requireScheduledLoop(state, loopId) {
  const loop = matchingLoop(state, loopId);
  if (loop.status !== 'scheduled' || !loop.scheduler?.id) throw new Error('debug loop has no confirmed native scheduler');
  return loop;
}

/** Only exact native confirmation releases custody; a durable heartbeat requires cancellation. */
export function stopLoop(state, { loopId, schedulerId, confirmation, confirmed }) {
  const loop = matchingLoop(state, loopId);
  if (confirmed !== true) throw new Error('stop needs exact native cancellation or closure confirmation');
  if (loop.scheduler) {
    if (schedulerId !== loop.scheduler.id || !(confirmation === 'cancelled' || (loop.scheduler.kind === 'claude-loop' && confirmation === 'ended'))) {
      throw new Error('stop confirmation does not match the bound native scheduler');
    }
  } else if (confirmation !== 'not-created' || schedulerId) throw new Error('unbound creation remains uncertain until native not-created confirmation');
  state.loop = null;
  return { stopped: loop.id, scheduler: loop.scheduler, confirmation };
}

/**
 * One pass over a core-watch snapshot. Closes the fixes whose alert cleared, calls `dispatch(alert)` once for every alert
 * with no open fix (or an unclaimed reservation past CLAIM_TTL_MS) and records what it returns ({lane} fixing,
 * {reason} noted, anything else a `dispatching` reservation). Returns {dispatched, rows}. Mutates `state`.
 */
export function runPass(state, snap, { now, dispatch, loopId = null }) {
  if (loopId !== null) requireScheduledLoop(state, loopId).lastPassAt = now;
  const alerts = new Map((snap?.alerts ?? []).map((a) => [a.key, a.text]));
  const rows = [];
  for (const [key, fix] of Object.entries(state.fixes)) {
    if (alerts.has(key)) continue;
    rows.push({ key, text: fix.text, state: 'resolved', fixOwner: fixOwnerOf(key), lane: fix.lane ?? null, since: fix.since });
    delete state.fixes[key];
  }
  const dispatched = [];
  for (const [key, text] of alerts) {
    const open = state.fixes[key];
    const expired = open?.state === 'dispatching' && now - Number(open.since) > CLAIM_TTL_MS;
    if (open && !expired) {
      open.text = text;
      rows.push({ key, text, state: open.state, fixOwner: fixOwnerOf(key), lane: open.lane ?? null, since: open.since });
      continue;
    }
    const got = dispatch({ key, text, fixOwner: fixOwnerOf(key) }) ?? {};
    const fix = got.lane ? { state: 'fixing', lane: got.lane } : got.reason ? { state: 'noted', reason: got.reason } : { state: 'dispatching' };
    state.fixes[key] = { ...fix, text, since: now };
    dispatched.push({ key, text, fixOwner: fixOwnerOf(key), state: fix.state });
    rows.push({ key, text, state: fix.state, fixOwner: fixOwnerOf(key), lane: fix.lane ?? null, since: now });
  }
  return { dispatched, rows };
}

/** Record the outcome of the chat's dispatch of one alert. Mutates `state`. */
export function settleFix(state, key, { now, lane = null, reason = null, release = false }) {
  if (release) { const had = Boolean(state.fixes[key]); delete state.fixes[key]; return { key, released: had }; }
  const prev = state.fixes[key];
  if (!prev) throw new Error(`no open alert ${key}: run pass first`);
  state.fixes[key] = lane ? { ...prev, state: 'fixing', lane, since: now } : { ...prev, state: 'noted', reason, since: now };
  return { key, ...state.fixes[key] };
}

function flag(argv, name) { return valueAfter(argv, name); }

async function main(argv = process.argv.slice(2)) {
  const verb = argv[0];
  const file = statePath();
  if (verb === 'status') {
    const state = loadState(file);
    console.log(JSON.stringify({ loop: state.loop, scheduled: state.loop?.status === 'scheduled', live: loopLive(state.loop, Date.now()), fixes: state.fixes }));
    return;
  }
  if (!['setup', 'bind', 'block', 'pass', 'claim', 'note', 'release', 'stop'].includes(verb)) {
    console.log('usage: starci debug pass setup | bind --loop-id <id> --scheduler <kind> --scheduler-id <id> --confirmed | block --loop-id <id> --reason <text> | pass [--loop-id <id>] [--snapshot <file>] | claim --key <k> --lane <lane> | note --key <k> --reason <text> | release --key <k> | stop --loop-id <id> --scheduler-id <id> --confirmation <outcome> --confirmed | status');
    process.exitCode = verb ? 2 : 0;
    return;
  }
  // Use the existing lock primitive under debug's own directory, never the heavy-runtime host lock.
  const out = await withHostLock({ role: 'lead', purpose: 'debug-state', dir: path.join(path.dirname(file), 'state-lock') }, async () => {
    const state = loadState(file);
    const now = Date.now();
    const loopId = flag(argv, '--loop-id');
    const confirmed = argv.includes('--confirmed');
    let result;
    if (verb === 'setup') result = setupLoop(state, { now, settings: coreDebugSettings() });
    else if (verb === 'bind') result = bindLoop(state, { now, loopId, scheduler: flag(argv, '--scheduler'), schedulerId: flag(argv, '--scheduler-id'), confirmed });
    else if (verb === 'block') result = blockLoop(state, { loopId, reason: flag(argv, '--reason') });
    else if (verb === 'stop') result = stopLoop(state, { loopId, schedulerId: flag(argv, '--scheduler-id'), confirmation: flag(argv, '--confirmation'), confirmed });
    else if (verb === 'pass') {
      if (argv.includes('--loop-id')) requireScheduledLoop(state, loopId);
      const fixture = flag(argv, '--snapshot');
      const snap = fixture ? JSON.parse(fs.readFileSync(fixture, 'utf8')) : await snapshot(watchOptions(argv));
      result = { at: snap.at, ok: snap.ok, facts: snap.facts, loop: state.loop?.id ?? null, ...runPass(state, snap, { now, loopId: loopId ?? null, dispatch: (a) => (a.fixOwner === 'owner' ? { reason: 'fix owner: the owner' } : null) }) };
    } else if (verb === 'claim' || verb === 'note' || verb === 'release') {
      const key = flag(argv, '--key');
      if (!key) throw new Error(`${verb} needs --key <alert>`);
      const lane = verb === 'claim' ? flag(argv, '--lane') : null;
      if (verb === 'claim' && !lane) throw new Error('claim needs --lane <lane>');
      result = settleFix(state, key, { now, lane, reason: flag(argv, '--reason') ?? 'no core fix owed', release: verb === 'release' });
    }
    saveState(file, state);
    return result;
  });
  if (out?.ok === false && out.reason === 'held') process.exitCode = 1;
  console.log(JSON.stringify(out));
}

if (isMain(import.meta.url)) await main();
