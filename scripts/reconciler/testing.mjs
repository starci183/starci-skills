import path from 'node:path';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';


export function fakeCtx(overrides = {}) {
  const {
    mode = 'shadow', controller = 'test', key = null, now = () => Date.now(), ledgers = [{ ledgerId: 'test', repo: tempRoot(), file: path.join(tempRoot(), 'none.sqlite') }],
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
  const dir = makeTempDir(prefix);
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
