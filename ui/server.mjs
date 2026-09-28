import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite'; // eslint-disable-line no-unused-vars
import { openLedgerReader } from '../engine/ledger-db.mjs';
import { jobDisplayNameOf, opLabelMap, workflowDisplayName } from '../scripts/lib/display-names.mjs';
import { supervisorSnapshot, basePoolState } from '../scripts/supervisor/status-block.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';
import { landStatus } from '../scripts/supervisor/land.mjs';
import { agentSnapshot, readAgentLog } from './agent-monitor.mjs';
import { readAgentChanges, readAgentImage, readProjectHistory, readProjectCommit } from './agent-changes.mjs';
import { listEvidence, findEvidence } from './evidence-gallery.mjs';
import { findIndexedArtifact, findProofFile, readArtifacts, readOpProofs } from './op-proofs.mjs';
import { readWorkflowEvents } from './workflow-events.mjs';
import { logQueryOf, readDiffAsset, readJobDiff, readProjectLogs } from './typed-logs.mjs';
import { readSupervisorLogs, readSupervisorStateForUi, supervisorLogQueryOf } from './supervisor.mjs';
import { aggregate, jobRecords, telemetrySettings } from '../scripts/supervisor/op-metrics.mjs';
import { notifierState } from '../scripts/reconciler/notifier.mjs';
import { hostRam, probeServices, productDecisions, productWorktreesOf, progressRow, reconcilerState, supervisorDecisions, unitBoard } from './reconciler.mjs';

// The approved leg graph comes from scripts/route/plan-edges.mjs. When a runtime does not have that module, the UI draws the linear chain.
const planEdges = await import('../scripts/route/plan-edges.mjs').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
// green-provisional: green on autopilot's provisional acceptance ("tự nhận tạm"); deferred: held for the final review (scripts/kernel/autopilot.mjs).
const LEG_COLORS = new Set(['green', 'yellow', 'red', 'gray', 'green-provisional', 'deferred']);
// The workflow's work graph (scripts/work/work-graph-store.mjs). A runtime without it shows the leg graph only.
const optionalModule = (spec) => import(spec).catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
const [graphStore, graphModel, contractVersion, depGraph] = await Promise.all([optionalModule('../scripts/work/work-graph-store.mjs'), optionalModule('../scripts/work/work-graph-model.mjs'), optionalModule('../scripts/kernel/contract-version.mjs'), optionalModule('../scripts/kernel/dependency-graph.mjs')]);
/** The ledger's cross-workflow waits, findings and Supervisor bridges (scripts/kernel/dependency-graph.mjs): a minimal view. */
function dependencyView(db, repo) {
  if (!depGraph) return null;
  try {
    const g = depGraph.dependencyGraph(db, { repo, light: true });
    return {
      edges: g.edges.filter((e) => e.strength === 'hard').map((e) => ({ from: safe(e.from), to: safe(e.to), via: safe(e.via) })),
      findings: g.findings.map((f) => ({ kind: safe(f.kind), workflows: f.workflows.map((wf) => safe(wf)), summary: safe(f.summary), action: safe(f.proposal?.action ?? ''), clearCut: Boolean(f.proposal?.clearCut) })),
      bridges: g.bridges.map((b) => ({ id: safe(b.id), action: safe(b.action), state: safe(b.state ?? ''), workflowId: b.workflowId ? safe(b.workflowId) : null, provisional: Boolean(b.provisional) })),
    };
  } catch { return null; }
}

const run = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(root, '..');
const serveStatic = process.argv.includes('--serve-static');
const port = Number(process.env.STARCI_STATUS_PORT || (serveStatic ? 4547 : 4546));
const dist = path.join(root, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
// The projects served. STARCI_STATUS_PROJECTS (a JSON array of {id, name, repo}) replaces them: the contract spec
// (tests/harness-contract.spec.mjs) serves fixture ledgers this way, never the live port.
const DEFAULT_PROJECTS = [
  { id: 'nivo', name: 'Nivo', repo: 'D:/Repositories/nivo-backend' },
  { id: 'starci-next', name: 'StarCi Next', repo: 'D:/Repositories/starci-next' },
  { id: 'mia-mia', name: 'Mia Mia', repo: 'D:/Repositories/mia-mia-backend' },
];
const projects = (() => {
  try { const list = JSON.parse(process.env.STARCI_STATUS_PROJECTS || 'null'); if (Array.isArray(list) && list.every((p) => /^[a-z0-9-]{1,40}$/.test(p?.id ?? '') && typeof p.repo === 'string')) return list.map((p) => ({ id: p.id, name: String(p.name ?? p.id), repo: p.repo })); } catch { /* the defaults */ }
  return DEFAULT_PROJECTS;
})();
// STARCI_STATUS_OFFLINE=1: the snapshot reads the ledgers only - no supervisor CLIs, no supervisor home (a fixture server).
const offline = process.env.STARCI_STATUS_OFFLINE === '1';
const TTL = 30_000;
let cache = null;
let pending = null;
let agentCache = null;
let agentPending = null;

function safe(value, limit = 300) {
  return String(value ?? '')
    .replace(/(?:sk|ghp|gho|xox[baprs]|AIza)[-_A-Za-z0-9]{12,}/g, '[đã ẩn]')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/gi, '$1 [đã ẩn]')
    .replace(/\b(token|secret|api[_ -]?key|password)\s*[:=]\s*[^\s,;]+/gi, '$1: [đã ẩn]')
    .replace(/\b(token|secret|api[_ -]?key|password)\s+[A-Za-z0-9._~+/-]{16,}/gi, '$1 [đã ẩn]')
    .replace(/([?&](?:token|key|secret|code)=)[^&#\s]+/gi, '$1[đã ẩn]')
    .slice(0, limit);
}
function liveFormLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !['response.starci.org', '127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/a-[0-9a-f]+$/.test(url.pathname)) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}
function parse(value, fallback = {}) { try { return JSON.parse(value); } catch { return fallback; } }
function localName(id) { return id.replace(/^wf-/, '').replace(/-mu[a-z0-9]+$/, '').replaceAll('-', ' '); }
async function mapLimit(rows, limit, mapper) {
  const result = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor++;
      result[index] = await mapper(rows[index]);
    }
  }));
  return result;
}

async function readCli(script, args, fallback, { timeout = 18_000 } = {}) {
  if (offline) return { value: fallback, error: 'offline' };
  try {
    const { stdout } = await run(process.execPath, [script, ...args], {
      cwd: runtime, timeout, maxBuffer: 20 * 1024 * 1024, windowsHide: true,
    });
    return { value: JSON.parse(stdout), error: null };
  } catch (error) {
    // A verb that reports a red result exits non-zero with its JSON on stdout (api verify-proofs: TAMPERED): that is data.
    try { const value = JSON.parse(error.stdout); if (value && typeof value === 'object') return { value, error: null }; } catch { /* no JSON */ }
    return { value: fallback, error: safe(error.message) };
  }
}

function planGraph(goalJson) {
  if (!planEdges) return null;
  const { edges, source } = planEdges.planGraphOf(goalJson);
  return { edges: edges.map(([from, to]) => [safe(from), safe(to)]), source: safe(source) };
}

/** A node's covering jobs (work-graph-store.mjs coverageOf) as the UI shows them: the op that last ran it and its jobs, newest first. */
function coverageView(covering = []) {
  const rows = [...covering].sort((a, b) => b.createdAt - a.createdAt || b.jobId.localeCompare(a.jobId));
  return { lastOp: rows[0]?.op ? safe(rows[0].op) : null, jobs: rows.slice(0, 12).map((job) => ({ jobId: safe(job.jobId), op: safe(job.op), status: safe(job.status), model: job.model ? safe(job.model) : null })) };
}

/**
 * The owner's image review board (api status drawReviews) as the UI shows it: each shape's images are served by
 * the evidence gallery (/api/evidence/<id>, the id of the part's path under .starciwork), its open notes and the
 * record's round history. Text is passed through `safe`.
 */
function drawReviewView(project, reviews) {
  if (!Array.isArray(reviews)) return [];
  const idOf = (recordPath, part) => {
    const dir = path.posix.dirname(String(recordPath ?? '').split(path.win32.sep).join('/')).replace(/^\.starciwork\//, '');
    const relative = path.posix.normalize(path.posix.join(dir, String(part ?? '').split(path.win32.sep).join('/')));
    return relative.startsWith('features/') ? createHash('sha256').update(`${project.id}:${relative}`).digest('hex').slice(0, 24) : null;
  };
  const note = (n) => ({ id: safe(n.id), text: safe(n.text, 600), round: n.round ?? null, class: safe(n.class), shape: n.shape ? safe(n.shape) : null,
    ...(typeof n.addressed === 'boolean' ? { addressed: n.addressed, reasons: (n.reasons ?? []).slice(0, 4).map((r) => safe(r, 240)) } : {}) });
  return reviews.slice(0, 40).map((r) => ({
    record: safe(r.record), state: safe(r.state), awaitingOwner: Boolean(r.awaitingOwner),
    rounds: (r.rounds ?? []).map((round) => ({ round: round.round, dispatchId: safe(round.dispatchId), state: safe(round.state), decision: round.decision ? safe(round.decision) : null,
      answeredAt: round.answeredAt ? safe(round.answeredAt) : null, golden: Boolean(round.golden), notes: (round.notes ?? []).map(note) })),
    shapes: (r.shapes ?? []).map((s) => ({ shape: safe(s.shape), round: s.round ?? null, golden: safe(s.golden), addressed: s.addressed ?? 0, unaddressed: s.unaddressed ?? 0,
      openNotes: (s.openNotes ?? []).map(note),
      images: (s.parts ?? []).map((p) => ({ path: safe(p.path), shape: p.shape ? safe(p.shape) : null, breakpoint: p.breakpoint ? safe(p.breakpoint) : null, imageId: idOf(r.recordPath, p.path) })) })),
  }));
}

const OPEN_JOB = ['queued', 'leased', 'running', 'answering'];
/**
 * The parallel units of each leg from the ledger: the ordinals of its cut sets (`api status` cutSets) and any open
 * job outside a cut. The live sets (a unit queued or running) win; else the set whose jobs are newest. A cut set no
 * job ran yet is `planned` (×N dự kiến) only while the op has no job at all. A queued unit carries why (`api status`
 * frontier.queued) and the slot ceiling when a slot is what it waits on.
 */
function legUnits(op, cutSets, jobs, queued) {
  const mine = jobs.filter((job) => job.op === op);
  const byId = new Map(mine.map((job) => [job.jobId, job]));
  const sets = cutSets.filter((set) => set?.op === op && Number(set.total) > 0);
  const jobsOf = (set) => Object.values(set.jobs ?? {}).map((entry) => byId.get(entry?.jobId)).filter(Boolean);
  const newest = (set) => Math.max(0, ...jobsOf(set).map((job) => job.createdAt));
  const live = sets.filter((set) => Object.values(set.jobs ?? {}).some((entry) => OPEN_JOB.includes(entry?.status)));
  const ran = sets.filter((set) => jobsOf(set).length).sort((a, b) => newest(b) - newest(a));
  const chosen = live.length ? live : ran.slice(0, 1);
  const unitOf = (job, label, cut) => {
    const wait = job ? queued.find((item) => item.jobId === job.jobId) : null;
    return { label: safe(job?.what ? `${job.what}` : label), ...(job?.displayName ? { displayName: safe(job.displayName) } : {}), jobId: job ? safe(job.jobId) : null, status: job ? safe(job.status) : 'planned', model: job?.model ? safe(job.model) : null, cut,
      ...(wait ? { queuedBecause: safe(wait.queuedBecause), ceiling: wait.ceiling ?? null, slotsHeld: wait.slotsHeld ?? null } : {}) };
  };
  const units = [];
  for (const set of chosen) for (let ordinal = 1; ordinal <= Number(set.total); ordinal++) {
    units.push(unitOf(byId.get(set.jobs?.[ordinal]?.jobId) ?? null, `${set.id} · ${ordinal}/${set.total}`, { id: safe(set.id), ordinal, total: Number(set.total) }));
  }
  const inCut = new Set(units.map((unit) => unit.jobId).filter(Boolean));
  for (const job of mine) if (OPEN_JOB.includes(job.status) && !inCut.has(job.jobId) && !job.cut) units.push(unitOf(job, job.title || job.jobId, null));
  if (!units.length && !mine.length && sets.length) return { total: Math.max(...sets.map((set) => Number(set.total))), planned: true, units: [] };
  return { total: units.length, planned: false, units };
}

/** Latest work-graph version with live colours, frontier and version history; null when the workflow has none. */
function workGraph(db, workflowId) {
  if (!graphStore || !graphModel) return null;
  const latest = graphStore.latestVersion(db, workflowId);
  if (!latest) return null;
  // A settled leg a contract change owes a follow-up is rework, as api status colours it.
  let rework = new Set();
  try { rework = new Set((contractVersion?.pendingContractFollowUps(db, workflowId, contractVersion.loadContractChanges(runtime)) ?? []).map((item) => item.jobId)); } catch { rework = new Set(); }
  const { colors, jobs } = graphStore.liveCoverage(db, latest, { rework });
  const nodes = latest.graph.nodes.map((node) => ({
    ...coverageView(jobs.get(node.id)),
    id: safe(node.id), domain: safe(node.domain), slice: safe(node.slice), kind: safe(node.kind), title: safe(node.title), parent: node.parent ? safe(node.parent) : null,
    color: LEG_COLORS.has(colors[node.id]) ? colors[node.id] : 'gray', frs: (node.frs ?? []).map((fr) => safe(fr)), shapes: (node.shapes ?? []).map((shape) => safe(shape)),
    inferred: (node.inferred ?? []).length > 0,
  }));
  return {
    version: latest.version, event: safe(latest.event), domains: latest.graph.domains.map((domain) => safe(domain.id)), nodes,
    edges: latest.graph.edges.map((edge) => ({ from: safe(edge.from), to: safe(edge.to), kind: safe(edge.kind) })),
    frontier: graphModel.frontierOf(latest.graph, colors).map((node) => safe(node.id)),
    history: graphStore.versionsOf(db, workflowId).map((version) => ({
      version: version.version, event: safe(version.event), reason: safe(version.reason, 600), authorOp: safe(version.authorOp), authorJob: version.authorJob ? safe(version.authorJob) : null, at: version.createdAt,
      added: version.diff?.added?.length ?? 0, removed: version.diff?.removed?.length ?? 0, changed: version.diff?.changed?.length ?? 0, red: (version.diff?.red ?? []).map((id) => safe(id)),
    })).reverse(),
  };
}

function readProject(project) {
  const db = openLedgerReader(path.join(project.repo, '.starciwork', 'runtime.sqlite'));
  try {
    // SELECT *: an older read-only ledger has no display_name column.
    const active = db.prepare("SELECT * FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY created_at").all();
    const ids = new Set(active.map((row) => row.workflow_id));
    const jobs = db.prepare("SELECT job_id, workflow_id, op_id, attempt, status, created_at, updated_at, payload_json FROM jobs WHERE kind<>'kernel' ORDER BY created_at DESC").all().filter((row) => ids.has(row.workflow_id));
    // Each job's human name, `<op label> · <what> · <workflow name>` (scripts/lib/display-names.mjs); ids stay the keys.
    const nameCache = new Map();
    const nameOf = new Map(active.map((row) => [row.workflow_id, workflowDisplayName(row) || localName(row.workflow_id)]));
    const jobName = new Map(jobs.map((job) => [job.job_id, jobDisplayNameOf(db, job, { repo: project.repo, workflowName: nameOf.get(job.workflow_id), cache: nameCache })]));
    const named = (jobId) => (jobName.get(jobId) ? { displayName: safe(jobName.get(jobId)) } : {});

    const settled = db.prepare("SELECT workflow_id, entity_id, payload_json, created_at FROM events WHERE kind='op-settled' ORDER BY seq DESC").all()
      .filter((row) => ids.has(row.workflow_id)).map((row) => ({ ...row, result: parse(row.payload_json) }));
    const openIncidents = db.prepare("SELECT workflow_id, incident_id, op_id, last_progress, updated_at FROM incidents WHERE status='open' ORDER BY updated_at DESC").all().filter((row) => ids.has(row.workflow_id));
    const signals = db.prepare("SELECT key, holder_pid, at, expires_at, value_json FROM signals WHERE scope='kernel'").all();
    const goals = db.prepare('SELECT workflow_id, json, markdown FROM goals ORDER BY goal_seq DESC').all();
    const goalMap = new Map();
    for (const goal of goals) if (!goalMap.has(goal.workflow_id)) goalMap.set(goal.workflow_id, goal);
    const signalMap = new Map(signals.map((row) => [row.key, row]));
    const now = Date.now();
    const workflowRows = active.map((row) => {
      const wfJobs = jobs.filter((job) => job.workflow_id === row.workflow_id);
      const wfVerdicts = settled.filter((event) => event.workflow_id === row.workflow_id);
      const wfIncidents = openIncidents.filter((incident) => incident.workflow_id === row.workflow_id);
      const goal = goalMap.get(row.workflow_id);
      const goalJson = parse(goal?.json);
      const signal = signalMap.get(row.workflow_id);
      const kernel = !signal ? 'unknown' : (signal.expires_at == null || Number(signal.expires_at) > now) ? 'live' : 'stale';
      const outcome = wfVerdicts.reduce((acc, event) => { const key = event.result?.verdict; if (key in acc) acc[key]++; return acc; }, { pass: 0, fail: 0, blocked: 0 });
      return {
        id: row.workflow_id, name: safe(nameOf.get(row.workflow_id)), projectId: project.id,
        goal: safe(goalJson?.opChain?.input?.text || goal?.markdown || ''),
        kernel: { state: kernel, at: signal?.at ?? null, agent: safe(parse(signal?.value_json)?.agent || ''), model: safe(parse(signal?.value_json)?.model || '') },
        verdicts: outcome,
        running: wfJobs.filter((job) => ['leased', 'running', 'answering'].includes(job.status)).map((job) => ({ jobId: job.job_id, op: job.op_id, attempt: job.attempt, since: job.created_at, status: job.status, ...named(job.job_id) })),
        queued: wfJobs.filter((job) => job.status === 'queued').map((job) => ({ jobId: job.job_id, op: job.op_id, since: job.created_at, reason: safe(parse(job.payload_json)?.queuedBecause || ''), ...named(job.job_id) })),
        incidents: wfIncidents.map((item) => ({ id: item.incident_id, op: item.op_id, text: safe(item.last_progress), at: item.updated_at })),
        recentVerdicts: wfVerdicts.slice(0, 12).map((item) => {
          const job = wfJobs.find((candidate) => candidate.job_id === item.entity_id);
          return { jobId: item.entity_id, op: job?.op_id || '', attempt: job?.attempt ?? null, verdict: item.result?.verdict || 'unknown', checks: item.result?.checkEvidence ?? null, at: item.created_at, ...named(item.entity_id) };
        }),
        frontier: null,
        plan: planGraph(goalJson),
        workGraph: workGraph(db, row.workflow_id),
        jobLog: wfJobs.map((job) => { const payload = parse(job.payload_json); const displayName = jobName.get(job.job_id) ?? null; return { jobId: job.job_id, op: job.op_id, status: job.status, createdAt: job.created_at, model: payload.model ?? null, cut: Boolean(payload.cut), title: payload.title ?? null, displayName, what: displayName ? displayName.split(' · ')[1] ?? null : null }; }),
      };
    });
    const totals = workflowRows.reduce((acc, wf) => {
      acc.workflows++;
      if (wf.kernel.state === 'live') acc.kernels++;
      acc.workers += wf.running.length;
      acc.pass += wf.verdicts.pass; acc.fail += wf.verdicts.fail; acc.blocked += wf.verdicts.blocked;
      acc.incidents += wf.incidents.length;
      return acc;
    }, { workflows: 0, kernels: 0, workers: 0, pass: 0, fail: 0, blocked: 0, incidents: 0 });
    // Op health (scripts/supervisor/op-metrics.mjs) over the telemetry window: per-job records, merged across projects.
    let opRecords = [];
    try { const windowMs = telemetrySettings().windowMs; opRecords = jobRecords(db, { since: now - windowMs, now }); } catch { opRecords = []; }
    return { id: project.id, name: project.name, repo: project.repo, totals, workflows: workflowRows, dependencies: dependencyView(db, project.repo), opRecords };
  } finally { db.close(); }
}

async function buildSnapshot() {
  const [progress, owed, inbox] = await Promise.all([
    readCli('scripts/supervisor/progress-report.mjs', projects.flatMap((p) => ['--repo', p.repo]).concat('--json'), { rows: [] }),
    readCli('scripts/supervisor/owed.mjs', ['--json'], { items: [], counts: {} }),
    readCli('scripts/supervisor/channel.mjs', ['inbox', '--id', 'main', '--peek', '--json'], { messages: [] }),
  ]);
  const sources = { progress: progress.error, owed: owed.error, inbox: inbox.error };
  const projectRows = projects.map((project) => {
    try { return readProject(project); }
    catch (error) { sources[project.id] = safe(error.message); return { id: project.id, name: project.name, repo: project.repo, error: safe(error.message), totals: null, workflows: [] }; }
  });
  const progressMap = new Map((progress.value.rows || []).map((row) => [row.id, row]));
  for (const project of projectRows) for (const wf of project.workflows) {
    const row = progressMap.get(wf.id);
    wf.done = row?.done ?? null; wf.total = row?.total ?? null;
    if (row?.name && wf.name === localName(wf.id)) wf.name = safe(row.name);
    wf.legs = Array.isArray(row?.legs) ? row.legs.map((leg) => ({ op: safe(leg.op), state: safe(leg.state), since: leg.since ?? null, rework: Boolean(leg.rework), color: null })) : [];
    wf.nextActions = null;
    wf.etaAt = row?.etaAt ?? null;
    wf.lastReport = row?.lastReport ? { op: safe(row.lastReport.op), outcome: safe(row.lastReport.outcome), summary: safe(row.lastReport.summary), at: row.lastReport.at } : null;
    wf.asks = Array.isArray(row?.asks) ? row.asks.map((ask) => ({ op: safe(ask.op), askClass: safe(ask.askClass), text: safe(ask.text), link: liveFormLink(ask.link) })) : [];
    wf.holds = Array.isArray(row?.holds) ? row.holds.map((hold) => ({ op: safe(hold.op), reason: safe(hold.heldBecause), peer: safe(hold.peer), jobId: safe(hold.jobId), since: hold.since })) : [];
  }
  // `api status` of each live workflow runs in its own loop (statusLoop, below): the snapshot applies the last answer
  // it has, so no page ever waits on the 30-50 s verb.
  const liveRows = projectRows.flatMap((project) => project.workflows.map((wf) => ({ project, wf })));
  for (const { project, wf } of liveRows) {
    const status = statusCache.get(wf.id);
    if (!status) { sources[`status:${wf.id}`] = offline ? 'offline' : 'api status chưa chạy xong lần đầu'; continue; }
    if (status.error) { sources[`status:${wf.id}`] = status.error; if (!status.value) continue; }
    const state = status.value;
    wf.stuck = Array.isArray(state?.stuck) ? state.stuck : [];
    wf.frontier = {
      state: safe(state?.frontier?.state),
      actionable: Boolean(state?.frontier?.actionable),
      reason: safe(state?.frontier?.reason),
      queuedCauses: state?.frontier?.queuedCauses && typeof state.frontier.queuedCauses === 'object' ? state.frontier.queuedCauses : {},
      peerWaits: Array.isArray(state?.frontier?.peerWaits) ? state.frontier.peerWaits.map((wait) => ({ peer: safe(wait.peer), job: safe(wait.job), reason: safe(wait.reason) })) : [],
    };
    const queuedNames = new Map((wf.queued ?? []).map((job) => [job.jobId, job.displayName]));
    if (Array.isArray(state?.frontier?.queued)) wf.queued = state.frontier.queued.map((job) => ({
      ...(queuedNames.get(safe(job.jobId)) ? { displayName: queuedNames.get(safe(job.jobId)) } : {}),
      jobId: safe(job.jobId), op: safe(job.opId), since: null,
      reason: safe(job.detail || job.queuedBecause || ''), queuedBecause: safe(job.queuedBecause),
      ceiling: Number(job.blockedBy?.ceiling ?? job.blockedBy?.maxParallel) || null, slotsHeld: Number.isFinite(Number(job.blockedBy?.running)) ? Number(job.blockedBy.running) : null,
      peer: safe(job.peer), blockedBy: job.blockedBy ? { op: safe(job.blockedBy.op), job: safe(job.blockedBy.job) } : null,
    }));
    if (state?.kernel?.status !== 'running' && wf.kernel.state === 'live') wf.kernel.state = 'stale';
    // Leg colors and next actions are the runtime's own verdict (api status); the UI only derives a color when status carries none.
    const colors = new Map((Array.isArray(state?.legs) ? state.legs : []).filter((leg) => LEG_COLORS.has(leg?.color)).map((leg) => [String(leg.op), leg.color]));
    for (const leg of wf.legs) leg.color = colors.get(leg.op) ?? null;
    const cutSets = Array.isArray(state?.cutSets) ? state.cutSets : [];
    for (const leg of wf.legs) leg.units = legUnits(leg.op, cutSets, wf.jobLog ?? [], wf.queued);
    if (Array.isArray(state?.nextActions)) wf.nextActions = state.nextActions.map((action) => ({
      kind: safe(action.kind), op: safe(action.op), jobId: action.jobId ? safe(action.jobId) : null, incidentId: action.incidentId ? safe(action.incidentId) : null, reason: safe(action.reason, 600),
      ...(action.displayName ? { displayName: safe(action.displayName) } : {}),
    }));
    wf.drawReviews = drawReviewView(project, state?.drawReviews);
    wf.workers = Array.isArray(state?.workers) ? state.workers.map((worker) => ({ jobId: safe(worker.jobId), liveness: safe(worker.liveness), connected: Boolean(worker.connected) })) : [];
    // Grammar proposals interface.draw filed and nobody resolved (the owner decides them) and LOG_TYPED_MISSING warnings.
    wf.grammarProposals = Array.isArray(state?.grammarProposals) ? state.grammarProposals.map((p) => ({ name: safe(p.name), opId: p.opId ? safe(p.opId) : null, jobId: p.jobId ? safe(p.jobId) : null, file: p.file ? safe(p.file) : null, complete: Boolean(p.complete) })) : [];
    wf.logTypedMissing = Array.isArray(state?.logTypedMissing) ? state.logTypedMissing.map((w) => ({ jobId: safe(w.jobId), op: w.op ? safe(w.op) : null, attempt: Number.isInteger(w.attempt) ? w.attempt : null, code: 'LOG_TYPED_MISSING', missing: (w.missing ?? []).map((m) => safe(m)), opRows: Number(w.opRows) || 0, at: w.at ?? null })) : [];
  }
  // Progress, RCA, units by job state, DIs and worktrees of each live workflow, in-process (progress-rca.mjs
  // workflowView is the function behind api status progress/rca; ~30 ms a workflow).
  const now = Date.now();
  const boards = new Map();
  await mapLimit(projectRows.filter((project) => project.workflows.length), 3, async (project) => {
    let db;
    try { db = openLedgerReader(path.join(project.repo, '.starciwork', 'runtime.sqlite')); } catch (error) { sources[`fleet:${project.id}`] = safe(error.message); return; }
    try {
      for (const wf of project.workflows) {
        try {
          const decisions = productDecisions(db, { ledger: project.id, workflowId: wf.id, now });
          const live = decisions.filter((d) => ['open', 'claimed', 'escalated'].includes(d.status));
          const state = statusCache.get(wf.id)?.value ?? null;
          const core = state ? { legs: state.legs, frontier: state.frontier, stuck: state.stuck, ramThrottle: state.ramThrottle, poolLoad: state.poolLoad } : {};
          const fleet = progressRow(db, { workflowId: wf.id, repo: project.repo, core, now, decisions: live, ownerAsks: (wf.asks ?? []).filter((ask) => ask.askClass !== 'credential') });
          const names = new Map((wf.jobLog ?? []).map((job) => [job.jobId, job.displayName]));
          boards.set(wf.id, { fleet, board: unitBoard(db, wf.id, { nameOf: (jobId) => (names.get(jobId) ? safe(names.get(jobId)) : null), now }), decisions, worktrees: await productWorktreesOf(db, wf.id), coreFrom: statusCache.get(wf.id)?.at ?? null });
        } catch (error) { sources[`fleet:${wf.id}`] = safe(error.message); }
      }
    } finally { db.close(); }
  });
  for (const project of projectRows) for (const wf of project.workflows) delete wf.jobLog;
  // Op health across every project and the stuck waits api status aged (critical first, then oldest), at most 60.
  let opHealth = null;
  try {
    const windowMs = telemetrySettings().windowMs;
    const m = aggregate(projectRows.flatMap((project) => project.opRecords ?? []), { now: Date.now(), windowMs });
    const row = (r) => ({ key: safe(r.key), jobs: r.jobs, succeeded: r.succeeded, failed: r.failed, successRate: r.successRate, queueWaitP50: r.queueWait.p50, queueWaitP90: r.queueWait.p90,
      runP50: r.runTime.p50, settleP50: r.settleTime.p50, topFailureClass: r.topFailureClass ? safe(r.topFailureClass) : null, failureClasses: r.failureClasses.slice(0, 5).map((c) => ({ class: safe(c.class), n: c.n })),
      repeatedIdentical: r.repeatedIdentical, deadWorkerRate: r.deadWorkerRate, attemptsMax: r.attemptsPerNode.max, ownerWaitMs: r.ownerWait.totalMs, throttleMs: r.throttle.totalMs });
    opHealth = { windowMs: m.windowMs, at: m.at, totals: row(m.totals), ops: m.ops.map(row) };
  } catch (error) { sources.opHealth = safe(error.message); }
  for (const project of projectRows) delete project.opRecords;
  const rank = { critical: 2, warn: 1, ok: 0 };
  const stuck = projectRows.flatMap((project) => project.workflows.flatMap((wf) => (wf.stuck ?? []).map((item) => ({
    key: safe(item.key), projectId: project.id, workflowId: safe(wf.id), kind: safe(item.kind), cause: safe(item.cause), jobId: item.jobId ? safe(item.jobId) : null, opId: item.opId ? safe(item.opId) : null,
    incidentId: item.incidentId ? safe(item.incidentId) : null, since: Number(item.since) || 0, ageMs: Number(item.ageMs) || 0, severity: safe(item.severity), owner: safe(item.owner), count: Number(item.count) || 1, detail: safe(item.detail, 600),
  })))).sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0) || b.ageMs - a.ageMs).slice(0, 60);
  for (const project of projectRows) for (const wf of project.workflows) delete wf.stuck;
  for (const project of projectRows) if (project.totals) {
    project.totals.kernels = project.workflows.filter((wf) => wf.kernel.state === 'live').length;
  }
  let supervisor = null;
  if (!offline) try {
    const snap = withSupervisorRead((db) => supervisorSnapshot(db));
    const land = landStatus();
    const base = basePoolState();
    supervisor = {
      activeWorkers: (snap?.board?.active || []).map((worker) => ({ agent: safe(worker.agent), cluster: safe(worker.cluster), ageMin: worker.ageMin ?? null })),
      land: { busy: Boolean(land.busy), queued: Number(land.queued || 0), current: safe(land.current?.jobId) },
      lastLands: (snap?.lands || []).map((event) => ({ kind: safe(event.kind), id: safe(event.entity_id), at: event.created_at })),
      pushes: (snap?.pushes || []).map((event) => ({ kind: safe(event.kind), repo: safe(path.basename(event.entity_id || '')), head: safe(event.payload?.head), error: safe(event.payload?.refused || event.payload?.error), at: event.created_at })),
      basePool: { name: safe(base.pool), provider: safe(base.provider), model: safe(base.model), open: base.open?.length || 0, ledgers: base.ledgers ?? 0 },
    };
  } catch (error) { sources.supervisor = safe(error.message); }
  else sources.supervisor = 'offline';
  const out = {
    updatedAt: Date.now(), sources,
    // The shared op labels (modules/ops/labels.yaml): the UI shows exactly these words for an op id.
    opLabels: Object.fromEntries(Object.entries(opLabelMap()).map(([op, label]) => [op, { vi: safe(label.vi ?? op), en: safe(label.en ?? label.vi ?? op) }])),
    projects: projectRows,
    owed: (owed.value.items || []).slice(0, 50).map((item) => ({ key: safe(item.key), projectId: projects.find((p) => item.repo?.replaceAll('\\', '/').toLowerCase() === p.repo.toLowerCase())?.id ?? null, workflowId: safe(item.workflowId), kind: safe(item.kind), summary: safe(item.summary), ageMin: item.ageMin ?? null, status: safe(item.status) })),
    owedCounts: owed.value.counts || {},
    inboxUnreadTotal: (inbox.value.messages || []).filter((message) => !message.read).length,
    inbox: (inbox.value.messages || []).slice(-30).reverse().map((message) => ({ id: safe(message.id), at: message.at, from: safe(message.from), text: safe(message.text), read: Boolean(message.read), judgedAt: /\bjudged\s+(\d{4}-\d{2}-\d{2}[^;)]*)/i.exec(message.text || '')?.[1] || null })),
    supervisor,
    opHealth,
    stuck,
  };
  // Per-workflow detail and the page views ride along out of /api/snapshot's JSON (non-enumerable).
  Object.defineProperty(out, 'boards', { value: boards, enumerable: false });
  const views = await pageViews(out);
  Object.defineProperty(out, 'views', { value: views, enumerable: false });
  return out;
}

const LIVE_DI = ['open', 'claimed', 'escalated'];
const PLAN_GATE = /\b(?:goal|plan) revision\b|bản chỉnh kế hoạch|sửa kế hoạch/i;
const PILL_RANK = { stuck: 0, slow: 1, unknown: 2, ok: 3, done: 4 };
/**
 * The page views, built once per tick from the snapshot (each page reads ONE endpoint):
 *   home    the live workflows (progress, speed, ETA, pill, top reason, who is on it), the owner-only items (shown
 *           only when any) and the one-line system health strip;
 *   system  the reconciler (engine, controllers, services, violations, GC), the Supervisor's decisions, op health
 *           and the land gate;
 *   nav     the counts the navigation shows.
 * Every number names its source.
 */
async function pageViews(snap) {
  const now = Date.now();
  const rows = snap.projects.flatMap((project) => project.workflows.map((wf) => ({ project, wf })));
  const supDecisions = offline ? [] : supervisorDecisions({ now });
  const productDis = rows.flatMap(({ project, wf }) => (snap.boards.get(wf.id)?.decisions ?? []).map((d) => ({ ...d, projectId: project.id })));
  const reconciler = reconcilerState({ now, serviceProbe });
  const ram = hostRam();

  const workflows = rows.map(({ project, wf }) => ({
    id: wf.id, projectId: project.id, projectName: project.name, name: wf.name, goal: safe(wf.goal, 200),
    kernel: wf.kernel.state, pill: snap.boards.get(wf.id)?.fleet?.pill ?? 'unknown', progress: snap.boards.get(wf.id)?.fleet?.progress ?? null, topReason: snap.boards.get(wf.id)?.fleet?.topReason ?? null, onIt: snap.boards.get(wf.id)?.fleet?.onIt ?? null,
    rcaWhy: snap.boards.get(wf.id)?.fleet?.rca?.why ?? null, statusAt: snap.boards.get(wf.id)?.coreFrom ?? null,
    source: 'progress-rca.mjs workflowView (= api status progress)',
  })).sort((a, b) => (PILL_RANK[a.pill] ?? 2) - (PILL_RANK[b.pill] ?? 2) || String(a.name).localeCompare(String(b.name)));

  // Owner-only items (DESIGN §20): asks, owner-decider DIs, images awaiting the owner, plan revisions; credentials
  // only as the one handover checklist line.
  const owner = [];
  for (const { wf } of rows) {
    for (const ask of wf.asks ?? []) if (ask.askClass !== 'credential') owner.push({ kind: 'ask', workflowId: wf.id, workflowName: wf.name, text: ask.text, link: ask.link, source: 'progress-report asks' });
    for (const review of wf.drawReviews ?? []) if (review.awaitingOwner || review.state === 'awaiting-owner') owner.push({ kind: 'draw-review', workflowId: wf.id, workflowName: wf.name, text: `Duyệt hình ${review.record}`, link: null, source: 'api status drawReviews' });
    for (const incident of wf.incidents ?? []) if (/^\[owner-gate/.test(incident.text) && PLAN_GATE.test(incident.text)) owner.push({ kind: 'plan-revision', workflowId: wf.id, workflowName: wf.name, text: safe(incident.text, 240), link: null, source: `incident ${incident.id}` });
  }
  for (const d of [...productDis, ...supDecisions]) if (d.decider === 'owner' && LIVE_DI.includes(d.status)) owner.push({ kind: 'decision', workflowId: d.workflowId, workflowName: rows.find(({ wf }) => wf.id === d.workflowId)?.wf.name ?? null, text: d.summary, link: null, source: `decision ${d.id}` });
  const credentials = rows.reduce((n, { wf }) => n + (wf.asks ?? []).filter((ask) => ask.askClass === 'credential').length, 0);
  if (credentials) owner.push({ kind: 'credentials', workflowId: null, workflowName: null, text: `Checklist credential khi bàn giao: ${credentials} mục`, link: null, source: 'progress-report asks (askClass credential)' });

  const modes = {};
  for (const c of reconciler.controllers) if (c.mode) modes[c.mode] = (modes[c.mode] ?? 0) + 1;
  const land = snap.supervisor?.land ?? null;
  const health = {
    ram: { ...ram, source: 'os.totalmem/os.freemem' },
    services: { healthy: reconciler.services.healthy, total: reconciler.services.managed, down: reconciler.services.down, source: reconciler.services.source },
    violations: { open: reconciler.violations.open, critical: reconciler.violations.critical, source: reconciler.violations.source },
    gc: reconciler.gc ? { leftovers: reconciler.gc.leftovers, at: reconciler.gc.at, msg: reconciler.gc.msg, source: reconciler.gc.source } : null,
    controllers: { engineRunning: reconciler.engine.running, why: reconciler.engine.why, modes, source: 'reconciler.sqlite leader/modes' },
    land: land ? { busy: land.busy, queued: land.queued, source: 'land.mjs landStatus' } : null,
    sourcesMissing: Object.values(snap.sources).filter(Boolean).length,
  };
  health.ok = health.ram.percent < 85 && health.services.down.length === 0 && health.violations.open === 0 && !(health.gc?.leftovers > 0);

  const home = { updatedAt: snap.updatedAt, workflows, owner, health };
  // The Supervisor (the tick is deleted, rc-cleanup 3175d8b8b): its seat as the Host controller keeps it, its Decision
  // Items (above), the Notifier's sends and judgements (scripts/reconciler/notifier.mjs), its channel inbox.
  let notifier = null;
  if (!offline) {
    try {
      const st = await notifierState({ now });
      notifier = { lastDigestAt: st.lastDigestAt, urgent: Object.entries(st.urgentSent).map(([key, at]) => ({ key: safe(key, 120), at })),
        judgements: st.judgements.slice(-5).map((j) => ({ text: safe(j.text, 400), at: j.at })), source: 'supervisor ledger notifier-*-sent, supervisor-judgement' };
    } catch (error) { snap.sources.notifier = safe(error.message); }
  }
  const seat = reconciler.services.seats.find((s) => s.name === 'seat:supervisor') ?? null;
  const supervisor = {
    seat: seat ? { state: seat.state, since: seat.since, lastAt: seat.lastAt ?? null, source: 'reconciler.sqlite services seat:supervisor (Host controller)' } : null,
    notifier, inboxUnread: snap.inboxUnreadTotal ?? 0,
    inbox: (snap.inbox ?? []).slice(0, 8).map((m) => ({ at: m.at, from: m.from, text: safe(m.text, 300), read: m.read })),
  };
  const system = {
    updatedAt: snap.updatedAt, reconciler, ram, supervisor,
    decisions: { supervisor: supDecisions, product: productDis.filter((d) => d.decider !== 'kernel' || LIVE_DI.includes(d.status)).slice(0, 60) },
    opHealth: snap.opHealth, stuck: snap.stuck,
    land: snap.supervisor ? { ...snap.supervisor.land, lastLands: snap.supervisor.lastLands, pushes: snap.supervisor.pushes } : null,
    sources: snap.sources,
  };
  const nav = { updatedAt: snap.updatedAt, owner: owner.length, live: workflows.length, stuck: workflows.filter((w) => w.pill === 'stuck').length };
  return { home, system, nav };
}

/** One workflow's detail page: the snapshot row (as the tracker reads it) plus progress, units by state, DIs, worktrees. */
function workflowPage(snap, projectId, workflowId) {
  const project = snap.projects.find((p) => p.id === projectId && p.workflows.some((wf) => wf.id === workflowId)) ?? snap.projects.find((p) => p.workflows.some((wf) => wf.id === workflowId));
  const wf = project?.workflows.find((item) => item.id === workflowId);
  if (!project || !wf) return null;
  const extra = snap.boards.get(wf.id) ?? {};
  return {
    updatedAt: snap.updatedAt, projectId: project.id, projectName: project.name,
    // The tracker reads a Snapshot: the one project with the one workflow.
    snapshot: { updatedAt: snap.updatedAt, sources: snap.sources, opLabels: snap.opLabels, projects: [{ ...project, workflows: [wf] }], owed: [], owedCounts: {}, inboxUnreadTotal: 0, inbox: [], supervisor: null, opHealth: null, stuck: snap.stuck.filter((s) => s.workflowId === wf.id) },
    fleet: extra.fleet ?? null, board: extra.board ?? null, decisions: extra.decisions ?? [], worktrees: extra.worktrees ?? [], statusAt: extra.coreFrom ?? null,
  };
}

// One build per tick, never per request (owner 2026-09-28: api status took 30-50 s a call). A request answers the
// cached build at once; the tick rebuilds it in the background. Only the very first request waits.
const TICK_MS = Math.max(5_000, Number(process.env.STARCI_STATUS_TICK_MS) || 20_000);
function refresh() {
  if (!pending) pending = buildSnapshot().then((result) => { cache = result; return result; }).finally(() => { pending = null; });
  return pending;
}
async function snapshot() {
  if (cache) { if (Date.now() - cache.updatedAt >= TTL) refresh().catch(() => {}); return cache; }
  return refresh();
}

// api status per live workflow, in its own loop: {value, error, at} by workflow id; a round ends with a rebuild.
const statusCache = new Map();
let statusRunning = false;
async function statusLoop() {
  if (offline || statusRunning || !cache) return;
  statusRunning = true;
  try {
    const rows = cache.projects.flatMap((project) => project.workflows.map((wf) => ({ project, id: wf.id })));
    await mapLimit(rows, 4, async ({ project, id }) => {
      const status = await readCli('scripts/kernel/api.mjs', ['status', '--repo', project.repo, '--workflow', id, '--json'], null, { timeout: 120_000 });
      const prior = statusCache.get(id);
      statusCache.set(id, status.error ? { value: prior?.value ?? null, error: status.error, at: prior?.at ?? null } : { value: status.value, error: null, at: Date.now() });
    });
    for (const id of statusCache.keys()) if (!rows.some((row) => row.id === id)) statusCache.delete(id);
    await refresh();
  } catch { /* the next round retries */ } finally { statusRunning = false; }
}

// While the Host controller has not written its service store, the UI probes the same registry every 2 minutes.
let serviceProbe = null;
async function serviceLoop() {
  if (offline) return;
  try { serviceProbe = await probeServices() ?? serviceProbe; } catch { /* keep the last */ }
}
if (!process.env.STARCI_STATUS_NO_TICK) {
  setInterval(() => { refresh().catch(() => {}); }, TICK_MS).unref();
  setInterval(() => { statusLoop(); }, TICK_MS).unref();
  setInterval(() => { serviceLoop(); }, 120_000).unref();
  refresh().then(() => { statusLoop(); serviceLoop(); }).catch(() => {});
}

async function agents() {
  if (agentCache && Date.now() - agentCache.updatedAt < 10_000) return agentCache;
  if (!agentPending) agentPending = agentSnapshot(projects, safe).then((result) => { agentCache = result; return result; }).finally(() => { agentPending = null; });
  return agentPending;
}

const proofCache = new Map();
/** One read-only proof verb (coverage | verify-proofs) of a workflow, cached 60 s: {value, error}. */
async function proofVerb(verb, project, workflowId) {
  const key = `${verb}:${project.id}:${workflowId}`;
  const hit = proofCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.result;
  const result = await readCli('scripts/kernel/api.mjs', [verb, '--repo', project.repo, '--workflow', workflowId, '--json'], null, { timeout: 120_000 });
  if (offline && !result.value) {
    // A fixture server has no CLI: the same verbs in-process would need the whole api; say so rather than invent data.
    return { value: null, error: 'offline' };
  }
  proofCache.set(key, { at: Date.now(), result });
  return result;
}
let contractCache = null;
/** The contract version (ui/src/contract.ts CONTRACT_VERSION) and the runtime's own vocabularies. */
async function contractInfo() {
  if (contractCache) return contractCache;
  const [{ JOB_ARTIFACT_KINDS, JOB_ARTIFACT_SUBKINDS }, { LOG_KINDS, LOG_ACTORS, LOG_LEVELS }] = await Promise.all([import('../engine/ledger-db.mjs'), import('../scripts/kernel/typed-logs.mjs')]);
  let version = null;
  try { version = /CONTRACT_VERSION\s*=\s*'([^']+)'/.exec(await readFile(path.join(root, 'src', 'contract.ts'), 'utf8'))?.[1] ?? null; } catch { version = null; }
  contractCache = { schema: 'starci/harness-contract@1', version, projects: projects.map((p) => ({ id: p.id, name: p.name })), artifactKinds: [...JOB_ARTIFACT_KINDS], artifactSubkinds: [...JOB_ARTIFACT_SUBKINDS],
    logKinds: Object.keys(LOG_KINDS), logActors: [...LOG_ACTORS], logLevels: [...LOG_LEVELS] };
  return contractCache;
}

/** Stream a read-only media file ({absolute, mime, size}) with byte ranges, so a video seeks. */
function streamMedia(request, response, media) {
  const headers = { 'content-type': media.mime, 'cache-control': 'private, no-store', 'accept-ranges': 'bytes', 'content-disposition': 'inline' };
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), media.size - 1) : media.size - 1;
    if (start >= media.size || end < start) { response.writeHead(416, { 'content-range': `bytes */${media.size}` }); response.end(); return; }
    response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${media.size}`, 'content-length': end - start + 1 });
    createReadStream(media.absolute, { start, end }).on('error', () => response.destroy()).pipe(response); return;
  }
  response.writeHead(200, { ...headers, 'content-length': media.size });
  createReadStream(media.absolute).on('error', () => response.destroy()).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-frame-options', 'DENY');
  if (serveStatic && request.method === 'GET' && url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end('{"ok":true}'); return;
  }
  if (serveStatic && request.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const relative = url.pathname === '/' || !path.extname(url.pathname) ? 'index.html' : url.pathname.slice(1);
    const target = path.resolve(dist, relative);
    if (!target.startsWith(`${dist}${path.sep}`)) {
      response.writeHead(404); response.end(); return;
    }
    try {
      const body = await readFile(target);
      response.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream', 'cache-control': relative === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end();
    }
    return;
  }
  const logMatch = /^\/api\/agents\/(term_[a-z0-9-]+)\/log$/i.exec(url.pathname);
  const changesMatch = /^\/api\/agents\/(op-[a-z0-9._-]+)\/changes$/i.exec(url.pathname);
  const imageMatch = /^\/api\/agents\/(op-[a-z0-9._-]+)\/images\/([a-f0-9]{20})$/i.exec(url.pathname);
  const evidenceMatch = /^\/api\/evidence\/([a-f0-9]{24})$/i.exec(url.pathname);
  const proofFileMatch = /^\/api\/proofs\/([a-z0-9-]{1,40})\/(op-[a-z0-9._-]+)\/([a-f0-9]{24})$/i.exec(url.pathname);
  const commitMatch = /^\/api\/history\/([a-z0-9-]{1,40})\/(BE|FE)\/([a-f0-9]{40})$/i.exec(url.pathname);
  if (request.method !== 'GET' || (!['/api/snapshot', '/api/agents', '/api/evidence', '/api/history', '/api/proofs', '/api/artifacts', '/api/artifacts/file', '/api/workflow-events', '/api/workflow-events/stream', '/api/logs', '/api/logs/stream', '/api/supervisor/logs', '/api/supervisor/logs/stream', '/api/supervisor/state', '/api/home', '/api/system', '/api/workflow', '/api/nav', '/api/reconciler/state', '/api/reconciler/decisions', '/api/diff', '/api/diff/asset', '/api/coverage', '/api/verify-proofs', '/api/contract'].includes(url.pathname) && !proofFileMatch && !logMatch && !changesMatch && !imageMatch && !evidenceMatch && !commitMatch)) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy"}'); return;
  }
  try {
    let data;
    if (url.pathname === '/api/workflow-events' || url.pathname === '/api/workflow-events/stream') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      const workflowId = url.searchParams.get('workflow') || '';
      if (!project || !/^wf-[a-z0-9-]{1,90}$/.test(workflowId)) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return;
      }
      const after = Number(request.headers['last-event-id'] || url.searchParams.get('after') || 0);
      data = readWorkflowEvents(project, workflowId, { after });
      if (!data) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return; }
      if (url.pathname === '/api/workflow-events/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        response.write(': connected\n\n');
        let cursor = data.cursor;
        const send = (events) => { for (const event of events) response.write(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`); };
        send(data.events);
        const timer = setInterval(() => {
          try {
            const next = readWorkflowEvents(project, workflowId, { after: cursor });
            if (next?.events.length) { send(next.events); cursor = next.cursor; }
            else response.write(': heartbeat\n\n');
          } catch { response.end(); }
        }, 5_000);
        request.on('close', () => clearInterval(timer));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data)); return;
    }
    if (url.pathname === '/api/logs' || url.pathname === '/api/logs/stream') {
      // Typed log rows (scripts/kernel/typed-logs.mjs): the stream reuses the workflow-events pattern - first page,
      // then every new row by seq, a heartbeat when nothing moved; Last-Event-ID resumes a dropped connection.
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      let query;
      try { query = logQueryOf(url.searchParams); } catch (error) { response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify({ error: safe(error.message) })); return; }
      const resume = Number(request.headers['last-event-id'] || 0);
      if (Number.isSafeInteger(resume) && resume > 0) query.after = resume;
      data = project ? readProjectLogs(project, query) : null;
      if (!data) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return; }
      if (url.pathname === '/api/logs/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        response.write(': connected\n\n');
        let cursor = data.cursor;
        const send = (rows) => { for (const row of rows) response.write(`id: ${row.seq}\ndata: ${JSON.stringify(row)}\n\n`); };
        send(data.rows);
        const timer = setInterval(() => {
          try {
            const next = readProjectLogs(project, { ...query, after: cursor });
            if (next?.rows.length) { send(next.rows); cursor = next.cursor; }
            else response.write(': heartbeat\n\n');
          } catch { response.end(); }
        }, 3_000);
        request.on('close', () => clearInterval(timer));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data)); return;
    }
    if (url.pathname === '/api/supervisor/logs' || url.pathname === '/api/supervisor/logs/stream') {
      // The Supervisor's machine log (ui/supervisor.mjs, scripts/supervisor/sup-log.mjs): LogRow like /api/logs, read-only.
      let query;
      try { query = supervisorLogQueryOf(url.searchParams); } catch (error) { response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify({ error: safe(error.message) })); return; }
      const resume = Number(request.headers['last-event-id'] || 0);
      if (Number.isSafeInteger(resume) && resume > 0) query.after = resume;
      data = readSupervisorLogs(query);
      if (url.pathname === '/api/supervisor/logs/stream') {
        response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
        response.write(': connected\n\n');
        let cursor = data.cursor;
        const send = (rows) => { for (const row of rows) response.write(`id: ${row.seq}\ndata: ${JSON.stringify(row)}\n\n`); };
        send(data.rows);
        const timer = setInterval(() => {
          try {
            const next = readSupervisorLogs({ ...query, after: cursor });
            if (next.rows.length) { send(next.rows); cursor = next.cursor; }
            else response.write(': heartbeat\n\n');
          } catch { response.end(); }
        }, 3_000);
        request.on('close', () => clearInterval(timer));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data)); return;
    }
    if (url.pathname === '/api/supervisor/state') {
      data = readSupervisorStateForUi();
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data)); return;
    }
    if (url.pathname === '/api/diff' || url.pathname === '/api/diff/asset') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      if (!project) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy dự án"}'); return; }
      if (url.pathname === '/api/diff/asset') {
        const asset = await readDiffAsset(project, url.searchParams.get('job'), url.searchParams.get('blob'), { filePath: url.searchParams.get('path') });
        if (!asset) { response.writeHead(404); response.end(); return; }
        response.writeHead(200, { 'content-type': asset.mime, 'cache-control': 'private, max-age=3600', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
        response.end(asset.body); return;
      }
      data = readJobDiff(project, url.searchParams.get('job'));
      if (!data) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Job không có diff"}'); return; }
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(data)); return;
    }
    if ((proofFileMatch || commitMatch) && !projects.some((item) => item.id === (proofFileMatch ?? commitMatch)[1])) {
      response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy dự án"}'); return;
    }
    if (url.pathname === '/api/contract') {
      // The data contract's own version and vocabularies (ui/CONTRACT.md, ui/src/contract.ts): what a client checks first.
      data = await contractInfo();
    } else if (url.pathname === '/api/coverage' || url.pathname === '/api/verify-proofs') {
      // Read-only api verbs (modules/kernel/api.yaml coverage, verify-proofs), cached per workflow.
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      const workflowId = url.searchParams.get('workflow') || '';
      if (!project || !/^wf-[a-z0-9._-]{1,120}$/i.test(workflowId)) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return; }
      data = await proofVerb(url.pathname === '/api/coverage' ? 'coverage' : 'verify-proofs', project, workflowId);
      if (data.error && !data.value) { response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify({ error: data.error })); return; }
      data = data.value;
    } else if (evidenceMatch || proofFileMatch) {
      const media = evidenceMatch ? await findEvidence(projects, evidenceMatch[1])
        : await findProofFile(projects.find((item) => item.id === proofFileMatch[1]), proofFileMatch[2], proofFileMatch[3]);
      if (!media) { response.writeHead(404); response.end(); return; }
      streamMedia(request, response, media); return;
    } else if (commitMatch) {
      const project = projects.find((item) => item.id === commitMatch[1]);
      data = await readProjectCommit(project, commitMatch[2], commitMatch[3]);
    } else if (url.pathname === '/api/history') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      data = project ? { projectId: project.id, commits: await readProjectHistory(project) } : { projectId: null, commits: [] };
    } else if (url.pathname === '/api/proofs') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      if (!project) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy dự án"}'); return; }
      const jobIds = url.searchParams.get('jobs') ? url.searchParams.get('jobs').split(',') : null;
      data = await readOpProofs(project, { workflowId: url.searchParams.get('workflow'), op: url.searchParams.get('op'), jobIds });
    } else if (url.pathname === '/api/artifacts/file') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      const media = project && await findIndexedArtifact(project, url.searchParams.get('job'), url.searchParams.get('sha256'));
      if (!media) { response.writeHead(404); response.end(); return; }
      streamMedia(request, response, media); return;
    } else if (url.pathname === '/api/artifacts') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      if (!project) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy dự án"}'); return; }
      data = readArtifacts(project, { workflowId: url.searchParams.get('workflow'), jobId: url.searchParams.get('job'), kind: url.searchParams.get('kind'), subkind: url.searchParams.get('subkind') });
    } else if (url.pathname === '/api/evidence') {
      data = await listEvidence(projects, url.searchParams);
    } else if (logMatch) {
      const known = await agents();
      const match = known.agents.find((agent) => agent.terminal === logMatch[1]);
      if (!match) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        response.end('{"error":"Terminal không thuộc danh sách agent đang theo dõi"}'); return;
      }
      data = await readAgentLog(match.terminal);
    } else if (changesMatch || imageMatch) {
      const jobId = changesMatch?.[1] || imageMatch[1];
      const known = await agents();
      const agent = known.agents.find((item) => item.id === jobId && item.role === 'op');
      const project = projects.find((item) => item.id === agent?.projectId);
      if (!project) {
        response.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end('{"error":"Op không thuộc danh sách đang theo dõi"}'); return;
      }
      if (imageMatch) {
        const image = await readAgentImage(project, jobId, imageMatch[2]);
        response.writeHead(200, { 'content-type': image.mime, 'cache-control': 'no-store' });
        response.end(image.body); return;
      }
      data = await readAgentChanges(project, jobId);
    } else if (['/api/home', '/api/system', '/api/nav', '/api/reconciler/state'].includes(url.pathname)) {
      const snap = await snapshot();
      data = url.pathname === '/api/home' ? snap.views.home : url.pathname === '/api/nav' ? snap.views.nav : url.pathname === '/api/system' ? snap.views.system : snap.views.system.reconciler;
    } else if (url.pathname === '/api/workflow') {
      const workflowId = url.searchParams.get('id') || '';
      if (!/^wf-[a-z0-9._-]{1,120}$/i.test(workflowId)) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return; }
      data = workflowPage(await snapshot(), url.searchParams.get('project'), workflowId);
      if (!data) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy workflow"}'); return; }
    } else if (url.pathname === '/api/reconciler/decisions') {
      // DIs across ledgers (lane rc-fleet-ui, DESIGN §10.3): the live ones and the newest closed, optionally one workflow.
      const snap = await snapshot();
      const workflowId = url.searchParams.get('workflow');
      const product = snap.projects.flatMap((project) => project.workflows.flatMap((wf) => (snap.boards.get(wf.id)?.decisions ?? []).map((d) => ({ ...d, projectId: project.id }))));
      const all = [...product, ...snap.views.system.decisions.supervisor];
      data = { updatedAt: snap.updatedAt, decisions: workflowId ? all.filter((d) => d.workflowId === workflowId) : all };
    } else data = url.pathname === '/api/agents' ? await agents() : await snapshot();
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(data));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: safe(error.message) }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`StarCi Status ${serveStatic ? 'app' : 'API'}: http://127.0.0.1:${server.address().port}`));
