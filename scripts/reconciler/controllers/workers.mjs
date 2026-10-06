// workers.mjs — the Workers controller (reconciler DESIGN §8.6, §10.2, §17.2; lane rc-workers). Cross-workflow and
// worker-wide work that no single workflow owns, as Supervisor Decision Items instead of tick text:
//
//   workers:deps    every depsEveryMs: the wait-for graph of every product ledger (scripts/kernel/dependency-graph.mjs
//                 hard edges: peer waits, typed waits, seam dependencies) -> a cycle is ONE `deadlock` DI (options: a
//                 seam stub, a Supervisor bridge, lower one branch's priority); a hub-blocker / unowned-need finding is
//                 ONE `cross-workflow` DI.
//   workers:owed    every owedEveryMs: owed.mjs owedFindings -> cluster.mjs clusterOwed -> ONE Supervisor DI per open
//                 cluster (replaces the tick's OWED ACTIONS block and its SLA inbox text while the engine owns workers.owed).
//   workers:land    land.mjs landStatus -> clock LAND_QUEUE_STALL while a land holds the gate; the newest land-failed with
//                 no later land-passed -> clock LAND_FAILED_UNOWNED (the SLA layer turns a clock past its slaMs into
//                 a violation). On land-* events, also the post-land derivation: the grammar dist against its source
//                 (scripts/checks/check-grammar-dist.mjs, the check of commit 25b23059d) -> clock DERIVED_STALE.
//   workers:push    every pushEveryMs: push-mains.mjs through ctx.run (shadow: a would-row); a refused repo -> DI push-refused
//                 keyed (repo, failure signature, head), carrying the full push/hook output blob; push-mains itself holds
//                 back a repo refused again at the same head (exponential backoff), so an identical refusal escalates once.
// Every periodic key is claimed in the durable `schedules` table (scripts/reconciler/schedules.mjs, MB-01).
//   workers:metrics every metricsEveryMs: the op-health snapshot (scripts/machine/op-metrics.mjs aggregate over every
//                 product ledger + the stuck waits of the cached starci kernel status) recorded as ONE supervisor-op-metrics
//                 event - the trend line of the digest and of `op-metrics.mjs` reads these (the deleted tick wrote them).
//                 Telemetry, not an action: recorded in shadow too, like the SLA clocks.
//   workers:direct  every directEveryMs, only in the exclusive land-gate mode (config.yaml supervisor.landGate.mode): each
//                 first-parent commit on .claude main that no gate land produced (scripts/supervisor/direct-commits.mjs)
//                 is ONE Supervisor DI (kind runtime-defect, key direct-commit:<sha>): revert and re-land through the gate.
//   workers:notify  every notifyEveryMs: the owner digest through scripts/reconciler/notifier.mjs (ctx.run: shadow sends
//                 nothing), plus the urgent channel for the Supervisor DIs overdue x3.
//
// Idempotent: a DI's key names what it is about (the cycle's members, the cluster id, the repo), so a second pass
// re-opens nothing (decisions.mjs keeps one live DI per key). Numbers: modules/reconciler/workers.yaml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedgerReader } from '../../../engine/db/ledger.mjs';
import { clipLine } from '../../lib/clip.mjs';
import { shortHash } from '../../lib/hash.mjs';
import { productLedgers } from '../../lib/ledgers.mjs';
import { yamlNumberSettings } from '../../lib/read-yaml.mjs';
import { ownerLanguage, translator } from '../../lib/i18n.mjs';
import { DEFAULTS as SUPERVISOR_DEFAULTS, supervisorSettings } from '../../machine/home.mjs';
import { claimDue, finishDuty } from '../schedules.mjs';
import { byCodeUnit } from '../../lib/list.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WORKERS_FILE = path.join(ROOT, 'modules', 'reconciler', 'workers.yaml');
export const KEYS = Object.freeze({ deps: 'workers:deps', owed: 'workers:owed', land: 'workers:land', push: 'workers:push', metrics: 'workers:metrics', direct: 'workers:direct', notify: 'workers:notify' });
export const DEFAULTS = Object.freeze({ resyncMs: 60_000, concurrency: 1, depsEveryMs: 300_000, owedEveryMs: 300_000, pushEveryMs: 1_800_000, notifyEveryMs: 300_000, metricsEveryMs: 1_800_000, directEveryMs: 900_000,
  decisionDueMs: 3_600_000, landStallMs: 1_800_000, landFailedMs: 3_600_000, derivedMs: 300_000, urgentOverdueEscalations: 3 });
const SUPERVISOR = 'supervisor';
/** push-mains runs every repository in sequence, each push up to PUSH_TIMEOUT_MS (push-mains.mjs); boot.mjs DRAIN_GRACE_MS covers it. */
export const PUSH_RUN_TIMEOUT_MS = 1_800_000;

/** modules/reconciler/workers.yaml over DEFAULTS; a missing or bad number keeps its default. */
function workersSettings(file = WORKERS_FILE) {
  return yamlNumberSettings(file, DEFAULTS);
}

/* ------------------------------------------------------------ pure planners */

/** A Supervisor DI (DESIGN §10.3) the Workers controller opens. Pure. */
function workersDecision({ kind, key, summary, entity, evidence = [], options = [], now, dueMs, productLedger = null, workflowId = null }) {
  return {
    schema: 'starci/decision-item@1', idempotencyKey: key, kind, decider: 'supervisor', ledger: SUPERVISOR,
    ...(productLedger ? { productLedger } : {}), ...(workflowId ? { productWorkflowId: workflowId } : {}),
    entity, summary: clipLine(summary, 300), evidence: evidence.filter(Boolean).slice(0, 8).map((ref) => ({ ref: clipLine(ref, 400) })),
    options, openedBy: 'workers-controller', openedAt: now, dueAt: now + dueMs, escalateTo: 'owner', escalations: 0, status: 'open',
  };
}

/**
 * The simple wait cycles of a directed graph (edges [{from, to, via}]), each as its members in a canonical order (the
 * smallest id first, then the cycle's direction) so the same cycle always has the same key. Tarjan SCC, then one
 * cycle per strongly connected component of 2+ members. Pure.
 */
export function waitCycles(edges) {
  const adj = new Map();
  for (const e of edges) { if (!e?.from || !e?.to || e.from === e.to) { continue; } if (!adj.has(e.from)) { adj.set(e.from, new Set()); } adj.get(e.from).add(e.to); if (!adj.has(e.to)) { adj.set(e.to, new Set()); } }
  let index = 0;
  const idx = new Map(), low = new Map(), stack = [], on = new Set(), sccs = [];
  const strong = (v) => {
    idx.set(v, index); low.set(v, index); index += 1; stack.push(v); on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) sccs.push(c); }
  };
  for (const v of [...adj.keys()].sort(byCodeUnit)) if (!idx.has(v)) strong(v);
  return sccs.map((members) => {
    // Walk the cycle from its smallest member along edges inside the component.
    const inside = new Set(members);
    const start = [...members].sort(byCodeUnit)[0];
    const order = [start];
    let cur = start;
    while (order.length < members.length) {
      const next = [...(adj.get(cur) ?? [])].filter((n) => inside.has(n) && !order.includes(n)).sort(byCodeUnit)[0];
      if (!next) break;
      order.push(next); cur = next;
    }
    return order.length === members.length ? order : [...members].sort(byCodeUnit);
  });
}

/**
 * The deps pass: one `deadlock` DI per wait cycle, one `cross-workflow` DI per hub-blocker / unowned-need finding.
 * `graphs` [{ledgerId, edges: [{from, to, via}], findings: [{kind, workflows, summary, proposal}]}]. Pure.
 */
export function planDeps({ graphs = [], now, settings = DEFAULTS, language = ownerLanguage() }) {
  const tr = translator(language);
  const edges = graphs.flatMap((g) => (g.edges ?? []).map((e) => ({ ...e, ledgerId: g.ledgerId })));
  const ledgerOf = (wf) => graphs.find((g) => (g.edges ?? []).some((e) => e.from === wf || e.to === wf))?.ledgerId ?? null;
  const decisions = [];
  for (const cycle of waitCycles(edges)) {
    const via = cycle.map((wf, i) => edges.find((e) => e.from === wf && e.to === cycle[(i + 1) % cycle.length])).filter(Boolean);
    decisions.push(workersDecision({
      kind: 'deadlock', key: `deadlock:${cycle.join('+')}`, now, dueMs: settings.decisionDueMs, productLedger: ledgerOf(cycle[0]),
      entity: { type: 'workflow', id: cycle.join('+') },
      summary: tr('A circular wait across {count} workflows: {cycle} -> {first}', { count: cycle.length, cycle: cycle.join(' -> '), first: cycle[0] }),
      evidence: via.map((e) => tr('{from} waits on {to}', { from: e.from, to: e.to }) + (e.via ? tr(' via {via}', { via: e.via }) : '')),
      options: [
        { key: 'seam-stub', title: tr('Publish a seam stub so one branch keeps running'), recommended: true },
        { key: 'bridge', verb: 'starci supervisor bridge', title: tr('Supervisor bridge: transfer or assign the owner of the shared need') },
        { key: `lower-priority:${cycle.at(-1)}`, title: tr('Lower the priority of branch {branch}', { branch: cycle.at(-1) }) },
      ],
    }));
  }
  for (const g of graphs) for (const f of g.findings ?? []) {
    if (!['hub-blocker', 'unowned-need'].includes(f.kind)) continue;
    const wfs = [...new Set(f.workflows ?? [])].sort(byCodeUnit);
    decisions.push(workersDecision({
      kind: 'cross-workflow', key: `cross-workflow:${f.kind}:${wfs.join('+')}`, now, dueMs: settings.decisionDueMs, productLedger: g.ledgerId, workflowId: wfs[0] ?? null,
      entity: { type: 'workflow', id: wfs.join('+') || g.ledgerId }, summary: `${f.kind}: ${f.summary ?? ''}`,
      evidence: [f.summary, f.proposal?.why].filter(Boolean),
      options: f.proposal?.action ? [{ key: f.proposal.action, title: clipLine(f.proposal.why ?? f.proposal.action, 200), recommended: Boolean(f.proposal.clearCut) }] : [],
    }));
  }
  return decisions;
}

/** The owed pass: one Supervisor DI per open cluster (cluster.mjs clusterOwed), keyed by the cluster id. Pure. */
export function planOwed({ clusters = [], now, settings = DEFAULTS, language = ownerLanguage() }) {
  const tr = translator(language);
  return clusters.filter((c) => !c.fixedBy).map((c) => {
    const first = c.items?.[0] ?? {};
    return workersDecision({
      kind: first.class === 'owner' ? 'supervisor-ruling' : 'runtime-defect', key: `owed:${c.id}`, now, dueMs: settings.decisionDueMs,
      productLedger: first.repo ? path.basename(first.repo) : null, workflowId: c.workflows?.[0] ?? null,
      entity: { type: 'owed-cluster', id: c.id },
      summary: tr('{size} owed items ({id}), oldest {oldestMin} min: {summary}', { size: c.size, id: c.id, oldestMin: c.oldestMin, summary: first.summary ?? first.kind ?? '' }),
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

/**
 * The push pass: one `push-refused` DI per refused repo of a push-mains result. The key names every identity field
 * (MB-07): repo, the stable failure signature and the head; a result missing one opens nothing and is reported
 * instead. A changed signature or head is a new key that supersedes the repo's older push DI (supersedeEntity), so
 * the one live DI always carries the current reason with its full output blob (MB-03). Pure.
 */
export function planPush({ results = [], now, settings = DEFAULTS, language = ownerLanguage() }) {
  const tr = translator(language);
  const decisions = [], incomplete = [];
  for (const r of results.filter((x) => x?.refused || (x?.pushed === false && x?.error && !x?.skipped))) {
    const repo = path.basename(String(r.repo ?? ''));
    const head = String(r.head ?? '').slice(0, 12);
    const signature = String(r.signature ?? '');
    if (!repo || !head || !signature) { incomplete.push({ repo: repo || null, head: head || null, signature: signature || null }); continue; }
    const why = r.refused ?? r.error;
    decisions.push({
      ...workersDecision({
        kind: 'push-refused', key: `push-refused:${repo}:${shortHash(signature)}:${head}`, now, dueMs: settings.decisionDueMs,
        entity: { type: 'repo', id: repo }, summary: tr('Push to main refused at {repo} ({signature}{repeat}): {why}', { repo, signature, repeat: r.repeat > 1 ? tr(', attempt {n} at the same head', { n: r.repeat }) : '', why }),
        evidence: [String(why ?? ''), r.outputSha ? tr('blob:{sha} (the full push/hook output, {bytes} bytes)', { sha: r.outputSha, bytes: r.outputBytes ?? '?' }) : null, `head ${r.head}`],
        options: [{ key: 'fix-and-push', title: tr('Fix the cause and let the next push run retry it'), recommended: true }],
      }),
      keyParts: { kind: 'push-refused', repo, signature, head: String(r.head) }, supersedeEntity: true,
      ...(r.outputSha ? { refs: { outputSha: r.outputSha } } : {}),
    });
  }
  return Object.assign(decisions, { incomplete });
}

/** The direct-commit pass: one Supervisor DI per commit on main no gate land produced. Pure over [{sha, subject}]. */
function planDirect({ commits = [], now, settings = DEFAULTS, language = ownerLanguage() }) {
  const tr = translator(language);
  return commits.map((c) => workersDecision({
    kind: 'runtime-defect', key: `direct-commit:${c.sha}`, now, dueMs: settings.decisionDueMs,
    entity: { type: 'commit', id: String(c.sha).slice(0, 12) },
    summary: tr('Direct commit on main bypassing the land gate: {sha} {subject}', { sha: String(c.sha).slice(0, 9), subject: c.subject ?? '' }),
    evidence: [`DIRECT-COMMIT ${c.sha} ${c.subject ?? ''}`, 'config.yaml supervisor.landGate.mode: exclusive'],
    options: [{ key: 'revert-reland', title: tr('Revert the commit and re-land through land.mjs (lane + contract change)'), recommended: true },
      { key: 'accept', title: tr('Accept and record the reason (the infrastructure commit was already approved)') }],
  }));
}

/** Supervisor DIs escalated `min` times or more and past due: the urgent items (DESIGN §19). Pure. */
export const overdueUrgent = (dis, { now, min = DEFAULTS.urgentOverdueEscalations, language = ownerLanguage() } = {}) => {
  const tr = translator(language);
  return dis
    .filter((d) => ['open', 'claimed', 'escalated'].includes(d.status) && (d.escalations ?? 0) >= min && d.dueAt != null && d.dueAt < now)
    .map((d) => ({ class: 'supervisor-di-overdue', key: `di:${d.id}`, text: tr('Supervisor DI overdue x{count}: {summary}', { count: d.escalations, summary: clipLine(d.summary, 200) }) }));
};

/* ------------------------------------------------------------ reads */

function withReaders(ctx, fn) {
  const readers = [];
  for (const l of productLedgers(ctx)) {
    try { if (fs.existsSync(l.file)) readers.push({ ...l, db: (ctx.openReader ?? openLedgerReader)(l.file) }); } catch { /* out of view */ }
  }
  try { return fn(readers); } finally { for (const r of readers) { try { r.db.close(); } catch { /* closed */ } } }
}

const dutyOf = (key) => String(key).replace(/^workers:/, '');
/**
 * Whether `key` is due (every `ms`), claimed in the engine's durable `schedules` table (MB-01: an engine restart
 * or reload never runs a duty early; the in-memory "first pass is always due" ran the 30-min push every ~6 min).
 */
function due(ctx, key, ms, now) {
  try { return claimDue(ctx, { controller: 'workers', duty: dutyOf(key), intervalMs: ms, now }).due; }
  catch { return false; }
}

async function openAll(ctx, decisions) {
  const opened = [], failed = [];
  for (const d of decisions) {
    try { await ctx.openDecision(d); opened.push(d.idempotencyKey); } catch (error) { failed.push(`${d.idempotencyKey}: ${clipLine(error?.message ?? error, 120)}`); }
  }
  return { opened, failed };
}

/** The land gate's runs of the last day (machine.sqlite land_runs) as [{kind: land-passed|land-failed, id, at}], newest first. */
async function landEventsOf(ctx, now) {
  try {
    const { readSupervisor } = await import('../../machine/home.mjs');
    return readSupervisor((m) => m.landRuns({ limit: 20 }).map((r) => ({ kind: r.result === 'passed' ? 'land-passed' : 'land-failed', id: r.lane ?? r.commit_sha, at: Number(r.finished_at ?? r.started_at) }))
      .filter((e) => e.at >= now - 86_400_000), [], { env: ctx.env ?? process.env });
  } catch { return []; }
}

/* ------------------------------------------------------------ reconcile */

/** config.yaml language for the owner-visible DI text (DEFAULT_OWNER_LANGUAGE unless config says otherwise); `deps.language` overrides. */
const languageOf = async (deps) => {
  return deps.language ?? ownerLanguage();
};

async function reconcileDeps(key, ctx, settings, now, force, language, deps) {
  if (!force && !due(ctx, key, settings.depsEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  const depGraph = deps.dependencyGraph ?? (await import('../../kernel/dependency-graph.mjs')).dependencyGraph;
  const graphs = withReaders(ctx, (readers) => readers.map((r) => {
    try { const g = depGraph(r.db, { repo: r.repo, now, light: true }); return { ledgerId: r.ledgerId, edges: g.edges.filter((e) => e.strength === 'hard'), findings: g.findings }; }
    catch { return { ledgerId: r.ledgerId, edges: [], findings: [] }; }
  }));
  const plan = planDeps({ graphs, now, settings, language });
  return { ok: true, key, cycles: plan.filter((d) => d.kind === 'deadlock').length, ...(await openAll(ctx, plan)) };
}

async function reconcileOwed(key, ctx, settings, now, force, language, deps) {
  if (!force && !due(ctx, key, settings.owedEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  const [{ owedFindings }, { clusterOwed }] = await Promise.all([deps.owed ?? import('../../supervisor/owed.mjs'), deps.cluster ?? import('../../supervisor/cluster.mjs')]);
  const owed = withReaders(ctx, (readers) => readers.flatMap((r) => {
    try { return owedFindings(r.db, { repo: r.repo, ledgers: readers.map((x) => ({ repo: x.repo, db: x.db })), now }).map((i) => ({ ...i, repo: r.repo })); } catch { return []; }
  }));
  const plan = planOwed({ clusters: clusterOwed(owed), now, settings, language });
  return { ok: true, key, owed: owed.length, clusters: plan.length, ...(await openAll(ctx, plan)) };
}

async function reconcileLand(key, ctx, settings, now, deps) {
  const land = deps.landStatus ? deps.landStatus() : (await import('../../supervisor/land.mjs')).landStatus({ env: ctx.env ?? process.env });
  const events = deps.landEvents ?? await landEventsOf(ctx, now);
  let dist = deps.dist ?? null;
  if (!dist && !deps.landStatus) { try { dist = (await import('../../gates/grammar-dist.mjs')).grammarDistStatus(); } catch { dist = null; } }
  const plan = planLand({ land, events, dist, now, settings });
  for (const c of plan.set) await ctx.clock(c.entity, c.state, c.slaMs, { ledgerId: SUPERVISOR, controller: 'workers', ...(c.enteredAt ? { enteredAt: c.enteredAt } : {}) });
  for (const c of plan.clear) await ctx.clear(c.entity, c.state);
  return { ok: true, key, clocks: plan.set.map((c) => `${c.state}:${c.entity}`), cleared: plan.clear.length };
}

async function reconcilePush(key, ctx, settings, now, force, language) {
  if (!force && !due(ctx, key, settings.pushEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  const r = await ctx.run('node', ['scripts/supervisor/push-mains.mjs', '--json'], { timeoutMs: PUSH_RUN_TIMEOUT_MS });
  if (r?.shadow) return { ok: true, key, shadow: true };
  const results = Array.isArray(r?.value) ? r.value : [];
  const plan = planPush({ results, now, settings, language });
  if (plan.incomplete.length) ctx.log('reconciler.error', `push: ${plan.incomplete.length} refusal(s) lack a repo, head or signature; no Decision Item opened`, { kind: 'reconciler.workers.push-key-incomplete', incomplete: plan.incomplete });
  return { ok: r?.ok !== false, key, actionId: r?.actionId ?? null, pushed: results.filter((x) => x.pushed).length, held: results.filter((x) => x.held).length, ...(await openAll(ctx, plan)) };
}

async function reconcileMetrics(key, ctx, now, force, settings, deps) {
  if (!force && !due(ctx, key, settings.metricsEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  const om = deps.opMetrics ?? await import('../../machine/op-metrics.mjs');
  const windowMs = om.telemetrySettings().windowMs;
  const { records, running } = withReaders(ctx, (readers) => {
    const out = { records: [], running: [] };
    for (const r of readers) {
      try { out.records.push(...om.jobRecords(r.db, { since: now - windowMs, now }).map((x) => ({ ...x, repo: r.repo }))); } catch { /* unreadable */ }
      try { for (const w of r.db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL").all()) out.running.push({ ledgerId: r.ledgerId, workflowId: w.workflow_id }); } catch { /* unreadable */ }
    }
    return out;
  });
  // The stuck waits come from the cached starci kernel status (ctx.status, shared by every controller; never a fresh spawn per pass).
  const stuck = [];
  for (const w of running) { try { const st = await ctx.status(w.ledgerId, w.workflowId); if (Array.isArray(st?.stuck)) stuck.push(...st.stuck); } catch { /* unreadable */ } }
  const payload = om.snapshotPayload(om.aggregate(records, { now, windowMs }), stuck);
  const record = deps.recordSnapshot ?? (async (p) => {
    const { withSupervisor } = await import('../../machine/home.mjs');
    withSupervisor((m) => om.recordSnapshot(m, p), { env: ctx.env ?? process.env });
  });
  await record(payload);
  return { ok: true, key, jobs: payload.totals.jobs, stuck: payload.stuck };
}

async function reconcileDirect(key, ctx, settings, now, force, language, deps) {
  if (!force && !due(ctx, key, settings.directEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  let mode = deps.landGateMode;
  if (mode === undefined) { try { mode = supervisorSettings().landGate.mode; } catch { mode = SUPERVISOR_DEFAULTS.landGate.mode; } }
  if (mode !== 'exclusive') return { ok: true, key, skipped: `land gate ${mode}` };
  const commits = deps.directCommits ? deps.directCommits() : (await import('../../supervisor/direct-commits.mjs')).directCommits({ env: ctx.env ?? process.env });
  return { ok: true, key, direct: commits.length, ...(await openAll(ctx, planDirect({ commits, now, settings, language }))) };
}

async function reconcileNotify(key, ctx, settings, now, force, language) {
  if (!force && !due(ctx, key, settings.notifyEveryMs, now)) return { ok: true, key, skipped: 'not-due' };
  const digest = await ctx.run('node', ['scripts/reconciler/notifier.mjs', 'digest', '--send', '--json'], { timeoutMs: 180_000 });
  let urgentItems = [];
  try {
    // Read-only: the Supervisor's DIs (machine.sqlite sup_decision_items, decisions.mjs supervisorDecisions).
    const [{ supervisorDecisions }, { readSupervisor }] = await Promise.all([import('../../machine/decisions.mjs'), import('../../machine/home.mjs')]);
    const dis = readSupervisor((m) => supervisorDecisions(m, { now }), [], { env: ctx.env ?? process.env });
    urgentItems = overdueUrgent(dis, { now, min: settings.urgentOverdueEscalations, language });
  } catch { urgentItems = []; }
  const urgent = [];
  for (const u of urgentItems) urgent.push(await ctx.run('node', ['scripts/reconciler/notifier.mjs', 'urgent', '--class', u.class, '--key', u.key, '--text', u.text, '--send', '--json'], { timeoutMs: 60_000 }));
  let digestResult = 'not-due';
  if (digest?.shadow) digestResult = 'shadow';
  else if (digest?.value?.sent) digestResult = 'sent';
  return { ok: true, key, digest: digestResult, urgent: urgent.length };
}

export async function reconcileWorkers(key, ctx, { settings = workersSettings(), deps = {} } = {}) {
  const now = ctx.now();
  const force = deps.force === true;
  const language = await languageOf(deps);
  if (key === KEYS.deps) return reconcileDeps(key, ctx, settings, now, force, language, deps);
  if (key === KEYS.owed) return reconcileOwed(key, ctx, settings, now, force, language, deps);
  if (key === KEYS.land) return reconcileLand(key, ctx, settings, now, deps);
  if (key === KEYS.push) return reconcilePush(key, ctx, settings, now, force, language);
  if (key === KEYS.metrics) return reconcileMetrics(key, ctx, now, force, settings, deps);
  if (key === KEYS.direct) return reconcileDirect(key, ctx, settings, now, force, language, deps);
  if (key === KEYS.notify) return reconcileNotify(key, ctx, settings, now, force, language);
  return { ok: false, key, skipped: 'unknown-key' };
}

export default {
  name: 'workers',
  concerns: ['workers.owed', 'workers.push', 'workers.deps', 'notify.owner'],
  resyncMs: DEFAULTS.resyncMs,
  concurrency: DEFAULTS.concurrency,
  // A land event re-reads the land gate and the derived dist at once; the other keys keep their own cadence.
  routes: { 'land-*': () => KEYS.land },
  list: async () => Object.values(KEYS),
  async reconcile(key, ctx) {
    const r = await reconcileWorkers(key, ctx, { settings: workersSettings() });
    // The claimed run's outcome (workers:land is event-driven, not a schedule).
    if (key !== KEYS.land && r && !r.skipped) {
      let result = 'done';
      if (r.shadow) result = 'skipped';
      else if (r.ok === false) result = 'failed';
      finishDuty(ctx, { controller: 'workers', duty: dutyOf(key), result, actionId: r.actionId ?? null, now: ctx.now() });
    }
    return r;
  },
};
