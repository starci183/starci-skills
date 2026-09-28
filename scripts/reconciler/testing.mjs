// scripts/reconciler/testing.mjs — spec helpers for controllers (LANES shared contract).
//
//   fakeCtx(overrides)   a ctx with no child processes and no ledger writes. Every gated call is recorded:
//                          ctx.calls.api   [{ledgerId, verb, argv}]        ctx.calls.run  [{cmd, args}]
//                          ctx.calls.decisions [di]                        ctx.calls.log  [{kind, msg, data}]
//                          ctx.calls.clock [{entity, state, slaMs, meta}]  ctx.calls.clear [{entity, state}]
//                        ctx.api / ctx.run / ctx.openDecision answer {ok: true, shadow: true} in shadow (the default
//                        mode) and `apiResult(call)` / `runResult(call)` / `decisionResult(di)` in active. `status` is a
//                        map `${ledgerId}:${workflowId}` -> value, or a function. `read(ledgerId, fn)` runs fn over
//                        `dbs[ledgerId]` (e.g. a DatabaseSync on a fixture ledger). `owns` defaults to mode === 'active'.
//                        Any other member (read, api, clock, log, ...) passed in `overrides` replaces the default, so a
//                        spec keeps its own recorders and still gets the whole ctx contract (env, stateDb, stateFile,
//                        key, epoch, openReader).
//   tempState()          a reconciler.sqlite in a fresh temp directory: {dir, file, env, db, own(x), close()}; close()
//                        closes every own()ed handle first, then removes the directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openState } from './state.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';

export function fakeCtx(overrides = {}) {
  const {
    mode = 'shadow', controller = 'test', key = null, now = () => Date.now(), ledgers = [{ ledgerId: 'test', repo: os.tmpdir(), file: path.join(os.tmpdir(), 'none.sqlite') }],
    status = {}, dbs = {}, apiResult = () => ({ ok: true, value: { ok: true } }), runResult = () => ({ ok: true, value: { ok: true } }),
    decisionResult = () => ({ ok: true }), owns = null, epoch = 1, env = process.env, stateDb = undefined, stateFile = null, ...rest
  } = overrides;
  const calls = { api: [], run: [], decisions: [], log: [], clock: [], clear: [], status: [] };
  const clocks = new Map();
  const ctx = {
    controller, key, mode, epoch, ledgers, calls, clocks, env, stateFile,
    ...(stateDb !== undefined ? { stateDb } : {}),
    now: typeof now === 'function' ? now : () => now,
    read(ledgerId, fn) { const db = dbs[ledgerId]; return db ? fn(db) : null; },
    openReader: (file) => { throw Error(`fakeCtx.openReader(${file}): pass dbs or an openReader override`); },
    async status(ledgerId, workflowId) {
      calls.status.push({ ledgerId, workflowId });
      return typeof status === 'function' ? status(ledgerId, workflowId) : status[`${ledgerId}:${workflowId}`] ?? null;
    },
    async api(ledgerId, verb, argv = [], options = {}) {
      const call = { ledgerId, verb, argv: [...argv], options };
      calls.api.push(call);
      return mode === 'active' ? apiResult(call) : { ok: true, shadow: true };
    },
    async run(cmd, args = [], options = {}) {
      const call = { cmd, args: [...args], options };
      calls.run.push(call);
      return mode === 'active' ? runResult(call) : { ok: true, shadow: true };
    },
    clock(entity, state, slaMs, meta = {}) {
      calls.clock.push({ entity, state, slaMs, meta });
      const id = `${entity}\u0000${state}`;
      if (!clocks.has(id) || clocks.get(id).clearedAt != null) clocks.set(id, { entity, state, slaMs, meta, enteredAt: ctx.now(), clearedAt: null });
      else clocks.get(id).slaMs = slaMs;
      return true;
    },
    clear(entity, state) {
      calls.clear.push({ entity, state });
      const c = clocks.get(`${entity}\u0000${state}`);
      if (!c || c.clearedAt != null) return false;
      c.clearedAt = ctx.now();
      return true;
    },
    async openDecision(di) {
      calls.decisions.push(di);
      return mode === 'active' ? decisionResult(di) : { ok: true, shadow: true };
    },
    log(kind, msg, data = {}) { calls.log.push({ kind, msg, data }); return { ok: true }; },
    owns(concern) { return typeof owns === 'function' ? owns(concern) : mode === 'active'; },
    ...rest,
  };
  return ctx;
}

/** A reconciler.sqlite in a fresh temp directory. env has STARCI_RECONCILER_STATE pointing at it. */
export function tempState({ prefix = 'starci-reconciler-' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, 'reconciler.sqlite');
  const env = { ...process.env, STARCI_RECONCILER_STATE: file, STARCI_SUPERVISOR_HOME: dir, LOCALAPPDATA: dir };
  const db = openState({ env, file });
  const owned = [];
  return {
    dir, file, env, db,
    /** Close `x` (an engine, a ledger handle) before the directory goes: Windows keeps an open SQLite file. */
    own(x) { owned.push(x); return x; },
    close() {
      for (const x of owned.reverse()) { try { x.close(); } catch { /* closed */ } }
      try { db.close(); } catch { /* closed */ }
      try { safeRemoveTree(dir); } catch { /* best effort */ }
    },
  };
}
