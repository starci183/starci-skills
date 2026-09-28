// fleet.mjs — the Fleet controller (reconciler DESIGN §8.6, §10.2, §17.2; lane rc-fleet-ui). Cross-workflow and
// fleet-wide work that no single workflow owns, as Supervisor Decision Items instead of tick text:
//
//   fleet:deps    every depsEveryMs: the wait-for graph of every product ledger (scripts/kernel/dependency-graph.mjs
//                 hard edges: peer waits, typed waits, seam dependencies) -> a cycle is ONE `deadlock` DI (options: a
//                 seam stub, a Supervisor bridge, lower one branch's priority); a hub-blocker / unowned-need finding is
//                 ONE `cross-workflow` DI.
//   fleet:owed    every owedEveryMs: owed.mjs owedFindings -> cluster.mjs clusterOwed -> ONE Supervisor DI per open
//                 cluster (replaces the tick's OWED ACTIONS block and its SLA inbox text while the engine owns fleet.owed).
//   fleet:land    land.mjs landStatus -> clock LAND_QUEUE_STALL while a land holds the gate; the newest land-failed with
//                 no later land-passed -> clock LAND_FAILED_UNOWNED (the SLA layer turns a clock past its slaMs into
//                 a violation). On land-* events, also the post-land derivation: the grammar dist against its source
//                 (scripts/checks/grammar-dist.mjs, the check of commit 25b23059d) -> clock DERIVED_STALE.
//   fleet:push    every pushEveryMs: push-mains.mjs through ctx.run (shadow: a would-row); a refused repo -> DI push-refused.
//   fleet:notify  every notifyEveryMs: the owner digest through scripts/reconciler/notifier.mjs (ctx.run: shadow sends
//                 nothing), plus the urgent channel for the Supervisor DIs overdue x3.
//
// Idempotent: a DI's key names what it is about (the cycle's members, the cluster id, the repo), so a second pass
// re-opens nothing (decisions.mjs keeps one live DI per key). Numbers: modules/reconciler/fleet.yaml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { openLedgerReader } from '../../../engine/ledger-db.mjs';
import { clipLine } from '../../lib/clip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const FLEET_FILE = path.join(ROOT, 'modules', 'reconciler', 'fleet.yaml');
export const KEYS = Object.freeze({ deps: 'fleet:deps', owed: 'fleet:owed', land: 'fleet:land', push: 'fleet:push', notify: 'fleet:notify' });
export const DEFAULTS = Object.freeze({ resyncMs: 60_000, concurrency: 1, depsEveryMs: 300_000, owedEveryMs: 300_000, pushEveryMs: 1_800_000, notifyEveryMs: 300_000,
  decisionDueMs: 3_600_000, landStallMs: 1_800_000, landFailedMs: 3_600_000, derivedMs: 300_000, urgentOverdueEscalations: 3 });
const SUPERVISOR = 'supervisor';

/** modules/reconciler/fleet.yaml over DEFAULTS; a missing or bad number keeps its default. */
export function fleetSettings(file = FLEET_FILE) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (Number.isFinite(Number(doc[k])) && Number(doc[k]) > 0) out[k] = Number(doc[k]);
  return out;
}

/* ------------------------------------------------------------ pure planners */

/** A Supervisor DI (DESIGN §10.3) the Fleet controller opens. Pure. */
export function fleetDecision({ kind, key, summary, entity, evidence = [], options = [], now, dueMs, productLedger = null, workflowId = null }) {
  return {
    schema: 'starci/decision-item@1', idempotencyKey: key, kind, decider: 'supervisor', ledger: SUPERVISOR,
    ...(productLedger ? { productLedger } : {}), ...(workflowId ? { productWorkflowId: workflowId } : {}),
    entity, summary: clipLine(summary, 300), evidence: evidence.filter(Boolean).slice(0, 8).map((ref) => ({ ref: clipLine(ref, 400) })),
    options, openedBy: 'fleet-controller', openedAt: now, dueAt: now + dueMs, escalateTo: 'owner', escalations: 0, status: 'open',
  };
}

/**
 * The simple wait cycles of a directed graph (edges [{from, to, via}]), each as its members in a canonical order (the
 * smallest id first, then the cycle's direction) so the same cycle always has the same key. Tarjan SCC, then one
 * cycle per strongly connected component of 2+ members. Pure.
 */
export function waitCycles(edges) {
  const adj = new Map();
  for (const e of edges) { if (!e?.from || !e?.to || e.from === e.to) continue; if (!adj.has(e.from)) adj.set(e.from, new Set()); adj.get(e.from).add(e.to); if (!adj.has(e.to)) adj.set(e.to, new Set()); }
  let index = 0;
  const idx = new Map(), low = new Map(), stack = [], on = new Set(), sccs = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index += 1; stack.push(v); on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) sccs.push(c); }
  };
  for (const v of [...adj.keys()].sort()) if (!idx.has(v)) strong(v);
  return sccs.map((members) => {
    // Walk the cycle from its smallest member along edges inside the component.
    const inside = new Set(members);
    const start = [...members].sort()[0];
    const order = [start];
    let cur = start;
    while (order.length < members.length) {
      const next = [...(adj.get(cur) ?? [])].filter((n) => inside.has(n) && !order.includes(n)).sort()[0];
      if (!next) break;
      order.push(next); cur = next;
    }
    return order.length === members.length ? order : [...members].sort();
  });
}

/**
 * The deps pass: one `deadlock` DI per wait cycle, one `cross-workflow` DI per hub-blocker / unowned-need finding.
 * `graphs` [{ledgerId, edges: [{from, to, via}], findings: [{kind, workflows, summary, proposal}]}]. Pure.
 */
export function planDeps({ graphs = [], now, settings = DEFAULTS }) {
  const edges = graphs.flatMap((g) => (g.edges ?? []).map((e) => ({ ...e, ledgerId: g.ledgerId })));
  const ledgerOf = (wf) => graphs.find((g) => (g.edges ?? []).some((e) => e.from === wf || e.to === wf))?.ledgerId ?? null;
  const decisions = [];
  for (const cycle of waitCycles(edges)) {
    const via = cycle.map((wf, i) => edges.find((e) => e.from === wf && e.to === cycle[(i + 1) % cycle.length])).filter(Boolean);
    decisions.push(fleetDecision({
      kind: 'deadlock', key: `deadlock:${cycle.join('+')}`, now, dueMs: settings.decisionDueMs, productLedger: ledgerOf(cycle[0]),
      entity: { type: 'workflow', id: cycle.join('+') },
      summary: `Chờ vòng tròn giữa ${cycle.length} luồng: ${cycle.join(' -> ')} -> ${cycle[0]}`,
      evidence: via.map((e) => `${e.from} chờ ${e.to}${e.via ? ` qua ${e.via}` : ''}`),
      options: [
        { key: 'seam-stub', title: 'Công bố một seam stub để một nhánh chạy tiếp', recommended: true },
        { key: 'bridge', verb: 'node scripts/supervisor/bridge.mjs', title: 'Supervisor bridge: chuyển hoặc chỉ định chủ của nhu cầu chung' },
        { key: `lower-priority:${cycle[cycle.length - 1]}`, title: `Hạ ưu tiên nhánh ${cycle[cycle.length - 1]}` },
      ],
    }));
  }
  for (const g of graphs) for (const f of g.findings ?? []) {
    if (!['hub-blocker', 'unowned-need'].includes(f.kind)) continue;
    const wfs = [...new Set(f.workflows ?? [])].sort();
    decisions.push(fleetDecision({
      kind: 'cross-workflow', key: `cross-workflow:${f.kind}:${wfs.join('+')}`, now, dueMs: settings.decisionDueMs, productLedger: g.ledgerId, workflowId: wfs[0] ?? null,
      entity: { type: 'workflow', id: wfs.join('+') || g.ledgerId }, summary: `${f.kind}: ${f.summary ?? ''}`,
      evidence: [f.summary, f.proposal?.why].filter(Boolean),
      options: f.proposal?.action ? [{ key: f.proposal.action, title: clipLine(f.proposal.why ?? f.proposal.action, 200), recommended: Boolean(f.proposal.clearCut) }] : [],
    }));
  }
  return decisions;
}

/** The owed pass: one Supervisor DI per open cluster (cluster.mjs clusterOwed), keyed by the cluster id. Pure. */
export function planOwed({ clusters = [], now, settings = DEFAULTS }) {
  return clusters.filter((c) => !c.fixedBy).map((c) => {
    const first = c.items?.[0] ?? {};
    return fleetDecision({
      kind: first.class === 'owner' ? 'supervisor-ruling' : 'runtime-defect', key: `owed:${c.id}`, now, dueMs: settings.decisionDueMs,
      productLedger: first.repo ? path.basename(first.repo) : null, workflowId: c.workflows?.[0] ?? null,
      entity: { type: 'owed-cluster', id: c.id },
      summary: `${c.size} việc nợ (${c.id}), cũ nhất ${c.oldestMin} phút: ${first.summary ?? first.kind ?? ''}`,
      evidence: (c.items ?? []).slice(0, 6).map((i) => i.line ?? `${i.workflowId} ${i.incidentId ?? i.key}`),
      options: first.action ? [{ key: 'owed-action', title: clipLine(first.action, 200), recommended: true }] : [],
    });
  });
}

/**
 * The land pass: the clocks to hold. `land` = landStatus(); `events` = the newest land-passed/land-failed rows
 * [{kind, id, at}] newest first; `dist` = grammarDistStatus() or null. Pure. {set: [{entity, state, slaMs, enteredAt?}], clear: [{entity, state}]}.
 */
export function planLand({ land = null, events = [], dist = null, now, settings = DEFAULTS }) {
  const set = [], clear = [];
  if (land?.busy) set.push({ entity: 'land:queue', state: 'LAND_QUEUE_STALL', slaMs: settings.landStallMs, enteredAt: Number(land.current?.at ?? land.current?.startedAt) || now });
  else clear.push({ entity: 'land:queue', state: 'LAND_QUEUE_STALL' });
  const newest = events[0];
  if (newest?.kind === 'land-failed') set.push({ entity: `land:${newest.id}`, state: 'LAND_FAILED_UNOWNED', slaMs: settings.landFailedMs, enteredAt: newest.at });
  for (const e of events.filter((x) => x.kind === 'land-failed' && x !== newest)) clear.push({ entity: `land:${e.id}`, state: 'LAND_FAILED_UNOWNED' });
  if (dist) {
    if (dist.ok === false || (dist.state && dist.state !== 'fresh')) set.push({ entity: 'derived:grammar-dist', state: 'DERIVED_STALE', slaMs: settings.derivedMs });
    else clear.push({ entity: 'derived:grammar-dist', state: 'DERIVED_STALE' });
  }
  return { set, clear };
}

/** The push pass: one `push-refused` DI per refused repo of a push-mains result. Pure. */
export function planPush({ results = [], now, settings = DEFAULTS }) {
  return results.filter((r) => r?.refused || (r?.pushed === false && r?.error && !r?.skipped)).map((r) => fleetDecision({
    kind: 'push-refused', key: `push-refused:${path.basename(String(r.repo ?? ''))}:${String(r.head ?? '').slice(0, 12)}`, now, dueMs: settings.decisionDueMs,
    entity: { type: 'repo', id: path.basename(String(r.repo ?? '')) }, summary: `Push main bị từ chối ở ${path.basename(String(r.repo ?? ''))}: ${r.refused ?? r.error}`,
    evidence: [String(r.refused ?? r.error ?? '')], options: [{ key: 'fix-and-push', title: 'Sửa nguyên nhân rồi để lượt push sau chạy lại', recommended: true }],
  }));
}

/** Supervisor DIs escalated `min` times or more and past due: the urgent items (DESIGN §19). Pure. */
export const overdueUrgent = (dis, { now, min = DEFAULTS.urgentOverdueEscalations }) => dis
  .filter((d) => ['open', 'claimed', 'escalated'].includes(d.status) && (d.escalations ?? 0) >= min && d.dueAt != null && d.dueAt < now)
  .map((d) => ({ class: 'supervisor-di-overdue', key: `di:${d.id}`, text: `Supervisor DI quá hạn x${d.escalations}: ${clipLine(d.summary, 200)}` }));

/* ------------------------------------------------------------ reads */

const productLedgers = (ctx) => (ctx.ledgers ?? []).filter((l) => l.ledgerId !== SUPERVISOR && l.file);
function withReaders(ctx, fn) {
  const readers = [];
  for (const l of productLedgers(ctx)) {
    try { if (fs.existsSync(l.file)) readers.push({ ...l, db: (ctx.openReader ?? openLedgerReader)(l.file) }); } catch { /* out of view */ }
  }
  try { return fn(readers); } finally { for (const r of readers) { try { r.db.close(); } catch { /* closed */ } } }
}

const lastRun = new WeakMap();
/** Whether `key` is due on this ctx's engine (every `ms`); the first pass after a start is always due. */
function due(ctx, key, ms, now) {
  let m = lastRun.get(ctx);
  if (!m) { m = new Map(); lastRun.set(ctx, m); }
  const at = m.get(key);
  if (at != null && now - at < ms) return false;
  m.set(key, now);
  return true;
}

async function openAll(ctx, decisions) {
  const opened = [], failed = [];
  for (const d of decisions) {
    try { await ctx.openDecision(d); opened.push(d.idempotencyKey); } catch (error) { failed.push(`${d.idempotencyKey}: ${clipLine(error?.message ?? error, 120)}`); }
  }
  return { opened, failed };
}

async function supervisorEvents(ctx, sql, args) {
  try {
    const { withSupervisorRead, SUPERVISOR_WF } = await import('../../supervisor/home.mjs');
    return withSupervisorRead((db) => db.prepare(sql).all(SUPERVISOR_WF, ...args), [], { env: ctx.env ?? process.env });
  } catch { return []; }
}

/* ------------------------------------------------------------ reconcile */

export async function reconcileFleet(key, ctx, { settings = fleetSettings(), deps = {} } = {}) {
  const now = ctx.now();
  const force = deps.force === true;
  if (key === KEYS.deps) {
    if (!force && !due(ctx, key, settings.depsEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
    const depGraph = deps.dependencyGraph ?? (await import('../../kernel/dependency-graph.mjs')).dependencyGraph;
    const graphs = withReaders(ctx, (readers) => readers.map((r) => {
      try { const g = depGraph(r.db, { repo: r.repo, now, light: true }); return { ledgerId: r.ledgerId, edges: g.edges.filter((e) => e.strength === 'hard'), findings: g.findings }; }
      catch { return { ledgerId: r.ledgerId, edges: [], findings: [] }; }
    }));
    const plan = planDeps({ graphs, now, settings });
    return { ok: true, key, cycles: plan.filter((d) => d.kind === 'deadlock').length, ...(await openAll(ctx, plan)) };
  }
  if (key === KEYS.owed) {
    if (!force && !due(ctx, key, settings.owedEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
    const [{ owedFindings }, { clusterOwed }] = await Promise.all([deps.owed ?? import('../../supervisor/owed.mjs'), deps.cluster ?? import('../../supervisor/cluster.mjs')]);
    const owed = withReaders(ctx, (readers) => readers.flatMap((r) => {
      try { return owedFindings(r.db, { repo: r.repo, ledgers: readers.map((x) => ({ repo: x.repo, db: x.db })), now }).map((i) => ({ ...i, repo: r.repo })); } catch { return []; }
    }));
    const plan = planOwed({ clusters: clusterOwed(owed), now, settings });
    return { ok: true, key, owed: owed.length, clusters: plan.length, ...(await openAll(ctx, plan)) };
  }
  if (key === KEYS.land) {
    const land = deps.landStatus ? deps.landStatus() : (await import('../../supervisor/land.mjs')).landStatus({ env: ctx.env ?? process.env });
    const events = deps.landEvents ?? (await supervisorEvents(ctx, "SELECT kind, entity_id, created_at FROM events WHERE workflow_id=? AND kind IN ('land-passed','land-failed') AND created_at>=? ORDER BY seq DESC LIMIT 20", [now - 86_400_000]))
      .map((r) => ({ kind: r.kind, id: r.entity_id, at: Number(r.created_at) }));
    let dist = deps.dist ?? null;
    if (!dist && !deps.landStatus) { try { dist = (await import('../../checks/grammar-dist.mjs')).grammarDistStatus(); } catch { dist = null; } }
    const plan = planLand({ land, events, dist, now, settings });
    for (const c of plan.set) await ctx.clock(c.entity, c.state, c.slaMs, { ledgerId: SUPERVISOR, controller: 'fleet', ...(c.enteredAt ? { enteredAt: c.enteredAt } : {}) });
    for (const c of plan.clear) await ctx.clear(c.entity, c.state);
    return { ok: true, key, clocks: plan.set.map((c) => `${c.state}:${c.entity}`), cleared: plan.clear.length };
  }
  if (key === KEYS.push) {
    if (!force && !due(ctx, key, settings.pushEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
    const r = await ctx.run('node', ['scripts/supervisor/push-mains.mjs', '--json'], { timeoutMs: 900_000 });
    if (r?.shadow) return { ok: true, key, shadow: true };
    const results = Array.isArray(r?.value) ? r.value : [];
    return { ok: r?.ok !== false, key, pushed: results.filter((x) => x.pushed).length, ...(await openAll(ctx, planPush({ results, now, settings }))) };
  }
  if (key === KEYS.notify) {
    if (!force && !due(ctx, key, settings.notifyEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
    const digest = await ctx.run('node', ['scripts/reconciler/notifier.mjs', 'digest', '--send', '--json'], { timeoutMs: 180_000 });
    let urgentItems = [];
    try {
      // Read-only: the Supervisor's DIs through withSupervisorRead (decisions.mjs listDecisions over that handle).
      const [{ listDecisions, SUPERVISOR_WF }, { withSupervisorRead }] = await Promise.all([import('../decisions.mjs'), import('../../supervisor/home.mjs')]);
      const dis = withSupervisorRead((db) => listDecisions(db, { workflowId: SUPERVISOR_WF, now }), [], { env: ctx.env ?? process.env });
      urgentItems = overdueUrgent(dis, { now, min: settings.urgentOverdueEscalations });
    } catch { urgentItems = []; }
    const urgent = [];
    for (const u of urgentItems) urgent.push(await ctx.run('node', ['scripts/reconciler/notifier.mjs', 'urgent', '--class', u.class, '--key', u.key, '--text', u.text, '--send', '--json'], { timeoutMs: 60_000 }));
    return { ok: true, key, digest: digest?.shadow ? 'shadow' : digest?.value?.sent ? 'sent' : 'not-due', urgent: urgent.length };
  }
  return { ok: false, key, skipped: 'unknown-key' };
}

export default {
  name: 'fleet',
  concerns: ['fleet.owed', 'fleet.push', 'fleet.deps', 'notify.owner'],
  resyncMs: DEFAULTS.resyncMs,
  concurrency: DEFAULTS.concurrency,
  // A land event re-reads the land gate and the derived dist at once; the other keys keep their own cadence.
  routes: { 'land-*': () => KEYS.land },
  list: async () => Object.values(KEYS),
  reconcile: (key, ctx) => reconcileFleet(key, ctx, { settings: fleetSettings() }),
};
