// scripts/reconciler/engine.mjs — the ONE reconciler process of the host (DESIGN §7; contract modules/reconciler/reconciler.yaml).
//
// It runs the file-discovered controllers (scripts/reconciler/controllers/*.mjs, discovered like the api verbs of
// scripts/kernel/api-extensions.mjs) level-triggered and idempotently:
//   - leader: the host lock claimManager('reconciler') (scripts/connectors/lib.mjs) AND the machine.sqlite
//     `engine_leader` row with an incrementing epoch (every epoch a leader_history row: how it was acquired, why it was
//     released), renewed every allocation.reconciler.renewMs, lost after leaseMs. A second engine stands by and takes
//     over (epoch + 1) once the row expires. Every mutation is fenced on the epoch (ctx.mjs); a leader that loses the
//     row stops and exits (DESIGN §7.5, §12.3);
//   - heartbeat: engine_leader.heartbeat_at (+ draining) and this process's process_runs.last_heartbeat_at, every
//     renewMs (owns.mjs, boot.mjs ensure). Every start and exit of the engine is a process_runs row (role engine:
//     start_reason, exit_reason, heartbeat age at the end; MB-04, G1); its log lines are machine_logs actor
//     'reconciler'. Its ONE machine.sqlite connection is the WAL checkpointer (openMachine checkpointer, checkpoint()
//     every CHECKPOINT_MS);
//   - self-reload (scripts/machine/self-reload.mjs): a new runtime HEAD that changed a file under RELOAD_HEAD_PATHS, or a
//     changed engine file, re-execs the engine and hands the lock and the leader row over. While it drains for the
//     reload, a timer keeps renewing the lease and the heartbeat says `draining`, so boot.mjs ensure leaves it alone
//     and the engine's own actions are never fenced by its own lease (MB-04);
//   - per controller: mode from config.yaml reconciler.controllers.<name>.mode (off | shadow | active; --safe runs
//     every active one as shadow), resyncMs / concurrency / timeoutMs from the module, overridden by
//     modules/reconciler/<name>.yaml;
//   - sources.mjs events cursor every pollMs -> routes -> workqueue.mjs; the periodic resync lists every key;
//   - one reconcile per key at a time, try/catch per reconcile, a time budget (over budget: logged, the slot stays
//     taken until it ends), exponential backoff on failure; one throwing controller never stops the others;
//   - the SLA layer: scripts/reconciler/sla.mjs slaPass(ctx) every SLA_PASS_MS when that module exists, and the Decision
//     Item ladder scripts/machine/decisions.mjs escalateDue every ESCALATE_MS (apply only when the workflow
//     controller is active and this engine holds the epoch; otherwise it plans);
//   - ONE ctx object per (controller, mode): the key being reconciled rides an AsyncLocalStorage (ctx.key), so a
//     controller may keep per-ctx memory; a thrown error with retryAfterMs is requeued after that delay.
// A controller module that fails to load is logged and skipped.
//
// Internal args (spawned by boot.mjs): [--safe] | --once [--controller x] [--key k] [--apply] [--json].
//        one pass: every non-off controller (or the named one) lists and reconciles its keys once; shadow unless
//        --apply, which first takes the lead (refused while another leader is live).
import '../api/process/hide-child-windows.mjs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTROLLERS as MACHINE_CONTROLLERS, openMachine } from '../../engine/db/machine.mjs';
import { claimOrTakeOver, lockHolder, reassertManager } from '../connectors/lib.mjs';
import { createReloadWatch, reexecSelf, RELOAD_ENV, runtimeHead } from '../machine/self-reload.mjs';
import { setPriority } from '../api/process/set-priority.mjs';
import { crashLoopPlan, crashLoopRecord } from './boot.mjs';
import { DEFAULT_STALL_MAX_MS, startHeartbeatWorker } from './heartbeat-worker.mjs';
import { DECISIONS_FILE, createCtx, logRowOf, reconcilerLog, spawnJson } from './ctx.mjs';
import { ledgersOf, pollAll } from './sources.mjs';
import { CONCERN_OWNER } from './owns.mjs';
import {
  CONTROLLER_NAMES, LEADER_NAME, MODES, SKILL_ROOT, START_REASON_ENV, configuredMode, controllerModule, reconcilerConfig, reconcilerNumbers,
} from './state.mjs';
import { WorkQueue, machineRows, memoryRows } from './workqueue.mjs'; import { isMain } from '../lib/is-main.mjs';
import { readEnv } from '../lib/env.mjs';
import { positiveNumber } from '../lib/number.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
const CONTROLLERS_DIR = path.join(SKILL_ROOT, 'scripts', 'reconciler', 'controllers');
export const SLA_FILE = path.join(SKILL_ROOT, 'scripts', 'reconciler', 'sla.mjs');
const LOCK_NAME = 'reconciler';
const SLA_PASS_MS = 30_000;
/** The Decision Item SLA ladder (scripts/machine/decisions.mjs escalateDue) runs this often; applied only when active. */
const ESCALATE_MS = 60_000;
const CONFIG_REFRESH_MS = 10_000;
const RELOAD_CHECK_MS = 60_000;
export const DEFAULTS = Object.freeze({ resyncMs: 60_000, concurrency: 1, timeoutMs: 300_000 });
/** An intent/running action older than this, from an earlier epoch, is `unknown` (DESIGN §7.6). */
const STALE_ACTION_MS = 150_000;
/** The engine's connection checkpoints machine.sqlite's WAL this often (PASSIVE; it is the one checkpointer). */
const CHECKPOINT_MS = 60_000;
const selfFile = fileURLToPath(import.meta.url);

/**
 * Discover the controller modules of `dir`: [{name, file, module}] and the load errors [{file, error}].
 * A module must default-export {name == file name, reconcile()}; anything else is a load error.
 */
export async function discoverControllers(dir = CONTROLLERS_DIR) {
  const controllers = [], errors = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort(); }
  catch (error) { return { controllers, errors: [{ file: dir, name: null, error: `controller inventory unreadable: ${String(error?.message ?? error).slice(0, 300)}` }] }; }
  for (const f of files) {
    const file = path.join(dir, f);
    const name = f.replace(/\.mjs$/, '');
    try {
      const mod = (await import(pathToFileURL(file).href)).default;
      if (!mod || typeof mod !== 'object') throw Error('no default export');
      if (mod.name !== name) throw Error(`name '${mod.name}' is not the file name '${name}'`);
      if (typeof mod.reconcile !== 'function') throw Error('reconcile() missing');
      controllers.push({ name, file, module: mod });
    } catch (error) { errors.push({ file, name, error: String(error?.message ?? error).slice(0, 400) }); }
  }
  return { controllers, errors };
}

export class Engine {
  constructor({
    env = process.env, now = Date.now, controllersDir = CONTROLLERS_DIR, controllers = null, safe = false, apply = true,
    numbers = null, config = null, ledgers = null, state = null, stateOptions = {}, holder = null,
    claimLock = (from) => claimOrTakeOver(LOCK_NAME, { from, env }), handoverFrom = null,
    spawnChild = spawnJson, writeLog = (row) => reconcilerLog(this.state, row, { env }), reader = undefined, slaModule = undefined, print = (line) => console.log(line),
    rev = null, loadDecisions = undefined, memoryQueue = false, processRunId = null, echo = false,
  } = {}) {
    this.env = env;
    this.now = now;
    this.controllersDir = controllersDir;
    this.injected = controllers; // [{name, module}] (specs) instead of discovery
    this.safe = safe;
    this.apply = apply;
    this.numbers = numbers ?? reconcilerNumbers();
    this.configFn = typeof config === 'function' ? config : () => (config ?? reconcilerConfig());
    this.ledgersFn = typeof ledgers === 'function' ? ledgers : () => ledgers ?? ledgersOf({ env });
    // The engine's ONE machine.sqlite connection, the WAL checkpointer (engine/db/machine.mjs openMachine).
    this.state = state ?? openMachine({ env, now, checkpointer: true, ...stateOptions });
    this.stateFile = this.state.file ?? null;
    this.ownsState = !state;
    this.processRunId = processRunId;
    this.echo = echo;
    this.holder = holder ?? `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString('hex')}`;
    this.claimLock = claimLock;
    this.handoverFrom = handoverFrom;
    this.spawnChild = spawnChild;
    this.writeLog = writeLog;
    this.reader = reader;
    this.slaModule = slaModule;
    this.loadDecisions = loadDecisions;
    this.print = print;
    this.rev = rev;
    // --once keeps its queue in memory, so a debugging pass never takes a live engine's queued keys.
    this.queue = new WorkQueue({ rows: memoryQueue ? memoryRows() : machineRows(this.state), now, backoff: this.numbers.backoff });
    this.shared = { statusCache: new Map(), wouldSeen: new Map() };
    this.controllers = []; // [{name, module, mode, resyncMs, concurrency, timeoutMs, lastResyncAt}]
    this.loadErrors = [];
    this.modes = {};
    this.epoch = 0;
    this.leader = false;
    this.lock = null;
    this.stopped = false;
    this.lost = false;
    this.draining = false;
    this.running = new Set();
    // The heartbeat worker (heartbeat-worker.mjs, started by main()): carries the lease and the heartbeat while a synchronous
    // duty blocks this thread. null in specs and --once (the timers below are then the only renewal).
    this.hb = null;
    this.runningLabels = new Set();
    this.timers = { renewAt: 0, pollAt: 0, configAt: 0, slaAt: 0, staleAt: 0, escalateAt: 0, checkpointAt: 0 };
    this.als = new AsyncLocalStorage();
    this.ctxCache = new Map();
    this.ledgers = [];
  }

  /** One machine_logs row (actor reconciler); printed only when --once echoes or the row could not be written. */
  log(kind, msg, data = {}) {
    let written = false;
    try { written = this.writeLog(logRowOf('engine', kind, msg, data)) !== false; } catch { written = false; }
    if (this.echo || !written) this.print(`[reconciler ${new Date(this.now()).toISOString()}] ${msg}`);
  }

  /** Discover (or take the injected) controllers and apply config modes and module numbers. */
  async load() {
    let found;
    if (this.injected) found = { controllers: this.injected.map((c) => ({ name: c.name ?? c.module?.name, module: c.module ?? c })), errors: [] };
    else found = await discoverControllers(this.controllersDir);
    this.loadErrors = found.errors;
    for (const e of found.errors) this.log('reconciler.error', `controller ${e.name} failed to load: ${e.error}`, { kind: 'reconciler.controller-load-failed', name: e.name, detail: e.error });
    this.controllers = found.controllers.map(({ name, module }) => {
      const yaml = controllerModule(name);
      return { name, module, mode: 'off', lastResyncAt: 0,
        resyncMs: positiveNumber(yaml.resyncMs, positiveNumber(module.resyncMs, DEFAULTS.resyncMs)),
        concurrency: positiveNumber(yaml.concurrency, positiveNumber(module.concurrency, DEFAULTS.concurrency)),
        timeoutMs: positiveNumber(yaml.timeoutMs, positiveNumber(module.timeoutMs, DEFAULTS.timeoutMs)) };
    });
    this.refreshConfig();
    return this;
  }

  /** Re-read config.yaml reconciler and the ledgers; compute the effective modes (safe: active -> shadow). */
  refreshConfig() {
    let conf;
    try { conf = this.configFn(); } catch { conf = { enabled: false, controllers: {} }; }
    const modes = {};
    for (const name of new Set([...CONTROLLER_NAMES, ...this.controllers.map((c) => c.name)])) {
      let mode = configuredMode(name, conf);
      if (!MODES.includes(mode)) mode = MODES[0];
      if ((this.safe || !this.apply) && mode === 'active') mode = 'shadow';
      modes[name] = mode;
    }
    for (const c of this.controllers) {
      if (c.mode === 'off' && modes[c.name] !== 'off') c.lastResyncAt = 0; // a controller turned on resyncs at once
      c.mode = modes[c.name];
    }
    this.modes = modes;
    try { this.ledgers = this.ledgersFn(); } catch { this.ledgers = this.ledgers ?? []; }
    if (this.leader) this.writeModes();
  }

  /**
   * Record the EFFECTIVE mode of each controller in controller_modes; a change is a mode_changes row first (who and why,
   * G6). The engine never chooses a mode: it records what config.yaml (and --safe / --once) make effective.
   */
  writeModes() {
    try {
      this.state.transaction(() => {
        for (const [name, mode] of Object.entries(this.modes)) {
          if (!MACHINE_CONTROLLERS.includes(name)) continue;
          const configured = configuredMode(name, (() => { try { return this.configFn(); } catch { return { enabled: false, controllers: {} }; } })());
          const reason = mode !== configured ? `${this.safe ? 'safe mode' : 'no --apply'}: configured ${configured} runs ${mode}` : `config.yaml reconciler.controllers.${name}.mode`;
          this.state.setControllerMode({ controller: name, mode, by: `engine:${this.holder}`, reason });
        }
      });
    } catch (error) { this.log('reconciler.error', `modes write failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.modes-write-failed' }); }
  }

  /** Try to become the leader. {ok, epoch} or {ok:false, standby: reason}. */
  acquire() {
    if (!this.lock) {
      let held;
      try { held = this.claimLock(this.handoverFrom); } catch (error) { held = { ok: false, error: String(error?.message ?? error) }; }
      if (!held?.ok) return { ok: false, standby: held?.holder?.pid ? `lock held by pid ${held.holder.pid}` : held?.error ?? 'lock held' };
      this.lock = held;
    }
    const now = this.now();
    const { leaseMs } = this.numbers;
    const handoverPid = Number(this.handoverFrom) || null;
    // acquireLeader: a fresh or expired lease is taken with epoch + 1 and a leader_history row (fresh | takeover-stale |
    // handover; the previous epoch's row is closed as reload | lost); the holder's own row is renewed.
    const out = this.state.transaction(() => {
      const row = this.state.leaderOf(LEADER_NAME);
      const handover = Boolean(handoverPid && row && row.pid === handoverPid && row.holder !== this.holder);
      const r = this.state.acquireLeader({ name: LEADER_NAME, holder: this.holder, pid: process.pid, leaseMs, rev: this.rev ?? undefined, processRunId: this.processRunId, handover });
      if (!r.leader) return { ok: false, standby: `leader ${row?.holder ?? r.holder} epoch ${r.epoch} until ${row ? new Date(row.expires_at).toISOString() : '?'}` };
      return { ok: true, epoch: Number(r.epoch), tookOver: !r.renewed && Boolean(row) };
    });
    if (out.ok) {
      const first = !this.leader;
      this.leader = true;
      this.lost = false;
      this.epoch = out.epoch;
      this.timers.renewAt = now + this.numbers.renewMs;
      this.hb?.notify({ leader: true, epoch: this.epoch, holder: this.holder, runId: this.processRunId, draining: this.draining });
      if (first) {
        // A new leader's first checkpoint waits a full period: the engine it took over from may have just checkpointed,
        // and two checkpoints back to back while a land writes is the WAL-reset bug window (SQLite < 3.51.3).
        this.timers.checkpointAt = now + CHECKPOINT_MS;
        this.markStaleActions({ all: true });
        this.writeModes();
        this.heartbeat();
        this.log('reconciler.event', `leader ${this.holder} epoch ${out.epoch}${out.tookOver ? ' (took over)' : ''}${this.safe ? ' SAFE MODE' : ''}`, { kind: 'reconciler.leader-acquired', epoch: out.epoch, safe: this.safe });
      }
    }
    return out;
  }

  /** Renew the leader row; false (and lost) when it no longer names this engine at this epoch. */
  renew() {
    const now = this.now();
    let changes = 0;
    try {
      const row = this.state.leaderOf(LEADER_NAME);
      changes = row?.holder === this.holder && this.state.renewLeader({ name: LEADER_NAME, epoch: this.epoch, leaseMs: this.numbers.leaseMs, draining: this.draining }) ? 1 : 0;
    } catch (error) { this.print(`[reconciler] renew failed: ${error?.message ?? error}`); return true; } // busy: retry next tick
    if (!changes) {
      this.leader = false;
      this.lost = true;
      this.hb?.notify({ leader: false });
      this.log('reconciler.event', `leadership lost at epoch ${this.epoch}`, { kind: 'reconciler.leader-lost', epoch: this.epoch });
      return false;
    }
    this.timers.renewAt = now + this.numbers.renewMs;
    this.heartbeat();
    return true;
  }

  /** The fence: this engine's epoch is still the leader's, and the lease has not run out. */
  isCurrentEpoch() {
    try {
      const row = this.state.leaderOf(LEADER_NAME);
      if (!row || row.holder !== this.holder || Number(row.epoch) !== this.epoch) return false;
      if (row.expires_at > this.now()) return true;
      // MB-04: the row still names this engine at this epoch, so nobody took over; an expired lease of its own never
      // fences its own action: renew it now (the conditional UPDATE fails if another engine got there first).
      return this.leader && !this.stopped && this.renew();
    } catch { return false; }
  }

  /** This process's process_runs heartbeat (+ draining_since while it drains); engine_leader.heartbeat_at is renew()'s. */
  heartbeat() {
    try { if (this.processRunId != null) this.state.heartbeatProcessRun(this.processRunId, { draining: this.draining }); } catch { /* best effort */ }
  }

  /** intent/running actions of an earlier epoch (or, at acquire, of any other process) past STALE_ACTION_MS -> unknown. */
  markStaleActions({ all = false } = {}) {
    try {
      const cutoff = this.now() - STALE_ACTION_MS;
      const n = all
        ? this.state.db.prepare("UPDATE engine_actions SET state='unknown', finished_at=? WHERE state IN ('intent','running') AND (epoch IS NULL OR epoch<? OR COALESCE(started_at,0)<?)").run(this.now(), this.epoch, cutoff).changes
        : this.state.db.prepare("UPDATE engine_actions SET state='unknown', finished_at=? WHERE state IN ('intent','running') AND epoch<? AND COALESCE(started_at,0)<?").run(this.now(), this.epoch, cutoff).changes;
      if (n) this.log('reconciler.event', `${n} stale action(s) marked unknown (re-evaluated from the ledger, never replayed)`, { kind: 'reconciler.actions-unknown', count: n });
      return n;
    } catch { return 0; }
  }

  /** Release the leader row (leader_history closes with `reason`: stop | crash | killed | ...); the next engine takes a fresh lease. */
  release({ reason = 'stop' } = {}) {
    try {
      const row = this.state.leaderOf(LEADER_NAME);
      if (row?.holder === this.holder && Number(row.epoch) === this.epoch) this.state.releaseLeader({ name: LEADER_NAME, epoch: this.epoch, reason });
    } catch { /* best effort */ }
    this.leader = false;
    this.hb?.notify({ leader: false });
    try { this.lock?.release?.(); } catch { /* best effort */ }
    this.lock = null;
  }

  /** The one ctx of (controller, mode); its key is the reconcile running in this async context. */
  ctxFor(c, mode = c.mode) {
    const m = mode === 'active' ? 'active' : 'shadow';
    const id = `${c.name}|${m}`;
    if (this.ctxCache.has(id)) return this.ctxCache.get(id);
    const ctx = createCtx({
      controller: c.name, mode: m, key: () => this.als.getStore()?.key ?? null, state: this.state, stateFile: this.stateFile, epoch: () => this.epoch,
      ledgers: () => this.ledgers, numbers: this.numbers, modes: () => this.modes, env: this.env, now: this.now, shared: this.shared,
      isCurrentEpoch: () => this.isCurrentEpoch(), spawnChild: this.spawnChild, writeLog: this.writeLog,
      ...(this.reader ? { reader: this.reader } : {}), ...(this.loadDecisions ? { loadDecisions: this.loadDecisions } : {}),
    });
    this.ctxCache.set(id, ctx);
    return ctx;
  }

  /** Poll the events of every ledger and queue the routed keys (non-off controllers only). */
  pollSources() {
    const on = this.controllers.filter((c) => c.mode !== 'off').map((c) => ({ name: c.name, routes: c.module.routes }));
    const out = pollAll(this.state, this.ledgers, on, { now: this.now(), ...(this.reader ? { reader: this.reader } : {}) });
    for (const r of out.routed) this.queue.add(r.controller, r.key, { reason: r.reason });
    return out;
  }

  /** Queue every key of each non-off controller whose resync is due. */
  async resyncDue({ force = false } = {}) {
    const now = this.now();
    for (const c of this.controllers) {
      if (c.mode === 'off' || typeof c.module.list !== 'function') continue;
      if (!force && now - c.lastResyncAt < c.resyncMs) continue;
      c.lastResyncAt = now;
      try {
        const keys = await this.als.run({ key: null }, () => c.module.list(this.ctxFor(c)));
        for (const key of Array.isArray(keys) ? keys : []) this.queue.add(c.name, key, { reason: 'resync' });
      } catch (error) {
        this.log('reconciler.error', `${c.name} list() failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.list-failed', name: c.name, detail: String(error?.message ?? error).slice(0, 600) });
      }
    }
  }

  /** One reconcile of (controller, key) with try/catch and the time budget; marks the queue done/failed. */
  async reconcileOne(c, item, { mode = c.mode } = {}) {
    const started = this.now();
    let overBudget = null;
    const label = `${c.name} ${item.key}`;
    this.runningLabels.add(label);
    this.hb?.phase(`reconcile ${label}`);
    this.hb?.running(this.runningLabels);
    const ctx = this.ctxFor(c, mode);
    const work = this.als.run({ key: item.key }, async () => c.module.reconcile(item.key, ctx));
    const budget = setTimeout(() => {
      overBudget = true;
      this.log('reconciler.event', `${c.name} ${item.key} over its ${c.timeoutMs}ms budget (still running)`, { kind: 'reconciler.over-budget', name: c.name, key: item.key });
    }, c.timeoutMs);
    budget.unref?.();
    try {
      const result = await work;
      if (result?.ok === false) {
        throw Object.assign(Error(result.error ?? result.reason ?? `controller returned ${result.action ?? 'ok:false'}`),
          { result, ...(Number.isFinite(Number(result.retryAfterMs)) ? { retryAfterMs: Number(result.retryAfterMs) } : {}) });
      }
      this.queue.done(c.name, item.key);
      // A known wait (a grace window, a busy owner step) is not a failure: the key comes back at that time, no error row.
      const wait = Number(result?.requeueAfterMs);
      if (Number.isFinite(wait) && wait > 0) this.queue.add(c.name, item.key, { reason: 'wait', dueAt: this.now() + wait });
      return { ok: true, key: item.key, result: result ?? null, ms: this.now() - started, ...(overBudget ? { overBudget } : {}) };
    } catch (error) {
      const delay = this.queue.failed(c.name, item.key, error);
      const attempts = (item.attempts ?? 0) + 1;
      if ((attempts & (attempts - 1)) === 0) {
        this.log('reconciler.error', `${c.name} ${item.key} failed (attempt ${attempts}, retry in ${delay}ms): ${String(error?.message ?? error).slice(0, 300)}`,
          { kind: 'reconciler.reconcile-failed', name: c.name, key: item.key, attempts, detail: String(error?.stack ?? error).slice(0, 800) });
      }
      return { ok: false, key: item.key, error: String(error?.message ?? error), retryMs: delay, ...(error?.result ? { result: error.result } : {}) };
    } finally { clearTimeout(budget); this.runningLabels.delete(label); this.hb?.running(this.runningLabels); }
  }

  /** Hand the due keys to their controllers, within each controller's concurrency. Each launched reconcile tracks itself in this.running and a rejection that escapes reconcileOne is logged, never unhandled; returns how many were launched. */
  dispatch() {
    let started = 0;
    for (const c of this.controllers) {
      if (c.mode === 'off') continue;
      for (const item of this.queue.take(c.name, c.concurrency)) {
        const p = this.reconcileOne(c, item).catch((error) => this.log('reconciler.error', `${c.name} ${item.key} reconcile crashed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.reconcile-failed', name: c.name, key: item.key, detail: String(error?.stack ?? error).slice(0, 800) })).finally(() => this.running.delete(p));
        this.running.add(p);
        started += 1;
      }
    }
    return started;
  }

  /** The SLA layer (scripts/reconciler/sla.mjs slaPass), when it exists. */
  async slaPass() {
    let mod = this.slaModule;
    if (mod === undefined) {
      try { mod = fs.existsSync(SLA_FILE) ? await import(pathToFileURL(SLA_FILE).href) : null; } catch (error) {
        mod = null;
        this.log('reconciler.error', `sla.mjs failed to load: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.controller-load-failed', name: 'sla', detail: String(error?.message ?? error).slice(0, 600) });
      }
    }
    if (typeof mod?.slaPass !== 'function') return null;
    const mode = this.modes[CONCERN_OWNER['sla.report']] === 'active' ? 'active' : 'shadow';
    try { return await this.als.run({ key: null }, () => mod.slaPass(this.ctxFor({ name: 'sla', module: mod }, mode))); } catch (error) {
      this.log('reconciler.error', `slaPass failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.reconcile-failed', name: 'sla', detail: String(error?.stack ?? error).slice(0, 800) });
      return null;
    }
  }

  /**
   * The Decision Item SLA ladder (scripts/machine/decisions.mjs escalateDue, lane rc-decisions): applied only when
   * the workflow controller is active and this engine holds the epoch; otherwise a plan (logged when it has actions).
   */
  async escalatePass() {
    let mod = this.decisionsModule;
    if (mod === undefined) {
      try { mod = this.loadDecisions ? await this.loadDecisions() : fs.existsSync(DECISIONS_FILE) ? await import(pathToFileURL(DECISIONS_FILE).href) : null; } catch { mod = null; }
      this.decisionsModule = mod;
    }
    if (typeof mod?.escalateDue !== 'function') return null;
    const apply = this.modes[CONCERN_OWNER['workflow.progress']] === 'active' && this.isCurrentEpoch();
    try {
      const r = await mod.escalateDue({ now: this.now(), apply, repos: this.ledgers.filter((l) => l.ledgerId !== 'supervisor').map((l) => l.repo), env: this.env });
      const n = r?.actions?.length ?? 0;
      if (n) this.log(apply ? 'reconciler.act' : 'reconciler.would', `decisions ladder: ${n} ${apply ? 'escalated' : 'would escalate'}`,
        { verb: 'decisions escalateDue', ...(apply ? { ok: true } : { mode: 'shadow' }), detail: JSON.stringify(r.actions.slice(0, 10)).slice(0, 900) });
      return r;
    } catch (error) {
      this.log('reconciler.error', `escalateDue failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.escalate-failed', detail: String(error?.stack ?? error).slice(0, 800) });
      return null;
    }
  }

  /** One loop iteration. Returns {leader, lost?}. */
  async step() {
    const now = this.now();
    if (!this.leader) {
      if (now >= this.timers.renewAt) {
        const got = this.acquire();
        if (!got.ok) { this.timers.renewAt = now + this.numbers.renewMs; return { leader: false, standby: got.standby }; }
      } else return { leader: false };
    }
    if (now >= this.timers.renewAt && !this.renew()) return { leader: false, lost: true };
    const phase = (label) => this.hb?.phase(label);
    if (now >= this.timers.configAt) { this.timers.configAt = now + CONFIG_REFRESH_MS; phase('refreshConfig'); this.refreshConfig(); }
    if (now >= this.timers.staleAt) { this.timers.staleAt = now + 60_000; phase('markStaleActions'); this.markStaleActions(); }
    if (now >= this.timers.pollAt) { this.timers.pollAt = now + this.numbers.pollMs; phase('pollSources'); this.pollSources(); }
    phase('resyncDue');
    await this.resyncDue();
    phase('dispatch');
    this.dispatch();
    if (now >= this.timers.slaAt) { this.timers.slaAt = now + SLA_PASS_MS; phase('slaPass'); await this.slaPass(); }
    if (now >= this.timers.escalateAt) { this.timers.escalateAt = now + ESCALATE_MS; phase('escalatePass'); await this.escalatePass(); }
    phase('idle');
    if (this.state.checkpointer && now >= this.timers.checkpointAt) {
      this.timers.checkpointAt = now + CHECKPOINT_MS;
      phase('checkpoint');
      // fenced on the leader row: a superseded or expired engine gets {skipped} and checkpoints nothing
      try { this.state.checkpoint({ name: LEADER_NAME, holder: this.holder, epoch: this.epoch }); } catch (error) { this.log('reconciler.error', `checkpoint failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.checkpoint-failed' }); }
    }
    return { leader: true };
  }

  /** Wait for every running reconcile; the heartbeat says `draining` meanwhile (boot.mjs ensure leaves it alone). */
  async drain() {
    this.draining = true;
    this.hb?.notify({ draining: true });
    if (this.leader) this.renew();
    try { while (this.running.size) await Promise.allSettled([...this.running]); }
    finally { this.draining = false; this.hb?.notify({ draining: false }); if (this.leader) this.renew(); }
  }

  /** The long-lived loop: until stop(), a lost lead, or a reload handed over. */
  async run({ sleep = (ms) => new Promise((r) => setTimeout(r, ms)), tickMs = Math.min(500, this.numbers.pollMs), watch = null, reload = null } = {}) {
    let reloadCheckAt = this.now() + RELOAD_CHECK_MS;
    // The lease and the heartbeat are the heartbeat worker's (heartbeat-worker.mjs, its own thread and connection): no duty,
    // drain or synchronous block of this thread can lapse them. This timer only proves to the worker that this thread lives.
    const renewal = setInterval(() => this.hb?.touch(), 1000);
    try {
      while (!this.stopped) {
        let r;
        try { r = await this.step(); } catch (error) { this.log('reconciler.error', `step failed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.step-failed', detail: String(error?.stack ?? error).slice(0, 2000) }); r = { leader: this.leader }; }
        if (r.lost) { await this.drain(); return { exitCode: 0, lost: true }; }
        if (watch && reload && this.now() >= reloadCheckAt) {
          reloadCheckAt = this.now() + RELOAD_CHECK_MS;
          const check = watch.check();
          if (check?.reload) {
            watch.markAttempt();
            await this.drain();
            const handed = await reload(check);
            this.log('reconciler.event', `${handed.ok ? `reloaded: pid ${handed.pid} took over` : `reload failed: ${handed.error}`} (${check.reason})`, { kind: 'reconciler.reload', ok: handed.ok === true });
            if (handed.ok) return { exitCode: 0, reloaded: handed.pid };
          }
        }
        await sleep(tickMs);
      }
      await this.drain();
      return { exitCode: 0, stopped: true };
    } finally { clearInterval(renewal); }
  }

  stop() { this.stopped = true; }

  close({ releaseLead = true, reason = 'stop' } = {}) {
    this.hb?.stop();
    if (releaseLead && this.leader) this.release({ reason });
    else { try { this.lock?.release?.(); } catch { /* best effort */ } }
    if (this.ownsState) { try { this.state.close(); } catch { /* closed */ } }
  }

  /**
   * --once: every non-off controller (or `controller`, even when off) lists its keys, or reconciles `key`, once.
   * Shadow unless the engine was built with apply and took the lead. Returns {ok, controllers: [...], loadErrors}.
   */
  async once({ controller = null, key = null } = {}) {
    const expected = controller ? [controller] : CONTROLLER_NAMES.filter((name) => this.modes[name] !== 'off');
    const loaded = new Set(this.controllers.map((c) => c.name));
    const missing = expected.filter((name) => !loaded.has(name));
    const incomplete = this.loadErrors.some((e) => e.name == null || expected.includes(e.name));
    const out = { ok: !incomplete && missing.length === 0, epoch: this.epoch, leader: this.leader, controllers: [],
      coverage: { expected: expected.length, loaded: expected.length - missing.length, missing },
      loadErrors: this.loadErrors.map((e) => ({ name: e.name, error: e.error })) };
    const picked = this.controllers.filter((c) => (controller ? c.name === controller : c.mode !== 'off'));
    if (controller && !picked.length) return { ...out, ok: false, error: `no controller '${controller}' (known: ${this.controllers.map((c) => c.name).join(', ') || 'none'})` };
    for (const c of picked) {
      const mode = this.leader && c.mode === 'active' ? 'active' : 'shadow';
      const entry = { name: c.name, mode, keys: 0, ok: 0, failed: [] };
      let keys = [];
      if (key) keys = [key];
      else {
        try { keys = typeof c.module.list === 'function' ? await this.als.run({ key: null }, () => c.module.list(this.ctxFor(c, mode))) : []; }
        catch (error) { entry.listError = String(error?.message ?? error); out.ok = false; }
      }
      for (const k of Array.isArray(keys) ? keys : []) this.queue.add(c.name, k, { reason: 'once' });
      entry.keys = Array.isArray(keys) ? keys.length : 0;
      for (;;) {
        const batch = this.queue.take(c.name, c.concurrency);
        if (!batch.length) break;
        const results = await Promise.all(batch.map((item) => this.reconcileOne(c, { ...item, attempts: 0 }, { mode })));
        for (const r of results) {
          if (r.ok) entry.ok += 1;
          else { entry.failed.push({ key: r.key, error: r.error }); this.queue.done(c.name, r.key); }
        }
      }
      if (entry.failed.length) out.ok = false;
      out.controllers.push(entry);
    }
    return out;
  }
}

/** What the engine process itself runs; a change to one of them (or a new runtime HEAD) reloads it. */
const reloadWatchedFiles = (root = SKILL_ROOT) => [
  'scripts/reconciler/engine.mjs', 'scripts/reconciler/ctx.mjs', 'scripts/reconciler/sources.mjs', 'scripts/reconciler/state.mjs',
  'scripts/reconciler/owns.mjs', 'scripts/reconciler/workqueue.mjs', 'scripts/reconciler/heartbeat-worker.mjs', 'scripts/reconciler/boot.mjs', 'scripts/machine/self-reload.mjs', 'engine/config.mjs', 'modules/models/runtimes.yaml',
].map((rel) => path.join(root, ...rel.split('/')));

/**
 * What the engine imports in process (controllers, the supervisor helpers they wrap, the ledger engine, the numbers):
 * a new runtime HEAD reloads the engine only when it changed a file under these (MB-01: every land of docs or ops
 * contracts re-exec'd the engine about every 6 minutes). Children (cli.mjs, push-mains.mjs, ...) start fresh anyway.
 */
const RELOAD_HEAD_PATHS = Object.freeze(['scripts/reconciler/', 'scripts/supervisor/', 'scripts/machine/', 'scripts/lib/', 'scripts/connectors/lib.mjs',
  'scripts/kernel/', 'scripts/api/orca/', 'engine/', 'modules/reconciler/', 'modules/models/runtimes.yaml']);

/**
 * Safe mode of a start. A fresh start (boot ensure) is safe exactly when it was given --safe. A self-reload is NOT
 * inherited: it re-evaluates the crash-loop plan (boot.mjs crashLoopPlan over the spawn record, where owner restarts,
 * self-reloads and clean exits never count), so an engine that was safe because of a crash loop that has since aged out
 * comes back in normal mode instead of staying shadow forever. Returns {safe, inherited, reevaluated, starts, max, windowMs}.
 */
export function safeForStart({ argv = [], reloaded = false, numbers = reconcilerNumbers(), now = Date.now(), record = () => crashLoopRecord({ now, windowMs: numbers.crashLoop.windowMs }) } = {}) {
  const inherited = argv.includes('--safe');
  if (!reloaded) return { safe: inherited, inherited, reevaluated: false };
  const { max, windowMs } = numbers.crashLoop;
  let plan;
  try { plan = crashLoopPlan(record(), { now, max, windowMs }); } catch { plan = { looping: inherited, starts: [] }; } // unreadable record: keep what we had
  return { safe: plan.looping, inherited, reevaluated: true, starts: plan.starts.length, max, windowMs };
}

const argValue = (argv, name) => valueAfter(argv, name);

async function main(argv = process.argv.slice(2)) {
  setPriority();
  const json = argv.includes('--json');
  if (argv.includes('--once')) {
    const apply = argv.includes('--apply');
    const engine = new Engine({ apply, memoryQueue: true, safe: argv.includes('--safe'), rev: runtimeHead({ root: SKILL_ROOT }), print: json ? () => {} : (l) => console.log(l), echo: !json,
    // a debugging pass is not the checkpointer (the long-lived engine's connection is)
    stateOptions: { checkpointer: false } });
    let result;
    try {
      await engine.load();
      if (apply) {
        const got = engine.acquire();
        if (!got.ok) { console.log(JSON.stringify({ ok: false, error: `not the leader: ${got.standby}` })); process.exitCode = 1; return; }
      }
      result = await engine.once({ controller: argValue(argv, '--controller'), key: argValue(argv, '--key') });
    } finally { engine.close({ releaseLead: apply }); }
    console.log(json ? JSON.stringify(result) : `[reconciler --once] ${result.ok ? 'ok' : 'NOT OK'} ${result.controllers.map((c) => `${c.name}(${c.mode}) keys=${c.keys} ok=${c.ok} failed=${c.failed.length}`).join('; ') || 'no controller on'}${result.error ? ` ${result.error}` : ''}`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }
  const handoverFrom = readEnv(RELOAD_ENV.handoverFrom) ?? null;
  const reloadedAt = Number(readEnv(RELOAD_ENV.reloadedAt)) || null;
  delete process.env[RELOAD_ENV.handoverFrom];
  delete process.env[RELOAD_ENV.reloadedAt];
  const safeStart = safeForStart({ argv, reloaded: Boolean(handoverFrom) });
  const safe = safeStart.safe;
  const startReason = handoverFrom ? 'self-reload' : readEnv(START_REASON_ENV) || 'manual';
  delete process.env[START_REASON_ENV];
  // Before machine.sqlite opens, stdout is the only place a crash can go (boot.mjs spawns the engine with no log file).
  const rev = runtimeHead({ root: SKILL_ROOT });
  const engine = new Engine({ safe, handoverFrom, rev, print: (l) => console.log(l) });
  // MB-04, G1: this start is a process_runs row; its end says why (clean | reload-handover | lost-lease | stopped | crash).
  try { engine.processRunId = engine.state.startProcessRun({ role: 'engine', rev: rev ?? undefined, startReason }); } catch (error) { console.error(`[reconciler] process run not recorded: ${error?.message ?? error}`); }
  let stopSignal = null;
  const endRun = (fields) => { try { if (engine.processRunId != null) engine.state.endProcessRun(engine.processRunId, fields); } catch { /* best effort */ } };
  const onCrash = (error) => {
    try { engine.log('reconciler.error', `engine crashed: ${String(error?.message ?? error).slice(0, 300)}`, { kind: 'reconciler.crash', detail: String(error?.stack ?? error).slice(0, 4000) }); } catch { console.error(error); }
    endRun({ exitCode: 1, exitReason: 'crash' });
    try { engine.close({ reason: 'crash' }); } catch { /* closing */ }
    process.exit(1);
  };
  process.on('uncaughtException', onCrash);
  process.on('unhandledRejection', onCrash);
  await engine.load();
  if (safeStart.reevaluated) {
    engine.log('reconciler.event', `self-reload re-evaluated safe mode: ${safe ? 'SAFE (a real crash loop is on record)' : 'normal'} (was ${safeStart.inherited ? '--safe' : 'normal'}; ${safeStart.starts} abnormal start(s) in the window, limit ${safeStart.max})`,
      { kind: 'reconciler.safe-reevaluated', safe, wasSafe: safeStart.inherited, abnormalStarts: safeStart.starts, max: safeStart.max, windowMs: safeStart.windowMs });
  }
  // The heartbeat worker (heartbeat-worker.mjs): its own connection renews the lease while a synchronous duty blocks this thread.
  engine.hb = startHeartbeatWorker({ file: engine.stateFile, leaseMs: engine.numbers.leaseMs, renewMs: engine.numbers.renewMs, stallMaxMs: engine.numbers.stallMaxMs ?? DEFAULT_STALL_MAX_MS });
  if (!engine.hb.active) throw new Error('the heartbeat worker did not start: this engine cannot keep its lease');
  const first = engine.acquire();
  if (!first.ok) engine.log('reconciler.event', `standby: ${first.standby}`, { kind: 'reconciler.standby' });
  const onSignal = (sig) => { stopSignal = sig; engine.stop(); };
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, onSignal);
  const watch = createReloadWatch({ root: SKILL_ROOT, files: reloadWatchedFiles(), lastReloadAt: reloadedAt, headPaths: RELOAD_HEAD_PATHS });
  // --safe is not inherited: the new process re-evaluates the crash-loop plan itself (safeForStart).
  const reload = () => reexecSelf({ script: selfFile, args: argv.filter((a) => a !== '--safe'), logFile: null, lockName: LOCK_NAME, cwd: SKILL_ROOT, env: { ...process.env, [START_REASON_ENV]: 'self-reload' }, holder: lockHolder, reclaim: reassertManager });
  const r = await engine.run({ watch, reload });
  endRun({ exitCode: r.exitCode ?? 0, exitReason: r.reloaded ? 'reload-handover' : r.lost ? 'lost-lease' : stopSignal ? 'stopped' : 'clean', killedBy: stopSignal ? `signal:${stopSignal}` : null });
  engine.close({ releaseLead: !r.reloaded && !r.lost, reason: 'stop' });
  process.exit(r.exitCode ?? 0);
}

if (isMain(import.meta.url)) await main();
