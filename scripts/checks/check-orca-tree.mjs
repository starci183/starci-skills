#!/usr/bin/env node
// check-orca-tree.mjs — the Orca tree a ledger implies against the terminals
// Orca actually has. modules/kernel/start-workflow.yaml orcaTree states the
// rule; this is the executable half of it, and the only thing that reads both
// sides at once.
//
//   DUPLICATE_KERNEL   a workflow with more than one live kernel terminal, or
//                      a kernel signal terminal that is not the kernel job's
//                      worker_id — a restart that did not close its predecessor
//   ORPHAN_TERMINAL    a live StarCi terminal bound to no running/answering job
//                      and not the kernel signal of a non-finished workflow
//   DEAD_KERNEL        a non-finished workflow whose signal terminal is not in
//                      the listing — the ledger holds a handle Orca has lost
//   STRAY_TERMINAL     a live terminal in the project worktree that is no live
//                      kernel or op worker (settled worker, leftover shell)
//   TITLE_DRIFT        a live managed op worker whose [Op] tab-title rename did
//                      not apply (the unnamed worker-task_<id> sidebar row)
//   TASK_OUTSIDE_RUN   a job whose Orca Run is not the workflow's current Run,
//                      so its Task hangs outside the workflow's tree
//
// ORPHAN_TERMINAL covers only StarCi's own terminals: a handle the ledger names, or
// a worker Orca accounts for in one of this ledger's Runs (orchestration
// worker-list, every row not released). A tab title proves nothing. An owner's
// own terminals are never findings, and neither is a live [Worker] of an open
// Supervisor job: it runs in the runtime project's worktree
// (scripts/supervisor/workers.mjs) and its job lives in machine.sqlite
// (sup_jobs), not in the ledger checked here.
//
//   node scripts/checks/check-orca-tree.mjs --repo <ledger owner>
//        (--terminals <terminal-list --json receipt> [--workers <worker-list --json receipt>] | --live) [--json]
//
// --live lists the terminals and, Run by Run, the workers of every Orca Run the
// ledger's jobs name.
//
// Exit 0 clean, 1 findings, 2 usage. It needs a ledger, so it is not part of
// `npm run check`; scripts/supervisor/poll.mjs runs the same projection every
// cycle against the listing it already fetches.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { workerListAll } from '../api/orca/worker-list.mjs';
import { workerTerminalHandles, distinctRuns } from '../lib/worker-accounting.mjs';
import { readSupervisor } from '../machine/home.mjs';
import { openWorkerHandles } from '../supervisor/workers.mjs';
import { parseJson } from '../lib/json.mjs';
import { jobTerminalHandles, ledgerJobs, kernelSignalRows, pathUnder, WORKER_HOLDING_STATUSES } from '../machine/terminal-ledger.mjs';

export const SCHEMA = 'starci/orca-tree-check@1';
export const FINDING_CODES = ['DUPLICATE_KERNEL', 'ORPHAN_TERMINAL', 'STRAY_TERMINAL', 'DEAD_KERNEL', 'TITLE_DRIFT', 'TASK_OUTSIDE_RUN'];


const parse = parseJson;

/**
 * The terminals of a `terminal list` receipt, whichever envelope it arrives in:
 * the wrapper's {ok, terminals}, the raw Orca {result:{terminals}}, or a bare
 * array. A terminal is live unless it says otherwise.
 */
export function readTerminals(source) {
  const rows = Array.isArray(source) ? source
    : Array.isArray(source?.terminals) ? source.terminals
      : Array.isArray(source?.result?.terminals) ? source.result.terminals : null;
  if (!rows) return null;
  return rows.map((t) => ({
    handle: t?.handle ?? t?.id ?? t?.terminal ?? null,
    title: t?.title ?? t?.displayName ?? t?.display_name ?? t?.name ?? null,
    live: t?.connected !== false && t?.closed !== true && t?.status !== 'exited',
    ...((t?.worktreePath ?? t?.worktree_path ?? t?.cwd) ? { worktreePath: t.worktreePath ?? t.worktree_path ?? t.cwd } : {}),
  })).filter((t) => t.handle);
}

const runIdOf = (payload) => payload?.orca?.runId ?? payload?.managed?.runId ?? payload?.hierarchy?.runtime?.runId ?? null;

/** The rows of a worker-list receipt, whichever envelope it arrives in (the wrapper's, the raw Orca one, a bare array), or null. */
export function readWorkers(source) {
  const rows = Array.isArray(source) ? source : Array.isArray(source?.workers) ? source.workers : Array.isArray(source?.result?.workers) ? source.result.workers : null;
  return rows;
}

/** The Orca Runs this ledger's jobs name. */
export const ledgerRuns = (db) => distinctRuns(ledgerJobs(db).map((job) => runIdOf(job.payload)));

/**
 * The ledger's side of the tree: one entry per non-finished workflow plus the
 * handles every job of the ledger names (finished workflows included — a
 * terminal they own is bound, not orphaned).
 */
export function projectLedger(db) {
  // SELECT *: an older read-only ledger has no display_name column.
  const workflows = db.prepare('SELECT * FROM workflows ORDER BY workflow_id').all();
  const signals = new Map(kernelSignalRows(db).map((row) => [row.key, row.value.terminal ?? null]));
  const jobs = ledgerJobs(db);
  const boundHandles = new Set();
  const knownHandles = new Set();
  for (const job of jobs) {
    for (const handle of jobTerminalHandles(job, job.payload)) {
      knownHandles.add(handle);
      if (WORKER_HOLDING_STATUSES.includes(job.status)) boundHandles.add(handle);
    }
  }
  for (const terminal of signals.values()) if (terminal) knownHandles.add(terminal);
  return {
    jobs,
    boundHandles,
    knownHandles,
    workflows: workflows.map((w) => {
      const kernelJob = jobs.find((j) => j.kind === 'kernel' && j.workflow_id === w.workflow_id) ?? null;
      return {
        workflowId: w.workflow_id,
        phase: w.phase,
        finished: w.phase === 'finished',
        signalTerminal: signals.get(w.workflow_id) ?? null,
        kernelTerminal: kernelJob?.worker_id ?? null,
        runId: runIdOf(kernelJob?.payload),
      };
    }),
  };
}

/** The terminals the open [Worker] jobs own (machine.sqlite sup_jobs; empty when there is no store yet). */
export const supervisorWorkerHandles = ({ env = process.env } = {}) => readSupervisor((m) => openWorkerHandles(m), new Set(), { env });

/** Every finding the ledger and the listing disagree on, in code order. */
// The owner reads the Orca sidebar: every live terminal in a project must be
// a [Kernel] or an [Op] of a live job, named so. Agent CLIs overwrite titles
// and settled workers linger; TITLE_DRIFT and STRAY_TERMINAL make both visible
// to the supervisor (modules/supervisor/supervise.yaml form checks).
const underRepo = pathUnder;
export function orcaTreeFindings(db, terminals, { repo = null, owned = null, workers: workerRows = [] } = {}) {
  const workers = owned ?? supervisorWorkerHandles();
  // The terminals Orca accounts for as workers of this ledger's Runs (the caller lists those Runs).
  const orcaWorkers = workerTerminalHandles(workerRows ?? []);
  const listing = terminals ?? [];
  const live = listing.filter((t) => t.live);
  const byHandle = new Map(listing.map((t) => [t.handle, t]));
  const { jobs, boundHandles, knownHandles, workflows } = projectLedger(db);
  const findings = [];
  const kernelSignals = new Set(workflows.filter((w) => !w.finished && w.signalTerminal).map((w) => w.signalTerminal));

  for (const wf of workflows) {
    if (wf.finished) continue;
    // A live terminal is this workflow's kernel when the ledger says so: its
    // signal or its kernel job's worker. A tab title proves nothing.
    const kernels = live.filter((t) => t.handle === wf.signalTerminal || t.handle === wf.kernelTerminal);
    if (kernels.length > 1) {
      findings.push({ code: 'DUPLICATE_KERNEL', workflowId: wf.workflowId, terminals: kernels.map((t) => t.handle),
        detail: `${kernels.length} live kernel terminals for one workflow: ${kernels.map((t) => t.handle).join(', ')}` });
    } else if (wf.signalTerminal && wf.kernelTerminal && wf.signalTerminal !== wf.kernelTerminal) {
      findings.push({ code: 'DUPLICATE_KERNEL', workflowId: wf.workflowId,
        terminals: [wf.signalTerminal, wf.kernelTerminal],
        detail: `kernel signal terminal ${wf.signalTerminal} is not the kernel job's worker_id ${wf.kernelTerminal}` });
    }
    if (wf.signalTerminal && !byHandle.get(wf.signalTerminal)?.live) {
      findings.push({ code: 'DEAD_KERNEL', workflowId: wf.workflowId, terminal: wf.signalTerminal,
        detail: byHandle.has(wf.signalTerminal)
          ? `kernel signal terminal ${wf.signalTerminal} is listed but not live`
          : `kernel signal terminal ${wf.signalTerminal} is not in the terminal listing` });
    }
  }

  // A terminal a DUPLICATE_KERNEL already names is that finding, not a second
  // one: the answer is to close the loser, and it is already on the report.
  const named = new Set(findings.flatMap((f) => f.terminals ?? []));
  for (const terminal of live) {
    // Ours: a handle this ledger names, or a worker Orca accounts for in one of
    // this ledger's Runs. Several ledgers share one Orca host: another
    // project's worker is in another Run.
    const ours = knownHandles.has(terminal.handle) || orcaWorkers.has(terminal.handle);
    if (!ours || workers.has(terminal.handle) || named.has(terminal.handle) || boundHandles.has(terminal.handle) || kernelSignals.has(terminal.handle)) continue;
    const owner = jobs.find((job) => jobTerminalHandles(job, job.payload).includes(terminal.handle)) ?? null;
    findings.push({ code: 'ORPHAN_TERMINAL', workflowId: owner?.workflow_id ?? null, terminal: terminal.handle,
      ...(owner ? { jobId: owner.job_id } : {}),
      detail: owner
        ? `terminal ${terminal.handle} is live but its job ${owner.job_id} is ${owner.status}`
        : `terminal ${terminal.handle} (${terminal.title ?? 'untitled'}) is a live Orca worker of this ledger's Run that no job holds` });
  }

  // Names: the sidebar shows the tab title Orca set at creation (--title) or
  // by terminal rename; `terminal list`'s `title` is the pane title the agent
  // CLI rewrites on every turn, so it is never compared. A managed worker gets
  // its [Op] tab title only through the rename after dispatch-show, whose
  // receipt the job keeps (payload.managed.terminalTitle): a live job whose
  // rename did not apply is the unnamed worker-task_<id> row the owner saw.
  const liveJobHandles = new Set(jobs.filter((job) => job.kind !== 'kernel' && ['running', 'answering', 'leased'].includes(job.status)).flatMap((job) => jobTerminalHandles(job, job.payload)));
  for (const job of jobs) {
    if (job.kind === 'kernel' || !['running', 'answering'].includes(job.status)) continue;
    const rename = job.payload?.managed?.terminalTitle;
    if (!rename || rename.ok === true) continue;
    const handle = job.payload?.managed?.assignee ?? jobTerminalHandles(job, job.payload)[0] ?? null;
    if (handle && !byHandle.get(handle)?.live) continue;
    findings.push({ code: 'TITLE_DRIFT', workflowId: job.workflow_id, terminal: handle, jobId: job.job_id,
      expected: rename.title ?? `[Op] ${job.op_id}`,
      detail: `op worker ${handle} of ${job.job_id} never got its tab title "${rename.title ?? ''}"${rename.error ? ` (${String(rename.error).slice(0, 120)})` : ''}` });
  }
  // Placement: a live terminal in this project's worktree that is neither a
  // live kernel nor a live job's worker is stray (a settled worker, a leftover
  // shell, an old kernel) and does not belong in the sidebar. An open job's
  // [Worker] belongs there.
  const reported = new Set(findings.map((f) => f.terminal).filter(Boolean));
  const kernelsLive = new Set(workflows.filter((w) => !w.finished).flatMap((w) => [w.signalTerminal, w.kernelTerminal]).filter(Boolean));
  for (const t of live) {
    if (!underRepo(t.worktreePath, repo) || kernelsLive.has(t.handle) || liveJobHandles.has(t.handle) || workers.has(t.handle)) continue;
    if (reported.has(t.handle) && findings.some((f) => f.terminal === t.handle && f.code === 'ORPHAN_TERMINAL')) continue;
    findings.push({ code: 'STRAY_TERMINAL', workflowId: null, terminal: t.handle,
      detail: `terminal ${t.handle} ("${t.title ?? 'untitled'}") is live in this project but is no live kernel or op worker` });
  }

  const currentRun = new Map(workflows.map((w) => [w.workflowId, w.runId]));
  for (const job of jobs) {
    if (job.kind === 'kernel') continue;
    const payload = job.payload;
    const runId = runIdOf(payload);
    const expected = currentRun.get(job.workflow_id) ?? null;
    if (!runId || !expected || runId === expected) continue;
    if (payload?.taskClosed?.ok === true) continue;
    findings.push({ code: 'TASK_OUTSIDE_RUN', workflowId: job.workflow_id, jobId: job.job_id,
      taskId: payload?.orca?.taskId ?? payload?.managed?.taskId ?? null, runId, expectedRunId: expected,
      detail: `job ${job.job_id} holds an open Task in run ${runId}; the workflow's run is ${expected}` });
  }

  return findings.sort((a, b) => FINDING_CODES.indexOf(a.code) - FINDING_CODES.indexOf(b.code)
    || String(a.workflowId).localeCompare(String(b.workflowId)));
}

export const formatFinding = (f) => `${f.code} ${f.workflowId ?? '-'}: ${f.detail}`;

/* ------------------------------------------------------------------- cli */
const usage = (message) => {
  process.stderr.write(`${message}\n\nUsage: node scripts/checks/check-orca-tree.mjs --repo <ledger owner> (--terminals <json> | --live) [--json]\n`);
  process.exit(2);
};

function main(argv) {
  const value = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const has = (name) => argv.includes(`--${name}`);
  const repo = value('repo');
  const file = value('terminals');
  const workersFile = value('workers');
  if (!repo) usage('check-orca-tree: --repo <ledger owner> is required');
  if (!file && !has('live')) usage('check-orca-tree: pass --terminals <json file> or --live');
  if (file && has('live')) usage('check-orca-tree: --terminals and --live are two answers to one question');
  if (workersFile && !file) usage('check-orca-tree: --workers goes with --terminals (--live lists the workers itself)');

  let terminals, workers = [];
  if (file) {
    if (!fs.existsSync(file)) usage(`check-orca-tree: no terminal listing at ${file}`);
    terminals = readTerminals(parse(fs.readFileSync(file, 'utf8')));
    if (!terminals) usage(`check-orca-tree: ${file} holds no terminal listing (expected a terminal-list --json receipt)`);
    if (workersFile) {
      if (!fs.existsSync(workersFile)) usage(`check-orca-tree: no worker listing at ${workersFile}`);
      workers = readWorkers(parse(fs.readFileSync(workersFile, 'utf8')));
      if (!workers) usage(`check-orca-tree: ${workersFile} holds no worker listing (expected a worker-list --json receipt)`);
    }
  } else {
    const listed = terminalList({});
    if (!listed.ok) usage(`check-orca-tree: terminal-list failed: ${listed.error ?? 'no listing'}`);
    terminals = readTerminals(listed) ?? [];
  }

  const ledgerFile = ledgerFileFor(path.resolve(repo));
  if (!fs.existsSync(ledgerFile)) usage(`check-orca-tree: no ledger at ${ledgerFile}`);
  const ledger = inspectLedger({ file: ledgerFile });
  let findings;
  try {
    if (!file) {
      for (const run of ledgerRuns(ledger.db)) {
        const listed = workerListAll({ run });
        if (!listed.ok) usage(`check-orca-tree: WORKER_LIST_UNAVAILABLE: worker-list --run ${run} failed: ${listed.error ?? 'no listing'}`);
        workers.push(...listed.workers);
      }
    }
    findings = orcaTreeFindings(ledger.db, terminals, { repo: path.resolve(repo), workers });
  } finally { ledger.close(); }

  if (has('json')) console.log(JSON.stringify({ schema: SCHEMA, ok: findings.length === 0, terminals: terminals.length, findings }, null, 2));
  else if (findings.length) console.log(findings.map(formatFinding).join('\n'));
  else console.log(`OK: the Orca tree matches the ledger (${terminals.length} terminals listed).`);
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2));
