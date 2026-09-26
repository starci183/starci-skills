#!/usr/bin/env node
// backfill-work-graph.mjs — give each running workflow that has none a work graph v0, built from what its Work tree
// already records.
//
//   node scripts/work/backfill-work-graph.mjs --repo <repo> [--dry-run|--apply] [--json]
//
// Domains are the features whose scope record names the workflow (extensions.work3.scope.request.workflow). Per
// domain: one slice per customer journey carrying the FRs it requires, one slice per FR no journey requires, and a
// foundation slice owning the domain's data and contract records plus every source path two nodes both claim.
// Implementation and ui records become task nodes in the slice whose FRs they prove or reference (else the
// foundation); an implementation's dependsOn is a data edge (a contract edge across domains) and the foundation
// runs before every slice that does not feed it. Every field not read from a decided record is listed in the
// node's `inferred`. Colours come from the jobs the workflow already ran. A workflow that already has a graph, or
// whose features carry no scope, is left alone, so a second run records nothing. Default is --dry-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { normalizeOwnedPath } from '../../engine/admission.mjs';
import { WORK_GRAPH_ID, validateGraph } from './work-graph-model.mjs';
import { latestVersion, liveColors, recordVersion } from './work-graph-store.mjs';
import { shapesOfUiRecord, workGraphContext } from './work-graph-context.mjs';
import { list, readYamlOrNull } from './work-io.mjs';

const USAGE = 'use: node scripts/work/backfill-work-graph.mjs --repo <repo> [--dry-run|--apply] [--json]';
const AUTHOR = 'backfill-work-graph';

function parseArgs(argv) {
  const a = { apply: false, json: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--repo') a.repo = argv[++i];
    else if (k === '--apply') a.apply = true;
    else if (k === '--dry-run') a.apply = false;
    else if (k === '--json') a.json = true;
    else return null;
  }
  return a.repo ? a : null;
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const subdirs = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch { return []; } };
const recordsIn = (dir) => subdirs(dir).map((name) => ({ name, record: readYamlOrNull(path.join(dir, name, 'index.yaml')) })).filter((r) => r.record);
const key = (p) => { try { return normalizeOwnedPath(p).toLowerCase(); } catch { return null; } };
const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/** Features whose scope record names `workflowId`. */
export function scopedFeatures(repo, workflowId) {
  const dir = path.join(repo, '.starciwork', 'features');
  return subdirs(dir).filter((f) => readYamlOrNull(path.join(dir, f, 'index.yaml'))?.extensions?.work3?.scope?.request?.workflow === workflowId);
}

/** The v0 candidate for one workflow over `domains`. */
export function buildGraph(repo, workflowId, domains) {
  const rel = (...parts) => ['.starciwork', 'features', ...parts].join('/');
  const repoName = path.basename(repo);
  const nodes = [], edges = [];
  const recordNode = new Map();
  for (const d of domains) {
    const fdir = path.join(repo, '.starciwork', 'features', d);
    const foundation = { id: `${d}.foundation`, domain: d, slice: `${d}.foundation`, kind: 'foundation', title: `${d} foundation: shared data, contracts and source`,
      ownedPaths: ['data', 'contract'].filter((f) => fs.existsSync(path.join(fdir, f))).map((f) => rel(d, f)), reads: [], rollbackTo: `${d}.foundation`,
      frs: [], shapes: [], inferred: ['slice', 'ownedPaths', 'size'] };
    if (!foundation.ownedPaths.length) foundation.ownedPaths.push(rel(d, 'index.yaml'));
    nodes.push(foundation);
    const frIds = new Set(recordsIn(path.join(fdir, 'fr')).map((r) => r.record.id).filter(Boolean));
    const slices = [];
    for (const { name, record } of recordsIn(path.join(fdir, 'journey'))) {
      if (!String(record.schema ?? '').startsWith('work/customer-journey')) continue;
      slices.push({ id: `${d}.${slug(name)}`, domain: d, slice: `${d}.${slug(name)}`, kind: 'slice', title: record.title ?? name,
        ownedPaths: [rel(d, 'journey', name)], reads: [], rollbackTo: `${d}.${slug(name)}`,
        frs: list(record.requirements).filter((fr) => frIds.has(fr)), shapes: [], inferred: ['size'], refId: record.id });
    }
    const journeyFrs = new Set(slices.flatMap((s) => s.frs));
    for (const { name, record } of recordsIn(path.join(fdir, 'fr'))) {
      if (!record.id || journeyFrs.has(record.id)) continue;
      const id = slices.some((s) => s.id === `${d}.${slug(name)}`) ? `${d}.fr-${slug(name)}` : `${d}.${slug(name)}`;
      slices.push({ id, domain: d, slice: id, kind: 'slice', title: record.title ?? name, ownedPaths: [rel(d, 'fr', name)], reads: [], rollbackTo: id,
        frs: [record.id], shapes: [], inferred: ['slice', 'size'], refId: record.id });
    }
    nodes.push(...slices);
    const sliceFor = (refs) => {
      const hit = slices.filter((s) => refs.includes(s.refId) || s.frs.some((fr) => refs.includes(fr)));
      return hit.length === 1 ? hit[0] : foundation;
    };
    const taskIds = new Set();
    const task = (slice, name, fields) => {
      let id = `${slice.id}.${slug(name)}`;
      for (let n = 2; taskIds.has(id); n++) id = `${slice.id}.${slug(name)}-${n}`;
      taskIds.add(id);
      const node = { id, domain: d, slice: slice.id, kind: 'task', rollbackTo: slice.id, frs: [], shapes: [], reads: [], ...fields };
      nodes.push(node);
      return node;
    };
    for (const impl of subdirs(path.join(fdir, 'impl'))) {
      for (const { name, record } of recordsIn(path.join(fdir, 'impl', impl))) {
        if (!String(record.schema ?? '').startsWith('work/implementation')) continue;
        const proves = list(record.proves);
        const slice = sliceFor(proves);
        const prefix = record.repository && record.repository !== repoName ? `${record.repository}/` : '';
        const node = task(slice, `${impl}-${name}`, { title: record.title ?? name,
          ownedPaths: [rel(d, 'impl', impl, name), ...list(record.owners).map((o) => o?.path).filter(Boolean).map((p) => `${prefix}${p}`)],
          frs: proves.filter((fr) => frIds.has(fr)), files: list(record.owners).length,
          inferred: ['slice', ...(slice === foundation ? ['foundation'] : [])] });
        recordNode.set(record.id, { node, dependsOn: list(record.dependsOn) });
      }
    }
    for (const { name, record } of recordsIn(path.join(fdir, 'ui'))) {
      if (!String(record.schema ?? '').startsWith('work/ui-screen')) continue;
      const slice = sliceFor(list(record.refs));
      task(slice, `ui-${name}`, { title: record.title ?? name, ownedPaths: [rel(d, 'ui', name)], shapes: shapesOfUiRecord(record),
        frs: list(record.refs).filter((fr) => frIds.has(fr)), inferred: ['slice'] });
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // A path two tasks both claim is shared: the domain foundation owns it and every task claiming it reads it.
  const tasks = nodes.filter((n) => n.kind === 'task');
  const shared = new Set();
  for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) {
    for (const pa of tasks[i].ownedPaths.map(key).filter(Boolean)) for (const pb of tasks[j].ownedPaths.map(key).filter(Boolean)) {
      if (overlaps(pa, pb)) { shared.add(pa); shared.add(pb); }
    }
  }
  for (const t of tasks) {
    const moved = t.ownedPaths.filter((p) => [...shared].some((k) => overlaps(key(p) ?? '', k)));
    if (!moved.length) continue;
    const f = byId.get(`${t.domain}.foundation`);
    t.ownedPaths = t.ownedPaths.filter((p) => !moved.includes(p));
    t.reads.push(...moved.filter((p) => !t.reads.includes(p)));
    t.inferred.push('ownedPaths');
    for (const p of moved) if (!f.ownedPaths.some((x) => overlaps(key(x), key(p)))) f.ownedPaths.push(p);
  }
  for (const f of nodes.filter((n) => n.kind === 'foundation')) {
    const ks = f.ownedPaths.map(key);
    f.ownedPaths = f.ownedPaths.filter((p, i) => !ks.some((q, j) => j !== i && q && ks[i] && ks[i].startsWith(`${q}/`)));
  }

  // dependsOn between implementation records: the dependency owns what the dependant reads.
  const addEdge = (from, to, kind, reason) => {
    if (from.id === to.id || edges.some((e) => e.from === from.id && e.to === to.id)) return;
    edges.push({ from: from.id, to: to.id, kind, reason, inferred: true });
  };
  for (const { node, dependsOn } of recordNode.values()) for (const dep of dependsOn) {
    const from = recordNode.get(dep)?.node;
    if (!from) continue;
    addEdge(from, node, from.domain === node.domain ? 'data' : 'contract', `${dep} is a declared dependency`);
    for (const p of from.ownedPaths) if (!node.reads.includes(p) && !p.startsWith('.starciwork/')) node.reads.push(p);
  }
  // The foundation runs before each slice of its domain unless something in the foundation depends on that slice.
  for (const f of nodes.filter((n) => n.kind === 'foundation')) {
    const feeds = new Set(edges.filter((e) => byId.get(e.from).slice !== f.id && byId.get(e.to).slice === f.id).map((e) => byId.get(e.from).slice));
    for (const s of nodes.filter((n) => n.kind === 'slice' && n.domain === f.domain)) {
      if (feeds.has(s.id)) {
        for (const t of nodes.filter((n) => n.slice === s.id && n.reads.some((r) => f.ownedPaths.some((p) => overlaps(key(p), key(r)))))) addEdge(f, t, 'data', 'reads a path the foundation owns');
      } else addEdge(f, s, 'order', 'the foundation slice runs first');
    }
  }
  // A slice's size counts the source owners and records of its tasks; a task carries none, it was never measured.
  for (const s of nodes.filter((n) => n.kind !== 'task')) {
    const inner = nodes.filter((n) => n.slice === s.id && n.id !== s.id);
    s.size = { files: inner.reduce((sum, n) => sum + (n.files ?? 0), 0), records: 1 + s.frs.length + inner.length };
  }
  for (const n of nodes) {
    delete n.refId;
    delete n.files;
    for (const k of ['frs', 'shapes']) if (!n[k].length) delete n[k];
    n.inferred = [...new Set(n.inferred)].sort();
  }
  return { schema: WORK_GRAPH_ID, workflow: workflowId, domains: domains.map((id) => ({ id, inferred: true })), nodes, edges };
}

function assess(repo, db, workflowId) {
  if (latestVersion(db, workflowId)) return { workflowId, outcome: 'exists' };
  const domains = scopedFeatures(repo, workflowId);
  if (!domains.length) return { workflowId, outcome: 'no-scope', reason: 'no feature scope names this workflow; the leg skeleton stays its graph' };
  const graph = buildGraph(repo, workflowId, domains);
  const verdict = validateGraph(graph, { workflowId, context: workGraphContext(repo, domains) });
  const count = (kind) => graph.nodes.filter((n) => n.kind === kind).length;
  const summary = { domains: domains.length, slices: count('slice'), foundations: count('foundation'), tasks: count('task'), edges: graph.edges.length,
    frs: new Set(graph.nodes.flatMap((n) => n.frs ?? [])).size, shapes: new Set(graph.nodes.flatMap((n) => n.shapes ?? [])).size };
  if (!verdict.ok) return { workflowId, outcome: 'invalid', ...summary, findings: verdict.findings };
  const colors = liveColors(db, { workflowId, graph, colors: {}, createdAt: 0 });
  const tally = Object.values(colors).reduce((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});
  return { workflowId, outcome: 'v0', ...summary, colors: tally, graph };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) { console.error(USAGE); process.exit(2); }
  const repo = path.resolve(args.repo);
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) { console.error(`no ledger at ${file}`); process.exit(2); }
  const read = inspectLedger({ file });
  let results;
  try {
    const rows = read.db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();
    results = rows.map((row) => assess(repo, read.db, row.workflow_id));
  } finally { read.close(); }
  if (args.apply && results.some((r) => r.graph)) {
    const ledger = openLedger({ file });
    try {
      for (const r of results.filter((x) => x.graph)) {
        const out = recordVersion(ledger, { workflowId: r.workflowId, graph: r.graph, event: 'backfill', authorOp: AUTHOR,
          reason: 'v0 backfilled from the feature scope, customer journeys, FR, implementation and ui records; inferred fields are listed per node',
          context: workGraphContext(repo, r.graph.domains.map((d) => d.id)) });
        r.outcome = out.unchanged ? 'exists' : 'written';
        r.version = out.version;
      }
    } finally { ledger.close(); }
  }
  for (const r of results) delete r.graph;
  const counts = results.reduce((acc, r) => ({ ...acc, [r.outcome]: (acc[r.outcome] ?? 0) + 1 }), {});
  const out = { ok: true, repo, ledger: file, mode: args.apply ? 'apply' : 'dry-run', running: results.length, counts, workflows: results };
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`${out.mode} ${repo}: ${results.length} running — ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ') || 'nothing to do'}`);
    for (const r of results) {
      console.log(`  ${r.workflowId} ${r.outcome}${r.slices !== undefined ? ` ${r.domains} domain(s), ${r.foundations} foundation, ${r.slices} slices, ${r.tasks} tasks, ${r.edges} edges, ${r.frs} FRs${r.colors ? ` [${Object.entries(r.colors).map(([k, v]) => `${k}:${v}`).join(' ')}]` : ''}` : ''}${r.reason ? ` — ${r.reason}` : ''}`);
      for (const f of r.findings ?? []) console.log(`    [${f.code}] ${f.detail}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
