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
//                        spec keeps its own recorders and still gets the whole ctx contract (env, machine, stateDb,
//                        stateFile, key, epoch, openReader).
//   tempState()          a machine.sqlite in a fresh temp directory: {dir, file, env, m, db (= m), own(x), close()}; env
//                        names it (STARCI_TEST_MACHINE_FILE); close() closes every own()ed handle first, then removes
//                        the directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';

/** The shared controller contract, asserted once per controller spec: the module names itself, owns its
 *  concerns, routes its declared event to its duty key, and ships a reconcile function. */
export function controllerContract(controller, { name, concerns, routeKey, routeEvent = {}, duty }) {
  assert.equal(controller.name, name);
  assert.deepEqual(controller.concerns, concerns);
  assert.equal(typeof controller.reconcile, 'function');
  assert.equal(controller.routes[routeKey](routeEvent), duty);
}

export function fakeCtx(overrides = {}) {
  const {
    mode = 'shadow', controller = 'test', key = null, now = () => Date.now(), ledgers = [{ ledgerId: 'test', repo: os.tmpdir(), file: path.join(os.tmpdir(), 'none.sqlite') }],
    status = {}, dbs = {}, apiResult = () => ({ ok: true, value: { ok: true } }), runResult = () => ({ ok: true, value: { ok: true } }),
    decisionResult = () => ({ ok: true }), owns = null, epoch = 1, env = process.env, machine = undefined, stateDb = undefined, stateFile = null, ...rest
  } = overrides;
  const calls = { api: [], run: [], decisions: [], log: [], clock: [], clear: [], status: [] };
  const clocks = new Map();
  const ctx = {
    controller, key, mode, epoch, ledgers, calls, clocks, env, stateFile,
    ...(machine !== undefined ? { machine, stateDb: machine?.db ?? null, stateFile: stateFile ?? machine?.file ?? null } : {}),
    ...(stateDb !== undefined ? { stateDb } : {}),
    now: typeof now === 'function' ? now : () => now,
    read(ledgerId, fn) { const db = dbs[ledgerId]; return db ? fn(db) : null; },
    openReader: (file) => { throw new Error(`fakeCtx.openReader(${file}): pass dbs or an openReader override`); },
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

/** A machine.sqlite in a fresh temp directory; env names it (STARCI_TEST_MACHINE_FILE). `m` (also `db`) is a writer on it. */
export function tempState({ prefix = 'starci-reconciler-' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, 'machine.sqlite');
  const env = { ...process.env, [TEST_REGISTRY_ENV]: file, STARCI_LOCAL_ROOT: dir, STARCI_LANES_ROOT: path.join(dir, 'lanes') };
  const m = openMachine({ env, file });
  const db = m;
  const owned = [];
  return {
    dir, file, env, m, db,
    /** Close `x` (an engine, a ledger handle) before the directory goes: Windows keeps an open SQLite file. */
    own(x) { owned.push(x); return x; },
    close() {
      for (const x of owned.toReversed()) { try { x.close(); } catch { /* closed */ } }
      try { db.close(); } catch { /* closed */ }
      try { safeRemove(dir, { hold: artifactHoldReason }); } catch { /* best effort */ }
    },
  };
}
