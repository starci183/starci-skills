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
//   TASK_OUTSIDE_RUN   a live job whose Orca Run is not the workflow's current Run,
//                      so its Task hangs outside the workflow's tree (a settled job's
//                      Task settled with its Dispatch: worker_done or settle's fence)
//
// ORPHAN_TERMINAL covers only StarCi's own terminals: a handle the ledger names, or
// a worker Orca accounts for in one of this ledger's Runs (orchestration
// worker-list, every row not released). A tab title proves nothing. An owner's
// own terminals are never findings, and neither is a live [Worker] of an open
// Supervisor job: it runs in the runtime project's worktree
// (scripts/supervisor/workers.mjs) and its job lives in machine.sqlite
// (sup_jobs), not in the ledger checked here.
//
//   starci runtime check --only orca-tree -- --repo <ledger owner>
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
import { isMain } from '../lib/is-main.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { workerListAll } from '../machine/worker-list-all.mjs';
import { parseJson } from '../lib/json.mjs';
import { SCHEMA, readTerminals, readWorkers, ledgerRuns, orcaTreeFindings, formatFinding } from '../supervisor/orca-tree.mjs';

/* ------------------------------------------------------------------- cli */
const usage = (message) => {
  process.stderr.write(`${message}\n\nUsage: starci runtime check --only orca-tree -- --repo <ledger owner> (--terminals <json> | --live) [--json]\n`);
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
    terminals = readTerminals(parseJson(fs.readFileSync(file, 'utf8')));
    if (!terminals) usage(`check-orca-tree: ${file} holds no terminal listing (expected a terminal-list --json receipt)`);
    if (workersFile) {
      if (!fs.existsSync(workersFile)) usage(`check-orca-tree: no worker listing at ${workersFile}`);
      workers = readWorkers(parseJson(fs.readFileSync(workersFile, 'utf8')));
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

if (isMain(import.meta.url)) main(process.argv.slice(2));
