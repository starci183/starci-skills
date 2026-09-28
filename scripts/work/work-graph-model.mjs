// work-graph-model.mjs — the pure half of the work graph (modules/schemas/work-graph.schema.yaml): validate one
// version, diff two, apply the colour rule and compute the frontier. No file or ledger access.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { canonicalJSON, sha256 } from '../../engine/index.mjs';
import { normalizeOwnedPath } from '../../engine/admission.mjs';
import { validateAgainstSchema } from '../checks/check-op-manifest.mjs';
import { sliceBound } from './slice-estimate.mjs';
import { list } from '../lib/list.mjs';

const SCHEMA_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../modules/schemas/work-graph.schema.yaml');
export const WORK_GRAPH_SCHEMA = parseYaml(fs.readFileSync(SCHEMA_FILE, 'utf8'));
export const WORK_GRAPH_ID = WORK_GRAPH_SCHEMA.properties.schema.const;
export const COLORS = Object.freeze([...WORK_GRAPH_SCHEMA.$defs.color.enum]);
export const EVENTS = Object.freeze([...WORK_GRAPH_SCHEMA.$defs.event.enum]);
const [GRAY, YELLOW, GREEN, RED] = COLORS;
export { GRAY, YELLOW, GREEN, RED };
const ROOT_KINDS = new Set(['foundation', 'slice']);

const pathKey = (p) => {
  try { return normalizeOwnedPath(p).toLowerCase(); } catch { return null; }
};
const within = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const edgeKey = (e) => `${e.from}\u0000${e.to}\u0000${e.kind}`;

/** The graph in canonical order: domains, nodes and edges sorted, so equal graphs digest equal. */
export function canonicalGraph(graph) {
  return {
    ...graph,
    domains: [...list(graph.domains)].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    nodes: [...list(graph.nodes)].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    edges: [...list(graph.edges)].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b))),
  };
}
export const graphDigest = (graph) => sha256(canonicalJSON(canonicalGraph(graph)));

/** Node ids a node contains: a slice root contains its slice's nodes, a node contains the tasks cut from it. */
function containment(nodes) {
  const children = new Map(nodes.map((n) => [n.id, new Set()]));
  for (const n of nodes) {
    if (n.slice !== n.id && children.has(n.slice)) children.get(n.slice).add(n.id);
    if (n.parent && children.has(n.parent)) children.get(n.parent).add(n.id);
  }
  return children;
}
const ancestorsIn = (nodes) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const up = (id, seen = new Set()) => {
    const n = byId.get(id);
    for (const p of [n?.parent, n && n.slice !== n.id ? n.slice : null].filter(Boolean)) if (!seen.has(p)) { seen.add(p); up(p, seen); }
    return seen;
  };
  return new Map(nodes.map((n) => [n.id, up(n.id)]));
};

/** Every node reachable from `ids` along edges and containment, the start nodes included. */
export function descendantsOf(graph, ids) {
  const nodes = list(graph.nodes);
  const next = containment(nodes);
  for (const e of list(graph.edges)) next.get(e.from)?.add(e.to);
  const seen = new Set(), queue = [...ids].filter((id) => next.has(id));
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const to of next.get(id) ?? []) queue.push(to);
  }
  return seen;
}

function findCycle(nodes, edges) {
  const out = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) out.get(e.from)?.push(e.to);
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1); stack.push(id);
    for (const to of out.get(id) ?? []) {
      if (state.get(to) === 1) return [...stack.slice(stack.indexOf(to)), to];
      if (!state.has(to)) { const c = visit(to); if (c) return c; }
    }
    state.set(id, 2); stack.pop();
    return null;
  };
  for (const n of nodes) if (!state.has(n.id)) { const c = visit(n.id); if (c) return c; }
  return null;
}

/**
 * Validate one candidate version. `context` holds what the Work tree already decides: `frs` (every FR id of the
 * workflow's domains, once business exists) and `shapes` (every Block / XBase#state, once drawings exist); an
 * empty list means the rule does not apply yet. Returns {ok, findings:[{code, node?, detail}]}.
 */
export function validateGraph(graph, { workflowId = null, context = {} } = {}) {
  const findings = [];
  const find = (code, detail, node = null) => findings.push({ code, ...(node ? { node } : {}), detail });
  for (const error of validateAgainstSchema(graph, WORK_GRAPH_SCHEMA)) find('SHAPE', error);
  if (findings.length) return { ok: false, findings };
  if (workflowId && graph.workflow !== workflowId) find('WORKFLOW_MISMATCH', `graph names workflow ${graph.workflow}, not ${workflowId}`);

  const domains = new Set(graph.domains.map((d) => d.id));
  const byId = new Map();
  for (const n of graph.nodes) {
    if (byId.has(n.id)) find('DUPLICATE_NODE', `node ${n.id} is declared twice`, n.id);
    byId.set(n.id, n);
  }
  const nodes = [...byId.values()];
  for (const n of nodes) {
    if (!domains.has(n.domain)) find('UNKNOWN_DOMAIN', `node ${n.id} names domain ${n.domain}, which the graph does not declare`, n.id);
    else if (!n.id.startsWith(`${n.domain}.`)) find('NODE_ID_DOMAIN', `node ${n.id} is not spelled under its domain ${n.domain}`, n.id);
    if (ROOT_KINDS.has(n.kind)) {
      if (n.slice !== n.id) find('SLICE_ROOT', `${n.kind} node ${n.id} must name itself as its slice`, n.id);
    } else {
      const root = byId.get(n.slice);
      if (!root || !ROOT_KINDS.has(root.kind)) find('UNKNOWN_SLICE', `task ${n.id} names slice ${n.slice}, which is no slice or foundation node`, n.id);
      else if (root.domain !== n.domain) find('UNKNOWN_SLICE', `task ${n.id} sits in domain ${n.domain} but its slice ${n.slice} is in ${root.domain}`, n.id);
    }
    if (n.parent && !byId.has(n.parent)) find('UNKNOWN_NODE', `node ${n.id} names parent ${n.parent}, which does not exist`, n.id);
    else if (n.parent && byId.get(n.parent).slice !== n.slice) find('UNKNOWN_SLICE', `node ${n.id} is cut from ${n.parent} in another slice`, n.id);
    if (!byId.has(n.rollbackTo)) find('UNKNOWN_NODE', `node ${n.id} rolls back to ${n.rollbackTo}, which does not exist`, n.id);
    if (!n.ownedPaths.length) find('OWNED_PATHS_EMPTY', `node ${n.id} declares no owned path`, n.id);
    for (const p of [...n.ownedPaths, ...n.reads]) if (pathKey(p) === null) find('PATH_INVALID', `node ${n.id} names ${JSON.stringify(p)}, which is not a concrete workspace-relative prefix`, n.id);
  }
  const edges = [];
  const seenEdges = new Set();
  for (const e of graph.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) { find('UNKNOWN_NODE', `edge ${e.from} -> ${e.to} names a node that does not exist`); continue; }
    if (e.from === e.to) { find('CYCLE', `edge ${e.from} -> ${e.to} loops on itself`, e.from); continue; }
    if (seenEdges.has(edgeKey(e))) continue;
    seenEdges.add(edgeKey(e));
    edges.push(e);
  }
  if (findings.length) return { ok: false, findings };

  const cycle = findCycle(nodes, edges);
  if (cycle) find('CYCLE', `edges form a cycle: ${cycle.join(' -> ')}`, cycle[0]);

  // Owned paths: disjoint unless one node contains the other.
  const ancestors = ancestorsIn(nodes);
  const related = (a, b) => ancestors.get(a.id).has(b.id) || ancestors.get(b.id).has(a.id);
  const owned = nodes.map((n) => ({ n, keys: n.ownedPaths.map(pathKey).filter(Boolean) }));
  for (let i = 0; i < owned.length; i++) for (let j = i + 1; j < owned.length; j++) {
    const a = owned[i], b = owned[j];
    if (related(a.n, b.n)) continue;
    const hit = a.keys.find((p) => b.keys.some((q) => within(p, q)));
    if (hit) find('OWNED_PATH_OVERLAP', `${a.n.id} (slice ${a.n.slice}) and ${b.n.id} (slice ${b.n.slice}) both own ${hit}`, a.n.id);
  }

  // A read of another node's owned path needs an edge between them (or their slices); across domains a contract edge.
  const linked = (from, to) => edges.filter((e) => [from.id, from.slice].includes(e.from) && [to.id, to.slice].includes(e.to));
  for (const n of nodes) for (const read of n.reads.map(pathKey).filter(Boolean)) {
    for (const o of owned) {
      if (o.n.id === n.id || related(o.n, n) || !o.keys.some((p) => within(p, read))) continue;
      const found = linked(o.n, n);
      if (o.n.domain !== n.domain) {
        if (!found.some((e) => e.kind === 'contract')) find('CONTRACT_EDGE_MISSING', `${n.id} (domain ${n.domain}) reads ${read}, owned by ${o.n.id} (domain ${o.n.domain}), with no contract edge ${o.n.id} -> ${n.id}`, n.id);
      } else if (!found.length) find('READ_WITHOUT_EDGE', `${n.id} reads ${read}, owned by ${o.n.id}, with no edge ${o.n.id} -> ${n.id}`, n.id);
    }
  }

  // Size: every slice and foundation declares one; every node without children stays inside the estimate bound.
  const kids = containment(nodes);
  for (const n of nodes) {
    if (ROOT_KINDS.has(n.kind) && !n.size) { find('SIZE_MISSING', `${n.kind} ${n.id} declares no size estimate`, n.id); continue; }
    if (!n.size || kids.get(n.id).size) continue;
    let bound;
    try { bound = sliceBound(n.size); } catch (error) {
      if (error.code === 'estimate-no-measure') continue;
      throw error;
    }
    if (bound.overTarget) find('OVERSIZED', `${n.id} sizes ${bound.minutes} agent-min (${bound.size}); ${bound.agents} agent(s) at gear ${bound.gear} still take ${bound.perSliceMinutes} min each, over ${bound.targetMinutes[1]} - cut it into child nodes, seam first`, n.id);
  }

  // Coverage once business and drawings exist.
  const covered = (field) => {
    const slices = new Map();
    for (const n of nodes) for (const item of list(n[field])) {
      if (!slices.has(item)) slices.set(item, new Set());
      slices.get(item).add(n.slice);
    }
    return slices;
  };
  const frs = covered('frs');
  for (const fr of list(context.frs)) if (!frs.has(fr)) find('FR_UNCOVERED', `${fr} is attached to no slice`);
  const shapes = covered('shapes');
  for (const shape of list(context.shapes)) {
    const at = shapes.get(shape);
    if (!at) find('SHAPE_UNCOVERED', `${shape} is attached to no slice`);
    else if (at.size > 1) find('SHAPE_SPLIT', `${shape} is attached to ${at.size} slices (${[...at].join(', ')}); a shape belongs to exactly one`);
  }
  return { ok: findings.length === 0, findings };
}

const COLOR_FREE_FIELDS = new Set(['title', 'inferred']);
/** {added, removed, changed:[{id, fields}], edgesAdded, edgesRemoved, domainsAdded, domainsRemoved} from `prev` to `next`. */
export function diffGraphs(prev, next) {
  const before = new Map(list(prev?.nodes).map((n) => [n.id, n]));
  const after = new Map(list(next?.nodes).map((n) => [n.id, n]));
  const changed = [];
  for (const [id, n] of after) {
    const old = before.get(id);
    if (!old) continue;
    const fields = [...new Set([...Object.keys(old), ...Object.keys(n)])].filter((k) => canonicalJSON(old[k] ?? null) !== canonicalJSON(n[k] ?? null)).sort();
    if (fields.length) changed.push({ id, fields });
  }
  const edgesOf = (g) => new Map(list(g?.edges).map((e) => [edgeKey(e), e]));
  const eb = edgesOf(prev), ea = edgesOf(next);
  const domainsOf = (g) => new Set(list(g?.domains).map((d) => d.id));
  const db = domainsOf(prev), da = domainsOf(next);
  return {
    added: [...after.keys()].filter((id) => !before.has(id)).sort(),
    removed: [...before.keys()].filter((id) => !after.has(id)).sort(),
    changed,
    edgesAdded: [...ea].filter(([k]) => !eb.has(k)).map(([, e]) => ({ from: e.from, to: e.to, kind: e.kind })),
    edgesRemoved: [...eb].filter(([k]) => !ea.has(k)).map(([, e]) => ({ from: e.from, to: e.to, kind: e.kind })),
    domainsAdded: [...da].filter((d) => !db.has(d)).sort(),
    domainsRemoved: [...db].filter((d) => !da.has(d)).sort(),
  };
}
export const diffIsEmpty = (d) => !d.added.length && !d.removed.length && !d.changed.length && !d.edgesAdded.length && !d.edgesRemoved.length && !d.domainsAdded.length && !d.domainsRemoved.length;

/**
 * The colour rule. A removed node's descendants (in the old graph), a node whose inputs changed and the target
 * of an added or removed edge turn red together with their descendants (in the new graph); a node with nothing
 * to redo (gray) stays gray, a new node is gray and every untouched node keeps its colour.
 * Returns {colors, red:[ids turned red]}.
 */
export function recolor(prevColors, prev, next, diff) {
  const present = new Set(list(next.nodes).map((n) => n.id));
  const hit = new Set();
  for (const id of descendantsOf(prev ?? { nodes: [], edges: [] }, diff.removed)) if (present.has(id)) hit.add(id);
  const starts = [
    ...diff.changed.filter((c) => c.fields.some((f) => !COLOR_FREE_FIELDS.has(f))).map((c) => c.id),
    ...[...diff.edgesAdded, ...diff.edgesRemoved].map((e) => e.to).filter((id) => present.has(id)),
  ];
  for (const id of descendantsOf(next, starts)) hit.add(id);
  const added = new Set(diff.added);
  const colors = {}, red = [];
  for (const n of list(next.nodes)) {
    const was = added.has(n.id) ? GRAY : (prevColors?.[n.id] ?? GRAY);
    if (hit.has(n.id) && was !== GRAY) { colors[n.id] = RED; if (was !== RED) red.push(n.id); }
    else colors[n.id] = was;
  }
  return { colors, red: red.sort() };
}

/**
 * The runnable nodes: every node without children whose colour is gray or red and whose predecessors (edge
 * sources, and the predecessors of the slice and parent it sits in) are all green. Ordered foundation first, then
 * by id.
 */
export function frontierOf(graph, colors) {
  const nodes = list(graph.nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = containment(nodes);
  const preds = new Map(nodes.map((n) => [n.id, []]));
  for (const e of list(graph.edges)) preds.get(e.to)?.push(e.from);
  const ancestors = ancestorsIn(nodes);
  const done = (id) => {
    const inner = [...(kids.get(id) ?? [])];
    return inner.length ? inner.every(done) : colors[id] === GREEN;
  };
  const ready = [];
  for (const n of nodes) {
    if (kids.get(n.id).size || ![GRAY, RED].includes(colors[n.id] ?? GRAY)) continue;
    const waits = [n.id, ...ancestors.get(n.id)].flatMap((id) => preds.get(id) ?? []).filter((p) => !done(p));
    if (!waits.length) ready.push(n);
  }
  const rank = (n) => (n.kind === 'foundation' || byId.get(n.slice)?.kind === 'foundation' ? 0 : 1);
  return ready.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}
