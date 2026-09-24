#!/usr/bin/env node
// tick.mjs — ONE [Supervisor] tick (modules/supervisor/supervise.yaml loop + kernelSeat): the Supervisor kernel
// runs it when its watchdog wakes it with [tick] (every config.yaml supervisor.pollIntervalMs).
//
//   node scripts/supervisor/tick.mjs [--repo <path>]... [--no-push] [--json]
//
// Prints, per product ledger, the poll digest (scripts/supervisor/poll.mjs cycle, read-only), then the OWED items
// of every ledger clustered by root cause (scripts/supervisor/cluster.mjs) with each cluster's open/fixed-by
// state and whether a [Worker] job already owns it, the worker board and land queue (scripts/supervisor/workers.mjs,
// land.mjs), and pushes main of the runtime and each product repository (scripts/supervisor/push-mains.mjs:
// secret scan first, hooks on). It records one `supervisor-tick` event (OWED count, clusters, pushes) that
// /status reads for the OWED trend. It decides nothing: the Supervisor acts on what it prints.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { cycle } from './poll.mjs';
import { clusterOwed, clusterLine } from './cluster.mjs';
import { workerBoard, jobsOf, OPEN_STATUSES } from './workers.mjs';
import { landStatus } from './land.mjs';
import { pushMains, describePush } from './push-mains.mjs';
import { heartbeatSupervisor, getSupervisor, readInbox } from '../connectors/telegram-bridge.mjs';
import { SUPERVISOR_ID, openSupervisorLedger, supervisorEvent, supervisorSettings, productRepos, supervisorLog } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);

/** The poll digest of one ledger, read-only: {repo, text, owed}. Never throws. */
export async function digestOf(repo, { cycleFn = cycle } = {}) {
  let handle = null;
  try {
    handle = inspectLedger({ file: ledgerFileFor(repo) });
    const lastReportId = handle.db.prepare('SELECT COALESCE(MAX(report_id),0) m FROM reports').get().m;
    const state = { lastReportId, lastArtifacts: Date.now() - 10 * 60_000, first: true };
    const out = await cycleFn(handle.db, { repo, state });
    return { repo, text: out.text, owed: out.owed ?? [], workflows: out.workflows?.length ?? 0 };
  } catch (error) {
    return { repo, text: `===== ${path.basename(repo)}: digest failed: ${String(error?.message ?? error).slice(0, 200)}`, owed: [], error: true };
  } finally { try { handle?.close(); } catch { /* closed */ } }
}

/** The whole tick. Seams: `digest`, `push`, `env`. Returns {digests, clusters, owed, board, land, pushes, lines}. */
export async function runTick({ repos = null, push = true, env = process.env, digest = digestOf, pushFn = pushMains, now = Date.now } = {}) {
  const settings = supervisorSettings();
  const list = repos ?? productRepos(settings);
  const digests = [];
  for (const repo of list) digests.push(await digest(repo));
  const owed = digests.flatMap((d) => d.owed.map((i) => ({ ...i, repo: d.repo })));
  const clusters = clusterOwed(owed);
  const ledger = openSupervisorLedger({ env });
  let board, openJobs;
  try {
    board = workerBoard(ledger.db, { now: now() });
    openJobs = jobsOf(ledger.db, OPEN_STATUSES);
  } finally { ledger.close(); }
  const owner = new Map(openJobs.map((j) => [j.payload.cluster, j.job_id]));
  const land = landStatus({ env });
  const pushes = push ? pushFn({ env }) : [];
  const unread = readInbox(SUPERVISOR_ID, env).filter((m) => !m.read).length;
  const w = openSupervisorLedger({ env });
  try {
    w.transaction(() => supervisorEvent(w, { entityType: 'tick', kind: 'supervisor-tick', now: now(), payload: {
      owed: owed.length, clusters: clusters.length, open: clusters.filter((c) => !c.fixedBy).length, repos: list,
      pushes: pushes.map((p) => ({ repo: p.repo, pushed: p.pushed, skipped: p.skipped ?? null, refused: p.refused ?? null, error: p.error ? String(p.error).slice(0, 120) : null })),
      workers: board.active.length, landQueue: board.reported.length } }));
  } finally { w.close(); }
  // The kernel runs this in its own terminal: a tick is also its heartbeat on the channel.
  try { const sup = getSupervisor(SUPERVISOR_ID, env); if (sup && (!sup.terminal || sup.terminal === env.ORCA_TERMINAL_HANDLE)) heartbeatSupervisor(SUPERVISOR_ID, { env }); } catch { /* best effort */ }

  const lines = [`===== [Supervisor] tick ${new Date(now()).toISOString()} =====`];
  for (const d of digests) lines.push(d.text);
  lines.push(`----- OWED ${owed.length} item(s) in ${clusters.length} cluster(s) -----`);
  for (const c of clusters) {
    lines.push(`${clusterLine(c)}${owner.has(c.id) ? ` [job ${owner.get(c.id)}]` : ''}`);
    for (const i of c.items.slice(0, 6)) lines.push(`    ${i.line ?? `${i.workflowId} ${i.incidentId ?? i.key}`}`);
    if (c.items.length > 6) lines.push(`    ... ${c.items.length - 6} more`);
    if (c.items[0]?.action) lines.push(`    action: ${c.items[0].action}`);
  }
  lines.push(`----- workers: ${board.active.length} active, ${board.queued.length} queued, land queue ${board.reported.length}${land.busy ? ` (landing ${land.current?.jobId ?? 'a commit'})` : ''} -----`);
  for (const j of [...board.active, ...board.queued, ...board.reported]) lines.push(`  ${j.jobId} [${j.status}] ${j.cluster} ${j.agent ?? '-'} ${j.ageMin}m`);
  if (push) { lines.push('----- push main -----'); for (const p of pushes) lines.push(`  ${describePush(p)}`); }
  lines.push(`----- inbox: ${unread} unread -----`);
  lines.push('Close every OWED cluster THIS tick (supervise.yaml step owed): verify fixed-by and notify, or one worker job per open cluster, or fix/rule it yourself. Then report and yield.');
  return { digests, clusters, owed, board, land, pushes, unread, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const r = await runTick({ repos: repos.length ? repos : null, push: !argv.includes('--no-push') });
  supervisorLog('tick', `owed=${r.owed.length} clusters=${r.clusters.length} workers=${r.board.active.length} pushes=${r.pushes.map((p) => (p.pushed ? 'ok' : p.skipped ? 'skip' : 'X')).join('')}`);
  if (argv.includes('--json')) console.log(JSON.stringify({ owed: r.owed.length, clusters: r.clusters.map(({ items, ...c }) => ({ ...c, items: items.map((i) => i.line) })), board: r.board, land: r.land, pushes: r.pushes, unread: r.unread }));
  else console.log(r.lines.join('\n'));
  process.exit(0);
}
