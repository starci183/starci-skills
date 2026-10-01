// controllers/resource.mjs — the reconciler's Resource controller (DESIGN §8.3, §14; lane rc-gc-resource).
//
// It wraps scripts/machine/ram-throttle.mjs (and ram-cap.mjs keeps its prioritize/setPriority path), never re-implements
// the math:
//   key resource:host, every resyncMs (30 s):
//     fleetCensus (every ledger the machine registry names) + machineLoad + memoryProbe (host-resources) → nextMode
//     (hysteresis: minFreeRamPct 10 / heavyResumeAbovePct 15, landSpecPauseBelowPct 2.5 / landSpecResumeAbovePct 5,
//     CPU 0.95 / 0.85) → machine.sqlite throttle_state (publishThrottle → setThrottle: a mode change appends its
//     throttle_events row first) + one host_samples row kind 'host': in active this controller is the single writer
//     of the mode; in shadow it writes NOTHING and keeps its own hysteresis in memory, recording a reconciler.would
//     row when its mode or slot targets change (with the published mode beside it: the shadow diff);
//     fair share: per-workflow slot targets (reserve first, then weight share of maxParallelOps among workflows with
//     ready work, water-filled up to each one's demand) published as `slotTargets` in the same state, for lane B's
//     dispatch pass and admitOp to read; admitOp's own semantics are unchanged;
//     every footprintEveryMs (5 min) one op-ram-footprint sample (footprintSample) as host_samples kind 'op-footprint';
//     clocks RAM_CRITICAL (mode critical) and DISK_LOW (host-resources lowDisk); cap-starved: the priority workflow
//     (reserve > 0) held fewer slots than min(reserve, demand) for capStarvedMs (15 min) → a Decision Item to the
//     Supervisor;
//   key resource:quota:<ledgerId>, every quotaProbeEveryMs (5 min) while a quota circuit is open on that ledger:
//     `api provider-health --quota-probe` through ctx.api (shadow-gated by the engine); and quota-exhausted: every
//     pool named by an op kind's queued jobs has an open provider circuit, none of that kind runs, and ready work
//     waits → a Decision Item to the Supervisor.
//
// Numbers: modules/reconciler/resource.yaml. createResourceController(deps) is the spec seam.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { providerCircuits } from '../../machine/provider-circuit.mjs';
import { claimDue, finishDuty } from '../schedules.mjs';
import { readSupervisor, withSupervisor } from '../../machine/home.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NAME = 'resource';
const WRITER = 'reconciler/resource';
const WOULD = 'reconciler.would';
export const HOST_KEY = 'resource:host';
export const POOLS_KEY = 'resource:pools';
export const RATE_LIMITED_EVENT = 'provider-rate-limited';
export const quotaKey = (ledgerId) => `resource:quota:${ledgerId}`;
export const DEFAULTS = Object.freeze({ resyncMs: 30_000, concurrency: 2, footprintEveryMs: 300_000, quotaProbeEveryMs: 300_000,
  capStarvedMs: 900_000, ramCriticalSlaMs: 600_000, diskLowSlaMs: 3_600_000, quotaProbeTimeoutMs: 120_000,
  backoffFloor: 2, backoffDecreaseCooldownMs: 120_000, backoffIncreaseAfterMs: 900_000, backoffIncreaseStepMs: 300_000,
  backoffStaleMs: 600_000, backoffPersistMs: 900_000 });
/** Non-numeric settings of resource.yaml. */
export const TEXT_DEFAULTS = Object.freeze({ backoffCircuitKind: 'quota' });

/** modules/reconciler/resource.yaml over the defaults. */
export function resourceControllerSettings(file = path.join(ROOT, 'modules', 'reconciler', 'resource.yaml')) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) { const n = Number(doc?.[k]); if (Number.isFinite(n) && n > 0) out[k] = n; }
  for (const [k, d] of Object.entries(TEXT_DEFAULTS)) out[k] = ['quota', 'rate-limited'].includes(doc?.[k]) ? doc[k] : d;
  return out;
}

/** {pool: cap} of the backed-off entries. */
const poolCapsOf = (entries) => Object.fromEntries(Object.entries(entries ?? {}).filter(([, e]) => e && e.cap < e.max).map(([k, e]) => [k, e.cap]));

/* ------------------------------------------------------------ fair share (pure) */

/**
 * Per-workflow slot targets. `ops`: the fleet census [{workflowId, status}] (queued rows included); `priorities`:
 * priorityTable(); `maxParallelOps`: the owner's ceiling (null: the total demand). Only workflows with ready (queued)
 * work get a target; the slots that workflows without ready work already hold are taken off the top. Reserve first
 * (weight order), then one slot at a time to the unsaturated workflow with the lowest target/weight (ties: higher
 * weight, then id), never above a workflow's demand (queued + running). Σ targets ≤ maxParallelOps.
 * {capacity, free, targets: {<workflowId>: {target, weight, reserve, running, queued, demand}}}.
 */
export function fairShare({ ops = [], priorities = {}, maxParallelOps = null }) {
  const by = new Map();
  for (const o of ops) {
    const id = o.workflowId ?? '(none)';
    const w = by.get(id) ?? { running: 0, queued: 0 };
    if (o.status === 'queued') w.queued += 1; else w.running += 1;
    by.set(id, w);
  }
  const demandTotal = [...by.values()].reduce((n, w) => n + w.running + w.queued, 0);
  const capacity = Number.isInteger(Number(maxParallelOps)) && Number(maxParallelOps) > 0 ? Number(maxParallelOps) : demandTotal;
  const heldElsewhere = [...by.values()].filter((w) => w.queued === 0).reduce((n, w) => n + w.running, 0);
  let free = Math.max(0, capacity - heldElsewhere);
  const ready = [...by.entries()].filter(([, w]) => w.queued > 0).map(([id, w]) => ({ id, ...w, demand: w.running + w.queued,
    weight: priorities?.[id]?.weight ?? 1, reserve: priorities?.[id]?.reserve ?? 0, target: 0 }));
  const order = (a, b) => b.weight - a.weight || a.id.localeCompare(b.id);
  for (const w of [...ready].sort(order)) {
    const r = Math.min(w.reserve, w.demand, free);
    w.target = r; free -= r;
  }
  while (free > 0) {
    const open = ready.filter((w) => w.target < w.demand);
    if (!open.length) break;
    open.sort((a, b) => a.target / a.weight - b.target / b.weight || order(a, b));
    open[0].target += 1; free -= 1;
  }
  const targets = {};
  for (const w of ready) targets[w.id] = { target: w.target, weight: w.weight, reserve: w.reserve, running: w.running, queued: w.queued, demand: w.demand };
  return { capacity, free, targets };
}

/**
 * The priority workflows starving now. Pure. Demand is running + queued-READY (api status progress.queuedReady: the
 * queued jobs whose queuedBecause is 'ready'); a job waiting on a live file lease, a dependency, a decision or any
 * other wait is not demand the slots could serve. `ready`: {<workflowId>: queuedReady}; a workflow with no reading
 * counts no ready work (never starved on a guess). Starved: reserve > 0, queuedReady > 0, running <
 * min(reserve, running + queuedReady).
 */
export function starvedWorkflows({ ops = [], priorities = {}, ready = {} }) {
  const out = [];
  for (const [id, p] of Object.entries(priorities ?? {})) {
    if (!(p?.reserve > 0)) continue;
    const mine = ops.filter((o) => o.workflowId === id);
    const running = mine.filter((o) => o.status !== 'queued').length;
    const queued = mine.length - running;
    const queuedReady = Math.max(0, Math.floor(Number(ready?.[id]) || 0));
    const want = Math.min(p.reserve, running + queuedReady);
    if (queuedReady > 0 && running < want) out.push({ workflowId: id, running, queued, queuedReady, want, reserve: p.reserve, weight: p.weight });
  }
  return out;
}

/**
 * quota-exhausted over one ledger. Pure. `jobs`: [{op, status, pool}] (queued and slot-holding ops); `openProviders`:
 * the providers whose circuit is open; `providerOf(pool)`. An op kind is exhausted when it has queued work, none of
 * it runs, and every pool its queued jobs name maps to an open provider (a kind whose queued jobs name no pool yet
 * is never judged: the router picks at dispatch). [{op, queued, pools, providers}].
 */
export function quotaExhausted({ jobs = [], openProviders = [], providerOf = () => null }) {
  const open = new Set(openProviders);
  const kinds = new Map();
  for (const j of jobs) { const k = kinds.get(j.op) ?? []; k.push(j); kinds.set(j.op, k); }
  const out = [];
  for (const [op, list] of kinds) {
    const queued = list.filter((j) => j.status === 'queued');
    if (!queued.length || list.some((j) => j.status !== 'queued')) continue;
    if (queued.some((j) => !j.pool)) continue;
    const pools = [...new Set(queued.map((j) => j.pool))];
    const providers = pools.map((p) => providerOf(p));
    if (providers.some((p) => !p || !open.has(p))) continue;
    out.push({ op, queued: queued.length, pools, providers: [...new Set(providers)] });
  }
  return out;
}

/* ------------------------------------------------------------ live deps */

const liveDeps = {
  throttle: () => import('../../machine/ram-throttle.mjs'),
  settings: async () => (await import('../../../engine/config.mjs')).allocationSettings(),
  maxParallelOps: async () => { const n = Number((await import('../../../engine/config.mjs')).runtimeProfile()?.maxParallelOps); return Number.isInteger(n) && n > 0 ? n : null; },
  providerOf: async () => {
    const doc = (await import('../../../engine/config.mjs')).runtimeProfile();
    return (pool) => Object.entries(doc?.runtimes ?? {}).find(([id, r]) => (r?.target ?? id) === pool)?.[1]?.provider ?? null;
  },
  host: async () => (await import('../../machine/host-resources.mjs')).hostResourcesFor({}),
  // api status progress.queuedReady of one workflow (ctx.status, cached and shared); its ledger from the census row's file.
  queuedReady: async (ctx, workflowId, ledgerFile) => {
    const key = (f) => String(f ?? '').replace(/\\/g, '/').toLowerCase();
    const l = (ctx.ledgers ?? []).find((x) => x.ledgerId !== 'supervisor' && x.file && key(x.file) === key(ledgerFile));
    const ids = l ? [l.ledgerId] : (ctx.ledgers ?? []).filter((x) => x.ledgerId !== 'supervisor').map((x) => x.ledgerId);
    for (const id of ids) {
      const st = await ctx.status(id, workflowId);
      const n = Number(st?.progress?.queuedReady);
      if (Number.isFinite(n)) return n;
    }
    return null;
  },
  poolBackoff: () => import('../../machine/pool-backoff.mjs'),
  pools: async () => Object.entries((await import('../../../engine/config.mjs')).runtimeProfile()?.runtimes ?? {})
    .map(([id, r]) => ({ target: r?.target ?? id, provider: r?.provider ? String(r.provider).toLowerCase().replace(/-agent$/, '') : null, maxParallel: Number(r?.maxParallel) || null })),
  load: async () => { try { return (await import('../../machine/host-resources.mjs')).machineLoad({ sampleMs: 200 })?.cpuBusy ?? null; } catch { return null; } },
  census: async () => (await import('../../machine/ram-throttle.mjs')).fleetCensus({}),
  footprints: async (limit, env) => { try { return (await import('../../machine/ram-throttle.mjs')).recentFootprints({ limit, env: env ?? process.env }); } catch { return []; } },
  // async: the sync process-table read blocks the engine's one thread for minutes on a loaded host (ENGINE-STALL)
  owners: async () => { const h = await import('../../supervisor/host-health.mjs'); return h.groupByOwner(await h.listProcessesAsync(), { limit: Infinity }); },
  recordFootprint: async (payload, env) => {
    const { recordFootprint } = await import('../../machine/ram-throttle.mjs');
    withSupervisor((m) => recordFootprint(m, payload), { env });
  },
  // machine.sqlite of this env (a spec passes STARCI_TEST_MACHINE_FILE in `env`); null: process.env.
  env: null,
};
const MB = 1048576;

/* ------------------------------------------------------------ the controller */

export function createResourceController(overrides = {}) {
  const deps = { ...liveDeps, ...overrides };
  const env = () => deps.env ?? process.env;
  const writeMachine = (fn) => withSupervisor(fn, { env: env() });
  const readMachineOr = (fn, fallback) => readSupervisor(fn, fallback, { env: env() });
  const settings = { ...resourceControllerSettings(), ...(overrides.config ?? {}) };
  // Shadow keeps its own hysteresis (it never writes throttle_state); active reads it back from the row it writes.
  const memory = { shadowPrev: null, lastWould: null, lastFootprintAt: null, starving: {}, clocks: {}, lastProbe: {},
    pools: null, poolCursor: {}, providerSeen: {}, poolWould: null, circuits: {} };

  const clock = (ctx, entity, state, on, slaMs, meta) => {
    const k = `${entity}|${state}`;
    if (on && !memory.clocks[k]) { memory.clocks[k] = ctx.now(); ctx.clock(entity, state, slaMs, meta); }
    else if (!on && memory.clocks[k]) { delete memory.clocks[k]; ctx.clear(entity, state); }
  };

  async function reconcileHost(ctx) {
    const t = await deps.throttle();
    const s = await deps.settings();
    const thresholds = t.throttleThresholds(s);
    const now = ctx.now();
    const host = await deps.host();
    const cpuBusy = await deps.load();
    const census = await deps.census();
    const ops = census?.ops ?? [];
    const live = t.readThrottleState({ env: env() });
    const active = ctx.mode === 'active';
    const prev = active ? live : (memory.shadowPrev ?? { ramMode: live.ramMode, cpuHot: live.cpuHot, mode: live.mode, since: live.since });
    const ramKnown = Number(host?.totalRamBytes) > 0 || host?.freeRamPct != null && host?.override;
    const m = ramKnown ? t.nextMode(prev, { freeRamPct: host.freeRamPct, cpuBusy }, thresholds)
      : { mode: prev.mode ?? 'normal', ramMode: prev.ramMode ?? 'normal', cpuHot: Boolean(prev.cpuHot), why: 'RAM unmeasured: mode unchanged' };
    const maxParallelOps = await deps.maxParallelOps();
    const estimates = t.opRamEstimates(t.opRamTable(s), await deps.footprints(thresholds.historySamples, env()), thresholds);
    const running = ops.filter((o) => o.status !== 'queued');
    const cap = t.effectiveCapOf({ maxParallelOps, running: running.length, host, mode: m.mode, estimates, thresholds });
    const priorities = t.priorityTable(s, live);
    const share = fairShare({ ops, priorities, maxParallelOps });
    const changed = prev.mode !== m.mode;
    const since = changed ? new Date(now).toISOString() : prev.since ?? null;
    const patch = { mode: m.mode, ramMode: m.ramMode, cpuHot: m.cpuHot, why: m.why, at: new Date(now).toISOString(), since,
      ...(changed ? { from: prev.mode ?? null } : {}), freeRamPct: Math.round(Number(host?.freeRamPct ?? 0) * 10) / 10,
      cpuBusy: cpuBusy == null ? null : Math.round(cpuBusy * 1000) / 1000, effectiveCap: cap.effectiveCap, heavyCap: cap.heavyCap, running: running.length,
      writer: WRITER, slotTargets: { at: new Date(now).toISOString(), maxParallelOps, capacity: share.capacity, targets: share.targets, poolCaps: poolCapsOf(memory.pools) } };

    let wrote = false;
    if (active) {
      try {
        const freeRamMb = host?.freeRamBytes == null ? null : Math.round(Number(host.freeRamBytes) / MB);
        writeMachine((mm) => mm.transaction(() => {
          t.publishThrottle(mm, { mode: m.mode, cpuHot: m.cpuHot, why: m.why, effectiveCap: cap.effectiveCap, heavyCap: cap.heavyCap, running: running.length,
            freeRamPct: patch.freeRamPct, freeRamMb, cpuBusy: patch.cpuBusy, slotTargets: patch.slotTargets, writer: WRITER,
            sample: { freeRamPct: patch.freeRamPct, cpuBusy: patch.cpuBusy, ramMode: m.ramMode, cpuHot: m.cpuHot, why: m.why } });
          mm.recordHostSample({ kind: 'host', freeRamPct: patch.freeRamPct, freeRamMb, cpuPct: patch.cpuBusy == null ? null : Math.round(patch.cpuBusy * 1000) / 10,
            freeDiskGb: host?.freeDiskGb ?? null, mode: t.dbMode(m.mode), effectiveCap: cap.effectiveCap, running: running.length });
        }));
        wrote = true;
      } catch (error) { ctx.log('reconciler.resource.error', `throttle_state: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
    } else {
      memory.shadowPrev = { mode: m.mode, ramMode: m.ramMode, cpuHot: m.cpuHot, since };
      const sig = JSON.stringify({ mode: m.mode, targets: Object.fromEntries(Object.entries(share.targets).map(([k, v]) => [k, v.target])) });
      if (sig !== memory.lastWould) {
        memory.lastWould = sig;
        ctx.log(WOULD, `throttle state: mode ${m.mode} (published: ${live.mode ?? '-'}), slot targets ${Object.entries(share.targets).map(([k, v]) => `${k}=${v.target}`).join(', ') || '-'}`,
          { controller: NAME, action: 'setThrottle', patch, liveMode: live.mode ?? null, liveWriter: live.writer ?? null, diff: (live.mode ?? 'normal') !== m.mode });
      }
    }

    // op-ram-footprint every footprintEveryMs (as tick.mjs recorded it).
    let footprint = null;
    // MB-01: the cadence is durable (schedules), not per engine process.
    if (claimDue(ctx, { controller: NAME, duty: 'footprint', intervalMs: settings.footprintEveryMs, now }).due) {
      finishDuty(ctx, { controller: NAME, duty: 'footprint', result: active ? 'done' : 'skipped', now });
      try {
        const owners = await deps.owners();
        footprint = t.footprintSample({ owners, ops, kernels: census?.kernels ?? 0, freeRamPct: patch.freeRamPct });
        if (active) await deps.recordFootprint(footprint, env());
        else ctx.log(WOULD, `op-ram-footprint: op agents ${footprint.opAgentRamMb} MB`, { controller: NAME, action: 'recordHostSample', kind: t.FOOTPRINT_SAMPLE_KIND, payload: footprint });
      } catch (error) { ctx.log('reconciler.resource.error', `footprint: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
    }

    // Clocks: RAM_CRITICAL, DISK_LOW (lane F reads them).
    clock(ctx, 'host:local', 'RAM_CRITICAL', m.mode === 'critical', settings.ramCriticalSlaMs, { freeRamPct: patch.freeRamPct, why: m.why });
    clock(ctx, 'host:local', 'DISK_LOW', Boolean(host?.lowDisk), settings.diskLowSlaMs, { drive: host?.drive ?? null, freeDiskGb: host?.freeDiskGb ?? null });

    // cap-starved: the priority workflow below its reserve for capStarvedMs → a Decision Item to the Supervisor.
    const ready = {};
    for (const [id, p] of Object.entries(priorities ?? {})) {
      if (!(p?.reserve > 0) || !ops.some((o) => o.workflowId === id && o.status === 'queued')) continue;
      try { const n = await deps.queuedReady(ctx, id, ops.find((o) => o.workflowId === id)?.ledger ?? null); if (Number.isFinite(n)) ready[id] = n; } catch { /* no reading: not starved */ }
    }
    const starved = starvedWorkflows({ ops, priorities, ready });
    const nowStarving = new Set(starved.map((w) => w.workflowId));
    for (const id of Object.keys(memory.starving)) if (!nowStarving.has(id)) { delete memory.starving[id]; clock(ctx, `workflow:${id}`, 'CAP_STARVED', false); }
    // Once per engine life: clear a CAP_STARVED clock a previous run left open for a workflow that is not starving now
    // (the memory that would clear it on the transition did not survive the restart).
    if (!memory.starvedSwept) {
      memory.starvedSwept = true;
      for (const [id, p] of Object.entries(priorities ?? {})) if (p?.reserve > 0 && !nowStarving.has(id)) ctx.clear(`workflow:${id}`, 'CAP_STARVED');
    }
    const decisions = [];
    for (const w of starved) {
      memory.starving[w.workflowId] ??= { since: now, opened: false };
      clock(ctx, `workflow:${w.workflowId}`, 'CAP_STARVED', true, settings.capStarvedMs, w);
      const st = memory.starving[w.workflowId];
      if (!st.opened && now - st.since >= settings.capStarvedMs) {
        st.opened = true;
        await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'cap-starved', decider: 'supervisor', ledger: 'supervisor', workflowId: w.workflowId,
          idempotencyKey: `cap-starved:${w.workflowId}:${new Date(st.since).toISOString()}`, entity: { type: 'workflow', id: w.workflowId },
          summary: `priority workflow ${w.workflowId} held ${w.running} of its reserve ${w.reserve} slot(s) for ${Math.round((now - st.since) / 60000)} min with ${w.queued} op(s) ready (mode ${m.mode}, cap ${cap.effectiveCap ?? '-'}/${maxParallelOps ?? '-'})`,
          evidence: [{ ref: `throttle:${m.why}` }, { ref: `cap:${cap.why}` }], options: [{ key: 'ram-cap-prioritize', verb: `node scripts/supervisor/ram-cap.mjs prioritize --workflow ${w.workflowId} --weight <n> --reserve <slots>`, recommended: true }],
          allowedVerbs: ['ram-cap prioritize', 'ram-cap unprioritize'], openedBy: 'resource-controller', escalateTo: 'owner' });
        decisions.push(`cap-starved:${w.workflowId}`);
      }
    }
    return { mode: m.mode, changed, wrote, shadow: !active, targets: share.targets, footprint: footprint != null, decisions };
  }

  /**
   * resource:pools — adaptive per-pool concurrency (AIMD, scripts/machine/pool-backoff.mjs). The rate-limit signals since
   * the last pass: provider-rate-limited events of every product ledger (payload pool / model / target, else the
   * job's routed pool, else every pool of payload.provider) and provider-health rows of failureKind rate-limited
   * observed since. Halve on a signal (floor backoffFloor, at most once per backoffDecreaseCooldownMs), +1 per
   * backoffIncreaseStepMs after backoffIncreaseAfterMs quiet, up to the pool's runtimes.yaml maxParallel. Active:
   * machine.sqlite pool_backoff rows (route reads them and prefers the next eligible pool); shadow: a would-row
   * when the caps change. A pool held at its floor while the rate limit persists for backoffPersistMs opens the
   * provider circuit (api provider-backoff) on every product ledger, once per floor episode.
   */
  async function reconcilePools(ctx) {
    const pb = await deps.poolBackoff();
    const t = await deps.throttle();
    const now = ctx.now();
    const pools = await deps.pools(); // [{target, provider, maxParallel}]
    const byTarget = new Map(pools.map((p) => [p.target, p]));
    const byProvider = new Map();
    for (const p of pools) if (p.provider) { const l = byProvider.get(p.provider) ?? []; l.push(p.target); byProvider.set(p.provider, l); }
    const providerKey = (v) => String(v ?? '').trim().toLowerCase().replace(/-agent$/, '');
    const hits = {}; // pool target -> newest signal time
    const hit = (target, at) => { if (target && byTarget.has(target)) hits[target] = Math.max(hits[target] ?? 0, Number(at) || now); };
    const seedSince = now - settings.backoffIncreaseAfterMs;
    // One signal's pool: a named pool target (model / pool / target / the job's routed pool), else every pool of its
    // provider (provider / pool naming a provider, e.g. the worker's agent identity).
    const hitSignal = (p, at) => {
      const named = [p.model, p.pool, p.target, p.jobPool].find((v) => v && byTarget.has(v));
      if (named) return hit(named, at);
      const prov = [p.provider, p.pool].map(providerKey).find((v) => v && byProvider.has(v));
      for (const target of byProvider.get(prov) ?? []) hit(target, at);
    };
    // The Job controller's worker-health probe logs reconciler.provider-rate-limited typed rows (ctx.log, lane B) in
    // machine.sqlite machine_logs: {jobId, workflowId, provider, pool, model, resetMs}.
    try {
      const since = memory.poolCursor.machine ?? null;
      const rows = readMachineOr((mm) => ({
        logs: mm.db.prepare(`SELECT seq, at, data_json d FROM machine_logs WHERE kind IN ('reconciler.provider-rate-limited','provider-rate-limited') AND ${since == null ? 'at>=?' : 'seq>?'} ORDER BY seq`).all(since == null ? seedSince : since),
        maxSeq: mm.db.prepare('SELECT COALESCE(MAX(seq),0) s FROM machine_logs').get()?.s ?? 0,
      }), null);
      if (rows) {
        memory.poolCursor.machine = Math.max(Number(since) || 0, Number(rows.maxSeq) || 0);
        for (const r of rows.logs ?? []) { let d = {}; try { d = JSON.parse(r.d || '{}'); } catch { d = {}; } hitSignal(d, r.at); }
      }
    } catch { /* an unreadable machine.sqlite adds no signal */ }
    const EVENTS_SQL = `SELECT e.seq, e.created_at at, e.payload_json p, json_extract(j.payload_json,'$.model') jobPool
      FROM events e LEFT JOIN jobs j ON j.job_id=e.entity_id WHERE e.kind=? AND `;
    for (const l of (ctx.ledgers ?? []).filter((x) => x.ledgerId !== 'supervisor')) {
      const since = memory.poolCursor[l.ledgerId] ?? null;
      let rows = null;
      try {
        rows = await ctx.read(l.ledgerId, (db) => ({
          events: db.prepare(EVENTS_SQL + (since == null ? 'e.created_at>=? ORDER BY e.seq' : 'e.seq>? ORDER BY e.seq')).all(RATE_LIMITED_EVENT, since == null ? seedSince : since),
          maxSeq: db.prepare('SELECT COALESCE(MAX(seq),0) s FROM events').get()?.s ?? 0,
        }));
      } catch { rows = null; }
      if (!rows) continue;
      memory.poolCursor[l.ledgerId] = Math.max(Number(since) || 0, Number(rows.maxSeq) || 0);
      for (const e of rows.events ?? []) {
        let p = {}; try { p = JSON.parse(e.p || '{}'); } catch { p = {}; }
        hitSignal({ ...p, jobPool: e.jobPool }, e.at);
      }
    }
    // The provider circuits: one fleet-wide row per provider in machine.sqlite provider_health (a3-4, provider-circuit.mjs).
    for (const c of (deps.providerCircuits ?? providerCircuits)()) {
      const v = c.value ?? {};
      const at = Number(v.observedAt) || Number(c.at) || 0;
      const k = providerKey(v.provider ?? c.provider);
      if (v.failureKind !== 'rate-limited' || at < seedSince || at <= (memory.providerSeen[k] ?? 0)) continue;
      memory.providerSeen[k] = at;
      for (const target of byProvider.get(k) ?? []) hit(target, at);
    }
    const liveRows = readMachineOr((mm) => mm.poolBackoff(), []);
    const active = ctx.mode === 'active';
    const prevAll = memory.pools ?? (active ? pb.entriesOfRows(liveRows) : {});
    const next = {};
    for (const p of pools) {
      const max = Number(p.maxParallel);
      if (!Number.isInteger(max) || max < 1) continue;
      const e = pb.aimdStep(prevAll[p.target] ?? null, { max, rateLimitAt: hits[p.target] ?? null, now, floor: settings.backoffFloor,
        decreaseCooldownMs: settings.backoffDecreaseCooldownMs, increaseAfterMs: settings.backoffIncreaseAfterMs, increaseStepMs: settings.backoffIncreaseStepMs });
      if (e) next[p.target] = { ...e, provider: p.provider ?? null };
    }
    memory.pools = next;
    const caps = poolCapsOf(next);
    if (active) {
      if (Object.keys(next).length || liveRows.length) {
        try {
          writeMachine((mm) => mm.transaction(() => {
            for (const [pool, e] of Object.entries(next)) mm.setPoolBackoff(pb.poolRowOf(pool, e, { now, staleMs: settings.backoffStaleMs }));
            for (const r of liveRows) if (!next[r.pool]) mm.clearPoolBackoff(r.pool);
          }));
        } catch (error) { ctx.log('reconciler.resource.error', `pool_backoff: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
      }
    } else {
      const sig = JSON.stringify(caps);
      if (sig !== memory.poolWould) {
        memory.poolWould = sig;
        const text = Object.entries(next).map(([k, e]) => `${k} ${e.cap}/${e.max}${e.reason ? ` (${e.reason})` : ''}`).join(', ') || 'every pool at its maxParallel';
        ctx.log(WOULD, `pool backoff: ${text}`, { controller: NAME, action: 'setPoolBackoff', patch: { poolBackoff: next }, caps });
      }
    }
    // A rate limit that persists at the floor: the provider circuit, once per floor episode, on every product ledger.
    const circuits = [];
    const byProv = new Map();
    for (const [target, e] of Object.entries(next)) {
      const per = pb.backoffPersists(e, { now, persistMs: settings.backoffPersistMs, floor: Math.min(settings.backoffFloor, e.max) });
      if (per.persists && e.provider && !byProv.has(e.provider)) byProv.set(e.provider, { target, e, since: per.since });
    }
    for (const [provider, { target, e, since }] of byProv) {
      const episode = `${provider}|${since}`;
      if (memory.circuits[provider] === episode) continue;
      memory.circuits[provider] = episode;
      const reason = `pool ${target} held at ${e.cap}/${e.max} since ${new Date(since).toISOString()} and still rate limited (last ${new Date(e.lastRateLimitAt).toISOString()})`;
      for (const l of (ctx.ledgers ?? []).filter((x) => x.ledgerId !== 'supervisor'))
        await ctx.api(l.ledgerId, 'provider-backoff', ['--provider', provider, '--open-circuit', '--kind', settings.backoffCircuitKind, '--reason', reason, '--by', WRITER], { timeoutMs: 60_000 });
      circuits.push(provider);
    }
    return { caps, hits: Object.keys(hits), circuits, shadow: !active };
  }

  async function reconcileQuota(ctx, ledgerId) {
    if (ledgerId === 'supervisor') return { skipped: 'the supervisor ledger runs no provider ops' };
    const now = ctx.now();
    const circuits = (deps.providerCircuits ?? providerCircuits)().map((c) => ({ provider: c.value?.provider ?? c.provider, status: c.value?.status ?? null,
      failureKind: c.value?.failureKind ?? null, expiresAt: Number(c.expiresAt) || null }));
    const read = ctx.read(ledgerId, (db) => {
      const jobs = db.prepare(`SELECT op_id op, status, json_extract(payload_json,'$.model') pool FROM jobs WHERE kind<>'kernel' AND op_id IS NOT NULL
        AND status IN ('queued','leased','running','reported','effect_unknown','answering')`).all();
      return { jobs };
    });
    const { jobs = [] } = (await read) ?? {};
    const open = circuits.filter((c) => c.status === 'unavailable' && (c.expiresAt == null || c.expiresAt > now));
    const quotaOpen = open.filter((c) => c.failureKind === 'quota');
    let probed = false;
    if (quotaOpen.length && (memory.lastProbe[ledgerId] == null || now - memory.lastProbe[ledgerId] >= settings.quotaProbeEveryMs)) {
      memory.lastProbe[ledgerId] = now;
      await ctx.api(ledgerId, 'provider-health', ['--quota-probe'], { timeoutMs: settings.quotaProbeTimeoutMs });
      probed = true;
    }
    const exhausted = open.length ? quotaExhausted({ jobs, openProviders: open.map((c) => c.provider), providerOf: await deps.providerOf() }) : [];
    for (const e of exhausted) {
      await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'quota-exhausted', decider: 'supervisor', ledger: ledgerId,
        idempotencyKey: `quota-exhausted:${ledgerId}:${e.op}:${e.providers.slice().sort().join('+')}`, entity: { type: 'job', id: `${ledgerId}:${e.op}` },
        summary: `${e.queued} ready ${e.op} op(s) on ${ledgerId} wait and every pool they name (${e.pools.join(', ')}) has an open circuit (${e.providers.join(', ')})`,
        evidence: open.filter((c) => e.providers.includes(c.provider)).map((c) => ({ ref: `circuit:${c.provider} ${c.failureKind} until ${c.expiresAt ? new Date(c.expiresAt).toISOString() : '?'}` })),
        options: [{ key: 'reroute', verb: 'api graph-edit / reroute the kind to a pool with quota', recommended: true }, { key: 'wait', verb: 'wait for the circuit to clear (quota probe every 5 min)' }],
        allowedVerbs: ['graph-edit', 'provider-health'], openedBy: 'resource-controller', escalateTo: 'owner' });
    }
    return { ledgerId, open: open.length, quotaOpen: quotaOpen.length, probed, exhausted: exhausted.map((e) => e.op) };
  }

  return {
    name: NAME,
    concerns: ['resource.throttle', 'resource.quota'],
    resyncMs: settings.resyncMs,
    concurrency: settings.concurrency,
    // A rate-limit signal (lane B's worker-health probe) re-reads every pool at once.
    routes: { [RATE_LIMITED_EVENT]: () => POOLS_KEY },
    async list(ctx) { return [HOST_KEY, POOLS_KEY, ...(ctx?.ledgers ?? []).filter((l) => l.ledgerId !== 'supervisor').map((l) => quotaKey(l.ledgerId))]; },
    async reconcile(key, ctx) {
      if (key === HOST_KEY) return reconcileHost(ctx);
      if (key === POOLS_KEY) return reconcilePools(ctx);
      const m = /^resource:quota:(.+)$/.exec(String(key));
      if (m) return reconcileQuota(ctx, m[1]);
      return { skipped: `unknown key ${key}` };
    },
    _memory: memory,
  };
}

export default createResourceController();
