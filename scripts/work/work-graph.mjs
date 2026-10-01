#!/usr/bin/env node
// work-graph.mjs — read and revise a workflow's work graph (modules/schemas/work-graph.schema.yaml).
//
//   node scripts/work/work-graph.mjs show     --repo <repo> --workflow <id> [--version <n>] [--json]
//   node scripts/work/work-graph.mjs validate --repo <repo> --workflow <id> [--file <candidate>] [--json]
//   node scripts/work/work-graph.mjs diff     --repo <repo> --workflow <id> [--from <n>] [--to <n> | --file <candidate>] [--json]
//   node scripts/work/work-graph.mjs propose  --repo <repo> [--workflow <id>] --job <job> --file <candidate> --reason <text> [--slice <id>] [--json]
//
// propose takes its workflow from the job when --workflow is absent, and a candidate without `workflow` gets it.
// propose writes: the job must be open, belong to the workflow and run an op whose manifest declares
// graphPolicy.workGraph (modules/schemas/op.schema.yaml). draw may record any version, revise a later one, cut a
// later one confined to --slice. Everything else is refused graph-write-denied; the Kernel holds no job of its
// own, so it never changes the graph. Exit 0 ok, 1 refused or invalid, 2 usage.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { JOB_STATUSES, inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { diffGraphs, frontierOf, validateGraph } from './work-graph-model.mjs';
import { latestVersion, liveColors, recordVersion, versionOf, versionsOf } from './work-graph-store.mjs';
import { workGraphContext } from './work-graph-context.mjs';

const USAGE = 'use: node scripts/work/work-graph.mjs show|validate|diff|propose --repo <repo> --workflow <id> [...] [--json]';
const VERBS = ['show', 'validate', 'diff', 'propose'];
const VALUE_FLAGS = ['repo', 'workflow', 'version', 'file', 'from', 'to', 'job', 'reason', 'slice'];
const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });

export function parseArgs(argv) {
  const [verb, ...rest] = argv;
  if (!VERBS.includes(verb)) return null;
  const args = { verb, json: false };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    if (key === 'json') args.json = true;
    else if (VALUE_FLAGS.includes(key) && i + 1 < rest.length) args[key] = rest[++i];
    else return null;
  }
  return args.repo && (args.workflow || (verb === 'propose' && args.job)) ? args : null;
}

const readCandidate = (file) => {
  if (!file) throw refuse('--file names the candidate graph', 'usage');
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  return /\.ya?ml$/i.test(file) ? parseYaml(text) : JSON.parse(text);
};
const contextFor = (repo, graph) => workGraphContext(repo, (graph?.domains ?? []).map((d) => d.id));

/** The op's graphPolicy.workGraph permission, or null. */
export function graphPermissionOf(op) {
  try { return parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'))?.graphPolicy?.workGraph ?? null; }
  catch { return null; }
}

/** The writing job and its permission; refuses graph-write-denied unless the job may make `want`. */
function authorOf(db, workflowId, jobId, want) {
  if (!jobId) throw refuse('changing the work graph needs --job: only an op job whose manifest declares graphPolicy.workGraph writes it; the Kernel executes nextActions and never edits the graph', 'graph-write-denied');
  const job = db.prepare('SELECT job_id,workflow_id,op_id,status FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw refuse(`job ${jobId} is not in this ledger`, 'graph-write-denied');
  if (job.workflow_id !== workflowId) throw refuse(`job ${jobId} belongs to ${job.workflow_id}, not ${workflowId}`, 'graph-write-denied');
  if (!JOB_STATUSES.dispatchable.includes(job.status)) throw refuse(`job ${jobId} is ${job.status}; only an open job writes the graph`, 'graph-write-denied');
  const permission = graphPermissionOf(job.op_id);
  if (!permission) throw refuse(`${job.op_id} declares no graphPolicy.workGraph permission; it cannot change the work graph`, 'graph-write-denied');
  if (!want.includes(permission)) throw refuse(`${job.op_id} holds workGraph ${permission}, which does not allow this change (needs ${want.join(' or ')})`, 'graph-write-denied');
  return { op: job.op_id, jobId: job.job_id, permission };
}

function withLedger(repo, write, fn) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) throw refuse(`no ledger at ${file}`, 'ledger-missing');
  const handle = write ? openLedger({ file }) : inspectLedger({ file });
  try { return fn(handle); } finally { handle.close(); }
}

const jobWorkflow = (repo, jobId) => withLedger(repo, false, ({ db }) => db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(jobId)?.workflow_id);

export function run(args) {
  const repo = path.resolve(args.repo);
  const workflowId = args.workflow ?? jobWorkflow(repo, args.job);
  if (!workflowId) throw refuse(`job ${args.job} is not in this ledger`, 'graph-write-denied');
  switch (args.verb) {
    case 'show': return withLedger(repo, false, ({ db }) => {
      const row = args.version != null ? versionOf(db, workflowId, Number(args.version)) : latestVersion(db, workflowId);
      if (!row) return { ok: true, workflowId, graph: null, history: [], fallback: 'leg-skeleton' };
      const colors = liveColors(db, row);
      return {
        ok: true, workflowId, version: row.version, event: row.event, digest: row.digest, graph: row.graph, colors,
        frontier: frontierOf(row.graph, colors).map((n) => n.id),
        history: versionsOf(db, workflowId).map((v) => ({ version: v.version, event: v.event, reason: v.reason, authorOp: v.authorOp, authorJob: v.authorJob, at: v.createdAt, diff: v.diff })),
      };
    });
    case 'validate': {
      const graph = args.file ? readCandidate(args.file) : withLedger(repo, false, ({ db }) => latestVersion(db, workflowId)?.graph);
      if (!graph) throw refuse(`workflow ${workflowId} has no work graph and no --file was given`, 'work-graph-missing');
      const verdict = validateGraph(graph, { workflowId, context: contextFor(repo, graph) });
      return { ...verdict, workflowId };
    }
    case 'diff': return withLedger(repo, false, ({ db }) => {
      const latest = latestVersion(db, workflowId);
      const from = args.from != null ? versionOf(db, workflowId, Number(args.from)) : latest;
      const to = args.file ? { graph: readCandidate(args.file), version: 'candidate' } : args.to != null ? versionOf(db, workflowId, Number(args.to)) : latest;
      if (!to) throw refuse(`nothing to diff: workflow ${workflowId} has no such version`, 'work-graph-missing');
      return { ok: true, workflowId, from: from?.version ?? null, to: to.version, diff: diffGraphs(from?.graph ?? null, to.graph) };
    });
    case 'propose': {
      if (!args.reason) throw refuse('propose needs --reason', 'usage');
      const candidate = readCandidate(args.file);
      const graph = { ...candidate, workflow: candidate?.workflow ?? workflowId };
      return withLedger(repo, true, (ledger) => {
        const exists = Boolean(latestVersion(ledger.db, workflowId));
        const author = authorOf(ledger.db, workflowId, args.job, exists ? ['draw', 'revise', 'cut'] : ['draw']);
        if (author.permission === 'cut' && !args.slice) throw refuse(`${author.op} cuts within one slice; name it with --slice`, 'usage');
        const event = !exists ? 'draw' : author.permission === 'cut' ? 'cut' : 'revise';
        return recordVersion(ledger, { workflowId, graph, event, reason: args.reason, authorOp: author.op, authorJob: author.jobId,
          context: contextFor(repo, graph), scope: author.permission === 'cut' ? args.slice : null });
      });
    }
    default: throw refuse(USAGE, 'usage');
  }
}

const text = (out) => {
  if (out.findings) return [`${out.ok ? 'valid' : 'invalid'} work graph for ${out.workflowId}`, ...out.findings.map((f) => `  [${f.code}] ${f.detail}`)].join('\n');
  if (out.graph === null) return `${out.workflowId}: no work graph; the leg skeleton drives the workflow`;
  if (out.graph) {
    const bySlice = new Map();
    for (const n of out.graph.nodes) (bySlice.get(`${n.domain} / ${n.slice}`) ?? bySlice.set(`${n.domain} / ${n.slice}`, []).get(`${n.domain} / ${n.slice}`)).push(`${n.id}:${out.colors[n.id]}`);
    return [`${out.workflowId} work graph v${out.version} (${out.event})`, ...[...bySlice].map(([k, v]) => `  ${k}: ${v.join(' ')}`),
      `  frontier: ${out.frontier.join(', ') || '-'}`, ...out.history.map((h) => `  v${h.version} ${h.event} by ${h.authorOp}${h.authorJob ? ` ${h.authorJob}` : ''}: ${h.reason}`)].join('\n');
  }
  if (out.diff && out.to !== undefined) return `diff v${out.from ?? '-'} -> ${out.to}: +${out.diff.added.length} -${out.diff.removed.length} ~${out.diff.changed.length} nodes, +${out.diff.edgesAdded.length} -${out.diff.edgesRemoved.length} edges`;
  if (out.unchanged) return `unchanged: v${out.version} already holds this graph`;
  return `recorded v${out.version} (${out.event})${out.diff?.red?.length ? `; red: ${out.diff.red.join(', ')}` : ''}`;
};

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args) { console.error(USAGE); return 2; }
  try {
    const out = run(args);
    console.log(args.json ? JSON.stringify(out, null, 2) : text(out));
    return out.ok === false ? 1 : 0;
  } catch (error) {
    if (error.code === 'usage') { console.error(`${error.message}\n${USAGE}`); return 2; }
    const out = { ok: false, code: error.code ?? 'error', error: error.message, ...(error.findings ? { findings: error.findings } : {}) };
    if (args.json) console.log(JSON.stringify(out, null, 2));
    else console.error(`${out.code}: ${out.error}${error.findings ? `\n${error.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}` : ''}`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exitCode = main();
