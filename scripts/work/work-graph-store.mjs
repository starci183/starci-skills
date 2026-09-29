// work-graph-store.mjs — the ledger half of the work graph: versions live in work_graph_versions (engine/schema.sql),
// one immutable row each, and every recorded version appends a `work-graph-version` event. Live colours come from
// the workflow's jobs on each node's owned paths (colorsFromJobs); the recorded colours only carry rework (red).
import { JOB_STATUSES, recordGraphVersion } from '../../engine/ledger-db.mjs';
import { AWAITING_OWNER_STATUS } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';
import {
  GRAY, GREEN, RED, YELLOW, WORK_GRAPH_ID, canonicalGraph, diffGraphs, diffIsEmpty, frontierOf, graphDigest, ownedPathKey, recolor, validateGraph,
} from './work-graph-model.mjs';

export const VERSION_EVENT = 'work-graph-version';
const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });

export const hasWorkGraphTable = (db) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='work_graph_versions'").get());

const rowOf = (row) => row ? {
  workflowId: row.workflow_id, version: row.version, event: row.event, graph: parseJson(row.graph_json),
  diff: parseJson(row.diff_json), colors: parseJson(row.colors_json, {}), reason: row.reason,
  authorOp: row.author_op, authorJob: row.author_job, digest: row.digest, createdAt: row.created_at,
} : null;

/** Every version of a workflow's graph, oldest first; [] when the ledger predates the table. */
export function versionsOf(db, workflowId) {
  if (!hasWorkGraphTable(db)) return [];
  return db.prepare('SELECT * FROM work_graph_versions WHERE workflow_id=? ORDER BY version').all(workflowId).map(rowOf);
}
export function latestVersion(db, workflowId) {
  if (!hasWorkGraphTable(db)) return null;
  return rowOf(db.prepare('SELECT * FROM work_graph_versions WHERE workflow_id=? ORDER BY version DESC LIMIT 1').get(workflowId));
}
export function versionOf(db, workflowId, version) {
  if (!hasWorkGraphTable(db)) return null;
  return rowOf(db.prepare('SELECT * FROM work_graph_versions WHERE workflow_id=? AND version=?').get(workflowId, version));
}

const hits = (a, b) => a.some((p) => b.some((q) => p === q || p.startsWith(`${q}/`) || q.startsWith(`${p}/`)));

const RUNNING = JOB_STATUSES.dispatchable.filter((s) => s !== 'queued');
const upLinks = (nodes) => {
  const kids = new Map(nodes.map((n) => [n.id, []]));
  const upOf = new Map();
  for (const n of nodes) {
    const up = n.parent ?? (n.slice !== n.id ? n.slice : null);
    if (up && kids.has(up)) { kids.get(up).push(n.id); upOf.set(n.id, up); }
  }
  return { kids, upOf };
};

/**
 * The jobs ({status, at, paths, ...}) that cover each node, oldest first: a job covers a node when one of its owned
 * paths meets one of the node's (either contains the other), unless that path is broad: it contains the owned paths
 * of two nodes neither of which contains the other (a feature tree, every impl record), so it names no node in
 * particular. A node's own coverage only; its children are not folded in.
 */
export function coverageOf(graph, jobs) {
  const nodes = list(graph?.nodes);
  const { upOf } = upLinks(nodes);
  const above = (id) => { const out = new Set(); for (let at = upOf.get(id); at && !out.has(at); at = upOf.get(at)) out.add(at); return out; };
  const keysOf = new Map(nodes.map((n) => [n.id, list(n.ownedPaths).map(ownedPathKey).filter(Boolean)]));
  const broad = (key) => {
    const inside = nodes.filter((n) => keysOf.get(n.id).some((k) => k === key || k.startsWith(`${key}/`))).map((n) => n.id);
    return inside.filter((id) => ![...above(id)].some((a) => inside.includes(a))).length > 1;
  };
  const scoped = list(jobs).map((j) => ({ ...j, paths: list(j.paths).filter((k) => !broad(k)) })).filter((j) => j.paths.length)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  return new Map(nodes.map((n) => [n.id, scoped.filter((j) => hits(j.paths, keysOf.get(n.id)))]));
}

/**
 * The one colour rule for a graph against the workflow's jobs, over coverageOf. A node without children is yellow
 * while a covering job runs (leased, running, answering; a queued job is not running), red when `recorded` marks it
 * for rework and no covering job succeeded after `since`, else green or red by its latest settled covering job
 * (succeeded / failed; cancelled ones are skipped), else gray. A red recorded colour counts only jobs after `since`;
 * any other recorded colour is re-derived from every job. A node with children takes its own colour and theirs
 * together: any red is red, any yellow is yellow, all green is green, anything else is gray.
 */
export function colorsFromJobs(graph, jobs, { recorded = {}, since = 0 } = {}) {
  const nodes = list(graph?.nodes);
  const { kids } = upLinks(nodes);
  const covering = coverageOf(graph, jobs);
  const own = (n) => {
    const rework = recorded[n.id] === RED;
    const mine = covering.get(n.id).filter((j) => !rework || (j.at ?? 0) > since);
    if (mine.some((j) => RUNNING.includes(j.status))) return YELLOW;
    // The newest covering try asked the owner: the node waits (yellow), it did not fail.
    if (mine.at(-1)?.status === AWAITING_OWNER_STATUS) return YELLOW;
    const last = mine.filter((j) => j.status === 'succeeded' || j.status === 'failed').at(-1);
    if (last) return last.status === 'succeeded' ? GREEN : RED;
    return rework ? RED : GRAY;
  };
  const out = {};
  const color = (id) => {
    if (out[id]) return out[id];
    const n = nodes.find((x) => x.id === id);
    const all = [own(n), ...(kids.get(id) ?? []).map(color)];
    out[id] = all.includes(RED) ? RED : all.includes(YELLOW) ? YELLOW : all.every((c) => c === GREEN) ? GREEN : GRAY;
    return out[id];
  };
  for (const n of nodes) color(n.id);
  return out;
}

/** The jobs of a workflow as colorsFromJobs and coverageOf read them. */
const jobsOf = (db, workflowId) => db.prepare("SELECT job_id,op_id,status,payload_json,created_at,updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId)
  .map((j) => {
    const payload = parseJson(j.payload_json, {}) ?? {};
    return { jobId: j.job_id, op: j.op_id, status: j.status, at: j.updated_at, createdAt: j.created_at, model: payload.model ?? null, paths: list(payload.owned_paths).map(ownedPathKey).filter(Boolean) };
  });

/**
 * Version `row` as the ledger stands now: {colors, jobs: Map(node id -> covering jobs, oldest first)}. `rework` names
 * succeeded jobs a contract change owes a follow-up (api status contractFollowUps): they colour their nodes as rework
 * (red), never done.
 */
export function liveCoverage(db, row, { rework = new Set() } = {}) {
  if (!row) return { colors: {}, jobs: new Map() };
  const jobs = jobsOf(db, row.workflowId).map((j) => (j.status === 'succeeded' && rework.has(j.jobId) ? { ...j, status: 'failed', rework: true } : j));
  return { colors: colorsFromJobs(row.graph, jobs, { recorded: row.colors ?? {}, since: row.createdAt ?? 0 }), jobs: coverageOf(row.graph, jobs) };
}
/** The colours of version `row` as the ledger stands now (colorsFromJobs over the workflow's jobs). */
export const liveColors = (db, row) => liveCoverage(db, row).colors;

const insertVersion = (ledger, { workflowId, version, event, graph, diff, colors, reason, authorOp, authorJob, digest, now }) => {
  recordGraphVersion(ledger.db, { workflowId, version, event, graph, diff, colors, reason, authorOp, authorJob, digest, createdAt: now, eventKind: VERSION_EVENT,
    eventPayload: { version, event, reason, authorOp, authorJob, digest, added: diff.added, removed: diff.removed, changed: diff.changed.map((c) => c.id), red: diff.red ?? [] } });
};

/**
 * Validate `graph` and record it as the next version. Refuses work-graph-invalid with the validator's findings;
 * a graph equal to the latest version records nothing and returns {unchanged:true}. `scope` (a slice id) confines a
 * cut: every added, removed or changed node must sit in that slice and the slice root stays.
 */
export function recordVersion(ledger, { workflowId, graph, event, reason, authorOp, authorJob = null, context = {}, scope = null, now = Date.now() }) {
  if (!reason || !String(reason).trim()) throw refuse('a graph version needs a reason', 'work-graph-reason-missing');
  const candidate = canonicalGraph({ ...graph, schema: graph?.schema ?? WORK_GRAPH_ID });
  const verdict = validateGraph(candidate, { workflowId, context });
  if (!verdict.ok) throw refuse(`work graph refused: ${verdict.findings.map((f) => f.code).join(', ')}`, 'work-graph-invalid', { findings: verdict.findings });
  return ledger.transaction(() => {
    const prev = latestVersion(ledger.db, workflowId);
    const digest = graphDigest(candidate);
    if (prev && prev.digest === digest) return { ok: true, unchanged: true, version: prev.version, digest };
    const diff = diffGraphs(prev?.graph ?? null, candidate);
    if (prev && diffIsEmpty(diff)) return { ok: true, unchanged: true, version: prev.version, digest: prev.digest };
    if (scope) {
      const inScope = (g, id) => list(g?.nodes).find((n) => n.id === id)?.slice === scope;
      const outside = [...diff.added.filter((id) => !inScope(candidate, id)), ...diff.removed.filter((id) => !inScope(prev?.graph, id)),
        ...diff.changed.map((c) => c.id).filter((id) => !inScope(candidate, id)), ...(diff.removed.includes(scope) ? [scope] : []),
        ...[...diff.edgesAdded, ...diff.edgesRemoved].filter((e) => !inScope(candidate, e.to) && !inScope(prev?.graph, e.to)).map((e) => `${e.from}->${e.to}`),
        ...diff.domainsAdded, ...diff.domainsRemoved];
      if (outside.length) throw refuse(`a cut changes only its own slice ${scope}; it touches ${[...new Set(outside)].join(', ')}`, 'work-graph-cut-outside-slice');
    }
    // v0 starts from what the ledger already shows: every job the workflow ran so far counts.
    const { colors, red } = prev ? recolor(liveColors(ledger.db, prev), prev.graph, candidate, diff)
      : { colors: liveColors(ledger.db, { workflowId, graph: candidate, colors: {}, createdAt: 0 }), red: [] };
    const version = prev ? prev.version + 1 : 0;
    insertVersion(ledger, { workflowId, version, event, graph: candidate, diff: { ...diff, red }, colors, reason, authorOp, authorJob, digest, now });
    return { ok: true, version, event, digest, diff: { ...diff, red }, colors };
  });
}

/** The domains of `graph` a job's owned paths reach: a node's owned path they touch, or a domain's feature record tree. */
export function domainsOfPaths(graph, paths) {
  const keys = list(paths).map(ownedPathKey).filter(Boolean);
  const out = new Set();
  for (const d of list(graph?.domains)) if (keys.some((k) => k === `.starciwork/features/${d.id}` || k.startsWith(`.starciwork/features/${d.id}/`))) out.add(d.id);
  for (const n of list(graph?.nodes)) if (hits(keys, n.ownedPaths.map(ownedPathKey).filter(Boolean))) out.add(n.domain);
  return out;
}

/**
 * What `api status` reads of the work graph: null without one, else {version, event, graph, colors, counts, frontier}
 * where frontier holds the runnable nodes (work-graph-model.mjs frontierOf) with the op of the last job on their paths.
 */
export function workGraphStatus(db, workflowId, { rework = new Set() } = {}) {
  const row = latestVersion(db, workflowId);
  if (!row) return null;
  const { colors, jobs } = liveCoverage(db, row, { rework });
  const counts = Object.values(colors).reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
  const frontier = frontierOf(row.graph, colors).map((n) => {
    const last = (jobs.get(n.id) ?? []).filter((j) => j.op).sort((a, b) => a.createdAt - b.createdAt || a.jobId.localeCompare(b.jobId)).at(-1) ?? null;
    return { id: n.id, domain: n.domain, slice: n.slice, kind: n.kind, color: colors[n.id], ownedPaths: n.ownedPaths, lastOp: last?.op ?? null, lastJob: last?.jobId ?? null };
  });
  return { version: row.version, event: row.event, graph: row.graph, colors, counts, frontier };
}
