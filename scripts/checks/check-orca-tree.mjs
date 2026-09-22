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
//   TASK_OUTSIDE_RUN   a job whose Orca Run is not the workflow's current Run,
//                      so its Task hangs outside the workflow's tree
//
// Only StarCi's own terminals are in scope: a handle the ledger names, or a
// title the kernel wrote ([Kernel] … / [Op] …). An owner's own terminals are
// never findings.
//
//   node scripts/checks/check-orca-tree.mjs --repo <ledger owner>
//        (--terminals <terminal-list --json receipt> | --live) [--json]
//
// Exit 0 clean, 1 findings, 2 usage. It needs a ledger, so it is not part of
// `npm run check`; scripts/supervisor/poll.mjs runs the same projection every
// cycle against the listing it already fetches.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectLedger, ledgerFileFor, JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';

export const SCHEMA = 'starci/orca-tree-check@1';
export const FINDING_CODES = ['DUPLICATE_KERNEL', 'ORPHAN_TERMINAL', 'DEAD_KERNEL', 'TASK_OUTSIDE_RUN'];

// A job holding a worker: the dispatchable states minus the ones that hold no
// agent yet (queued) or hold only a fence (leased).
const HOLDS_A_WORKER = JOB_STATUSES.dispatchable.filter((s) => s === 'running' || s === 'answering');
const KERNEL_TITLE = /^\[Kernel\]\s*(.*)$/;
const STARCI_TITLE = /^\[(?:Kernel|Op)\]\s/;

const parse = (text) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };

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
  })).filter((t) => t.handle);
}

const payloadOf = (row) => parse(row?.payload_json) ?? {};
const runIdOf = (payload) => payload?.orca?.runId ?? payload?.managed?.runId ?? payload?.hierarchy?.runtime?.runId ?? null;
const handlesOf = (row) => {
  const payload = payloadOf(row);
  return [row?.worker_id, payload?.orca?.agentTerminalHandle, payload?.managed?.agentTerminalHandle,
    payload?.hierarchy?.runtime?.terminalHandle].filter(Boolean);
};

/**
 * The ledger's side of the tree: one entry per non-finished workflow plus the
 * handles every job of the ledger names (finished workflows included — a
 * terminal they own is bound, not orphaned).
 */
export function projectLedger(db) {
  const workflows = db.prepare('SELECT workflow_id, phase FROM workflows ORDER BY workflow_id').all();
  const signals = new Map(db.prepare("SELECT key, value_json FROM signals WHERE scope='kernel'").all()
    .map((row) => [row.key, parse(row.value_json)?.terminal ?? null]));
  const jobs = db.prepare('SELECT job_id, workflow_id, op_id, kind, status, worker_id, payload_json FROM jobs').all();
  const boundHandles = new Set();
  const knownHandles = new Set();
  for (const job of jobs) {
    for (const handle of handlesOf(job)) {
      knownHandles.add(handle);
      if (HOLDS_A_WORKER.includes(job.status)) boundHandles.add(handle);
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
        runId: runIdOf(payloadOf(kernelJob)),
      };
    }),
  };
}

/** Every finding the ledger and the listing disagree on, in code order. */
export function orcaTreeFindings(db, terminals) {
  const listing = terminals ?? [];
  const live = listing.filter((t) => t.live);
  const byHandle = new Map(listing.map((t) => [t.handle, t]));
  const { jobs, boundHandles, knownHandles, workflows } = projectLedger(db);
  const findings = [];
  const kernelSignals = new Set(workflows.filter((w) => !w.finished && w.signalTerminal).map((w) => w.signalTerminal));

  for (const wf of workflows) {
    if (wf.finished) continue;
    // A live terminal is this workflow's kernel when the ledger says so, or
    // when the kernel itself wrote the title at creation.
    const kernels = live.filter((t) => t.handle === wf.signalTerminal || t.handle === wf.kernelTerminal
      || KERNEL_TITLE.exec(t.title ?? '')?.[1]?.trim() === wf.workflowId);
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
    const ours = knownHandles.has(terminal.handle) || STARCI_TITLE.test(terminal.title ?? '');
    if (!ours || named.has(terminal.handle) || boundHandles.has(terminal.handle) || kernelSignals.has(terminal.handle)) continue;
    const owner = jobs.find((job) => handlesOf(job).includes(terminal.handle)) ?? null;
    findings.push({ code: 'ORPHAN_TERMINAL', workflowId: owner?.workflow_id ?? null, terminal: terminal.handle,
      ...(owner ? { jobId: owner.job_id } : {}),
      detail: owner
        ? `terminal ${terminal.handle} is live but its job ${owner.job_id} is ${owner.status}`
        : `terminal ${terminal.handle} (${terminal.title ?? 'untitled'}) is live and belongs to no job` });
  }

  const currentRun = new Map(workflows.map((w) => [w.workflowId, w.runId]));
  for (const job of jobs) {
    if (job.kind === 'kernel') continue;
    const payload = payloadOf(job);
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
  if (!repo) usage('check-orca-tree: --repo <ledger owner> is required');
  if (!file && !has('live')) usage('check-orca-tree: pass --terminals <json file> or --live');
  if (file && has('live')) usage('check-orca-tree: --terminals and --live are two answers to one question');

  let terminals;
  if (file) {
    if (!fs.existsSync(file)) usage(`check-orca-tree: no terminal listing at ${file}`);
    terminals = readTerminals(parse(fs.readFileSync(file, 'utf8')));
    if (!terminals) usage(`check-orca-tree: ${file} holds no terminal listing (expected a terminal-list --json receipt)`);
  } else {
    const listed = terminalList({});
    if (!listed.ok) usage(`check-orca-tree: terminal-list failed: ${listed.error ?? 'no listing'}`);
    terminals = readTerminals(listed) ?? [];
  }

  const ledgerFile = ledgerFileFor(path.resolve(repo));
  if (!fs.existsSync(ledgerFile)) usage(`check-orca-tree: no ledger at ${ledgerFile}`);
  const ledger = inspectLedger({ file: ledgerFile });
  let findings;
  try { findings = orcaTreeFindings(ledger.db, terminals); } finally { ledger.close(); }

  if (has('json')) console.log(JSON.stringify({ schema: SCHEMA, ok: findings.length === 0, terminals: terminals.length, findings }, null, 2));
  else if (findings.length) console.log(findings.map(formatFinding).join('\n'));
  else console.log(`OK: the Orca tree matches the ledger (${terminals.length} terminals listed).`);
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main(process.argv.slice(2));
