import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { supervisorSnapshot, basePoolState } from '../scripts/supervisor/status-block.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';
import { landStatus } from '../scripts/supervisor/land.mjs';
import { agentSnapshot, readAgentLog } from './agent-monitor.mjs';
import { readAgentChanges, readAgentImage, readProjectHistory, readProjectCommit } from './agent-changes.mjs';
import { listEvidence, findEvidence } from './evidence-gallery.mjs';
import { findProofFile, readArtifacts, readOpProofs } from './op-proofs.mjs';
import { readWorkflowEvents } from './workflow-events.mjs';
import { logQueryOf, readDiffAsset, readJobDiff, readProjectLogs } from './typed-logs.mjs';

// The approved leg graph comes from scripts/route/plan-edges.mjs. When a runtime does not have that module, the UI draws the linear chain.
const planEdges = await import('../scripts/route/plan-edges.mjs').catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
const LEG_COLORS = new Set(['green', 'yellow', 'red', 'gray']);
// The workflow's work graph (scripts/work/work-graph-store.mjs). A runtime without it shows the leg graph only.
const optionalModule = (spec) => import(spec).catch((error) => {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
const [graphStore, graphModel, contractVersion] = await Promise.all([optionalModule('../scripts/work/work-graph-store.mjs'), optionalModule('../scripts/work/work-graph-model.mjs'), optionalModule('../scripts/kernel/contract-version.mjs')]);

const run = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(root, '..');
const serveStatic = process.argv.includes('--serve-static');
const port = Number(process.env.STARCI_STATUS_PORT || (serveStatic ? 4547 : 4546));
const dist = path.join(root, 'dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
const projects = [
  { id: 'nivo', name: 'Nivo', repo: 'D:/Repositories/nivo-backend' },
  { id: 'starci-next', name: 'StarCi Next', repo: 'D:/Repositories/starci-next' },
  { id: 'mia-mia', name: 'Mia Mia', repo: 'D:/Repositories/mia-mia-backend' },
];
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

async function readCli(script, args, fallback) {
  try {
    const { stdout } = await run(process.execPath, [script, ...args], {
      cwd: runtime, timeout: 18_000, maxBuffer: 20 * 1024 * 1024, windowsHide: true,
    });
    return { value: JSON.parse(stdout), error: null };
  } catch (error) {
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
    return { label: safe(label), jobId: job ? safe(job.jobId) : null, status: job ? safe(job.status) : 'planned', model: job?.model ? safe(job.model) : null, cut,
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
  const db = new DatabaseSync(path.join(project.repo, '.starciwork', 'runtime.sqlite'), { readOnly: true });
  try {
    const active = db.prepare("SELECT workflow_id, title, created_at, updated_at FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY created_at").all();
    const ids = new Set(active.map((row) => row.workflow_id));
    const jobs = db.prepare("SELECT job_id, workflow_id, op_id, attempt, status, created_at, updated_at, payload_json FROM jobs WHERE kind<>'kernel' ORDER BY created_at DESC").all().filter((row) => ids.has(row.workflow_id));
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
        id: row.workflow_id, name: safe(row.title || localName(row.workflow_id)), projectId: project.id,
        goal: safe(goalJson?.opChain?.input?.text || goal?.markdown || ''),
        kernel: { state: kernel, at: signal?.at ?? null, agent: safe(parse(signal?.value_json)?.agent || ''), model: safe(parse(signal?.value_json)?.model || '') },
        verdicts: outcome,
        running: wfJobs.filter((job) => ['leased', 'running', 'answering'].includes(job.status)).map((job) => ({ jobId: job.job_id, op: job.op_id, attempt: job.attempt, since: job.created_at, status: job.status })),
        queued: wfJobs.filter((job) => job.status === 'queued').map((job) => ({ jobId: job.job_id, op: job.op_id, since: job.created_at, reason: safe(parse(job.payload_json)?.queuedBecause || '') })),
        incidents: wfIncidents.map((item) => ({ id: item.incident_id, op: item.op_id, text: safe(item.last_progress), at: item.updated_at })),
        recentVerdicts: wfVerdicts.slice(0, 12).map((item) => {
          const job = wfJobs.find((candidate) => candidate.job_id === item.entity_id);
          return { jobId: item.entity_id, op: job?.op_id || '', attempt: job?.attempt ?? null, verdict: item.result?.verdict || 'unknown', checks: item.result?.checkEvidence ?? null, at: item.created_at };
        }),
        frontier: null,
        plan: planGraph(goalJson),
        workGraph: workGraph(db, row.workflow_id),
        jobLog: wfJobs.map((job) => { const payload = parse(job.payload_json); return { jobId: job.job_id, op: job.op_id, status: job.status, createdAt: job.created_at, model: payload.model ?? null, cut: Boolean(payload.cut), title: payload.title ?? null }; }),
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
    return { id: project.id, name: project.name, repo: project.repo, totals, workflows: workflowRows };
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
    if (row?.name) wf.name = safe(row.name);
    wf.legs = Array.isArray(row?.legs) ? row.legs.map((leg) => ({ op: safe(leg.op), state: safe(leg.state), since: leg.since ?? null, rework: Boolean(leg.rework), color: null })) : [];
    wf.nextActions = null;
    wf.etaAt = row?.etaAt ?? null;
    wf.lastReport = row?.lastReport ? { op: safe(row.lastReport.op), outcome: safe(row.lastReport.outcome), summary: safe(row.lastReport.summary), at: row.lastReport.at } : null;
    wf.asks = Array.isArray(row?.asks) ? row.asks.map((ask) => ({ op: safe(ask.op), askClass: safe(ask.askClass), text: safe(ask.text), link: liveFormLink(ask.link) })) : [];
    wf.holds = Array.isArray(row?.holds) ? row.holds.map((hold) => ({ op: safe(hold.op), reason: safe(hold.heldBecause), peer: safe(hold.peer), jobId: safe(hold.jobId), since: hold.since })) : [];
  }
  const liveRows = projectRows.flatMap((project) => project.workflows.map((wf) => ({ project, wf })));
  await mapLimit(liveRows, 4, async ({ project, wf }) => {
    const status = await readCli('scripts/kernel/api.mjs', ['status', '--repo', project.repo, '--workflow', wf.id, '--json'], null);
    if (status.error) { sources[`status:${wf.id}`] = status.error; return; }
    const state = status.value;
    wf.frontier = {
      state: safe(state?.frontier?.state),
      actionable: Boolean(state?.frontier?.actionable),
      reason: safe(state?.frontier?.reason),
      queuedCauses: state?.frontier?.queuedCauses && typeof state.frontier.queuedCauses === 'object' ? state.frontier.queuedCauses : {},
      peerWaits: Array.isArray(state?.frontier?.peerWaits) ? state.frontier.peerWaits.map((wait) => ({ peer: safe(wait.peer), job: safe(wait.job), reason: safe(wait.reason) })) : [],
    };
    if (Array.isArray(state?.frontier?.queued)) wf.queued = state.frontier.queued.map((job) => ({
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
    }));
    wf.drawReviews = drawReviewView(project, state?.drawReviews);
    wf.workers = Array.isArray(state?.workers) ? state.workers.map((worker) => ({ jobId: safe(worker.jobId), liveness: safe(worker.liveness), connected: Boolean(worker.connected) })) : [];
  });
  for (const project of projectRows) for (const wf of project.workflows) delete wf.jobLog;
  for (const project of projectRows) if (project.totals) {
    project.totals.kernels = project.workflows.filter((wf) => wf.kernel.state === 'live').length;
  }
  let supervisor = null;
  try {
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
  return {
    updatedAt: Date.now(), sources,
    projects: projectRows,
    owed: (owed.value.items || []).slice(0, 50).map((item) => ({ key: safe(item.key), projectId: projects.find((p) => item.repo?.replaceAll('\\', '/').toLowerCase() === p.repo.toLowerCase())?.id ?? null, workflowId: safe(item.workflowId), kind: safe(item.kind), summary: safe(item.summary), ageMin: item.ageMin ?? null, status: safe(item.status) })),
    owedCounts: owed.value.counts || {},
    inboxUnreadTotal: (inbox.value.messages || []).filter((message) => !message.read).length,
    inbox: (inbox.value.messages || []).slice(-30).reverse().map((message) => ({ id: safe(message.id), at: message.at, from: safe(message.from), text: safe(message.text), read: Boolean(message.read), judgedAt: /\bjudged\s+(\d{4}-\d{2}-\d{2}[^;)]*)/i.exec(message.text || '')?.[1] || null })),
    supervisor,
  };
}

async function snapshot() {
  if (cache && Date.now() - cache.updatedAt < TTL) return cache;
  if (!pending) pending = buildSnapshot().then((result) => { cache = result; return result; }).finally(() => { pending = null; });
  return pending;
}

async function agents() {
  if (agentCache && Date.now() - agentCache.updatedAt < 10_000) return agentCache;
  if (!agentPending) agentPending = agentSnapshot(projects, safe).then((result) => { agentCache = result; return result; }).finally(() => { agentPending = null; });
  return agentPending;
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

http.createServer(async (request, response) => {
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
  const proofFileMatch = /^\/api\/proofs\/(nivo|starci-next|mia-mia)\/(op-[a-z0-9._-]+)\/([a-f0-9]{24})$/i.exec(url.pathname);
  const commitMatch = /^\/api\/history\/(nivo|starci-next|mia-mia)\/(BE|FE)\/([a-f0-9]{40})$/i.exec(url.pathname);
  if (request.method !== 'GET' || (!['/api/snapshot', '/api/agents', '/api/evidence', '/api/history', '/api/proofs', '/api/artifacts', '/api/workflow-events', '/api/workflow-events/stream', '/api/logs', '/api/logs/stream', '/api/diff', '/api/diff/asset'].includes(url.pathname) && !proofFileMatch && !logMatch && !changesMatch && !imageMatch && !evidenceMatch && !commitMatch)) {
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
    if (evidenceMatch || proofFileMatch) {
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
    } else if (url.pathname === '/api/artifacts') {
      const project = projects.find((item) => item.id === url.searchParams.get('project'));
      if (!project) { response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy dự án"}'); return; }
      data = readArtifacts(project, { workflowId: url.searchParams.get('workflow'), jobId: url.searchParams.get('job'), kind: url.searchParams.get('kind') });
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
    } else data = url.pathname === '/api/agents' ? await agents() : await snapshot();
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(data));
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: safe(error.message) }));
  }
}).listen(port, '127.0.0.1', () => console.log(`StarCi Status ${serveStatic ? 'app' : 'API'}: http://127.0.0.1:${port}`));
