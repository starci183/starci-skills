// ram-throttle.mjs — the RAM-aware, priority-aware dispatch throttle (owner rulings 2026-09-28: "Cap parallelism by
// real RAM: with free RAM below 15% reduce the number of ops running in parallel, so a hung machine does not kill ops mid-run", lowered the same day to "15→10, 10→2.5"; and the FE
// refactor workflow runs its parallel code.refactor slices first while the other workflows ramp up).
//
// Measured before it (supervisor bottleneck samples, 2026-09-27): free RAM sat at 10-13% of 68.6 GB for hours with
// CPU at 45-90%, and backend.implement / interface.draw / uat.verify / brand.decide workers died mid-run with no
// report. `maxParallelOps` (modules/models/runtimes.yaml, the owner's 20) stays the ceiling; at EVERY
// `starci kernel dispatch --spawn` this module computes the effective cap under it from the host's real RAM and CPU
//
//   effectiveCap = min(maxParallelOps, running + ops that still fit in free RAM above the hard floor)
//
// and admits one candidate op (admitOp) in this order:
//   1. workers: the ops holding a slot on every product ledger of the host (the machine registry) never reach
//      maxParallelOps - the owner's 20 is never exceeded, whatever the RAM says;
//   2. priority slots: a workflow below the top priority weight leaves the prioritized workflows' reserved slots
//      free (min(reserve, their queued + running) - their running);
//   3. mode (hysteresis; the Resource controller publishes it in machine.sqlite throttle_state, DBTREE.sql B4):
//        normal        free RAM >= minFreeRamPct (10) and CPU below cpuHeavyStopAbove - every op may start;
//        heavy-paused  free RAM < 10%, or CPU saturated - no NEW heavy op (Playwright / render / test / implement:
//                      the `heavy` class of the opRam table) from a workflow below the top priority; the
//                      prioritized workflow's heavy ops still start while they fit; light ops still start. Leaves
//                      once free RAM is back above heavyResumeAbovePct (15) and CPU below cpuHeavyResumeBelow;
//        critical      free RAM < landSpecPauseBelowPct (2.5) - no new heavy op from ANY workflow, and the land
//                      gate's spec runs pause (scripts/supervisor/land.mjs). Leaves at landSpecResumeAbovePct (5);
//   4. fit: the candidate's RAM estimate fits in free RAM above hardFloorPct of total - and a heavy op below the
//      top priority also leaves the RAM the prioritized workflows' pending ops need (a light op only its slots).
// Running ops are never killed: the throttle only refuses NEW launches, as the typed wait host-resources-low
// (waiting:true, nothing recorded as a rejection - the job stays queued and the next dispatch re-probes). Each
// refusal is a `dispatch-throttled` event on the job's ledger with the numbers, and one open throttle_decisions row per
// held job (machine.sqlite; released with its waited_ms when the job is admitted).
//
// Priorities: allocation.resources.ramThrottle.priorities in runtimes.yaml ({<workflowId>: {weight, reserve}}),
// overridden per host by the Supervisor (scripts/supervisor/ram-cap.mjs prioritize) in throttle_state.priorities_json. Weight 1 is
// everyone's default; with no weight above 1 anywhere, every workflow is equal and steps 2 and 4's priority share
// do nothing.
//
// Per-op RAM estimates: the opRam table of runtimes.yaml (allocation.resources.opRam) is the prior; the
// op-ram-footprint history (one per resource controller sample: the RAM of the agent
// process trees minus the kernels', shared across the running ops in proportion to their priors) replaces a kind's
// prior once it has historyMinObservations observations (machine.sqlite host_samples kind 'op-footprint'), clamped to [0.5x, 3x] of the prior so one noisy sample
// cannot admit or starve a kind. The worker-footprint events of scripts/guards/footprint-scan.mjs are the FILE
// footprint (worktrees, links) and carry no RAM, so the RAM history is its own sample kind.
//
// Seams: every pure function takes its numbers; hostThrottle() takes `env` (STARCI_HOST_RESOURCES_JSON - the fake
// host sample a spec hands the dispatch CLI, which may also carry cpuBusy, ops [{op, workflowId, status}] and
// footprints), `load`, `census`, `footprints` and `state` (the throttle state object; default read from machine.sqlite
// of `env`, STARCI_TEST_MACHINE_FILE in a spec).
//
// The store (machine.sqlite, DBTREE.sql B4; ram-throttle.json is retired): throttle_state (one row id=1, the writer and
// its rev - MB-15), throttle_events (every mode change, append-only - G7), throttle_decisions (ops held back),
// host_samples (kind 'host' per controller pass, 'op-footprint' per footprint sample). The DB mode enum is
// normal|heavy|critical; this module's MODES name heavy 'heavy-paused' (mapped at the boundary: dbMode/codeMode).
import { allocationSettings, runtimeProfile } from '../../engine/config.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { runtimeRevOf } from './home.mjs';
import { hostResourcesFor, resourceThresholds, machineLoad, HOST_RESOURCES_ENV } from './host-resources.mjs';
import { machineLedgerFiles } from './ledger-files.mjs';
import { isSpecRun } from '../lib/env.mjs';
import { positiveNumber } from '../lib/number.mjs';
import { MODES, nextModeOf, num, pct1 } from './ram-mode.mjs';

export { MODES } from './ram-mode.mjs';
import { isoOr } from '../lib/time.mjs';

/** The Resource controller's writer tag (scripts/reconciler/controllers/resource.mjs) and how long its mode stays usable. */
export const RECONCILER_WRITER = 'reconciler/resource';
const RECONCILER_MODE_FRESH_MS = 120_000;

export const DISPATCH_THROTTLED = 'dispatch-throttled';
const OP_RAM_FOOTPRINT = 'op-ram-footprint';
/** host_samples.kind of one op-ram-footprint sample. */
export const FOOTPRINT_SAMPLE_KIND = 'op-footprint';
// The job statuses that hold a slot (scripts/kernel/cli.mjs SLOT_HOLDING_STATUSES: dispatched and not settled).
export const SLOT_STATUSES = Object.freeze(['leased', 'running', 'reported', 'effect_unknown', 'answering']);

const DEFAULTS = Object.freeze({
  heavyResumeAbovePct: 15, landSpecPauseBelowPct: 2.5, landSpecResumeAbovePct: 5, hardFloorPct: 2.5,
  cpuHeavyStopAbove: 0.95, cpuHeavyResumeBelow: 0.85, historySamples: 48, historyMinObservations: 3, kernelMb: 900,
});
const DEFAULT_OP = Object.freeze({ mb: 1200, class: 'light' });
const MB = 1048576;

const median = (list) => { const s = [...list].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** The thresholds: allocation.resources.minFreeRamPct is the heavy floor; the rest from allocation.resources.ramThrottle. */
export function throttleThresholds(settings = null) {
  const s = settings ?? allocationSettings();
  const t = s?.resources?.ramThrottle ?? {};
  const out = { heavyStopBelowPct: resourceThresholds(s).minFreeRamPct };
  for (const [key, fallback] of Object.entries(DEFAULTS)) out[key] = positiveNumber(t[key], fallback);
  return out;
}

/** The opRam table: {default: {mb, class}, kinds: {<op>: {mb, class}}} from allocation.resources.opRam. */
export function opRamTable(settings = null) {
  const raw = (settings ?? allocationSettings())?.resources?.opRam ?? {};
  const entry = (v, fallback) => ({ mb: positiveNumber(v?.mb, fallback.mb), class: v?.class === 'heavy' || v?.class === 'light' ? v.class : fallback.class });
  const def = entry(raw.default, DEFAULT_OP);
  const kinds = {};
  for (const [kind, v] of Object.entries(raw)) if (kind !== 'default' && v && typeof v === 'object') kinds[kind] = entry(v, def);
  return { default: def, kinds };
}

const opClassOf = (op, table) => (table.kinds[op] ?? table.default).class;
const priorMbOf = (op, table) => (table.kinds[op] ?? table.default).mb;

/**
 * Per-kind RAM observations out of op-ram-footprint samples [{opAgentRamMb, kernels, running:{kind:n}}]: the op
 * agents' RAM (minus kernels x kernelMb) is shared across the running ops in proportion to their priors.
 * Returns {<kind>: [mbPerOp, ...]}.
 */
export function footprintObservations(samples, table, { kernelMb = DEFAULTS.kernelMb } = {}) {
  const obs = {};
  for (const s of samples ?? []) {
    const running = Object.entries(s?.running ?? {}).filter(([, n]) => num(n) > 0);
    if (!running.length) continue;
    const opsMb = Math.max(0, num(s.opAgentRamMb) - num(s.kernels) * kernelMb);
    if (opsMb <= 0) continue;
    const weight = running.reduce((sum, [kind, n]) => sum + num(n) * priorMbOf(kind, table), 0);
    if (weight <= 0) continue;
    for (const [kind] of running) {
      obs[kind] ??= [];
      obs[kind].push(Math.round(opsMb * priorMbOf(kind, table) / weight));
    }
  }
  return obs;
}

/**
 * The estimates admission reads: {<kind>: {mb, class, source: 'table'|'history', observations}} for every kind of
 * the table and of the history, plus `default`.
 */
export function opRamEstimates(table, samples = [], thresholds = throttleThresholds()) {
  const obs = footprintObservations(samples, table, thresholds);
  const out = { default: { ...table.default, source: 'table', observations: 0 } };
  for (const kind of new Set([...Object.keys(table.kinds), ...Object.keys(obs)])) {
    const prior = priorMbOf(kind, table), seen = obs[kind] ?? [];
    const history = seen.length >= thresholds.historyMinObservations;
    const mb = history ? Math.round(Math.min(prior * 3, Math.max(prior * 0.5, median(seen)))) : prior;
    out[kind] = { mb, class: opClassOf(kind, table), source: history ? 'history' : 'table', observations: seen.length };
  }
  return out;
}

const estimateOf = (op, estimates) => estimates[op] ?? estimates.default;
const heavyAdmissionText = (mode, held, heavyCap, typical) => { if (mode === 'normal') { return ` or ${Math.max(0, heavyCap - held)} heavy (~${Math.round(typical('heavy'))} MB)`; } if (mode === 'critical') { return ', heavy only for the top priority - and not even that while critical'; } return ', heavy only for the top priority'; };

/** The next mode from the previous state and one host sample (ram-mode.mjs), over `t` (default: this host's thresholds). */
export const nextMode = (prev, sample, t = throttleThresholds()) => nextModeOf(prev, sample, t);

/* ------------------------------------------------------------ priority */

/**
 * The priority table: runtimes.yaml allocation.resources.ramThrottle.priorities with the state file's Supervisor
 * overrides on top: {<workflowId>: {weight, reserve}}. A weight <= 0 or missing entry is weight 1, reserve 0.
 */
export function priorityTable(settings = null, state = {}) {
  const fromYaml = (settings ?? allocationSettings())?.resources?.ramThrottle?.priorities;
  const out = {};
  for (const [wf, v] of Object.entries({ ...fromYaml, ...state?.priorities })) {
    if (v == null) continue;
    const weight = positiveNumber(typeof v === 'object' ? v.weight : v, 1);
    const reserve = Math.max(0, Math.floor(num(typeof v === 'object' ? v.reserve : 0)));
    out[wf] = { weight, reserve };
  }
  return out;
}

export const weightOf = (wf, priorities) => priorities?.[wf]?.weight ?? 1;

/**
 * What the workflows ranked above `wf` that have ops open (queued or running) still claim: {slots, mb, above: [{workflowId, weight, reserve, running,
 * queued, pending}]}. `ops`: the worker census [{op, workflowId, status}] (queued rows included). A workflow's
 * pending claim is min(reserve || queued + running, queued + running) - running, its queued kinds' estimates sized.
 */
export function priorityClaim(wf, ops, priorities, estimates) {
  const w = weightOf(wf, priorities);
  const above = [];
  let slots = 0, mb = 0;
  for (const [id, p] of Object.entries(priorities)) {
    if (id === wf || p.weight <= w) continue;
    const mine = ops.filter((o) => o.workflowId === id);
    if (!mine.length) continue; // a prioritized workflow with nothing open outranks nobody
    const running = mine.filter((o) => o.status !== 'queued').length;
    const queued = mine.filter((o) => o.status === 'queued');
    const want = Math.min(p.reserve > 0 ? p.reserve : queued.length + running, queued.length + running);
    const pending = Math.max(0, want - running);
    const sizes = queued.map((o) => estimateOf(o.op, estimates).mb).sort((a, b) => b - a).slice(0, pending);
    slots += pending; mb += sizes.reduce((a, b) => a + b, 0);
    above.push({ workflowId: id, weight: p.weight, reserve: p.reserve, running, queued: queued.length, pending });
  }
  return { weight: w, slots, mb: Math.round(mb), above };
}

/* ------------------------------------------------------------ cap and admission */

const ramMbOf = (host) => {
  const totalMb = num(host?.totalRamBytes) / MB;
  const freeMb = host?.freeRamBytes != null && num(host.totalRamBytes) > 0 ? num(host.freeRamBytes) / MB : totalMb * num(host?.freeRamPct) / 100;
  return { totalMb, freeMb, measured: totalMb > 0 };
};

/**
 * The effective cap over one host sample: {maxParallelOps, running, mode, headroomMb, reserveMb, effectiveCap,
 * heavyCap, lightCap, why}. `running` is the workers' slot-holding op count; `estimates` the opRamEstimates. The
 * cap counts how many ops of each class could run given what already runs, never above maxParallelOps. heavyCap is
 * what a workflow below the top priority may reach; the prioritized one keeps starting heavy ops that fit until
 * critical.
 */
export function effectiveCapOf({ maxParallelOps = null, running = 0, host, mode, estimates, thresholds = throttleThresholds() }) {
  const ceiling = Number.isInteger(Number(maxParallelOps)) && Number(maxParallelOps) > 0 ? Number(maxParallelOps) : Infinity;
  const { totalMb, freeMb, measured } = ramMbOf(host);
  const reserveMb = totalMb * thresholds.hardFloorPct / 100;
  const headroomMb = Math.max(0, freeMb - reserveMb);
  const typical = (cls) => {
    const kinds = Object.entries(estimates).filter(([k, e]) => k !== 'default' && e.class === cls).map(([, e]) => e.mb);
    return kinds.length ? median(kinds) : estimates.default.mb;
  };
  const fits = (mb) => (measured ? Math.floor(headroomMb / Math.max(1, mb)) : Infinity);
  const held = Math.max(0, num(running));
  const lightCap = Math.min(ceiling, held + fits(typical('light')));
  const heavyCap = mode === 'normal' ? Math.min(ceiling, held + fits(typical('heavy'))) : Math.min(ceiling, held);
  const effectiveCap = Math.max(lightCap, heavyCap);
  const finite = (n) => (Number.isFinite(n) ? n : null);
  const why = effectiveCap >= ceiling && mode === 'normal'
    ? `maxParallelOps ${ceiling} binds (${Math.round(headroomMb)} MB free above the ${thresholds.hardFloorPct}% floor)`
    : `${mode}: ${Math.round(headroomMb)} MB free above the ${thresholds.hardFloorPct}% floor fits ${Math.max(0, lightCap - held)} more light op(s) (~${Math.round(typical('light'))} MB)${heavyAdmissionText(mode, held, heavyCap, typical)} beside ${held} running`;
  return { maxParallelOps: finite(ceiling), running: held, mode, headroomMb: Math.round(headroomMb), reserveMb: Math.round(reserveMb),
    effectiveCap: finite(effectiveCap), heavyCap: finite(heavyCap), lightCap: finite(lightCap), why };
}

/**
 * Admission of one candidate op of workflow `workflowId`: {ok, reason, detail, op, class, estimateMb, priority,
 * ...cap}. reason is null, 'workers-max-ops', 'priority-reserved' (a slot or the RAM a higher-priority workflow still
 * claims), 'heavy-paused' or 'does-not-fit'.
 */
export function admitOp({ op, workflowId = null, ops = [], maxParallelOps = null, host, mode, modeWhy = '', estimates, priorities = {}, thresholds = throttleThresholds() }) {
  const running = ops.filter((o) => o.status !== 'queued').length;
  const cap = effectiveCapOf({ maxParallelOps, running, host, mode, estimates, thresholds });
  const est = estimateOf(op, estimates);
  const claim = priorityClaim(workflowId, ops, priorities, estimates);
  const top = claim.above.length === 0 && claim.weight > 1; // prioritized: an explicit weight nobody open outranks
  const base = { op, workflowId, class: est.class, estimateMb: est.mb, estimateSource: est.source, ...cap, modeWhy,
    priority: { weight: claim.weight, top, claimSlots: claim.slots, claimMb: claim.mb, above: claim.above } };
  const refuse = (reason, detail) => ({ ...base, ok: false, reason, detail });
  if (cap.maxParallelOps != null && running >= cap.maxParallelOps)
    return refuse('workers-max-ops', `${running} op(s) already hold a slot across the host's ledgers at maxParallelOps ${cap.maxParallelOps}`);
  if (cap.maxParallelOps != null && claim.slots > 0 && running + 1 + claim.slots > cap.maxParallelOps)
    return refuse('priority-reserved', `${running} running + ${claim.slots} slot(s) reserved for ${claim.above.filter((a) => a.pending).map((a) => a.workflowId + ' (weight ' + a.weight + ')').join(', ')} leave no slot under maxParallelOps ${cap.maxParallelOps} for ${workflowId ?? 'this workflow'} (weight ${claim.weight})`);
  if (est.class === 'heavy' && mode === 'critical')
    return refuse('heavy-paused', `${op} is a heavy op (~${est.mb} MB) and the host is critical: ${modeWhy}`);
  if (est.class === 'heavy' && mode !== 'normal' && !top)
    return refuse('heavy-paused', `${op} is a heavy op (~${est.mb} MB) of ${workflowId ?? 'this workflow'} (weight ${claim.weight}, below ${claim.above.map((a) => a.workflowId).join(', ')}) and the host is ${mode}: ${modeWhy}`);
  if (num(host?.totalRamBytes) > 0 && cap.headroomMb < est.mb)
    return refuse('does-not-fit', `${op} needs ~${est.mb} MB (${est.source}) and only ${cap.headroomMb} MB is free above the ${thresholds.hardFloorPct}% floor (${cap.reserveMb} MB)`);
  if (est.class === 'heavy' && num(host?.totalRamBytes) > 0 && claim.mb > 0 && cap.headroomMb - est.mb < claim.mb)
    return refuse('priority-reserved', `${op} needs ~${est.mb} MB and ${claim.mb} MB of the ${cap.headroomMb} MB headroom is held for ${claim.above.filter((a) => a.pending).map((a) => a.workflowId).join(', ')}'s ${claim.slots} pending op(s)`);
  return { ...base, ok: true, reason: null, detail: null };
}

/* ------------------------------------------------------------ IO */

/** The DB mode (throttle_state / throttle_events enum normal|heavy|critical) of a code mode, and back. */
export const dbMode = (mode) => {
  if (mode === 'heavy-paused') return 'heavy';
  if (MODES.includes(mode)) return mode;
  return 'normal';
};
const codeMode = (mode) => {
  if (mode === 'heavy') return 'heavy-paused';
  if (MODES.includes(mode)) return mode;
  return null;
};

/**
 * The throttle state object out of the throttle_state row and throttle_decisions: {mode, ramMode, cpuHot, why, at,
 * since, writer, writerRev, effectiveCap, heavyCap, running, freeRamPct, cpuBusy, slotTargets, priorities, throttled:
 * {count, open, last}}; {} with neither. ramMode is not a column: it reads as the mode (conservative - after a CPU-only
 * heavy pause the RAM hysteresis holds until free RAM clears heavyResumeAbovePct).
 */
function throttleStateOf(m) {
  const row = m.throttleState();
  const decisions = m.db.prepare('SELECT count(*) n, sum(released_at IS NULL) open FROM throttle_decisions').get();
  const last = m.db.prepare('SELECT * FROM throttle_decisions ORDER BY seq DESC LIMIT 1').get();
  const throttled = Number(decisions?.n) > 0 ? { count: Number(decisions.n), open: Number(decisions.open ?? 0),
    last: last ? { at: isoOr(last.at), jobId: last.job_id, workflowId: last.workflow_id, ledgerId: last.ledger_id, reason: last.reason, waitedMs: last.waited_ms, releasedAt: isoOr(last.released_at) } : null } : null;
  if (!row) return throttled ? { throttled } : {};
  const mode = codeMode(row.mode);
  return { mode, ramMode: mode, cpuHot: Boolean(row.cpu_hot), why: row.reason ?? null, at: isoOr(row.updated_at), since: isoOr(row.since),
    writer: row.writer, writerRev: row.writer_rev, effectiveCap: row.effective_cap, heavyCap: row.heavy_cap, running: row.running,
    freeRamPct: row.free_ram_pct, cpuBusy: row.cpu_pct == null ? null : row.cpu_pct / 100, slotTargets: row.slotTargets ?? null,
    priorities: row.priorities ?? {}, throttled };
}

/** The throttle state of machine.sqlite for `env` ({} when there is no store or no row). Never throws. */
export const readThrottleState = ({ env = process.env } = {}) => readMachine((m) => throttleStateOf(m), {}, { env });

/**
 * Publish the throttle row (the Resource controller, the one writer of the mode): setThrottle appends a
 * throttle_events row first on a mode change (G7) and carries the writer and its rev (MB-15). The Supervisor's
 * priorities (priorities_json) are kept: read inside the same write transaction.
 */
export function publishThrottle(m, { mode, cpuHot = false, why = null, effectiveCap = null, heavyCap = null, running = null, freeRamPct = null, freeRamMb = null,
  cpuBusy = null, slotTargets = null, writer, sample = null }) {
  return m.transaction(() => {
    const cur = m.throttleState();
    return m.setThrottle({ mode: dbMode(mode), effectiveCap, heavyCap, running, freeRamPct, freeRamMb: freeRamMb == null ? null : Math.round(freeRamMb),
      cpuPct: cpuBusy == null ? null : Math.round(cpuBusy * 1000) / 10, cpuHot: Boolean(cpuHot), reason: why, writer, writerRev: runtimeRevOf(), slotTargets, priorities: cur?.priorities ?? null, sample });
  });
}

/** The Supervisor's host override of one workflow's priority (throttle_state.priorities_json); weight null removes it. */
export function setPriority({ workflowId, weight = null, reserve = 0, by = 'supervisor', now = Date.now(), env = process.env }) {
  if (!workflowId) throw new Error('setPriority needs a workflow id');
  try {
    return withMachine((m) => m.transaction(() => {
      const cur = m.throttleState();
      const priorities = { ...cur?.priorities };
      if (weight == null) priorities[workflowId] = null;
      else priorities[workflowId] = { weight: positiveNumber(weight, 1), reserve: Math.max(0, Math.floor(num(reserve))), by, at: new Date(now).toISOString() };
      if (cur) m.update('throttle_state', { priorities_json: priorities }, { id: 1 });
      // No row yet (the Resource controller never published): a normal row by ram-cap, its mode event recorded.
      else m.setThrottle({ mode: 'normal', writer: 'supervisor/ram-cap', reason: `priority override for ${workflowId} before any throttle publication`, priorities });
      return true;
    }), { env });
  } catch { return false; }
}

/**
 * One op held back by the throttle: an open throttle_decisions row per job (a re-probe of a job already held adds
 * nothing, so waited_ms runs from the first refusal). The row's seq, or null. Never throws.
 */
export function noteThrottled({ jobId, workflowId = null, ledgerId = null, reason, env = process.env }) {
  try {
    return withMachine((m) => m.transaction(() => {
      const open = m.db.prepare('SELECT seq FROM throttle_decisions WHERE job_id IS ? AND ledger_id IS ? AND released_at IS NULL ORDER BY seq LIMIT 1').get(jobId ?? null, ledgerId);
      return open ? open.seq : m.recordThrottleDecision({ ledgerId, workflowId, jobId, reason });
    }), { env });
  } catch { return null; }
}

/** The job was admitted: release its open throttle_decisions rows (waited_ms set). The count released; never throws. */
export function releaseThrottled({ jobId, ledgerId = null, env = process.env }) {
  const sql = 'SELECT seq FROM throttle_decisions WHERE job_id=? AND ledger_id IS ? AND released_at IS NULL';
  try {
    if (!readMachine((m) => m.db.prepare(sql).all(jobId, ledgerId).length, 0, { env })) return 0;
    return withMachine((m) => m.transaction(() => m.db.prepare(sql).all(jobId, ledgerId).filter((r) => m.releaseThrottleDecision(r.seq)).length), { env });
  } catch { return 0; }
}

const CENSUS_SQL = `SELECT workflow_id workflowId, op_id op, status, json_extract(payload_json,'$.model') pool FROM jobs
  WHERE kind<>'kernel' AND op_id IS NOT NULL AND status IN ('queued',${SLOT_STATUSES.map(() => '?').join(',')})`;
const KERNELS_SQL = `SELECT count(*) n FROM jobs WHERE kind='kernel' AND status IN (${SLOT_STATUSES.map(() => '?').join(',')})`;

/**
 * The worker census: {ops: [{op, workflowId, status, pool, ledger}] (queued and slot-holding), kernels} over `db`
 * (the open repo ledger, its file excluded from the machine scan) and every other product ledger the machine
 * registry names.
 */
export function workersCensus({ db = null, ledgerFile = null, env = process.env } = {}) {
  const ops = [];
  let kernels = 0;
  const read = (handle, name) => {
    for (const r of handle.prepare(CENSUS_SQL).all(...SLOT_STATUSES)) ops.push({ ...r, ledger: name });
    kernels += Number(handle.prepare(KERNELS_SQL).get(...SLOT_STATUSES)?.n ?? 0);
  };
  if (db) { try { read(db, ledgerFile ?? 'repo'); } catch { /* unreadable */ } }
  for (const file of machineLedgerFiles({ env, exclude: [ledgerFile] })) {
    let other = null;
    try { other = openLedgerReader(file); read(other, file); } catch { /* an unreadable ledger counts nothing */ } finally { try { other?.close(); } catch { /* read-only */ } }
  }
  return { ops, kernels };
}

const countByKind = (ops) => ops.reduce((acc, o) => { acc[o.op] = (acc[o.op] ?? 0) + 1; return acc; }, {});

const overrideOf = (env) => {
  const raw = env?.[HOST_RESOURCES_ENV];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; }
};

// The host's CPU busy fraction: the spec override's, none inside a spec tree without a loader, else a short live sample.
function cpuBusyOf({ override, testContext, load }) {
  if (override) return override.cpuBusy != null ? num(override.cpuBusy) : null;
  if (testContext && !load) return null;
  try { return (load ?? (() => machineLoad({ sampleMs: 200 })))()?.cpuBusy ?? null; } catch { return null; }
}

function workersOf({ override, census, db, ledgerFile, env }) {
  if (Array.isArray(override?.ops)) return { ops: override.ops.map((o) => ({ status: 'running', ...o })), kernels: num(override.kernels) };
  return (census ?? (() => workersCensus({ db, ledgerFile, env })))();
}

function footprintSamplesOf({ override, footprints, thresholds, env }) {
  if (Array.isArray(override?.footprints)) return override.footprints;
  if (override) return [];
  try { return (footprints ?? (() => recentFootprints({ limit: thresholds.historySamples, env })))(); } catch { return []; }
}

// The mode of this call. Single writer (DESIGN §8.3): the reconciler's Resource controller alone writes the mode. This call reads the mode
// it published (fresh within RECONCILER_MODE_FRESH_MS); a stale or missing publication is computed locally and never
// written (owner ruling 2026-09-28 "on an error, delete it outright": no dormant fallback writer).
function throttleModeOf({ prev, host, override, cpuBusy, thresholds, now }) {
  const ramKnown = num(host.totalRamBytes) > 0 || override?.freeRamPct != null;
  const published = prev.writer === RECONCILER_WRITER && MODES.includes(prev.mode) && now - Date.parse(prev.at ?? '') < RECONCILER_MODE_FRESH_MS;
  if (published) return { published, m: { mode: prev.mode, ramMode: MODES.includes(prev.ramMode) ? prev.ramMode : prev.mode, cpuHot: Boolean(prev.cpuHot), why: prev.why ?? `${prev.mode} (published by ${RECONCILER_WRITER})` } };
  if (ramKnown) return { published, m: nextMode(prev, { freeRamPct: host.freeRamPct, cpuBusy }, thresholds) };
  return { published, m: { mode: prev.mode ?? 'normal', ramMode: prev.ramMode ?? 'normal', cpuHot: Boolean(prev.cpuHot), why: 'RAM unmeasured: mode unchanged' } };
}

const maxParallelOpsOf = () => {
  const configured = Number(runtimeProfile()?.maxParallelOps);
  if (!Number.isInteger(configured) || configured <= 0) return null;
  return configured;
};

/**
 * The throttle verdict for the host now: {host, cpuBusy, mode, ramMode, cpuHot, modeWhy, since, running,
 * runningByKind, queued, estimates, priorities, cap, admission (when `op` is named), thresholds, throttled}.
 * Reads the mode the Resource controller published (it alone keeps the hysteresis state). `load()` returns {cpuBusy}; `census()` the worker census; `footprints()` the
 * op-ram-footprint samples; each has a live default. Inside a node --test tree with no override the verdict is
 * computed but never refuses and nothing is written (as hostResourcesFor).
 */
export function hostThrottle({ op = null, workflowId = null, env = process.env, repo = null, db = null, ledgerFile = null, settings = null,
  load = null, census = null, footprints = null, state = null, now = Date.now() } = {}) {
  const s = settings ?? allocationSettings();
  const thresholds = throttleThresholds(s);
  const table = opRamTable(s);
  const override = overrideOf(env);
  const testContext = Boolean(isSpecRun(env ?? {})) && !override;
  const host = hostResourcesFor({ env, repo, settings: s });
  const cpuBusy = cpuBusyOf({ override, testContext, load });
  const workers = workersOf({ override, census, db, ledgerFile, env });
  const ops = workers.ops ?? [];
  const estimates = opRamEstimates(table, footprintSamplesOf({ override, footprints, thresholds, env }), thresholds);
  const prev = state ?? readThrottleState({ env });
  const priorities = priorityTable(s, prev);
  const { m, published } = throttleModeOf({ prev, host, override, cpuBusy, thresholds, now });
  const maxParallelOps = maxParallelOpsOf();
  const running = ops.filter((o) => o.status !== 'queued');
  const cap = effectiveCapOf({ maxParallelOps, running: running.length, host, mode: m.mode, estimates, thresholds });
  let admission = op ? admitOp({ op, workflowId, ops, maxParallelOps, host, mode: m.mode, modeWhy: m.why, estimates, priorities, thresholds }) : null;
  if (admission && testContext && !admission.ok) admission = { ...admission, ok: true, testContext: true };
  const changed = prev.mode !== m.mode;
  const since = changed ? new Date(now).toISOString() : prev.since ?? null;
  return { host, cpuBusy, mode: m.mode, ramMode: m.ramMode, cpuHot: m.cpuHot, modeWhy: m.why, since, running: running.length,
    runningByKind: countByKind(running), queued: ops.length - running.length, kernels: num(workers.kernels), estimates, priorities, cap, admission,
    thresholds, throttled: prev.throttled ?? null, modeWriter: RECONCILER_WRITER, modePublished: published, ...(testContext ? { testContext: true } : {}) };
}

/** The compact view status, the digest and the tick event carry. */
export const throttleSummary = (t) => (t ? {
  effectiveCap: t.cap?.effectiveCap ?? null, heavyCap: t.cap?.heavyCap ?? null, lightCap: t.cap?.lightCap ?? null, maxParallelOps: t.cap?.maxParallelOps ?? null,
  running: t.running, queued: t.queued, mode: t.mode, since: t.since, why: t.modeWhy, capWhy: t.cap?.why ?? null,
  freeRamPct: Math.round(num(t.host?.freeRamPct) * 10) / 10, cpuBusy: t.cpuBusy, throttled: t.throttled ?? null, line: throttleLine(t),
} : null);

/** One line for status and the digest. */
export function throttleLine(t) {
  if (!t) return 'ram-throttle: unread';
  const c = t.cap ?? {};
  const prio = Object.entries(t.priorities ?? {}).filter(([, p]) => p.weight > 1).map(([wf, p]) => `${wf} w${p.weight}${p.reserve ? ' r' + p.reserve : ''}`);
  return `ram-throttle: effective cap ${c.effectiveCap ?? '-'}/${c.maxParallelOps ?? '-'} (heavy ${c.heavyCap ?? '-'}), ${t.running} running, mode ${t.mode}`
    + ` - free RAM ${pct1(t.host?.freeRamPct)}${t.cpuBusy != null ? ', CPU ' + Math.round(t.cpuBusy * 100) + '%' : ''}; ${t.modeWhy}; ${c.why ?? ''}`
    + `${prio.length ? '; priority ' + prio.join(', ') : ''}${t.throttled?.count ? '; throttled ' + t.throttled.count + ' dispatch(es), last ' + (t.throttled.last?.jobId ?? '-') + ' ' + (t.throttled.last?.reason ?? '') + ' at ' + (t.throttled.last?.at ?? '-') : ''}`;
}

/* ------------------------------------------------------------ footprint history */

/**
 * One op-ram-footprint sample out of a process table grouped by owner (scripts/supervisor/host-health.mjs
 * groupByOwner with no limit) and the worker census: {opAgentRamMb, agentRamMb:{agent:mb}, kernels, running:{kind:n},
 * runningByPool:{pool:n}, freeRamPct}. Every agent:* and op:* group counts as op agents; the kernels are subtracted
 * (kernelMb each) when a kind's estimate is read.
 */
export function footprintSample({ owners = [], ops = [], kernels = 0, freeRamPct = null }) {
  const agents = owners.filter((g) => /^(agent|op):/.test(String(g.key)));
  const agentRamMb = {};
  for (const g of agents) agentRamMb[g.key] = (agentRamMb[g.key] ?? 0) + Math.round(num(g.ramMb));
  const running = ops.filter((o) => o.status !== 'queued');
  const runningByPool = running.reduce((acc, o) => { if (o.pool) { acc[o.pool] = (acc[o.pool] ?? 0) + 1; } return acc; }, {});
  return { opAgentRamMb: Object.values(agentRamMb).reduce((a, b) => a + b, 0), agentRamMb, kernels: num(kernels), running: countByKind(running), runningByPool,
    ...(freeRamPct != null ? { freeRamPct } : {}) };
}

/** The newest `limit` op-ram-footprint samples (machine.sqlite host_samples kind 'op-footprint'), oldest first. */
export const recentFootprints = ({ limit = DEFAULTS.historySamples, env = process.env } = {}) => readMachine((m) => m.db.prepare(
  'SELECT detail_json FROM host_samples WHERE kind=? ORDER BY seq DESC LIMIT ?').all(FOOTPRINT_SAMPLE_KIND, limit)
  .reverse().map((r) => JSON.parse(r.detail_json)).filter((v) => v && typeof v === 'object'), [], { env });

/** Record one footprintSample as host_samples kind 'op-footprint' (the full sample in detail_json). */
export const recordFootprint = (m, sample) => m.recordHostSample({ kind: FOOTPRINT_SAMPLE_KIND, subject: OP_RAM_FOOTPRINT,
  ramMb: Math.round(num(sample?.opAgentRamMb)), freeRamPct: sample?.freeRamPct ?? null,
  running: Object.values(sample?.running ?? {}).reduce((a, b) => a + num(b), 0), detailJson: sample });
