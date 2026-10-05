#!/usr/bin/env node
import fs from 'node:fs';
import { isMain } from '../lib/is-main.mjs';
import { openMachine, openMachineReader } from '../../engine/db/machine.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
import { snapshot, watchOptions } from './core-watch.mjs';
import { coreDebugProfile } from './core-debug.mjs';
import { seatOf, enabledOf } from '../machine/home.mjs';

export const CLAIM_TTL_MS = 30 * 60_000;

export function requireDiagnosticSeat(m, dispatch, profile = coreDebugProfile()) {
  if (dispatch == null) return;
  const seat = m ? seatOf(m, Date.now(), profile) : null;
  if (!dispatch || !m || enabledOf(m, profile) !== true || seat?.value?.dispatch !== dispatch || seat.value.state === 'launch-unknown' || seat.starting) {
    throw new Error('diagnostic Dispatch does not match an enabled held native maintenance seat');
  }
}

export function loadState(m, profile = coreDebugProfile()) {
  const value = m?.supSignal(profile.stateScope, profile.id)?.value;
  if (value == null) return { fixes: {}, lastPassAt: null };
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.fixes || typeof value.fixes !== 'object' || Array.isArray(value.fixes)) {
    throw new Error('invalid persisted core diagnostic custody');
  }
  return value;
}

export function diagnosticAction(m, verb, input = {}, now = Date.now()) {
  const profile = coreDebugProfile();
  return m.transaction(() => {
    requireDiagnosticSeat(m, input.dispatch, profile);
    const state = loadState(m, profile);
    let result;
    if (verb === 'pass') {
      result = { at: input.snapshot.at, ok: input.snapshot.ok, facts: input.snapshot.facts,
        ...runPass(state, input.snapshot, { now, dispatch: alert => alert.fixOwner === 'owner' ? { reason: 'fix owner: the owner' } : null }) };
      state.lastPassAt = now;
    } else {
      if (!input.key || (verb === 'claim' && !input.lane)) throw new Error('diagnostic action requires its alert key and claim lane');
      result = settleFix(state, input.key, { now, lane: verb === 'claim' ? input.lane : null,
        reason: input.reason ?? 'no core fix owed', release: verb === 'release' });
    }
    m.setSupSignal({ scope: profile.stateScope, key: profile.id, value: state });
    return result;
  });
}

export function fixOwnerOf(key) {
  return /^wf:.*:owner$/.test(key) || key.startsWith('config:') ? 'owner' : 'core';
}

export function runPass(state, snap, { now, dispatch }) {
  const alerts = new Map((snap?.alerts ?? []).map((a) => [a.key, a.text]));
  const healthy = new Set((snap?.observations ?? []).filter((row) => row.state === 'healthy').map((row) => row.key));
  const rows = [];
  for (const [key, fix] of Object.entries(state.fixes)) {
    if (alerts.has(key)) continue;
    if (!healthy.has(key)) {
      rows.push({ key, text: fix.text, state: fix.state, observation: 'unknown', fixOwner: fixOwnerOf(key), lane: fix.lane ?? null, since: fix.since });
      continue;
    }
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

/** Record repair custody or an owner note for one diagnosed alert. Mutates `state`. */
export function settleFix(state, key, { now, lane = null, reason = null, release = false }) {
  if (release) { const had = Boolean(state.fixes[key]); delete state.fixes[key]; return { key, released: had }; }
  const prev = state.fixes[key];
  if (!prev) throw new Error(`no open alert ${key}: run pass first`);
  state.fixes[key] = lane ? { ...prev, state: 'fixing', lane, since: now } : { ...prev, state: 'noted', reason, since: now };
  return { key, ...state.fixes[key] };
}


async function main(argv = process.argv.slice(2)) {
  const verb = argv[0];
  if (verb === 'status') {
    const m = openMachineReader();
    try { console.log(JSON.stringify(loadState(m))); } finally { m?.close(); }
    return;
  }
  if (!['pass', 'claim', 'note', 'release'].includes(verb)) {
    console.error('usage: starci debug pass pass [--snapshot <file>] | claim --key <alert> --lane <lane> | note --key <alert> --reason <text> | release --key <alert> | status');
    process.exitCode = 2;
    return;
  }
  const fixture = valueAfter(argv, '--snapshot');
  const dispatch = valueAfter(argv, '--dispatch');
  if (argv.includes('--dispatch')) {
    const held = openMachineReader();
    try { requireDiagnosticSeat(held, dispatch ?? '', coreDebugProfile()); } finally { held?.close(); }
  }
  const snap = verb === 'pass' ? fixture ? JSON.parse(fs.readFileSync(fixture, 'utf8')) : await snapshot(watchOptions(argv)) : null;
  const m = openMachine();
  try {
    const result = diagnosticAction(m, verb, { snapshot: snap, dispatch, key: valueAfter(argv, '--key'), lane: valueAfter(argv, '--lane'), reason: valueAfter(argv, '--reason') });
    console.log(JSON.stringify(result));
  } finally { m.close(); }
}

if (isMain(import.meta.url)) await main();
