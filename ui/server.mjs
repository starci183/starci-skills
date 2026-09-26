import http from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { supervisorSnapshot, basePoolState } from '../scripts/supervisor/status-block.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';
import { landStatus } from '../scripts/supervisor/land.mjs';
import { agentSnapshot, readAgentLog } from './agent-monitor.mjs';
import { readAgentChanges, readAgentImage } from './agent-changes.mjs';

const run = promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(root, '..');
const serveStatic = process.argv.includes('--serve-static');
const port = Number(process.env.STARCI_STATUS_PORT || (serveStatic ? 4547 : 4546));
const dist = path.join(root, 'dist');
const authFile = process.env.STARCI_STATUS_AUTH_FILE || path.join(root, '.secrets', 'auth.json');
const auth = serveStatic ? JSON.parse(readFileSync(authFile, 'utf8')) : null;
if (serveStatic && (!auth.username || !auth.salt || !auth.hash)) throw new Error('Thiếu cấu hình xác thực của dashboard');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' };
function authorized(header) {
  if (!auth) return true;
  if (!header?.startsWith('Basic ') || header.length > 1024) return false;
  const raw = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const split = raw.indexOf(':');
  if (split < 0 || raw.slice(0, split) !== auth.username) return false;
  const candidate = scryptSync(raw.slice(split + 1), auth.salt, 32);
  const expected = Buffer.from(auth.hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}
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
    wf.legs = Array.isArray(row?.legs) ? row.legs.map((leg) => ({ op: safe(leg.op), state: safe(leg.state), since: leg.since ?? null })) : [];
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
      peer: safe(job.peer), blockedBy: job.blockedBy ? { op: safe(job.blockedBy.op), job: safe(job.blockedBy.job) } : null,
    }));
    if (state?.kernel?.status !== 'running' && wf.kernel.state === 'live') wf.kernel.state = 'stale';
    wf.workers = Array.isArray(state?.workers) ? state.workers.map((worker) => ({ jobId: safe(worker.jobId), liveness: safe(worker.liveness), connected: Boolean(worker.connected) })) : [];
  });
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

http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-frame-options', 'DENY');
  if (serveStatic && !authorized(request.headers.authorization)) {
    response.writeHead(401, { 'www-authenticate': 'Basic realm="StarCi Status", charset="UTF-8"', 'cache-control': 'no-store' });
    response.end(); return;
  }
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
  if (request.method !== 'GET' || (!['/api/snapshot', '/api/agents'].includes(url.pathname) && !logMatch && !changesMatch && !imageMatch)) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"error":"Không tìm thấy"}'); return;
  }
  try {
    let data;
    if (logMatch) {
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
