// scripts/reconciler/ctx.mjs — the `ctx` every controller reconciles through (LANES shared contract; DESIGN §7.4-§7.6).
//
//   ctx.mode                    'shadow' | 'active' (an `off` controller never runs; safe mode runs everything shadow)
//   ctx.now()                   epoch ms
//   ctx.ledgers                 [{ledgerId, repo, file}] (sources.mjs ledgersOf)
//   ctx.read(ledgerId, fn)      fn(db) over a read-only handle (openLedgerReader); null when the ledger is absent
//   ctx.status(ledgerId, wf)    the cached `api status --json` value (TTL allocation.reconciler.statusCacheMs, shared)
//   ctx.statusRead(ledgerId, wf) the same read as {value, failure}: failure names why it gave no value (statusFailureOf)
//   ctx.api(ledgerId, verb, argv, {timeoutMs})
//                               `node scripts/kernel/cli.mjs <verb> --repo <repo> ...argv --json` as a child with
//                               STARCI_ACTOR=reconciler/<controller> and STARCI_RECONCILER_EPOCH. In shadow it does NOT
//                               run: one `reconciler.would` typed row, {ok: true, shadow: true}.
//   ctx.run(cmd, args, {timeoutMs})  the same gate for a non-api actuator ('node' = this node; 'scripts/..' paths
//                               resolve against the runtime root)
//   ctx.clock(entity, state, slaMs, meta) / ctx.clear(entity, state)   SLA clocks (machine.sqlite sla_episodes, append-only:
//                               one open episode per (entity, state), closed once with a reason); shadow records them too
//   ctx.openDecision(di)        Decision Item through scripts/machine/decisions.mjs openDecision (lane C) when
//                               active; in shadow, or before that module exists, only the would-row
//   ctx.log(kind, msg, data)    a typed row in machine.sqlite machine_logs, actor 'reconciler' (logRowOf, reconcilerLog)
//   ctx.owns(concern)           whether the concern's controller runs active in THIS engine
//   ctx.machine                 the engine's machine.sqlite handle (engine/db/machine.mjs; never open another one yourself)
//   ctx.stateDb / ctx.stateFile its raw connection (ctx.machine.db) and file; ctx.env
//   ctx.key / ctx.epoch         the key being reconciled (null in list()) and the leader epoch
//
// Every real mutation is journaled in machine.sqlite `engine_actions` (intent -> running -> done|failed; fenced) and
// fenced: it runs only while this engine's epoch is still the leader's (DESIGN §7.5). The FULL result is a blob
// (result_sha), result_json only a <= 8 KiB summary, stdout/stderr full blobs (MB-03). A stale intent/running row at
// boot becomes `unknown` (engine.mjs) and is never replayed: the controller re-evaluates from the ledger.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnCapture } from '../api/process/spawn-capture.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineLog } from '../../engine/db/machine.mjs';
import { LOG_KINDS } from '../kernel/typed-logs.mjs';
import { wakeKernel } from '../kernel/wake-delivery.mjs';
import { CONCERN_OWNER } from './owns.mjs';
import { openClock, slaCatalog } from './sla.mjs';
import { SKILL_ROOT } from './state.mjs';

export const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'cli.mjs');
export const DECISIONS_FILE = path.join(SKILL_ROOT, 'scripts', 'machine', 'decisions.mjs');
export const DEFAULT_TIMEOUT_MS = 120_000;
/** The same would-row (controller, verb, argv) is written at most once per this window. */
export const WOULD_DEDUPE_MS = 10 * 60_000;
/** A value up to this many bytes rides in the action summary (engine_actions.result_json, <= 8 KiB); the full result is a blob. */
const SUMMARY_VALUE_BYTES = 6000;

export const digestOf = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const clip = (text, n = 300) => { const s = String(text ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** Node's own warning lines ("(node:123) ExperimentalWarning: ...", "(Use `node --trace-warnings ...`"). */
export const isNodeWarningLine = (line) => /^\(node:\d+\) \w*Warning:|^\(Use `node --trace-warnings/.test(String(line).trim());

/**
 * The one line that says why a child failed: the JSON answer's error / reason / code (its `error` text itself
 * cleaned of node warnings), else the first stderr line that is not a node warning, else the exit. Pure.
 */
export function errorLineOf(r) {
  if (!r || r.ok === true) return null;
  const firstReal = (text) => {
    const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isNodeWarningLine(l));
    // A thrown error's own line first (ReferenceError: ...), else the first line that is not a stack frame or source excerpt.
    return lines.find((l) => /^[A-Z]\w*(?:Error|Exception)\b/.test(l)) ?? lines.find((l) => !/^(?:file:\/\/|at |\^+$|Node\.js v)/.test(l)) ?? null;
  };
  // A list answer (push-mains: one entry per repository): its first failing entry.
  const item = Array.isArray(r.value) ? r.value.find((x) => x && typeof x === 'object' && (x.ok === false || x.error || x.refused || x.scan?.ok === false)) : null;
  const v = item ? { error: item.error, reason: [item.repo ? String(item.repo).split(/[\\/]/).pop() : null, item.refused ?? (item.scan?.ok === false ? `push scan: ${item.scan.findings?.length ?? '?'} finding(s)` : null)].filter(Boolean).join(': ') || null }
    : r.value && typeof r.value === 'object' && !Array.isArray(r.value) ? r.value : null;
  const fromJson = v ? firstReal(v.error) ?? (typeof v.reason === 'string' ? v.reason : null) ?? (typeof v.code === 'string' ? v.code : null) ?? (v.action ? `action ${v.action}` : null) : null;
  return clip(r.fenced ? 'epoch-fenced: this engine is no longer the leader' : r.timedOut ? 'timed out' : fromJson ?? firstReal(r.error) ?? firstReal(r.stderr) ?? `exit ${r.code ?? '?'}`, 300);
}

/**
 * The engine_actions.result_json summary of a result: {ok, code, error?, timedOut?, fenced?, value | valueBytes}. The value
 * rides only when small; the full result is the action's result blob (machine-db actionFinish). Pure.
 */
export function actionSummary(r) {
  const base = { ok: r?.ok === true, code: r?.code ?? null, ...(r?.timedOut ? { timedOut: true } : {}), ...(r?.fenced ? { fenced: true } : {}), ...(r?.ok ? {} : { error: errorLineOf(r) }) };
  let value = null;
  try { value = JSON.stringify(r?.value ?? null); } catch { value = 'null'; }
  return Buffer.byteLength(value) <= SUMMARY_VALUE_BYTES ? { ...base, value: r?.value ?? null } : { ...base, valueBytes: Buffer.byteLength(value) };
}

/** The full result an action keeps as its blob: the child's answer without stdout/stderr (those are blobs of their own). Pure. */
const actionResultOf = (r) => { const { stdout, stderr, ...rest } = r ?? {}; return rest; };

/**
 * Write one ctx/engine log row ({kind, msg, data, refs, level?}, logRowOf) to machine_logs, actor 'reconciler'. With
 * `m` (the engine's handle) on it; else through machineLog (its own short-lived connection). Returns the rows written.
 */
export function reconcilerLog(m, row, { env = process.env } = {}) {
  const data = row?.data ?? {};
  const level = row?.level ?? (/\.error$/.test(String(row?.kind ?? '')) ? 'error' : 'info');
  const out = { actor: 'reconciler', controller: typeof data.controller === 'string' ? data.controller : null, kind: String(row?.kind ?? 'reconciler.event'),
    msg: String(row?.msg ?? ''), level, data, refs: row?.refs ?? null, actionId: typeof data.actionId === 'string' ? data.actionId : null,
    workflowId: typeof data.workflowId === 'string' ? data.workflowId : null, ...(row?.at ? { at: row.at } : {}) };
  return m && !m.readOnly ? m.log(out) : machineLog(out, { env });
}

/** The last JSON line of a child's stdout, or null. Pure. */
export function lastJsonLine(stdout) {
  const lines = String(stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) { try { return JSON.parse(lines[i]); } catch { /* not JSON */ } }
  return null;
}

/**
 * Run `cmd args` as a child with a timeout; resolves {ok, code, value, stdout, stderr, timedOut, error?}. Never rejects.
 * ok = exit 0 and (no JSON, or JSON whose ok is not false).
 */
export async function spawnJson(cmd, args, { env = process.env, cwd = SKILL_ROOT, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const r = await spawnCapture(cmd, args, { cwd, env, timeoutMs });
  const value = lastJsonLine(r.stdout);
  return { ok: !r.timedOut && !r.error && r.code === 0 && value?.ok !== false, ...r, value };
}

/**
 * Why an `api status --json` child gave no value, or null when it did: {cause, error, code, timedOut, stderrHead}.
 * cause is 'timeout' | 'spawn' | 'refused' (a typed {ok:false,error} answer, on stdout or on stderr: cli.mjs prints
 * its refusal JSON on stderr and exits 1, e.g. plan-edges-missing) | 'exit' (non-zero, no JSON) | 'no-json' (exit 0,
 * stdout carried no JSON line). Pure.
 */
export function statusFailureOf(r, { timeoutMs = null } = {}) {
  const value = r?.value && typeof r.value === 'object' ? r.value : null;
  if (r?.ok && value) return null;
  const stderr = String(r?.stderr ?? '');
  const stderrHead = clip(stderr.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isNodeWarningLine(l)).join(' | '), 300) || null;
  const refusal = value && value.ok === false ? value : (() => { const j = lastJsonLine(stderr); return j && typeof j === 'object' && j.ok === false ? j : null; })();
  const base = { code: Number.isInteger(r?.code) ? r.code : null, timedOut: Boolean(r?.timedOut), stderrHead };
  if (r?.timedOut) return { cause: 'timeout', error: `api status timed out after ${timeoutMs ?? '?'}ms`, ...base };
  if (r?.error) return { cause: 'spawn', error: clip(`api status did not spawn: ${r.error}`, 300), ...base };
  if (refusal) return { cause: 'refused', error: clip(`api status refused (exit ${base.code ?? '?'}): ${refusal.error ?? refusal.code ?? 'ok:false'}`, 300), refusal: refusal.code ?? null, ...base };
  if (base.code !== 0) return { cause: 'exit', error: clip(`api status exited ${base.code ?? '?'}${stderrHead ? `: ${stderrHead}` : ' with no stderr'}`, 300), ...base };
  return { cause: 'no-json', error: clip(`api status exited 0 with no JSON on stdout${stderrHead ? ` (stderr: ${stderrHead})` : ''}`, 300), ...base };
}

/** The typed-log kinds a ctx.log row may carry as is; any other kind rides under reconciler.event (or .error). */
export const CTX_LOG_KINDS = Object.freeze(['reconciler.would', 'reconciler.act', 'reconciler.error', 'reconciler.event', 'invariant.violated', 'invariant.cleared']);

/**
 * The typed row a ctx.log call writes. A kind of CTX_LOG_KINDS is kept; any other kind (reconciler.gc.close,
 * reconciler.host.service, ...) is written as reconciler.error when it ends in `.error`, else reconciler.event, with
 * data.kind naming it. data.controller is always the controller. Pure.
 */
export function logRowOf(controller, kind, msg, data = {}, { key = null } = {}) {
  const k = String(kind ?? 'reconciler.event');
  const rowKind = CTX_LOG_KINDS.includes(k) && Object.hasOwn(LOG_KINDS, k) ? k : /\.error$/.test(k) ? 'reconciler.error' : 'reconciler.event';
  const who = String(controller ?? 'engine');
  const payload = { ...(data && typeof data === 'object' ? data : {}), controller: who, ...(key && data?.key == null ? { key: String(key) } : {}) };
  if (rowKind !== k) payload.kind = k;
  if (rowKind === 'reconciler.event' && typeof payload.kind !== 'string') payload.kind = k;
  return { kind: rowKind, msg: clip(msg, 400), data: payload, refs: [`reconciler:${who}`, ...(key ? [`key:${key}`] : [])] };
}

const valueOf = (v) => (typeof v === 'function' ? v() : v);

/** The SLA catalogue, read at most once a minute (the code and severity of an episode). */
let catalogCache = { at: 0, value: null };
const catalogNow = (at) => { if (!catalogCache.value || at - catalogCache.at > 60_000) catalogCache = { at, value: slaCatalog() }; return catalogCache.value; };

/**
 * Build the ctx of one controller. `key`, `epoch`, `ledgers` and `modes` may be functions (the engine passes live
 * readers: the key of the reconcile running in this async context, the current epoch), so ONE ctx object serves every
 * reconcile of a controller in a mode, and a controller may keep per-ctx memory (a WeakMap keyed by ctx).
 * `shared` = {statusCache: Map, wouldSeen: Map} is shared by every ctx of one engine. `state` is the engine's
 * machine.sqlite handle (engine/db/machine.mjs openMachine). Seams: spawnChild (spawnJson), writeLog (reconcilerLog),
 * reader (openLedgerReader), loadDecisions (import of decisions.mjs), isCurrentEpoch (the fence).
 */
export function createCtx({
  controller, mode = 'shadow', key = null, state = null, stateFile = state?.file ?? null, epoch = 0, ledgers = [], numbers = { statusCacheMs: 20_000 },
  modes = {}, env = process.env, now = Date.now, shared = { statusCache: new Map(), wouldSeen: new Map() },
  isCurrentEpoch = () => true, spawnChild = spawnJson, writeLog = (row) => reconcilerLog(state, row, { env }), reader = openLedgerReader,
  loadDecisions = async () => (fs.existsSync(DECISIONS_FILE) ? import(`file://${DECISIONS_FILE.replace(/\\/g, '/')}`) : null),
} = {}) {
  const keyNow = () => valueOf(key) ?? null;
  const epochNow = () => Number(valueOf(epoch)) || 0;
  const ledgersNow = () => valueOf(ledgers) ?? [];
  const ledgerOf = (ledgerId) => ledgersNow().find((l) => l.ledgerId === ledgerId) ?? null;
  // NODE_NO_WARNINGS: a child's stderr carries its real errors only (no node:sqlite ExperimentalWarning), down the tree.
  const childEnv = () => ({ ...env, NODE_NO_WARNINGS: '1', STARCI_ACTOR: `reconciler/${controller}`, STARCI_RECONCILER_EPOCH: String(epochNow()) });

  const log = (kind, msg, data = {}) => {
    try { return writeLog(logRowOf(controller, kind, msg, data, { key: keyNow() })); } catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
  };

  const would = (verb, argv, extra = {}) => {
    const digest = digestOf([controller, verb, argv]);
    const seen = shared.wouldSeen.get(digest);
    const at = now();
    if (!(seen != null && at - seen < WOULD_DEDUPE_MS)) {
      shared.wouldSeen.set(digest, at);
      if (shared.wouldSeen.size > 5000) for (const [k, v] of shared.wouldSeen) if (at - v >= WOULD_DEDUPE_MS) shared.wouldSeen.delete(k);
      log('reconciler.would', `${controller} would ${verb} ${clip(argv.join(' '), 200)}`, { verb, argv: clip(argv.join(' '), 1000), mode, digest, ...extra });
    }
    return { ok: true, shadow: true };
  };

  /** Journal + fence + run + one reconciler.act row. `exec` returns the spawnJson result. */
  const act = async (verb, argv, exec, { ledgerId = null } = {}) => {
    const id = `act-${crypto.randomBytes(8).toString('hex')}`;
    const digest = digestOf([verb, argv]);
    const k = keyNow(), ep = epochNow();
    const journal = (fn) => { try { if (state) fn(state); } catch { /* the journal is best effort */ } };
    journal((m) => m.actionIntent({ id, controller, key: k, verb, argvDigest: digest, epoch: ep, mode: 'active', ledgerId }));
    let current = false;
    try { current = isCurrentEpoch() === true; } catch { current = false; }
    if (!current) {
      const fenced = { ok: false, fenced: true, error: 'epoch-fenced: this engine is no longer the leader' };
      journal((m) => m.actionFinish(id, { state: 'fenced', result: fenced, summary: actionSummary(fenced), errorSignature: 'epoch-fenced' }));
      return fenced;
    }
    journal((m) => m.actionRunning(id));
    let r;
    try { r = await exec(); } catch (error) { r = { ok: false, error: String(error?.message ?? error) }; }
    journal((m) => m.actionFinish(id, { state: r?.ok === true ? 'done' : 'failed', exitCode: Number.isInteger(r?.code) ? r.code : null, result: actionResultOf(r),
      summary: actionSummary(r), stdout: r?.stdout ?? null, stderr: r?.stderr ?? null, errorSignature: r?.ok === true ? null : errorLineOf(r) }));
    log('reconciler.act', `${controller} ${r?.ok === true ? 'ran' : 'FAILED'} ${verb} ${clip(argv.join(' '), 200)}`, { verb, ok: r?.ok === true, ...(r?.ok === true ? {} : { detail: errorLineOf(r) }), actionId: id, argv: clip(argv.join(' '), 1000), epoch: ep, ...(ledgerId ? { ledgerId } : {}) });
    return { ...r, actionId: id };
  };

  const resolveArgs = (args) => args.map((a) => (typeof a === 'string' && /^scripts[\\/]/.test(a) ? path.join(SKILL_ROOT, a) : a));

  const ctx = {
    controller, mode, env, numbers,
    get key() { return keyNow(); },
    get epoch() { return epochNow(); },
    get ledgers() { return ledgersNow(); },
    /** The engine's machine.sqlite handle (engine/db/machine.mjs); never open the file yourself. */
    machine: state,
    /** Its raw connection (schedules.mjs claimDue/finishDuty); null without an engine. */
    stateDb: state?.db ?? null,
    stateFile,
    now: () => now(),
    read(ledgerId, fn) {
      const l = ledgerOf(ledgerId);
      if (!l || !l.file || !fs.existsSync(l.file)) return null;
      const db = reader(l.file);
      try { return fn(db); } finally { try { db.close(); } catch { /* closed */ } }
    },
    openReader: (file) => reader(file),
    async status(ledgerId, workflowId) { return (await ctx.statusRead(ledgerId, workflowId)).value; },
    /** {value, failure}: the value ctx.status answers (null when the read failed) and statusFailureOf's why; cached alike. */
    async statusRead(ledgerId, workflowId) {
      const l = ledgerOf(ledgerId);
      if (!l || !workflowId) return { value: null, failure: { cause: 'out-of-view', error: `ledger ${ledgerId} not in view or no workflow` } };
      const id = `${ledgerId}\u0000${workflowId}`;
      const hit = shared.statusCache.get(id);
      const ttl = Number(numbers?.statusCacheMs) || 20_000;
      if (hit && now() - hit.at < ttl) return hit.promise;
      const promise = Promise.resolve(spawnChild(process.execPath, [API_FILE, 'status', '--repo', l.repo, '--workflow', workflowId, '--json'], { env: childEnv(), timeoutMs: DEFAULT_TIMEOUT_MS }))
        .then((r) => ({ value: r?.value && typeof r.value === 'object' ? r.value : null, failure: statusFailureOf(r, { timeoutMs: DEFAULT_TIMEOUT_MS }) }),
          (error) => ({ value: null, failure: { cause: 'spawn', error: clip(`api status threw: ${error?.message ?? error}`, 300) } }));
      shared.statusCache.set(id, { at: now(), promise });
      return promise;
    },
    async api(ledgerId, verb, argv = [], { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
      const l = ledgerOf(ledgerId);
      if (!l) return { ok: false, error: `unknown ledger ${ledgerId}` };
      const list = [...argv.map(String)];
      if (!list.includes('--json')) list.push('--json');
      if (mode !== 'active') return would(`api ${verb}`, list, { ledgerId });
      return act(`api ${verb}`, list, () => spawnChild(process.execPath, [API_FILE, verb, '--repo', l.repo, ...list], { env: childEnv(), timeoutMs }), { ledgerId });
    },
    /** In active: {ok, code, value (last JSON line), stdout, stderr, actionId}; in shadow {ok: true, shadow: true}. */
    async run(cmd, args = [], { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
      const list = args.map(String);
      if (mode !== 'active') return would(`run ${cmd}`, list);
      const exe = cmd === 'node' ? process.execPath : cmd;
      return act(`run ${cmd}`, list, () => spawnChild(exe, resolveArgs(list), { env: childEnv(), timeoutMs }));
    },
    /** Start (or keep) the SLA clock of (entity, state); meta.enteredAt is its start, meta.ledgerId its ledger. Recorded in shadow too. */
    clock(entity, clockState, slaMs, meta = {}) {
      if (!state) return false;
      return openClock(state, { entity, state: clockState, slaMs, ledgerId: meta?.ledgerId ?? null, workflowId: meta?.workflowId ?? null, code: meta?.code ?? null,
        enteredAt: Number.isFinite(Number(meta?.enteredAt)) && meta?.enteredAt != null ? Number(meta.enteredAt) : now(), catalog: catalogNow(now()) });
    },
    clear(entity, clockState, { reason = 'resolved' } = {}) {
      if (!state) return false;
      return state.clearSla({ entity: String(entity), state: String(clockState), reason }) > 0;
    },
    /**
     * Open a Decision Item (DESIGN §10.3) through scripts/machine/decisions.mjs openDecision(repo, di) when active; a
     * DI with ledger 'supervisor' goes to the supervisor ledger. In shadow, or before that module exists: the would-row.
     */
    async openDecision(di) {
      const item = { schema: 'starci/decision-item@1', openedBy: `${controller}-controller`, openedAt: now(), ...di };
      const summary = { kind: item.kind ?? null, decider: item.decider ?? null, idempotencyKey: item.idempotencyKey ?? null, ledgerId: item.ledger ?? null };
      if (mode !== 'active') return would('decisions --open', [JSON.stringify(summary)], { decision: summary });
      let mod = null;
      try { mod = await loadDecisions(); } catch { mod = null; }
      if (typeof mod?.openDecision !== 'function') return { ...would('decisions --open', [JSON.stringify(summary)], { decision: summary, pending: 'scripts/machine/decisions.mjs absent' }), recordedOnly: true };
      const l = ledgerOf(item.ledger ?? '') ?? null;
      const opened = await act('decisions --open', [item.idempotencyKey ?? digestOf(item)], async () => {
        const r = await mod.openDecision(l?.repo ?? item.repo ?? null, item, { env: childEnv(), now: now() });
        return r && typeof r === 'object' ? { ...r, ok: r.ok !== false, value: r.json ?? r.value ?? r } : { ok: Boolean(r), value: r };
      }, { ledgerId: item.ledger ?? null });
      // MB-02: a new Supervisor DI rings the Supervisor seat at once (a busy seat defers; the watchdog pass reminds).
      if (opened?.ok && opened.value?.created && item.ledger === 'supervisor' && typeof mod.ringSupervisor === 'function') {
        try {
          const rung = await mod.ringSupervisor({ env: childEnv(), wake: wakeKernel, now: now() });
          log('reconciler.event', `supervisor doorbell ${rung?.action ?? 'unknown'} for ${item.idempotencyKey ?? item.kind}`, { kind: 'reconciler.supervisor-ring', action: rung?.action ?? null, open: rung?.open ?? null });
        } catch (error) { log('reconciler.error', `supervisor doorbell failed: ${clip(error?.message ?? error, 200)}`, { kind: 'reconciler.supervisor-ring.error' }); }
      }
      return opened;
    },
    log,
    owns(concern) { const owner = CONCERN_OWNER[concern]; return Boolean(owner) && valueOf(modes)?.[owner] === 'active'; },
  };
  return ctx;
}
