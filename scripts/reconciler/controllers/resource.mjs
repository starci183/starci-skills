// controllers/resource.mjs — the reconciler's Resource controller (DESIGN §8.3, §14; lane rc-gc-resource).
//
// It wraps scripts/machine/ram-throttle.mjs (and ram-cap.mjs keeps its prioritize/setPriority path), never re-implements
// the math:
//   key resource:host, every resyncMs (30 s):
//     workersCensus (every ledger the machine registry names) + machineLoad + memoryProbe (host-resources) → nextMode
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
//     `starci kernel provider-health --quota-probe` through ctx.api (shadow-gated by the engine); and quota-exhausted: every
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
import { normalizeProvider } from '../../lib/provider.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { eachInOrder, findInOrder } from '../../lib/in-order.mjs';
import { fairShare, starvedWorkflows, quotaExhausted } from '../resource-share.mjs';

export { fairShare, starvedWorkflows, quotaExhausted };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NAME = 'resource';
const WRITER = 'reconciler/resource';
const WOULD = 'reconciler.would';
export const HOST_KEY = 'resource:host';
export const POOLS_KEY = 'resource:pools';
const RATE_LIMITED_EVENT = 'provider-rate-limited';
const quotaKey = (ledgerId) => `resource:quota:${ledgerId}`;
export const DEFAULTS = Object.freeze({ resyncMs: 30_000, concurrency: 2, footprintEveryMs: 300_000, quotaProbeEveryMs: 300_000,
  capStarvedMs: 900_000, ramCriticalSlaMs: 600_000, diskLowSlaMs: 3_600_000, quotaProbeTimeoutMs: 120_000,
  backoffFloor: 2, backoffDecreaseCooldownMs: 120_000, backoffIncreaseAfterMs: 900_000, backoffIncreaseStepMs: 300_000,
  backoffStaleMs: 600_000, backoffPersistMs: 900_000 });
/** Non-numeric settings of resource.yaml. */
const TEXT_DEFAULTS = Object.freeze({ backoffCircuitKind: 'quota' });

/** modules/reconciler/resource.yaml over the defaults. */
function resourceControllerSettings(file = path.join(ROOT, 'modules', 'reconciler', 'resource.yaml')) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) { const n = Number(doc?.[k]); if (Number.isFinite(n) && n > 0) out[k] = n; }
  for (const [k, d] of Object.entries(TEXT_DEFAULTS)) out[k] = ['quota', 'rate-limited'].includes(doc?.[k]) ? doc[k] : d;
  return out;
}

/** {pool: cap} of the backed-off entries. */
const poolCapsOf = (entries) => Object.fromEntries(Object.entries(entries ?? {}).filter(([, e]) => e && e.cap < e.max).map(([k, e]) => [k, e.cap]));

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
  // starci kernel status progress.queuedReady of one workflow (ctx.status, cached and shared); its ledger from the census row's file.
  queuedReady: async (ctx, workflowId, ledgerFile) => {
    const key = (f) => String(f ?? '').replaceAll('\\', '/').toLowerCase();
    const l = (ctx.ledgers ?? []).find((x) => x.ledgerId !== 'supervisor' && x.file && key(x.file) === key(ledgerFile));
    const ids = l ? [l.ledgerId] : (ctx.ledgers ?? []).filter((x) => x.ledgerId !== 'supervisor').map((x) => x.ledgerId);
    let ready = null;
    await findInOrder(ids, async (id) => {
      const n = Number((await ctx.status(id, workflowId))?.progress?.queuedReady);
      if (Number.isFinite(n)) ready = n;
      return ready !== null;
    });
    return ready;
  },
  poolBackoff: () => import('../../machine/pool-backoff.mjs'),
  pools: async () => Object.entries((await import('../../../engine/config.mjs')).runtimeProfile()?.runtimes ?? {})
    .map(([id, r]) => ({ target: r?.target ?? id, provider: r?.provider ? String(r.provider).toLowerCase().replace(/-agent$/, '') : null, maxParallel: Number(r?.maxParallel) || null })),
  load: async () => { try { return (await import('../../machine/host-resources.mjs')).machineLoad({ sampleMs: 200 })?.cpuBusy ?? null; } catch { return null; } },
  census: async () => (await import('../../machine/ram-throttle.mjs')).workersCensus({}),
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
const EVENTS_SQL = `SELECT e.seq, e.created_at at, e.payload_json p, json_extract(j.payload_json,'$.model') jobPool
  FROM events e LEFT JOIN jobs j ON j.job_id=e.entity_id WHERE e.kind=? AND `;
const productLedgers = (ctx) => (ctx.ledgers ?? []).filter((x) => x.ledgerId !== 'supervisor');
const jsonOr = (text) => { try { return JSON.parse(text || '{}'); } catch { return {}; } };

/** The mode after one pass: the hysteresis step when RAM is measured, else the previous mode unchanged. */
function modeOf(t, { prev, host, cpuBusy, thresholds }) {
  const ramKnown = Number(host?.totalRamBytes) > 0 || host?.freeRamPct != null && host?.override;
  if (ramKnown) return t.nextMode(prev, { freeRamPct: host.freeRamPct, cpuBusy }, thresholds);
  return { mode: prev.mode ?? 'normal', ramMode: prev.ramMode ?? 'normal', cpuHot: Boolean(prev.cpuHot), why: 'RAM unmeasured: mode unchanged' };
}

/**
 * The rate-limit signal sink of one pools pass: `hit(target, at)` keeps the newest signal time per pool target in `hits`;
 * `hitSignal(p, at)` names one signal's pool (a pool target: model / pool / target / the job's routed pool), else every
 * pool of its provider (provider / pool naming a provider, e.g. the worker's agent identity).
 */
function poolSignals(pools, now) {
  const byTarget = new Map(pools.map((p) => [p.target, p]));
  const byProvider = new Map();
  for (const p of pools) if (p.provider) { const l = byProvider.get(p.provider) ?? []; l.push(p.target); byProvider.set(p.provider, l); }
  const hits = {};
  const hit = (target, at) => { if (target && byTarget.has(target)) hits[target] = Math.max(hits[target] ?? 0, Number(at) || now); };
  const hitSignal = (p, at) => {
    const named = [p.model, p.pool, p.target, p.jobPool].find((v) => v && byTarget.has(v));
    if (named) return hit(named, at);
    const prov = [p.provider, p.pool].map(normalizeProvider).find((v) => v && byProvider.has(v));
    for (const target of byProvider.get(prov) ?? []) hit(target, at);
  };
  return { byProvider, hits, hit, hitSignal };
}

/** The providers whose pool is held at its floor while the rate limit persists: Map provider -> {target, e, since}. */
function persistingProviders(pb, next, { now, settings }) {
  const byProv = new Map();
  for (const [target, e] of Object.entries(next)) {
    const per = pb.backoffPersists(e, { now, persistMs: settings.backoffPersistMs, floor: Math.min(settings.backoffFloor, e.max) });
    if (per.persists && e.provider && !byProv.has(e.provider)) byProv.set(e.provider, { target, e, since: per.since });
  }
  return byProv;
}

/* ------------------------------------------------------------ the controller */

export function createResourceController(overrides = {}) {
  const deps = { ...liveDeps, ...overrides };
  const env = () => deps.env ?? process.env;
  const writeMachine = (fn) => withSupervisor(fn, { env: env() });
  const readMachineOr = (fn, fallback) => readSupervisor(fn, fallback, { env: env() });
  const settings = { ...resourceControllerSettings(), ...overrides.config };
  // Shadow keeps its own hysteresis (it never writes throttle_state); active reads it back from the row it writes.
  const memory = { shadowPrev: null, lastWould: null, lastFootprintAt: null, starving: {}, clocks: {}, lastProbe: {},
    pools: null, poolCursor: {}, providerSeen: {}, poolWould: null, circuits: {} };

  const clock = (ctx, entity, state, on, slaMs, meta) => {
    const k = `${entity}|${state}`;
    if (on && !memory.clocks[k]) { memory.clocks[k] = ctx.now(); ctx.clock(entity, state, slaMs, meta); }
    else if (!on && memory.clocks[k]) { delete memory.clocks[k]; ctx.clear(entity, state); }
  };

  // The active pass: throttle_state + one host_samples row in one transaction; true when written.
  function publishHost(ctx, t, { m, cap, host, patch, running }) {
    try {
      const freeRamMb = host?.freeRamBytes == null ? null : Math.round(Number(host.freeRamBytes) / MB);
      writeMachine((mm) => mm.transaction(() => {
        t.publishThrottle(mm, { mode: m.mode, cpuHot: m.cpuHot, why: m.why, effectiveCap: cap.effectiveCap, heavyCap: cap.heavyCap, running,
          freeRamPct: patch.freeRamPct, freeRamMb, cpuBusy: patch.cpuBusy, slotTargets: patch.slotTargets, writer: WRITER,
          sample: { freeRamPct: patch.freeRamPct, cpuBusy: patch.cpuBusy, ramMode: m.ramMode, cpuHot: m.cpuHot, why: m.why } });
        mm.recordHostSample({ kind: 'host', freeRamPct: patch.freeRamPct, freeRamMb, cpuPct: patch.cpuBusy == null ? null : Math.round(patch.cpuBusy * 1000) / 10,
          freeDiskGb: host?.freeDiskGb ?? null, mode: t.dbMode(m.mode), effectiveCap: cap.effectiveCap, running });
      }));
      return true;
    } catch (error) {
      ctx.log('reconciler.resource.error', `throttle_state: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME });
      return false;
    }
  }

  // The shadow pass: its own hysteresis in memory and a would-row when the mode or a slot target changes.
  function recordShadowHost(ctx, { m, share, since, patch, live }) {
    memory.shadowPrev = { mode: m.mode, ramMode: m.ramMode, cpuHot: m.cpuHot, since };
    const sig = JSON.stringify({ mode: m.mode, targets: Object.fromEntries(Object.entries(share.targets).map(([k, v]) => [k, v.target])) });
    if (sig === memory.lastWould) return;
    memory.lastWould = sig;
    const targets = Object.entries(share.targets).map(([k, v]) => k + '=' + v.target).join(', ') || '-';
    ctx.log(WOULD, `throttle state: mode ${m.mode} (published: ${live.mode ?? '-'}), slot targets ${targets}`,
      { controller: NAME, action: 'setThrottle', patch, liveMode: live.mode ?? null, liveWriter: live.writer ?? null, diff: (live.mode ?? 'normal') !== m.mode });
  }

  // op-ram-footprint every footprintEveryMs (as tick.mjs recorded it); MB-01: the cadence is durable (schedules), not per engine process.
  async function footprintDuty(ctx, t, { active, ops, census, patch, now }) {
    if (!claimDue(ctx, { controller: NAME, duty: 'footprint', intervalMs: settings.footprintEveryMs, now }).due) return null;
    finishDuty(ctx, { controller: NAME, duty: 'footprint', result: active ? 'done' : 'skipped', now });
    let footprint = null;
    try {
      const owners = await deps.owners();
      footprint = t.footprintSample({ owners, ops, kernels: census?.kernels ?? 0, freeRamPct: patch.freeRamPct });
      if (active) await deps.recordFootprint(footprint, env());
      else ctx.log(WOULD, `op-ram-footprint: op agents ${footprint.opAgentRamMb} MB`, { controller: NAME, action: 'recordHostSample', kind: t.FOOTPRINT_SAMPLE_KIND, payload: footprint });
    } catch (error) { ctx.log('reconciler.resource.error', `footprint: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
    return footprint;
  }

  // queuedReady of every priority workflow that has queued ops; a workflow with no reading counts no ready work (not starved on a guess).
  async function readyCounts(ctx, priorities, ops) {
    const ready = {};
    const queuing = Object.entries(priorities ?? {}).filter(([id, p]) => p?.reserve > 0 && ops.some((o) => o.workflowId === id && o.status === 'queued'));
    await eachInOrder(queuing, async ([id]) => {
      try { const n = await deps.queuedReady(ctx, id, ops.find((o) => o.workflowId === id)?.ledger ?? null); if (Number.isFinite(n)) ready[id] = n; } catch { /* no reading: not starved */ }
    });
    return ready;
  }

  // Clocks of workflows that stopped starving close; once per engine life a CAP_STARVED clock a previous run left open for a
  // workflow that is not starving now closes (the memory that would clear it on the transition did not survive the restart).
  function clearStarving(ctx, priorities, nowStarving) {
    for (const id of Object.keys(memory.starving)) if (!nowStarving.has(id)) { delete memory.starving[id]; clock(ctx, `workflow:${id}`, 'CAP_STARVED', false); }
    if (memory.starvedSwept) return;
    memory.starvedSwept = true;
    for (const [id, p] of Object.entries(priorities ?? {})) if (p?.reserve > 0 && !nowStarving.has(id)) ctx.clear(`workflow:${id}`, 'CAP_STARVED');
  }

  // cap-starved: the priority workflow below its reserve for capStarvedMs → a Decision Item to the Supervisor.
  async function starvationDecisions(ctx, { priorities, ops, m, cap, maxParallelOps, now }) {
    const starved = starvedWorkflows({ ops, priorities, ready: await readyCounts(ctx, priorities, ops) });
    clearStarving(ctx, priorities, new Set(starved.map((w) => w.workflowId)));
    const decisions = [];
    await eachInOrder(starved, async (w) => {
      memory.starving[w.workflowId] ??= { since: now, opened: false };
      clock(ctx, `workflow:${w.workflowId}`, 'CAP_STARVED', true, settings.capStarvedMs, w);
      const st = memory.starving[w.workflowId];
      if (!st.opened && now - st.since >= settings.capStarvedMs) {
        st.opened = true;
        await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'cap-starved', decider: 'supervisor', ledger: 'supervisor', workflowId: w.workflowId,
          idempotencyKey: `cap-starved:${w.workflowId}:${new Date(st.since).toISOString()}`, entity: { type: 'workflow', id: w.workflowId },
          summary: `priority workflow ${w.workflowId} held ${w.running} of its reserve ${w.reserve} slot(s) for ${Math.round((now - st.since) / 60000)} min with ${w.queued} op(s) ready (mode ${m.mode}, cap ${cap.effectiveCap ?? '-'}/${maxParallelOps ?? '-'})`,
          evidence: [{ ref: `throttle:${m.why}` }, { ref: `cap:${cap.why}` }], options: [{ key: 'ram-cap-prioritize', verb: `starci supervisor ram-cap prioritize --workflow ${w.workflowId} --weight <n> --reserve <slots>`, recommended: true }],
          allowedVerbs: ['ram-cap prioritize', 'ram-cap unprioritize'], openedBy: 'resource-controller', escalateTo: 'owner' });
        decisions.push(`cap-starved:${w.workflowId}`);
      }
    });
    return decisions;
  }

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
    const m = modeOf(t, { prev, host, cpuBusy, thresholds });
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
    if (active) wrote = publishHost(ctx, t, { m, cap, host, patch, running: running.length });
    else recordShadowHost(ctx, { m, share, since, patch, live });
    const footprint = await footprintDuty(ctx, t, { active, ops, census, patch, now });

    // Clocks: RAM_CRITICAL, DISK_LOW (lane F reads them).
    clock(ctx, 'host:local', 'RAM_CRITICAL', m.mode === 'critical', settings.ramCriticalSlaMs, { freeRamPct: patch.freeRamPct, why: m.why });
    clock(ctx, 'host:local', 'DISK_LOW', Boolean(host?.lowDisk), settings.diskLowSlaMs, { drive: host?.drive ?? null, freeDiskGb: host?.freeDiskGb ?? null });

    const decisions = await starvationDecisions(ctx, { priorities, ops, m, cap, maxParallelOps, now });
    return { mode: m.mode, changed, wrote, shadow: !active, targets: share.targets, footprint: footprint != null, decisions };
  }

  // The machine_logs rows the Job controller's worker-health probe wrote (reconciler.provider-rate-limited typed rows,
  // ctx.log, lane B): {jobId, workflowId, provider, pool, model, resetMs}.
  function machineSignals(hitSignal, seedSince) {
    try {
      const since = memory.poolCursor.machine ?? null;
      const rows = readMachineOr((mm) => ({
        logs: mm.db.prepare(`SELECT seq, at, data_json d FROM machine_logs WHERE kind IN ('reconciler.provider-rate-limited','provider-rate-limited') AND ${since == null ? 'at>=?' : 'seq>?'} ORDER BY seq`).all(since == null ? seedSince : since),
        maxSeq: mm.db.prepare('SELECT COALESCE(MAX(seq),0) s FROM machine_logs').get()?.s ?? 0,
      }), null);
      if (rows) {
        memory.poolCursor.machine = Math.max(Number(since) || 0, Number(rows.maxSeq) || 0);
        for (const r of rows.logs ?? []) hitSignal(jsonOr(r.d), r.at);
      }
    } catch { /* an unreadable machine.sqlite adds no signal */ }
  }

  async function ledgerSignals(ctx, hitSignal, seedSince) {
    await eachInOrder(productLedgers(ctx), async (l) => {
      const since = memory.poolCursor[l.ledgerId] ?? null;
      let rows = null;
      try {
        rows = await ctx.read(l.ledgerId, (db) => ({
          events: db.prepare(EVENTS_SQL + (since == null ? 'e.created_at>=? ORDER BY e.seq' : 'e.seq>? ORDER BY e.seq')).all(RATE_LIMITED_EVENT, since == null ? seedSince : since),
          maxSeq: db.prepare('SELECT COALESCE(MAX(seq),0) s FROM events').get()?.s ?? 0,
        }));
      } catch { rows = null; }
      if (!rows) return;
      memory.poolCursor[l.ledgerId] = Math.max(Number(since) || 0, Number(rows.maxSeq) || 0);
      for (const e of rows.events ?? []) hitSignal({ ...jsonOr(e.p), jobPool: e.jobPool }, e.at);
    });
  }

  // The provider circuits: one worker-wide row per provider in machine.sqlite provider_health (provider-circuit.mjs).
  function circuitSignals(hit, byProvider, seedSince) {
    for (const c of (deps.providerCircuits ?? providerCircuits)()) {
      const v = c.value ?? {};
      const at = Number(v.observedAt) || Number(c.at) || 0;
      const k = normalizeProvider(v.provider ?? c.provider);
      if (v.failureKind !== 'rate-limited' || at < seedSince || at <= (memory.providerSeen[k] ?? 0)) continue;
      memory.providerSeen[k] = at;
      for (const target of byProvider.get(k) ?? []) hit(target, at);
    }
  }

  // Active: machine.sqlite pool_backoff rows; shadow: a would-row when the caps change.
  function publishPools(ctx, pb, { next, liveRows, now, active }) {
    const caps = poolCapsOf(next);
    if (!active) {
      const sig = JSON.stringify(caps);
      if (sig === memory.poolWould) return caps;
      memory.poolWould = sig;
      const text = Object.entries(next).map(([k, e]) => k + ' ' + e.cap + '/' + e.max + (e.reason ? ' (' + e.reason + ')' : '')).join(', ') || 'every pool at its maxParallel';
      ctx.log(WOULD, `pool backoff: ${text}`, { controller: NAME, action: 'setPoolBackoff', patch: { poolBackoff: next }, caps });
      return caps;
    }
    if (Object.keys(next).length || liveRows.length) {
      try {
        writeMachine((mm) => mm.transaction(() => {
          for (const [pool, e] of Object.entries(next)) mm.setPoolBackoff(pb.poolRowOf(pool, e, { now, staleMs: settings.backoffStaleMs }));
          for (const r of liveRows) if (!next[r.pool]) mm.clearPoolBackoff(r.pool);
        }));
      } catch (error) { ctx.log('reconciler.resource.error', `pool_backoff: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
    }
    return caps;
  }

  // A rate limit that persists at the floor: the provider circuit, once per floor episode, on every product ledger.
  async function openFloorCircuits(ctx, pb, next, now) {
    const circuits = [];
    await eachInOrder(persistingProviders(pb, next, { now, settings }), async ([provider, { target, e, since }]) => {
      const episode = `${provider}|${since}`;
      if (memory.circuits[provider] === episode) return;
      memory.circuits[provider] = episode;
      const reason = `pool ${target} held at ${e.cap}/${e.max} since ${new Date(since).toISOString()} and still rate limited (last ${new Date(e.lastRateLimitAt).toISOString()})`;
      await eachInOrder(productLedgers(ctx), (l) => ctx.api(l.ledgerId, 'provider-backoff', ['--provider', provider, '--open-circuit', '--kind', settings.backoffCircuitKind, '--reason', reason, '--by', WRITER], { timeoutMs: 60_000 }));
      circuits.push(provider);
    });
    return circuits;
  }

  /**
   * resource:pools — adaptive per-pool concurrency (AIMD, scripts/machine/pool-backoff.mjs). The rate-limit signals since
   * the last pass: provider-rate-limited events of every product ledger (payload pool / model / target, else the
   * job's routed pool, else every pool of payload.provider) and provider-health rows of failureKind rate-limited
   * observed since. Halve on a signal (floor backoffFloor, at most once per backoffDecreaseCooldownMs), +1 per
   * backoffIncreaseStepMs after backoffIncreaseAfterMs quiet, up to the pool's registry.yaml maxParallel. Active:
   * machine.sqlite pool_backoff rows (route reads them and prefers the next eligible pool); shadow: a would-row
   * when the caps change. A pool held at its floor while the rate limit persists for backoffPersistMs opens the
   * provider circuit (starci kernel provider-backoff) on every product ledger, once per floor episode.
   */
  async function reconcilePools(ctx) {
    const pb = await deps.poolBackoff();
    await deps.throttle();
    const now = ctx.now();
    const pools = await deps.pools(); // [{target, provider, maxParallel}]
    const { byProvider, hits, hit, hitSignal } = poolSignals(pools, now);
    const seedSince = now - settings.backoffIncreaseAfterMs;
    machineSignals(hitSignal, seedSince);
    await ledgerSignals(ctx, hitSignal, seedSince);
    circuitSignals(hit, byProvider, seedSince);
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
    const caps = publishPools(ctx, pb, { next, liveRows, now, active });
    const circuits = await openFloorCircuits(ctx, pb, next, now);
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
    await eachInOrder(exhausted, async (e) => {
      await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'quota-exhausted', decider: 'supervisor', ledger: ledgerId,
        idempotencyKey: `quota-exhausted:${ledgerId}:${e.op}:${e.providers.slice().sort(byCodeUnit).join('+')}`, entity: { type: 'job', id: `${ledgerId}:${e.op}` },
        summary: `${e.queued} ready ${e.op} op(s) on ${ledgerId} wait and every pool they name (${e.pools.join(', ')}) has an open circuit (${e.providers.join(', ')})`,
        evidence: open.filter((c) => e.providers.includes(c.provider)).map((c) => ({ ref: `circuit:${c.provider} ${c.failureKind} until ${c.expiresAt ? new Date(c.expiresAt).toISOString() : '?'}` })),
        options: [{ key: 'reroute', verb: 'starci kernel graph-edit / reroute the kind to a pool with quota', recommended: true }, { key: 'wait', verb: 'wait for the circuit to clear (quota probe every 5 min)' }],
        allowedVerbs: ['graph-edit', 'provider-health'], openedBy: 'resource-controller', escalateTo: 'owner' });
    });
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
