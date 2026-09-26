// work-graph-store.mjs — the ledger half of the work graph: versions live in work_graph_versions (engine/schema.sql),
// one immutable row each, and every recorded version appends a `work-graph-version` event. Live colours overlay
// the recorded ones with the workflow's jobs: an open job on a node's owned paths is yellow, a job that succeeded
// after the version was recorded is green.
import { JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { normalizeOwnedPath } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';
import {
  GRAY, GREEN, RED, YELLOW, WORK_GRAPH_ID, canonicalGraph, diffGraphs, diffIsEmpty, frontierOf, graphDigest, recolor, validateGraph,
} from './work-graph-model.mjs';

export const VERSION_EVENT = 'work-graph-version';
const list = (v) => (Array.isArray(v) ? v : []);
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

const pathKey = (p) => { try { return normalizeOwnedPath(typeof p === 'string' ? p : p?.path).toLowerCase(); } catch { return null; } };
const hits = (a, b) => a.some((p) => b.some((q) => p === q || p.startsWith(`${q}/`) || q.startsWith(`${p}/`)));

/**
 * The colours of `row` as the ledger stands: a node without children is yellow while a dispatchable job writes one
 * of its owned paths and green once such a job succeeded after the version was recorded; otherwise it keeps its
 * recorded colour. A node with children takes theirs: any red is red, any yellow (or a mix with green) is yellow,
 * all green is green.
 */
export function liveColors(db, row) {
  if (!row) return {};
  const nodes = list(row.graph?.nodes);
  const jobs = db.prepare('SELECT status,payload_json,updated_at FROM jobs WHERE workflow_id=?').all(row.workflowId)
    .map((j) => ({ status: j.status, at: j.updated_at, paths: list(parseJson(j.payload_json, {})?.owned_paths).map(pathKey).filter(Boolean) }))
    .filter((j) => j.paths.length);
  const kids = new Map(nodes.map((n) => [n.id, []]));
  for (const n of nodes) {
    const up = n.parent ?? (n.slice !== n.id ? n.slice : null);
    if (up && kids.has(up)) kids.get(up).push(n.id);
  }
  const out = {};
  const color = (id) => {
    if (out[id]) return out[id];
    const inner = kids.get(id) ?? [];
    if (inner.length) {
      const all = inner.map(color);
      out[id] = all.includes(RED) ? RED : all.every((c) => c === GREEN) ? GREEN : all.every((c) => c === GRAY) ? GRAY : YELLOW;
      return out[id];
    }
    const n = nodes.find((x) => x.id === id);
    const own = n.ownedPaths.map(pathKey).filter(Boolean);
    const mine = jobs.filter((j) => hits(j.paths, own));
    out[id] = mine.some((j) => JOB_STATUSES.dispatchable.includes(j.status)) ? YELLOW
      : mine.some((j) => j.status === 'succeeded' && j.at > row.createdAt) ? GREEN
      : row.colors?.[id] ?? GRAY;
    return out[id];
  };
  for (const n of nodes) color(n.id);
  return out;
}

const insertVersion = (ledger, { workflowId, version, event, graph, diff, colors, reason, authorOp, authorJob, digest, now }) => {
  ledger.db.prepare(`INSERT INTO work_graph_versions(workflow_id,version,event,graph_json,diff_json,colors_json,reason,author_op,author_job,digest,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(workflowId, version, event, JSON.stringify(graph), JSON.stringify(diff), JSON.stringify(colors), reason, authorOp, authorJob, digest, now);
  ledger.appendEvent({ workflowId, entityType: 'work-graph', entityId: workflowId, kind: VERSION_EVENT, createdAt: now,
    payload: { version, event, reason, authorOp, authorJob, digest, added: diff.added, removed: diff.removed, changed: diff.changed.map((c) => c.id), red: diff.red ?? [] } });
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
  const keys = list(paths).map(pathKey).filter(Boolean);
  const out = new Set();
  for (const d of list(graph?.domains)) if (keys.some((k) => k === `.starciwork/features/${d.id}` || k.startsWith(`.starciwork/features/${d.id}/`))) out.add(d.id);
  for (const n of list(graph?.nodes)) if (hits(keys, n.ownedPaths.map(pathKey).filter(Boolean))) out.add(n.domain);
  return out;
}

/**
 * What `api status` reads of the work graph: null without one, else {version, event, graph, colors, counts, frontier}
 * where frontier holds the runnable nodes (work-graph-model.mjs frontierOf) with the op of the last job on their paths.
 */
export function workGraphStatus(db, workflowId) {
  const row = latestVersion(db, workflowId);
  if (!row) return null;
  const colors = liveColors(db, row);
  const counts = Object.values(colors).reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
  const jobs = db.prepare("SELECT job_id,op_id,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId)
    .map((j) => ({ jobId: j.job_id, op: j.op_id, paths: list(parseJson(j.payload_json, {})?.owned_paths).map(pathKey).filter(Boolean) }));
  const frontier = frontierOf(row.graph, colors).map((n) => {
    const last = jobs.filter((j) => j.op && hits(j.paths, n.ownedPaths.map(pathKey).filter(Boolean))).at(-1) ?? null;
    return { id: n.id, domain: n.domain, slice: n.slice, kind: n.kind, color: colors[n.id], ownedPaths: n.ownedPaths, lastOp: last?.op ?? null, lastJob: last?.jobId ?? null };
  });
  return { version: row.version, event: row.event, graph: row.graph, colors, counts, frontier };
}
