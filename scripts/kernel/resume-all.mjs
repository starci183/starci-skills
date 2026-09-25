#!/usr/bin/env node
// resume-all.mjs — bring every durable workflow on this host back after a
// shutdown or reboot, with no human.
//
// The ledger (<repo>/.starciwork/runtime.sqlite) is the whole workflow state;
// what a reboot loses is the processes around it: Orca drops every terminal
// (kernels and op workers) and nothing restarts the watchdogs. This script
// restarts the watchdogs; each watchdog's --repair relaunches its dead Kernel
// from the ledger (start-workflow.mjs), and the Kernel recovers every op whose
// terminal died (api reconcile --dead-worker, frontier worker-dead).
//
//   node scripts/kernel/resume-all.mjs [--repo <path>]... [--wait-orca]
//       [--wait-orca-ms <ms>] [--dedupe | --no-dedupe] [--dry-run] [--json]
//   node scripts/kernel/resume-all.mjs --install-startup [--apply] [--json]
//
// For every running, unarchived workflow of every product ledger it makes sure
// one watchdog loop is alive (a node process whose command line runs
// watchdog.mjs for `--workflow <id>`, not a per-tick `--once` child). A missing
// one starts detached with --repair, logging to
// %LOCALAPPDATA%/StarCi/runtime/watchdog-logs/<workflow>.log. It never starts a
// second one and never stops one: a workflow with two loops is reported as
// `duplicate`. When config.yaml connectors.cloudflare.mode is not off it also
// runs `ask-gateway.mjs start` and `tunnel.mjs start` for whichever is not
// already running (each connector's own liveness test; both are single-instance).
// It also makes sure the Telegram command bridge (connectors/telegram-bridge.mjs)
// runs when connectors.telegram is ready and a supervisor has registered
// (scripts/supervisor/channel.mjs register) — best effort, never fails the pass.
// And it launches scripts/supervisor/stall-alert.mjs detached for the same
// ledgers (unless one is still running): the progress check that routes each
// stall finding with no chat involved - a `[stall]` wake into the owning
// workflow's Kernel first, the supervisor's channel inbox only when that
// self-heal fails, and the owner on Telegram only for what waits on the owner
// (one digest an hour at most) — best effort as well.
//
// And the ONE [Supervisor] kernel (scripts/supervisor/start-supervisor.mjs ensureSupervisor): when its seat is
// enabled (start-supervisor ran, --stop did not follow), its watchdog loop is kept running (single: a host lock
// and a process-table check); that loop replaces a dead Supervisor itself. It never starts a disabled seat, and in
// config.yaml supervisor.mode chat (the default: the owner's desktop chat is the Supervisor) it starts nothing at all.
//
// Post-reboot dedupe (scripts/kernel/terminal-dedupe.mjs): Orca restores its
// previous tabs when it opens, old kernel sessions with their history
// included, and each would act as a second kernel beside the one its watchdog
// starts. Once Orca answers and before any watchdog starts, every terminal in
// the resumed repos' worktrees that no ledger binds and that is a bare shell or
// a StarCi agent session ([Kernel]/[Op]/kernel/op-<kind>-<hex>/qwen-code) is
// quit and closed. It runs when this pass has watchdogs to start (a reboot) or
// with --dedupe, never with --no-dedupe; what it closed is in the JSON
// (`dedupe`) and appended to watchdog-logs/resume-all.log. Kernel jobs of
// finished or archived workflows are reported (`orphanKernelJobs`) for
// `api reconcile --orphan-kernel-jobs`.
//
// Idempotent: safe to run every few minutes. Watchdogs start only once Orca
// answers a terminal listing — a watchdog that finds Orca down would try to
// relaunch its Kernel into nothing. --wait-orca retries that probe with backoff
// for up to --wait-orca-ms (default 10 minutes), for the logon run that races
// Orca's own start; without it one failed probe skips the watchdogs this run.
//
// Ledgers: exactly config.yaml supervisor.repos (relative to the source root)
// plus every --repo, each kept only when it holds a ledger. Nothing is
// discovered, so a ledger nobody listed (an old test workflow in the skill's
// own checkout) is never revived.
//
// --install-startup prints the Windows Task Scheduler commands that run this
// script at logon (--wait-orca) and every 10 minutes; --apply creates them.
// Creating a scheduled task is the owner's decision: nothing is created
// without --apply.

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isRuntimeRoot, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { connectorsConfig, loadConfig } from '../../engine/config.mjs';
import { lockHolder, sourceRootOf, spawnDetached, withLedgerRead } from '../connectors/lib.mjs';
import { gatewayAlive } from '../connectors/ask-gateway.mjs';
import { managerAlive } from '../connectors/tunnel.mjs';
import { ensureTelegramBridge } from '../connectors/telegram-bridge.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { dedupeTerminals, describeDedupe } from './terminal-dedupe.mjs';
import { orphanKernelJobs } from '../supervisor/poll.mjs';
import { watchdogLogFile } from './watchdog-log.mjs';
import { ensureSupervisor } from '../supervisor/start-supervisor.mjs';

const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..');
const watchdogFile = path.join(skillRoot, 'scripts', 'kernel', 'watchdog.mjs');
const connectorScripts = ['ask-gateway.mjs', 'tunnel.mjs'].map((name) => path.join(skillRoot, 'scripts', 'connectors', name));
const stallAlertFile = path.join(skillRoot, 'scripts', 'supervisor', 'stall-alert.mjs');

export const DEFAULT_WAIT_ORCA_MS = 600_000;
const LOG_CAP_BYTES = 5 * 1024 * 1024;

/**
 * The product ledgers to resume: exactly config.yaml supervisor.repos (relative entries resolve
 * against the source root) plus the --repo paths. Nothing is discovered: a ledger nobody listed -
 * the skill's own checkout holding an old test workflow - is never revived. {repos, missing, configError?}:
 * `missing` names listed paths that hold no ledger; `configError` says why config.yaml could not be read.
 */
export function resumeRepos({ config = null, env = process.env, extra = [] } = {}) {
  let listed = [], configError = null;
  try { listed = (config ?? loadConfig())?.supervisor?.repos ?? []; } catch (error) { configError = String(error?.message ?? error); }
  const source = sourceRootOf(env);
  const seen = new Set(), repos = [], missing = [];
  for (const repo of [...(listed ?? []).map((r) => path.resolve(source, r)), ...extra.map((r) => path.resolve(r))]) {
    const key = process.platform === 'win32' ? repo.toLowerCase() : repo;
    if (seen.has(key)) continue;
    seen.add(key);
    let ledger = false;
    try { ledger = !isRuntimeRoot(repo) && fs.existsSync(ledgerFileFor(repo)); } catch { ledger = false; }
    (ledger ? repos : missing).push(repo);
  }
  return { repos, missing, ...(configError ? { configError } : {}) };
}

/** Running, unarchived workflows of one ledger, read-only. */
export function runningWorkflows(repo) {
  return withLedgerRead(repo, (db) => db.prepare(
    "SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id",
  ).all().map((row) => ({ workflowId: row.workflow_id, repo })), []);
}

const argValue = (line, name) => {
  const match = new RegExp(`(?:^|\\s)--${name}\\s+(?:"([^"]*)"|(\\S+))`).exec(line);
  return match ? (match[1] ?? match[2]) : null;
};

/**
 * One watchdog process from `<pid>|<created>|<command line>`, or null for any
 * other process. `once` marks the per-tick child a watchdog loop spawns; only
 * loops count as a workflow's watchdog.
 */
export function parseWatchdogLine(line) {
  const text = String(line ?? '');
  const first = text.indexOf('|'), second = text.indexOf('|', first + 1);
  if (first < 0 || second < 0) return null;
  const pid = Number(text.slice(0, first)), created = Number(text.slice(first + 1, second)) || null;
  const commandLine = text.slice(second + 1).trim();
  if (!Number.isInteger(pid) || !/watchdog\.mjs/i.test(commandLine)) return null;
  const workflowId = argValue(commandLine, 'workflow') ?? argValue(commandLine, 'goal');
  if (!workflowId) return null;
  return {
    pid, created, workflowId, repo: argValue(commandLine, 'repo'), once: /(?:^|\s)--once(?:\s|$)/.test(commandLine), commandLine,
  };
}

/** Live watchdog processes on this host, or null when the process table cannot be read. */
export function listWatchdogs({ platform = process.platform, run = spawnSync } = {}) {
  const r = platform === 'win32'
    ? run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'watchdog\\.mjs' } | ForEach-Object { '{0}|{1}|{2}' -f $_.ProcessId, $_.CreationDate.ToFileTimeUtc(), $_.CommandLine }"],
    { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
    : run('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', timeout: 30_000 });
  if (r.status !== 0) return null;
  const lines = String(r.stdout ?? '').split(/\r?\n/).filter(Boolean);
  const rows = platform === 'win32' ? lines : lines.map((line) => line.trim().replace(/^(\d+)\s+/, '$1||'));
  return rows.map(parseWatchdogLine).filter(Boolean);
}

/** Which workflows need a watchdog: {start, present, duplicate} (watchdog loops only; a loop always runs --repair). */
export function planWatchdogs({ workflows, watchdogs }) {
  const loops = (watchdogs ?? []).filter((w) => !w.once);
  const plan = { start: [], present: [], duplicate: [] };
  for (const wf of workflows) {
    const mine = loops.filter((w) => w.workflowId === wf.workflowId);
    if (!mine.length) plan.start.push(wf);
    else if (mine.length === 1) plan.present.push({ ...wf, pid: mine[0].pid });
    else plan.duplicate.push({ ...wf, pids: mine.map((w) => w.pid) });
  }
  return plan;
}

// One log file per workflow, shared with the loop's own re-exec (scripts/kernel/watchdog-log.mjs).
export { watchdogLogFile };

/** Make the log's directory; a log past `cap` bytes moves to `<log>.1`, replacing the previous one. */
export function rotateLog(log, { cap = LOG_CAP_BYTES } = {}) {
  fs.mkdirSync(path.dirname(log), { recursive: true });
  try { if (fs.statSync(log).size > cap) fs.renameSync(log, `${log}.1`); } catch { /* no log yet */ }
  return log;
}

/** Start one watchdog loop detached with --repair, stdout/stderr appended to its log. */
export function spawnWatchdog({ workflowId, repo }, { env = process.env } = {}) {
  const log = rotateLog(watchdogLogFile(workflowId, env));
  fs.appendFileSync(log, `[resume-all ${new Date().toISOString()}] starting watchdog --repo ${repo} --workflow ${workflowId} --repair\n`);
  const fd = fs.openSync(log, 'a');
  try {
    const child = spawn(process.execPath, [watchdogFile, '--repo', repo, '--workflow', workflowId, '--repair'],
      { detached: true, stdio: ['ignore', fd, fd], windowsHide: true, cwd: skillRoot, env });
    child.unref();
    return { pid: child.pid ?? null, log };
  } finally { fs.closeSync(fd); }
}

/** Orca is up when it answers a terminal listing. */
export const orcaReady = () => {
  try { return terminalList().ok === true; } catch { return false; }
};

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Probe Orca until it answers, backing off 5s doubling to 60s, for at most waitMs. */
export function waitForOrca({ probe = orcaReady, waitMs = 0, sleep = sleepSync, now = Date.now } = {}) {
  const started = now();
  let attempts = 0, delay = 5_000;
  for (;;) {
    attempts += 1;
    if (probe()) return { ready: true, attempts, waitedMs: now() - started };
    const left = waitMs - (now() - started);
    if (left <= 0) return { ready: false, attempts, waitedMs: now() - started };
    sleep(Math.min(delay, left));
    delay = Math.min(delay * 2, 60_000);
  }
}

/** Run `node scripts/connectors/<name> start` (idempotent) and return its JSON answer. */
export function startConnector(script, { env = process.env } = {}) {
  const r = spawnSync(process.execPath, [script, 'start'], { cwd: skillRoot, encoding: 'utf8', windowsHide: true, timeout: 60_000, env });
  let answer = null;
  try { answer = JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { /* not json */ }
  return { script: path.basename(script), ok: r.status === 0 && answer?.ok !== false, ...(answer ?? { stdout: String(r.stdout ?? '').trim().slice(0, 300) }),
    ...(r.status !== 0 ? { stderr: String(r.stderr ?? '').trim().slice(0, 300) } : {}) };
}

/**
 * Launch the headless stall check (scripts/supervisor/stall-alert.mjs) detached over `repos`,
 * unless a run still holds its lock. Never throws; a spec run (NODE_TEST_CONTEXT) is a no-op.
 */
export function ensureStallAlert({ repos = [], env = process.env, spawn: spawnOne = spawnDetached, dryRun = false } = {}) {
  try {
    if (env.NODE_TEST_CONTEXT) return { ok: true, skipped: 'test context' };
    const live = lockHolder('stall-alert', env);
    if (live) return { ok: true, already: true, pid: live.pid };
    if (dryRun) return { ok: true, wouldStart: true };
    return { ok: true, launched: spawnOne(stallAlertFile, repos.flatMap((repo) => ['--repo', repo]), { env }) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

/** Kernel jobs of finished or archived workflows in `repos`, read-only (poll.mjs orphanKernelJobs). */
export const orphanKernelJobsOf = (repos) => repos.flatMap((repo) => withLedgerRead(repo, (db) => orphanKernelJobs(db), [])
  .map((o) => ({ repo, jobId: o.job_id, workflowId: o.workflow_id, status: o.status, terminal: o.worker_id ?? null, phase: o.phase, archived: Boolean(o.archived_at) })));

// The real pass talks to Orca: a spec run (NODE_TEST_CONTEXT) that did not inject one gets a no-op.
const defaultDedupe = (options) => (process.env.NODE_TEST_CONTEXT
  ? { ok: true, skipped: 'test context', closed: [], kept: [], deferred: [] } : dedupeTerminals(options));

/** One line per closed stray terminal in watchdog-logs/resume-all.log; never throws. */
export function logDedupe(dedupe, { env = process.env, now = new Date() } = {}) {
  try {
    if (!dedupe?.closed?.length || dedupe.dryRun) return null;
    const file = rotateLog(path.join(path.dirname(watchdogLogFile('x', env)), 'resume-all.log'));
    fs.appendFileSync(file, dedupe.closed.map((c) => `[resume-all ${now.toISOString()}] dedupe ${c.ok ? 'closed' : 'FAILED to close'} ${c.handle} (${c.kind}: ${c.marker ?? c.reason}; tab "${c.tabTitle ?? ''}"; ${c.repo})${c.error ? ` ${c.error}` : ''}\n`).join(''));
    return file;
  } catch { return null; }
}

/**
 * One resume pass. Every seam is injectable for the specs: the ledgers, the
 * process table, the spawner, the Orca probe, the connector starter and the
 * terminal dedupe. `dedupe`: 'auto' (only when watchdogs must start: a reboot),
 * true (always, once Orca answers) or false. A `configError` (resumeRepos) fails the pass.
 */
// Each connector's own liveness test: the state record's process (this boot) or its start lock.
const CONNECTOR_ALIVE = { 'ask-gateway.mjs': () => gatewayAlive(), 'tunnel.mjs': () => Boolean(managerAlive()) };

export function resumeAll({
  repos, missing = [], configError = null, workflowsOf = runningWorkflows, watchdogs = listWatchdogs, spawn: spawnOne = spawnWatchdog,
  probe = orcaReady, waitMs = 0, sleep = sleepSync, connectors = null, startOne = startConnector,
  connectorAlive = (script) => CONNECTOR_ALIVE[path.basename(script)]?.() === true, dryRun = false,
  ensureBridge = ensureTelegramBridge, stallAlert = ensureStallAlert,
  dedupe = 'auto', dedupeFn = defaultDedupe, orphansOf = orphanKernelJobsOf, logDedupeFn = logDedupe,
  supervisor = (options) => (process.env.NODE_TEST_CONTEXT ? { ok: true, skipped: 'test context' } : ensureSupervisor(options)),
} = {}) {
  const result = { ok: !configError, dryRun, repos, missing, ...(configError ? { configError } : {}), workflows: [], started: [], present: [], duplicate: [], connectors: [], telegramBridge: null, stallAlert: null, supervisor: null, orca: null, skipped: null, dedupe: null, orphanKernelJobs: [] };
  try { result.orphanKernelJobs = orphansOf(repos); } catch (error) { result.orphanKernelJobsError = String(error?.message ?? error); }
  // The stray-terminal pass runs once Orca answers and before any watchdog starts a kernel.
  const runDedupe = () => {
    try { result.dedupe = dedupeFn({ repos, dryRun }); } catch (error) { result.dedupe = { ok: false, error: String(error?.message ?? error), closed: [], kept: [], deferred: [] }; }
    result.dedupe.logFile = logDedupeFn(result.dedupe);
  };
  // The Telegram command bridge is best effort: its failure is reported, never fatal to the pass.
  try { result.telegramBridge = ensureBridge({ dryRun, requireRegistered: true }); } catch (error) { result.telegramBridge = { ok: false, error: String(error?.message ?? error) }; }
  // The [Supervisor] kernel's watchdog, when its seat is enabled: best effort, never fails the pass.
  try { result.supervisor = supervisor({ dryRun }); } catch (error) { result.supervisor = { ok: false, error: String(error?.message ?? error) }; }
  // The stall check is best effort too: it never fails the pass.
  try { result.stallAlert = stallAlert({ repos, dryRun }); } catch (error) { result.stallAlert = { ok: false, error: String(error?.message ?? error) }; }
  const cf = connectors ?? (() => { try { return connectorsConfig(); } catch { return null; } })();
  if (cf && cf.cloudflare?.mode && cf.cloudflare.mode !== 'off') {
    result.connectors = connectorScripts.map((script) => {
      if (connectorAlive(script)) return { script: path.basename(script), ok: true, already: true };
      return dryRun ? { script: path.basename(script), wouldStart: true } : startOne(script);
    });
    if (result.connectors.some((c) => c.ok === false)) result.ok = false;
  }
  result.workflows = repos.flatMap((repo) => workflowsOf(repo));
  const listed = watchdogs();
  if (listed == null) {
    result.ok = false;
    result.skipped = 'process-table-unreadable';
    return result;
  }
  const plan = planWatchdogs({ workflows: result.workflows, watchdogs: listed });
  result.present = plan.present;
  result.duplicate = plan.duplicate;
  const wantDedupe = dedupe === true || (dedupe === 'auto' && plan.start.length > 0);
  if (!plan.start.length && !wantDedupe) return result;
  result.orca = waitForOrca({ probe, waitMs, sleep });
  if (!result.orca.ready) {
    result.ok = false;
    result.skipped = 'orca-unavailable';
    result.pending = plan.start;
    return result;
  }
  if (wantDedupe) runDedupe();
  for (const wf of plan.start) {
    if (dryRun) { result.started.push({ ...wf, wouldStart: true }); continue; }
    try { result.started.push({ ...wf, ...spawnOne(wf) }); }
    catch (error) { result.ok = false; result.started.push({ ...wf, error: String(error?.message ?? error) }); }
  }
  return result;
}

/** The Task Scheduler commands that resume this host at logon and every 10 minutes. */
export function startupTasks({ node = process.execPath, script = path.join(skillRoot, 'scripts', 'kernel', 'resume-all.mjs') } = {}) {
  const run = (extra) => `"${node}" "${script}"${extra}`;
  return [
    { name: 'StarCi-Resume', trigger: 'at logon, waiting up to 10 minutes for Orca',
      argv: ['/Create', '/TN', 'StarCi-Resume', '/SC', 'ONLOGON', '/RL', 'LIMITED', '/TR', run(' --wait-orca'), '/F'] },
    { name: 'StarCi-Resume-Every10m', trigger: 'every 10 minutes while the owner is logged on',
      argv: ['/Create', '/TN', 'StarCi-Resume-Every10m', '/SC', 'MINUTE', '/MO', '10', '/RL', 'LIMITED', '/TR', run(''), '/F'] },
  ];
}

const quoteArg = (arg) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg);
export const renderSchtasks = (task) => `schtasks ${task.argv.map(quoteArg).join(' ')}`;

function installStartup({ apply, asJson }) {
  const tasks = startupTasks();
  if (process.platform !== 'win32') {
    const out = { ok: false, reason: 'not-windows', tasks: tasks.map((t) => ({ name: t.name, command: renderSchtasks(t) })) };
    console.log(asJson ? JSON.stringify(out) : 'install-startup creates Windows Task Scheduler tasks; this host is not Windows.');
    process.exitCode = 1;
    return;
  }
  const results = tasks.map((task) => {
    const entry = { name: task.name, trigger: task.trigger, command: renderSchtasks(task) };
    if (!apply) return entry;
    const r = spawnSync('schtasks.exe', task.argv, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    return { ...entry, created: r.status === 0, output: String(r.stdout || r.stderr || '').trim().slice(0, 400) };
  });
  const ok = !apply || results.every((r) => r.created);
  if (asJson) console.log(JSON.stringify({ ok, applied: apply, tasks: results }));
  else {
    console.log(apply ? 'Created Windows scheduled tasks:' : 'Would create these Windows scheduled tasks (re-run with --apply to create them):');
    for (const r of results) console.log(`  ${r.name} (${r.trigger})${apply ? (r.created ? ' - created' : ` - FAILED: ${r.output}`) : ''}\n    ${r.command}`);
    if (apply && !ok) console.log('An ONLOGON task can need an elevated prompt; the every-10-minutes task alone still resumes the host within 10 minutes of logon.');
  }
  if (!ok) process.exitCode = 1;
}

const describe = (result) => [
  `[resume-all] ${result.ok ? 'ok' : 'NOT OK'}${result.dryRun ? ' (dry run)' : ''}: ${result.repos.length} ledger(s), ${result.workflows.length} running workflow(s)`,
  ...(result.configError ? [`  config.yaml unreadable: ${result.configError}`]
    : result.repos.length || result.missing.length ? [] : ['  no ledger to resume: list the product repositories in config.yaml supervisor.repos, or pass --repo <path>']),
  ...result.missing.map((repo) => `  missing   ${repo} is listed but holds no .starciwork/runtime.sqlite`),
  ...result.present.map((w) => `  present   ${w.workflowId} watchdog pid ${w.pid}`),
  ...result.duplicate.map((w) => `  duplicate ${w.workflowId} ${w.pids.length} watchdog loops (pids ${w.pids.join(', ')}); none started, none stopped`),
  ...result.started.map((w) => `  ${w.wouldStart ? 'would start' : w.error ? 'FAILED' : 'started'} ${w.workflowId} (${w.repo})${w.pid ? ` pid ${w.pid} log ${w.log}` : ''}${w.error ? `: ${w.error}` : ''}`),
  ...(result.pending ?? []).map((w) => `  pending   ${w.workflowId} (${w.repo}): Orca did not answer`),
  ...result.connectors.map((c) => `  connector ${c.script} ${c.wouldStart ? 'would start' : c.already ? 'already running' : c.ok ? 'started' : `FAILED ${c.error ?? c.stderr ?? ''}`}`),
  ...(result.telegramBridge ? [`  connector telegram-bridge.mjs ${(({ wouldStart, already, launched, skipped, ok, error }) => (wouldStart ? 'would start' : already ? 'already running' : launched ? `started pid ${launched}` : skipped ? `skipped (${skipped})` : ok ? 'ok' : `FAILED ${error ?? ''}`))(result.telegramBridge)}`] : []),
  ...(result.stallAlert ? [`  stall-alert ${(({ wouldStart, already, pid, launched, skipped, ok, error }) => (wouldStart ? 'would start' : already ? `already running pid ${pid}` : launched ? `started pid ${launched}` : skipped ? `skipped (${skipped})` : ok ? 'ok' : `FAILED ${error ?? ''}`))(result.stallAlert)}`] : []),
  ...(result.supervisor ? [`  supervisor ${(({ wouldStart, already, pid, launched, skipped, ok, error }) => (wouldStart ? 'watchdog would start' : already ? `watchdog running pid ${pid}` : launched ? `watchdog started pid ${launched}` : skipped ? `skipped (${skipped})` : ok ? 'ok' : `FAILED ${error ?? ''}`))(result.supervisor)}`] : []),
  ...(result.skipped ? [`  skipped watchdogs: ${result.skipped}${result.orca ? ` after ${result.orca.attempts} Orca probe(s)` : ''}`] : []),
  ...describeDedupe(result.dedupe),
  ...(result.orphanKernelJobsError ? [`  orphan    check FAILED: ${result.orphanKernelJobsError}`] : []),
  ...(result.orphanKernelJobs ?? []).map((o) => `  orphan    ${o.jobId} (${o.status}; workflow ${o.phase}${o.archived ? ', archived' : ''}): node scripts/kernel/api.mjs reconcile --repo ${o.repo} --orphan-kernel-jobs`),
].join('\n');

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const has = (name) => argv.includes(`--${name}`);
  const values = (name) => argv.flatMap((arg, i) => (arg === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
  const asJson = has('json');
  if (has('help') || has('h')) {
    console.log('use: node scripts/kernel/resume-all.mjs [--repo <path>]... [--wait-orca] [--wait-orca-ms <ms>] [--dedupe | --no-dedupe] [--dry-run] [--json]\n     node scripts/kernel/resume-all.mjs --install-startup [--apply] [--json]');
  } else if (has('install-startup')) {
    installStartup({ apply: has('apply'), asJson });
  } else {
    const waitMs = has('wait-orca') ? (Number(values('wait-orca-ms')[0]) || DEFAULT_WAIT_ORCA_MS) : 0;
    const { repos, missing, configError } = resumeRepos({ extra: values('repo') });
    const result = resumeAll({ repos, missing, configError, waitMs, dryRun: has('dry-run'), dedupe: has('no-dedupe') ? false : has('dedupe') ? true : 'auto' });
    console.log(asJson ? JSON.stringify(result) : describe(result));
    if (!result.ok) process.exitCode = 1;
  }
}
