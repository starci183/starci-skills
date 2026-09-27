#!/usr/bin/env node
// migrate-runtime.mjs — bring a product repo's running workflows onto the current runtime model.
//
//   node scripts/work/migrate-runtime.mjs --repo <repo> [--dry-run|--apply] [--json]
//
// The audit lists every place a running workflow's stored state disagrees with the model the runtime now reads:
// ledger tables schema.sql adds, ui records still split by state, owner asks for retired or non-shape drawings, a
// goal with no plan edges, a missing or invalid work graph, a failed settle with no recorded next step, a worker
// whose terminal is gone or whose held settle still holds its terminal, leases no open job holds, a frontier that
// names nothing to do, contract follow-ups the plan cannot order, and legs no follow-up can be proved for.
// Each finding is `apply` (storage every ledger and Work tree needs so new goals run cleanly: --apply adds the
// missing tables through openLedger and rewrites old-shaped ui records through migrate-ui-shapes), `report` (a
// running workflow's own state; `command` names the landed helper that fixes it - never run from here), `owner`
// (a decision) or `note`. It never writes a running workflow's jobs, asks, graph or goal. Idempotent; default is
// --dry-run.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { parseJson } from '../lib/json.mjs';
import { planAncestorsOf } from '../route/plan-edges.mjs';
import { contractFollowUpsOf, loadContractChanges } from '../kernel/contract-version.mjs';
import { stepOwedFailures } from '../kernel/failure-steps.mjs';
import { uiShapeFindings } from '../checks/ui-shapes.mjs';
import { migrateRepo } from './migrate-ui-shapes.mjs';
import { loadDrawing, reviewShapesOf } from './draw-review.mjs';
import { validateGraph } from './work-graph-model.mjs';
import { latestVersion } from './work-graph-store.mjs';
import { workGraphContext } from './work-graph-context.mjs';
import { indexFilesUnder, readYamlOrNull, slash } from './work-io.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = 'use: node scripts/work/migrate-runtime.mjs --repo <repo> [--dry-run|--apply] [--json]';
const DRAW_REVIEW_KIND = 'draw-review';
const IN_FLIGHT = ['leased', 'running', 'answering', 'effect_unknown'];
const LEGIT_WAITS = ['awaiting-owner', 'peer-wait', 'ask-reserve', 'engaged'];
const FOLLOW_UP_ORDER = [['interface.draw', 'interface.implement'], ['interface.implement', 'interface.audit']];
const list = (v) => (Array.isArray(v) ? v : []);

const script = (...parts) => path.join(skillRoot, 'scripts', ...parts);
/** Run one landed CLI with --json; {status, body, stderr}. */
function runJson(file, args) {
  const r = spawnSync(process.execPath, [file, ...args, '--json'], { cwd: skillRoot, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 600000 });
  return { status: r.status, body: parseJson(r.stdout), stderr: String(r.stderr ?? '').split('\n').filter((l) => l && !/ExperimentalWarning|trace-warnings/.test(l)).join('\n').slice(0, 400) };
}
const api = (repo, ...args) => runJson(script('kernel', 'api.mjs'), [...args, '--repo', repo]);

/** Tables and columns engine/schema.sql declares that the ledger lacks: {tables: [], columns: [{table, column}]}. */
export function schemaDrift(db) {
  const want = new DatabaseSync(':memory:');
  try {
    want.exec(fs.readFileSync(path.join(skillRoot, 'engine', 'schema.sql'), 'utf8'));
    const tables = (d) => d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    const columns = (d, t) => d.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    const have = new Set(tables(db));
    const out = { tables: [], columns: [] };
    for (const t of tables(want)) {
      if (!have.has(t)) { out.tables.push(t); continue; }
      const present = new Set(columns(db, t));
      for (const c of columns(want, t)) if (!present.has(c)) out.columns.push({ table: t, column: c });
    }
    return out;
  } finally { want.close(); }
}

/** Every ui record's repo-relative retired asset paths. */
function retiredAssetPaths(repo) {
  const out = new Set();
  const work = path.join(repo, '.starciwork');
  for (const file of fs.existsSync(work) ? indexFilesUnder(work) : []) {
    const record = readYamlOrNull(file);
    if (record?.schema !== 'work/ui-screen@1') continue;
    const dir = slash(path.relative(repo, path.dirname(file)));
    for (const a of [...list(record.assets), ...list(record.ui?.assets)]) if (a?.retired && a.path) out.add(`${dir}/${slash(a.path)}`);
  }
  return out;
}

/** Why an open ask no longer fits the model (a draw-review part that is not a live shape part, a retired drawing), else null. */
function staleAskReason(repo, question, retired) {
  if (question?.kind === DRAW_REVIEW_KIND && question.review?.recordPath) {
    const dir = path.join(repo, path.dirname(question.review.recordPath));
    if (!fs.existsSync(path.join(dir, 'index.yaml'))) return `its record ${question.review.recordPath} no longer exists`;
    const split = reviewShapesOf(loadDrawing(dir).record);
    const live = new Set(split.parts.map((p) => slash(p.path)));
    const off = list(question.review.parts).filter((p) => !live.has(slash(p.path)));
    if (off.length) return `draw-review asks about ${off.map((p) => `${p.path}${p.shape ? ` (${p.shape})` : ''}`).join(', ')}, which ${off.length === 1 ? 'is' : 'are'} not a live shape part of ${question.review.record} (data status or retired)`;
  }
  const assets = list(question?.assets).map((a) => slash(typeof a === 'string' ? a : a?.path ?? '')).filter(Boolean);
  const gone = assets.filter((a) => retired.has(a) || [...retired].some((r) => r.endsWith(`/${a}`)));
  return gone.length ? `asks about retired drawing(s) ${gone.join(', ')}` : null;
}


/** The findings of one running workflow: [{code, fix, subject, detail, command?}]. */
function auditWorkflow({ repo, db, workflowId, status, registry, retired, backfills }) {
  const out = [];
  const add = (code, fix, subject, detail, command = null) => out.push({ code, fix, subject, detail, ...(command ? { command } : {}) });
  const goal = parseJson(db.prepare('SELECT json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId)?.json, {}) ?? {};
  const plan = goal.derivedPlan?.legs ? goal.derivedPlan : goal.opChain;
  const edges = backfills.edges.get(workflowId);
  if (plan?.legs && !Array.isArray(plan.edges)) {
    if (edges?.outcome === 'edges') add('plan-edges-missing', 'report', workflowId, `the approved plan carries no dependency edges; backfill-plan-edges derives ${edges.edges} over ${edges.legs} legs`, `node scripts/route/backfill-plan-edges.mjs --repo ${slash(repo)} --apply`);
    else add('plan-linear', 'note', workflowId, `the plan keeps its linear chain: ${edges?.reason ?? 'backfill-plan-edges gave no outcome'}`);
  }

  const graph = latestVersion(db, workflowId);
  const v0 = backfills.graphs.get(workflowId);
  if (!graph && v0?.outcome === 'v0') add('work-graph-missing', 'report', workflowId, `no work graph version; backfill-work-graph builds a valid v0 (${v0.domains} domain(s), ${v0.slices} slices, ${v0.tasks} tasks, ${v0.shapes} shapes)`, `node scripts/work/backfill-work-graph.mjs --repo ${slash(repo)} --apply`);
  else if (!graph && v0?.outcome === 'invalid') add('work-graph-refused', 'owner', workflowId, `backfill-work-graph cannot build a valid v0: ${list(v0.findings).map((f) => `[${f.code}] ${f.detail}`).join('; ')}`);
  else if (!graph) add('work-graph-none', 'note', workflowId, v0?.reason ?? 'no work graph and backfill-work-graph builds none; the leg skeleton stays its graph');
  else {
    const domains = list(graph.graph?.domains).map((d) => d.id);
    const verdict = validateGraph(graph.graph, { workflowId, context: workGraphContext(repo, domains) });
    if (!verdict.ok) add('work-graph-invalid', 'owner', `v${graph.version}`, `work graph v${graph.version} no longer validates against the Work tree: ${verdict.findings.map((f) => `[${f.code}] ${f.detail}`).join('; ')}; the scope.define follow-up proposes the next version`);
  }

  for (const { job, supersededBy } of stepOwedFailures(db, workflowId)) {
    if (supersededBy) add('failed-superseded', 'note', job.job_id, `${job.op_id} a${job.attempt} settled fail before the router and records no nextStep; ${supersededBy} re-ran the same work`);
    else add('failed-without-next-step', 'report', job.job_id, `${job.op_id} a${job.attempt} settled fail before the router: no nextStep and nothing re-ran its work, so nextActions never names it and its leg reads red; the Kernel retries or drops it`, `node scripts/kernel/api.mjs enqueue --repo ${slash(repo)} --workflow ${workflowId} --op ${job.op_id} --retry-of ${job.job_id} --paths <its paths>`);
  }

  for (const ask of list(status?.awaitingOwner).filter((item) => item.answer === 'pending' && item.dispatchId)) {
    const question = parseJson(db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?').get(workflowId, ask.dispatchId)?.report_json, {})?.question;
    const why = staleAskReason(repo, question, retired);
    if (why) add('ask-stale', 'report', ask.dispatchId, why, `node scripts/kernel/api.mjs retire-ask --repo ${slash(repo)} --workflow ${workflowId} --dispatch ${ask.dispatchId} --reason <text>`);
  }

  const frontier = status?.frontier ?? {};
  for (const jobId of list(frontier.deadWorkerJobs)) add('dead-worker', 'report', jobId, 'reads running but its terminal is gone (host restart)', `node scripts/kernel/api.mjs reconcile --repo ${slash(repo)} --job ${jobId} --dead-worker --settle-failed`);
  for (const jobId of list(frontier.heldWorkerJobs)) add('held-worker', 'report', jobId, 'its settle is held by a wait but its terminal and path lease are still held', `node scripts/kernel/api.mjs reconcile --repo ${slash(repo)} --job ${jobId} --release-worker`);
  for (const row of db.prepare('SELECT l.job_id,l.resource_key,j.status FROM leases l JOIN jobs j USING(job_id) WHERE l.workflow_id=?').all(workflowId)) {
    if (!IN_FLIGHT.includes(row.status)) add('lease-orphaned', 'owner', row.job_id, `lease ${row.resource_key} is held by a ${row.status} job`);
  }

  if (frontier.state === 'orphaned-frontier') add('orphaned-frontier', 'owner', workflowId, frontier.reason ?? 'no open operation and nothing named');
  else if (!list(status?.nextActions).length && !LEGIT_WAITS.includes(frontier.state) && frontier.state !== 'finished') add('no-next-actions', 'owner', workflowId, `frontier ${frontier.state} names no next action`);

  const followUps = contractFollowUpsOf(db, workflowId, registry);
  for (const leg of followUps.unadmitted) add('follow-up-unprovable', 'owner', leg.jobId, `${leg.op} a${leg.attempt} (${leg.status}) has no admitted contract row, so ${leg.change} cannot tell whether it owes a follow-up`);
  // Follow-ups owed (not yet enqueued) or enqueued (a job carries payload.contractChange), per op.
  const enqueued = db.prepare("SELECT job_id,op_id,status FROM jobs WHERE workflow_id=? AND status<>'cancelled' AND json_extract(payload_json,'$.contractChange.id') IS NOT NULL").all(workflowId);
  const summary = {};
  for (const item of followUps.owed) (summary[item.followUpOp] ??= { owed: 0, enqueued: 0 }).owed += 1;
  for (const job of enqueued) (summary[job.op_id] ??= { owed: 0, enqueued: 0 }).enqueued += 1;
  const ancestors = planAncestorsOf(goal);
  const ready = new Set(list(frontier.queued).filter((q) => q.queuedBecause === 'ready').map((q) => q.jobId));
  for (const [first, then] of FOLLOW_UP_ORDER) {
    if (!summary[first] || !summary[then]) continue;
    if (!(ancestors.get(then) ?? []).includes(first)) add('follow-up-order', 'owner', `${first}->${then}`, `${then} follow-ups come with ${first}'s, but the plan does not put ${first} before ${then}, so the queued follow-ups cannot wait on each other`);
    const firstOpen = enqueued.some((job) => job.op_id === first && ['queued', ...IN_FLIGHT].includes(job.status));
    const early = enqueued.filter((job) => job.op_id === then && ready.has(job.job_id));
    if (firstOpen && early.length) add('follow-up-order', 'owner', early.map((job) => job.job_id).join(','), `${then} follow-up(s) read ready while a ${first} follow-up is still open; the enqueue path did not order them`);
  }
  return { findings: out, followUps: summary };
}

/** The whole audit of `repo`: {schema, ui, workflows}. */
export function auditRepo(repo, { registry = loadContractChanges(skillRoot) } = {}) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) throw new Error(`no ledger at ${slash(file)}`);
  const ui = migrateRepo(repo, { apply: false });
  const uiFindings = [];
  for (const rec of ui.records) {
    if (rec.changed) uiFindings.push({ code: 'ui-record-old-shape', fix: 'apply', subject: rec.id ?? rec.file, detail: `${rec.shapes} shape(s), ${rec.moved.length} data-status state(s) to move, ${rec.retired.length} drawing(s) to retire (migrate-ui-shapes)` });
    for (const c of rec.candidates) uiFindings.push({ code: 'ui-non-derivable-candidate', fix: 'owner', subject: `${rec.id}#${c.state}`, detail: `${c.status} in ${c.base}/${c.slot}: ${c.reasons.join('; ')}` });
    const record = readYamlOrNull(path.join(repo, rec.file));
    if (!rec.changed) for (const f of uiShapeFindings(record)) uiFindings.push({ code: `ui-${f.code}`, fix: 'owner', subject: rec.id ?? rec.file, detail: f.detail });
  }
  const retired = retiredAssetPaths(repo);
  const outcomes = (file) => new Map(list(runJson(file, ['--repo', repo, '--dry-run']).body?.workflows).map((w) => [w.workflowId, w]));
  const backfills = { edges: outcomes(script('route', 'backfill-plan-edges.mjs')), graphs: outcomes(script('work', 'backfill-work-graph.mjs')) };
  const read = inspectLedger({ file });
  try {
    const drift = schemaDrift(read.db);
    const schema = [
      ...drift.tables.map((t) => ({ code: 'schema-table-missing', fix: 'apply', subject: t, detail: `table ${t} is in engine/schema.sql but not in the ledger; openLedger adds it` })),
      ...drift.columns.map((c) => ({ code: 'schema-column-missing', fix: 'owner', subject: `${c.table}.${c.column}`, detail: 'a column schema.sql declares that the ledger lacks; no additive migration exists for it' })),
    ];
    const running = read.db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all().map((r) => r.workflow_id);
    const workflows = running.map((workflowId) => {
      const st = api(repo, 'status', '--workflow', workflowId);
      const status = st.status === 0 ? st.body : null;
      const { findings, followUps } = status ? auditWorkflow({ repo, db: read.db, workflowId, status, registry, retired, backfills })
        : { findings: [{ code: 'status-failed', fix: 'owner', subject: workflowId, detail: `api status failed: ${st.stderr}` }], followUps: {} };
      return { workflowId, frontier: status?.frontier?.state ?? null, nextActions: list(status?.nextActions).map((a) => `${a.kind}:${a.op ?? '-'}`),
        workGraph: status?.workGraph ? `v${status.workGraph.version}` : null, contractFollowUps: followUps, findings };
    });
    return { repo: slash(path.resolve(repo)), ledger: slash(file), schema, ui: uiFindings, workflows };
  } finally { read.close(); }
}

const tally = (audit) => {
  const all = [...audit.schema, ...audit.ui, ...audit.workflows.flatMap((w) => w.findings)];
  return all.reduce((acc, f) => ({ ...acc, [f.code]: (acc[f.code] ?? 0) + 1 }), {});
};
const allFindings = (audit) => [...audit.schema, ...audit.ui, ...audit.workflows.flatMap((w) => w.findings.map((f) => ({ ...f, workflowId: w.workflowId })))];

/** The storage fixes: the ledger tables openLedger adds, and the ui records migrate-ui-shapes rewrites. */
function applyStorage(repo, audit) {
  const done = [];
  const tables = audit.schema.filter((f) => f.fix === 'apply').map((f) => f.subject);
  if (tables.length) {
    openLedger({ file: ledgerFileFor(repo) }).close();
    done.push({ kind: 'schema', ok: true, detail: `openLedger added ${tables.join(', ')}` });
  }
  if (audit.ui.some((f) => f.fix === 'apply')) {
    const r = migrateRepo(repo, { apply: true });
    done.push({ kind: 'ui-shapes', ok: !r.unreadable.length, detail: `${r.totals.changed} ui record(s) rewritten`, files: r.records.filter((x) => x.changed).map((x) => x.file) });
  }
  return done;
}

export function migrateRuntime(repo, { apply = false } = {}) {
  const root = path.resolve(repo);
  const before = auditRepo(root);
  const open = (audit) => allFindings(audit).filter((f) => f.fix !== 'apply');
  if (!apply) return { repo: before.repo, mode: 'dry-run', counts: { before: tally(before) }, before, open: open(before) };
  const applied = applyStorage(root, before);
  const after = applied.length ? auditRepo(root) : before;
  return { repo: after.repo, mode: 'apply', counts: { before: tally(before), after: tally(after) }, applied, after, open: open(after) };
}

const render = (r) => {
  const lines = [`migrate-runtime ${r.mode} ${r.repo}`];
  const fmt = (c) => Object.entries(c).map(([k, v]) => `${k}:${typeof v === 'object' ? `${v.owed} owed/${v.enqueued} enqueued` : v}`).join(' ') || 'none';
  lines.push(`  findings before: ${fmt(r.counts.before)}`);
  if (r.counts.after) lines.push(`  findings after:  ${fmt(r.counts.after)}`);
  const audit = r.after ?? r.before;
  for (const w of audit.workflows) {
    lines.push(`  ${w.workflowId}: frontier ${w.frontier}, ${w.nextActions.length} next action(s), work graph ${w.workGraph ?? 'none'}, follow-ups ${fmt(w.contractFollowUps)}`);
    for (const f of w.findings) lines.push(`    [${f.fix}] ${f.code} ${f.subject}: ${f.detail}${f.command ? `\n      fix: ${f.command}` : ''}`);
  }
  for (const f of [...audit.schema, ...audit.ui]) lines.push(`  [${f.fix}] ${f.code} ${f.subject}: ${f.detail}`);
  for (const a of r.applied ?? []) lines.push(`  applied ${a.kind}: ${a.ok ? 'ok' : 'FAILED'} (${a.detail})`);
  return `${lines.join('\n')}\n`;
};

export function migrateRuntimeMain(argv = []) {
  let repo = null, apply = false, json = false;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--repo') repo = argv[++i];
    else if (k === '--apply') apply = true;
    else if (k === '--dry-run') apply = false;
    else if (k === '--json') json = true;
    else return { exitCode: 2, text: `${USAGE}\n` };
  }
  if (!repo) return { exitCode: 2, text: `${USAGE}\n` };
  try {
    const result = migrateRuntime(repo, { apply });
    const failed = (result.applied ?? []).some((a) => !a.ok);
    return { exitCode: failed ? 1 : 0, text: json ? `${JSON.stringify(result, null, 2)}\n` : render(result) };
  } catch (error) {
    return { exitCode: 1, text: `migrate-runtime: ${error.message}\n` };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = migrateRuntimeMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
