// scripts/reconciler/ctx.mjs — the `ctx` every controller reconciles through (LANES shared contract; DESIGN §7.4-§7.6).
//
//   ctx.mode                    'shadow' | 'active' (an `off` controller never runs; safe mode runs everything shadow)
//   ctx.now()                   epoch ms
//   ctx.ledgers                 [{ledgerId, repo, file}] (sources.mjs ledgersOf)
//   ctx.read(ledgerId, fn)      fn(db) over a read-only handle (openLedgerReader); null when the ledger is absent
//   ctx.status(ledgerId, wf)    the cached `api status --json` value (TTL allocation.reconciler.statusCacheMs, shared)
//   ctx.api(ledgerId, verb, argv, {timeoutMs})
//                               `node scripts/kernel/api.mjs <verb> --repo <repo> ...argv --json` as a child with
//                               STARCI_ACTOR=reconciler/<controller> and STARCI_RECONCILER_EPOCH. In shadow it does NOT
//                               run: one `reconciler.would` typed row, {ok: true, shadow: true}.
//   ctx.run(cmd, args, {timeoutMs})  the same gate for a non-api actuator ('node' = this node; 'scripts/..' paths
//                               resolve against the runtime root)
//   ctx.clock(entity, state, slaMs, meta) / ctx.clear(entity, state)   SLA clocks (sla_clocks); shadow records them too
//   ctx.openDecision(di)        Decision Item through scripts/reconciler/decisions.mjs openDecision (lane C) when
//                               active; in shadow, or before that module exists, only the would-row
//   ctx.log(kind, msg, data)    a typed row on the Supervisor ledger (sup-log.mjs), kind prefix `reconciler.` (logRowOf)
//   ctx.owns(concern)           whether the concern's controller runs active in THIS engine
//   ctx.stateDb / ctx.stateFile the engine's reconciler.sqlite handle and file (never open it yourself); ctx.env
//   ctx.key / ctx.epoch         the key being reconciled (null in list()) and the leader epoch
//
// Every real mutation is journaled in `actions` (intent -> running -> done|failed) and fenced: it runs only while
// this engine's epoch is still the leader's (DESIGN §7.5). A stale intent/running row at boot becomes `unknown`
// (engine.mjs) and is never replayed: the controller re-evaluates from the ledger.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openLedgerReader } from '../../engine/ledger-db.mjs';
import { LOG_KINDS } from '../kernel/typed-logs.mjs';
import { supLog } from '../supervisor/sup-log.mjs';
import { CONCERN_OWNER } from './owns.mjs';
import { SKILL_ROOT } from './state.mjs';

export const API_FILE = path.join(SKILL_ROOT, 'scripts', 'kernel', 'api.mjs');
export const DECISIONS_FILE = path.join(SKILL_ROOT, 'scripts', 'reconciler', 'decisions.mjs');
export const DEFAULT_TIMEOUT_MS = 120_000;
/** The same would-row (controller, verb, argv) is written at most once per this window. */
export const WOULD_DEDUPE_MS = 10 * 60_000;
const RESULT_CAP = 4000;

export const digestOf = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const clip = (text, n = 300) => { const s = String(text ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

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
export function spawnJson(cmd, args, { env = process.env, cwd = SKILL_ROOT, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn(cmd, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { resolve({ ok: false, code: null, value: null, stdout: '', stderr: '', error: String(error?.message ?? error) }); return; }
    let stdout = '', stderr = '', timedOut = false, settled = false;
    const cap = 4 * 1024 * 1024;
    child.stdout.on('data', (d) => { if (stdout.length < cap) stdout += d; });
    child.stderr.on('data', (d) => { if (stderr.length < cap) stderr += d; });
    const timer = setTimeout(() => { timedOut = true; try { child.kill(); } catch { /* gone */ } }, timeoutMs);
    const finish = (code, error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const value = lastJsonLine(stdout);
      resolve({ ok: !timedOut && !error && code === 0 && value?.ok !== false, code, value, stdout: clip(stdout, 20000), stderr: clip(stderr, 4000), timedOut, ...(error ? { error } : {}) });
    };
    child.on('error', (error) => finish(null, String(error?.message ?? error)));
    child.on('close', (code) => finish(code));
  });
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

/**
 * Build the ctx of one controller. `key`, `epoch`, `ledgers` and `modes` may be functions (the engine passes live
 * readers: the key of the reconcile running in this async context, the current epoch), so ONE ctx object serves every
 * reconcile of a controller in a mode, and a controller may keep per-ctx memory (a WeakMap keyed by ctx).
 * `shared` = {statusCache: Map, wouldSeen: Map} is shared by every ctx of one engine. Seams: spawnChild (spawnJson),
 * writeLog (supLog), reader (openLedgerReader), loadDecisions (import of decisions.mjs), isCurrentEpoch (the fence).
 */
export function createCtx({
  controller, mode = 'shadow', key = null, state = null, stateFile = null, epoch = 0, ledgers = [], numbers = { statusCacheMs: 20_000 },
  modes = {}, env = process.env, now = Date.now, shared = { statusCache: new Map(), wouldSeen: new Map() },
  isCurrentEpoch = () => true, spawnChild = spawnJson, writeLog = (row) => supLog(row, { env }), reader = openLedgerReader,
  loadDecisions = async () => (fs.existsSync(DECISIONS_FILE) ? import(`file://${DECISIONS_FILE.replace(/\\/g, '/')}`) : null),
} = {}) {
  const keyNow = () => valueOf(key) ?? null;
  const epochNow = () => Number(valueOf(epoch)) || 0;
  const ledgersNow = () => valueOf(ledgers) ?? [];
  const ledgerOf = (ledgerId) => ledgersNow().find((l) => l.ledgerId === ledgerId) ?? null;
  const childEnv = () => ({ ...env, STARCI_ACTOR: `reconciler/${controller}`, STARCI_RECONCILER_EPOCH: String(epochNow()) });

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
    const journal = (sql, ...params) => { try { state?.prepare(sql).run(...params); } catch { /* the journal is best effort */ } };
    journal('INSERT INTO actions(id,controller,key,verb,argv_digest,epoch,state,started_at) VALUES(?,?,?,?,?,?,?,?)', id, controller, k, verb, digest, ep, 'intent', now());
    let current = false;
    try { current = isCurrentEpoch() === true; } catch { current = false; }
    if (!current) {
      journal("UPDATE actions SET state='failed', finished_at=?, result_json=? WHERE id=?", now(), JSON.stringify({ fenced: true }), id);
      return { ok: false, fenced: true, error: 'epoch-fenced: this engine is no longer the leader' };
    }
    journal("UPDATE actions SET state='running' WHERE id=?", id);
    let r;
    try { r = await exec(); } catch (error) { r = { ok: false, error: String(error?.message ?? error) }; }
    const result = { ok: r?.ok === true, code: r?.code ?? null, value: r?.value ?? null, ...(r?.timedOut ? { timedOut: true } : {}), ...(r?.error ? { error: r.error } : {}), ...(r?.ok ? {} : { stderr: clip(r?.stderr, 600) }) };
    journal('UPDATE actions SET state=?, finished_at=?, result_json=? WHERE id=?', result.ok ? 'done' : 'failed', now(), clip(JSON.stringify(result), RESULT_CAP), id);
    log('reconciler.act', `${controller} ${result.ok ? 'ran' : 'FAILED'} ${verb} ${clip(argv.join(' '), 200)}`, { verb, ok: result.ok, actionId: id, argv: clip(argv.join(' '), 1000), epoch: ep, ...(ledgerId ? { ledgerId } : {}) });
    return { ...r, actionId: id };
  };

  const resolveArgs = (args) => args.map((a) => (typeof a === 'string' && /^scripts[\\/]/.test(a) ? path.join(SKILL_ROOT, a) : a));

  const ctx = {
    controller, mode, env, numbers,
    get key() { return keyNow(); },
    get epoch() { return epochNow(); },
    get ledgers() { return ledgersNow(); },
    /** The engine's reconciler.sqlite handle (read and write your own tables through it; never open the file yourself). */
    stateDb: state,
    stateFile,
    now: () => now(),
    read(ledgerId, fn) {
      const l = ledgerOf(ledgerId);
      if (!l || !l.file || !fs.existsSync(l.file)) return null;
      const db = reader(l.file);
      try { return fn(db); } finally { try { db.close(); } catch { /* closed */ } }
    },
    openReader: (file) => reader(file),
    async status(ledgerId, workflowId) {
      const l = ledgerOf(ledgerId);
      if (!l || !workflowId) return null;
      const id = `${ledgerId}\u0000${workflowId}`;
      const hit = shared.statusCache.get(id);
      const ttl = Number(numbers?.statusCacheMs) || 20_000;
      if (hit && now() - hit.at < ttl) return hit.promise;
      const promise = spawnChild(process.execPath, [API_FILE, 'status', '--repo', l.repo, '--workflow', workflowId, '--json'], { env: childEnv(), timeoutMs: DEFAULT_TIMEOUT_MS })
        .then((r) => (r.value && typeof r.value === 'object' ? r.value : null));
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
      const at = now();
      state.prepare(`INSERT INTO sla_clocks(entity,state,ledger_id,entered_at,sla_ms,violated_at,reported_at,cleared_at) VALUES(?,?,?,?,?,NULL,NULL,NULL)
        ON CONFLICT(entity,state) DO UPDATE SET sla_ms=excluded.sla_ms, ledger_id=COALESCE(excluded.ledger_id, sla_clocks.ledger_id),
          entered_at=CASE WHEN sla_clocks.cleared_at IS NOT NULL THEN excluded.entered_at ELSE MIN(sla_clocks.entered_at, excluded.entered_at) END,
          violated_at=CASE WHEN sla_clocks.cleared_at IS NOT NULL THEN NULL ELSE sla_clocks.violated_at END,
          reported_at=CASE WHEN sla_clocks.cleared_at IS NOT NULL THEN NULL ELSE sla_clocks.reported_at END,
          cleared_at=NULL`).run(String(entity), String(clockState), meta?.ledgerId ?? null, Number.isFinite(Number(meta?.enteredAt)) && meta?.enteredAt != null ? Number(meta.enteredAt) : at, Number(slaMs) || 0);
      return true;
    },
    clear(entity, clockState) {
      if (!state) return false;
      return state.prepare('UPDATE sla_clocks SET cleared_at=? WHERE entity=? AND state=? AND cleared_at IS NULL').run(now(), String(entity), String(clockState)).changes > 0;
    },
    /**
     * Open a Decision Item (DESIGN §10.3) through scripts/reconciler/decisions.mjs openDecision(repo, di) when active; a
     * DI with ledger 'supervisor' goes to the supervisor ledger. In shadow, or before that module exists: the would-row.
     */
    async openDecision(di) {
      const item = { schema: 'starci/decision-item@1', openedBy: `${controller}-controller`, openedAt: now(), ...di };
      const summary = { kind: item.kind ?? null, decider: item.decider ?? null, idempotencyKey: item.idempotencyKey ?? null, ledgerId: item.ledger ?? null };
      if (mode !== 'active') return would('decisions --open', [JSON.stringify(summary)], { decision: summary });
      let mod = null;
      try { mod = await loadDecisions(); } catch { mod = null; }
      if (typeof mod?.openDecision !== 'function') return { ...would('decisions --open', [JSON.stringify(summary)], { decision: summary, pending: 'scripts/reconciler/decisions.mjs absent' }), recordedOnly: true };
      const l = ledgerOf(item.ledger ?? '') ?? null;
      return act('decisions --open', [item.idempotencyKey ?? digestOf(item)], async () => {
        const r = await mod.openDecision(l?.repo ?? item.repo ?? null, item, { env: childEnv(), now: now() });
        return r && typeof r === 'object' ? { ...r, ok: r.ok !== false, value: r.json ?? r.value ?? r } : { ok: Boolean(r), value: r };
      }, { ledgerId: item.ledger ?? null });
    },
    log,
    owns(concern) { const owner = CONCERN_OWNER[concern]; return Boolean(owner) && valueOf(modes)?.[owner] === 'active'; },
  };
  return ctx;
}
