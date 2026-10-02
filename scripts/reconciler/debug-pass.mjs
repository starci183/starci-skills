#!/usr/bin/env node
// starci debug pass — debug-loop state: one loop per host, one pass per tick, one lane per alert.
//
//   starci debug pass setup                     record the chat's /loop unless a live one exists
//   starci debug pass pass [--snapshot <file>]  one pass: core-watch snapshot -> alerts to dispatch
//     [--child-timeout <sec>] [--token-window <min>] [--token-spike <n>]   passed to the core-watch snapshot
//   starci debug pass claim --key <alert> --lane <lane>     a lane now fixes that alert
//   starci debug pass note --key <alert> --reason <text>    diagnosed, no core fix owed while it lasts
//   starci debug pass release --key <alert>                 forget a fix (lane died, fix did not help)
//   starci debug pass stop                                  forget the loop (after the chat ends its /loop)
//   starci debug pass status
// Every verb prints one JSON object. The loop interval is config.yaml claudeDebug.interval (engine/config.mjs
// claudeDebugSettings); code carries no default.
//
// State: <state root>/claude-debug/state.json (engine/db/machine.mjs starciLocalRoot, so STARCI_LOCAL_ROOT moves it). It is
// chat-side bookkeeping, not engine state, so it stays out of machine.sqlite (whose writers are the engine's own):
//   loop   {id, intervalMs, startedAt, lastPassAt} — live while the newer of startedAt/lastPassAt is younger than
//          2 x intervalMs + LOOP_GRACE_MS; a loop whose chat died stops passing and turns stale, and the next setup replaces it.
//   fixes  {<alert key>: {state: dispatching|fixing|noted, text, since, lane?, reason?}} — keyed by the core-watch fact key
//          (its text carries changing numbers). An alert with a fix is never dispatched again; a fix closes when its alert
//          clears; a `dispatching` reservation nobody claimed within CLAIM_TTL_MS is dispatched again.
// It never restarts, fixes or types into anything; dispatch is the chat's (a lane agent), recorded here with `claim`.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { starciLocalRoot } from '../../engine/db/machine.mjs';
import { claudeDebugSettings } from '../../engine/config.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { renameOver } from '../api/fs/rename-over.mjs';
import { snapshot, watchOptions } from './core-watch.mjs';

export const LOOP_GRACE_MS = 5 * 60_000;
export const CLAIM_TTL_MS = 30 * 60_000;

/** The state file of this host (or of STARCI_LOCAL_ROOT). */
export const statePath = (env = process.env) => path.join(starciLocalRoot(env), 'claude-debug', 'state.json');

/** The state in `file`, or an empty one. */
export function loadState(file) {
  const s = readJsonFile(file, null);
  return { loop: s?.loop ?? null, fixes: s?.fixes && typeof s.fixes === 'object' ? s.fixes : {} };
}

/** Replace `file` whole with `state`. */
export function saveState(file, state) {
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
  if (!loop?.id || !(loop.intervalMs > 0)) return false;
  return now - Math.max(Number(loop.startedAt) || 0, Number(loop.lastPassAt) || 0) <= 2 * loop.intervalMs + LOOP_GRACE_MS;
}

/**
 * Setup (`settings` = claudeDebugSettings(): {interval, intervalMs}): a live loop is kept and nothing is created; otherwise `startLoop(loop)` runs once and the new record replaces
 * a stale one. Returns {created, loop, replaced}. Mutates `state`.
 */
export function setupLoop(state, { now, settings, startLoop = () => {} }) {
  if (loopLive(state.loop, now)) return { created: false, loop: state.loop, replaced: null };
  const replaced = state.loop ?? null;
  const loop = { id: `loop-${now.toString(36)}`, interval: settings.interval, intervalMs: settings.intervalMs, startedAt: now, lastPassAt: null };
  startLoop(loop);
  state.loop = loop;
  return { created: true, loop, replaced };
}

/**
 * One pass over a core-watch snapshot. Closes the fixes whose alert cleared, calls `dispatch(alert)` once for every alert
 * with no open fix (or an unclaimed reservation past CLAIM_TTL_MS) and records what it returns ({lane} fixing,
 * {reason} noted, anything else a `dispatching` reservation). Returns {dispatched, rows}. Mutates `state`.
 */
export function runPass(state, snap, { now, dispatch }) {
  if (state.loop) state.loop.lastPassAt = now;
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

function flag(argv, name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] ?? null : null; }

async function main(argv = process.argv.slice(2)) {
  const verb = argv[0];
  const file = statePath();
  const state = loadState(file);
  const now = Date.now();
  let out;
  if (verb === 'setup') out = setupLoop(state, { now, settings: claudeDebugSettings() });
  else if (verb === 'pass') {
    const fixture = flag(argv, '--snapshot');
    const snap = fixture ? JSON.parse(fs.readFileSync(fixture, 'utf8')) : await snapshot(watchOptions(argv));
    out = { at: snap.at, ok: snap.ok, facts: snap.facts, loop: state.loop?.id ?? null, ...runPass(state, snap, { now, dispatch: (a) => (a.fixOwner === 'owner' ? { reason: 'fix owner: the owner' } : null) }) };
  } else if (verb === 'claim' || verb === 'note' || verb === 'release') {
    const key = flag(argv, '--key');
    if (!key) throw new Error(`${verb} needs --key <alert>`);
    const lane = verb === 'claim' ? flag(argv, '--lane') : null;
    if (verb === 'claim' && !lane) throw new Error('claim needs --lane <lane>');
    out = settleFix(state, key, { now, lane, reason: flag(argv, '--reason') ?? 'no core fix owed', release: verb === 'release' });
  } else if (verb === 'stop') { out = { stopped: state.loop?.id ?? null }; state.loop = null; }
  else if (verb === 'status') out = { loop: state.loop, live: loopLive(state.loop, now), fixes: state.fixes };
  else { console.log('usage: starci debug pass setup | pass [--snapshot <file>] | claim --key <k> --lane <lane> | note --key <k> --reason <text> | release --key <k> | stop | status'); process.exitCode = verb ? 2 : 0; return; }
  if (verb !== 'status') saveState(file, state);
  console.log(JSON.stringify(out));
}

if (isMain(import.meta.url)) await main();
