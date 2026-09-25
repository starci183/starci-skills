#!/usr/bin/env node
// watchdog.mjs — the maintenance loop of one durable Kernel workflow. It never
// plans, routes, dispatches, settles a verdict or finishes a workflow.
//
//   node scripts/kernel/watchdog.mjs --repo <ledger-owner> --workflow <id> --repair [--interval-ms <ms>] [--json]
//   node scripts/kernel/watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]
//
// A loop always runs --repair; a loop without it is refused (exit 2). --once
// without --repair is the read-only probe: it reports restart-needed /
// wake-needed and acts on nothing. --repair continues an approved workflow; it
// never creates one or widens its authority.
//
// Every tick reads canonical status/survey and the attested Kernel terminal and
// starts the host footprint scan (scripts/guards/footprint-scan.mjs: detached,
// at most every allocation.footprint.everyMs). Under --repair it also:
//   - probes the ledger's open quota circuits (api provider-health --quota-probe);
//   - settles every frontier deadWorkerJobs entry through `api reconcile
//     --dead-worker --settle-failed` (re-proves the death, settles the attempt
//     failed-no-report, releases lease, worker and Task, queues the retry);
//   - releases every frontier heldWorkerJobs worker through `api reconcile
//     --release-worker` (the job stays unsettled until its wait releases);
//   - replaces the Kernel through start-workflow when a responding Orca proves
//     its terminal disconnected or gone (twice) or back at a bare shell (two
//     reads), and adopts back a live kernel whose seat was lost;
//   - presses Enter on a queued or staged input, and wakes a turn-idle Kernel
//     when the frontier is actionable.
// An Orca outage (runtime_unavailable, orca.exe ENOENT) is host-unavailable:
// waited out and re-verified, never a restart (scripts/kernel/host-outage.mjs).
//
// The default cadence is modules/models/runtimes.yaml allocation.watchdogCadenceMs.
//
// The loop (no --once) is a singleton per workflow: host lock 'kernel-watchdog-<workflow>' (a second loop
// answers action=already-watched and exits 0). Every tick runs as a fresh `--once` child, and the loop itself
// reloads (scripts/lib/self-reload.mjs): when the runtime's HEAD or a watched module/card changed, it spawns
// its replacement with the same argv (detached, hidden, the same watchdog-logs/<workflow>.log), hands it the
// lock and exits - at most once per allocation.selfReload.minIntervalMs. A replacement that does not take the lock leaves this loop running.

import '../lib/hide-child-windows.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { classifyAgentScreen, staleAwareState, exitedAgentPromptRow } from './terminal-liveness.mjs';
import { sendWakeWithProof, sendEnterWithProof, deliveryFieldsOf, WAKE_BOUNDS, withWakeIdentity } from './wake-delivery.mjs';
import { settledKernelVerdict, DEAD_VERDICTS, DEATH_SETTLE_MS } from './host-outage.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { claimOrTakeOver } from '../connectors/lib.mjs';
import { createReloadWatch, reexecSelf, RELOAD_ENV } from '../lib/self-reload.mjs';
import { watchdogLogFile } from './watchdog-log.mjs';
import { footprintTick } from '../guards/footprint-scan.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'api.mjs');
const startFile = path.join(skillRoot, 'scripts', 'kernel', 'start-workflow.mjs');

const argv = process.argv.slice(2);
const valueOf = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const has = name => argv.includes(`--${name}`);

const repo = valueOf('repo');
const workflowId = valueOf('workflow') ?? valueOf('goal');
const once = has('once');
const repair = has('repair');
const asJson = has('json');
const CADENCE_MS = allocationMs('watchdogCadenceMs');
// An `active` screen older than this is a frozen frame, not a running turn
// (modules/models/runtimes.yaml allocation.liveness.activeStaleMs).
const ACTIVE_STALE_MS = allocationMs('liveness.activeStaleMs');
const intervalMs = Math.max(10_000, Number(valueOf('interval-ms')) || CADENCE_MS);

const jsonFrom = stdout => {
  const text = String(stdout ?? '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
};

const runNodeJson = (file, args) => {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: skillRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    value: jsonFrom(result.stdout),
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    error: result.error?.message ?? null,
  };
};

export const classifyKernelScreen = classifyAgentScreen;

export const buildWakePrompt = (workflow, attempt = null) => withWakeIdentity([
  `Watchdog liveness wake for ${workflow}: phase=running and the prior model turn returned to the input prompt; act on it now.`,
  'Re-read canonical api status and survey, handle every filed Op outcome through consume-report/check/settle or its retry/incident route, and work the frontier until nothing is immediately executable.',
  `If it is then waiting on an active Op, a lease, a not-before time or a report/message, record the exact wait and yield the model turn immediately; the external watchdog owns the ${Math.round(intervalMs / 60_000)}-minute cadence and wakes this same Kernel.`,
  'Never run Start-Sleep, shell sleep, a timer or an in-turn polling loop.',
  WAKE_BOUNDS,
].join(' '), workflow, attempt);

const api = command => runNodeJson(apiFile, [command, '--repo', path.resolve(repo), '--workflow', workflowId, '--json']);

// Replace the seat through start-workflow, which re-proves the old kernel dead
// itself. Its refusals are answers, not failures: an Orca that is not answering
// (step host-unavailable) is waited out by the next tick, and a kernel terminal
// that is still alive but unbound (step kernel-terminal-alive - a restart that
// failed during an Orca outage left the job stopped) is adopted back instead of
// being replaced by a second kernel.
const replaceKernel = (base) => {
  const started = runNodeJson(startFile, ['--repo', path.resolve(repo), '--goal', workflowId, '--launched-by', 'watchdog', '--json']);
  const step = started.value?.step ?? null;
  if (step === 'host-unavailable') return { ...base, ok: true, action: 'host-unavailable', reason: started.value?.error ?? null };
  if (step === 'kernel-terminal-alive' && started.value?.terminal) {
    const adopted = runNodeJson(startFile, ['--repo', path.resolve(repo), '--goal', workflowId, '--adopt', started.value.terminal, '--json']);
    return { ...base, ok: adopted.ok && adopted.value?.ok !== false, action: adopted.ok ? 'adopted' : 'adopt-failed',
      adoptedTerminal: started.value.terminal, detail: adopted.value ?? adopted.stderr ?? adopted.stdout };
  }
  return {
    ...base, ok: started.ok && started.value?.ok !== false, action: started.ok ? 'restarted' : 'restart-failed',
    replacementTerminal: started.value?.terminal ?? null,
    ...(started.value?.exitedTerminalsClosed ? { exitedTerminalsClosed: started.value.exitedTerminalsClosed } : {}),
    detail: started.value ?? started.stderr ?? started.stdout,
  };
};

// A dead worker never files its report, and before this each one sat until its
// Kernel hand-wrote an incident and settled it (inc-305adcb1d3c1,
// inc-e6e2e0d274a9, inc-c6cf249ecd5a and 25 more on 2026-09-23). The api
// re-proves every death itself and refuses a live worker.
export const recoverDeadWorkers = (statusValue, { run = (args) => runNodeJson(apiFile, args), repoPath = repo } = {}) =>
  (statusValue?.frontier?.deadWorkerJobs ?? []).map((jobId) => {
    const r = run(['reconcile', '--repo', path.resolve(repoPath), '--job', jobId, '--dead-worker', '--settle-failed', '--json']);
    const v = r.value ?? {};
    return { jobId, ok: r.ok && v.ok !== false, recovery: v.recovery ?? null, status: v.status ?? null,
      ...(v.retry?.jobId ? { retry: v.retry.jobId } : {}), ...(v.pattern?.raised ? { patternIncident: v.pattern.incidentId } : {}),
      ...(r.ok && v.ok !== false ? {} : { reason: v.reason ?? String(r.stderr || r.stdout || r.error || '').slice(0, 300) }) };
  });

// The base pool (Qwen) is blocked only while its quota circuit is open. Every --repair tick asks the
// api to run the recovery probe of each open quota circuit of this ledger; the api throttles it to
// one real 1-token completion per probe interval (and one right after the plan reset), so
// several watchdogs on one ledger never multiply the probes.
export const probeQuotaCircuits = ({ run = (args) => runNodeJson(apiFile, args), repoPath = repo, workflow = workflowId } = {}) => {
  const r = run(['provider-health', '--repo', path.resolve(repoPath), '--quota-probe', '--workflow', workflow, '--json']);
  const probed = (r.value?.results ?? []).filter((x) => x.probed);
  return r.ok ? (probed.length ? probed.map((x) => ({ provider: x.provider, recovered: x.recovered, state: x.probe?.state ?? null })) : null)
    : [{ ok: false, error: String(r.stderr || r.stdout || r.error || '').slice(0, 300) }];
};

// A worker whose job is done but whose settle waits on a peer or the owner kept its terminal
// open and its lease renewed through the whole wait (nivo op-integration.verify-25532858e7 under
// peer-wait inc-8cce1cf1b330). The api re-proves the hold itself and refuses anything else.
export const releaseHeldWorkers = (statusValue, { run = (args) => runNodeJson(apiFile, args), repoPath = repo } = {}) =>
  (statusValue?.frontier?.heldWorkerJobs ?? []).map((jobId) => {
    const r = run(['reconcile', '--repo', path.resolve(repoPath), '--job', jobId, '--release-worker', '--json']);
    const v = r.value ?? {};
    return { jobId, ok: r.ok && v.ok !== false, custody: v.custody?.state ?? null, leasesReleased: v.leasesReleased ?? null,
      ...(r.ok && v.ok !== false ? {} : { reason: v.reason ?? v.code ?? String(r.stderr || r.stdout || r.error || '').slice(0, 300) }) };
  });

export async function watchdogTick() {
  const quotaProbes = repair ? probeQuotaCircuits() : null;
  // The worktree/link footprint watch (nivo-fe inc-c8fbf76aa499): a detached, host-wide scan at most every FOOTPRINT_EVERY_MS
  // that flags new worktrees and cross-repository links under the repositories root; it never blocks this tick.
  const footprint = footprintTick();
  const tick = await statusTick();
  return { ...tick, ...(quotaProbes ? { quotaProbes } : {}), ...(footprint.started || footprint.error ? { footprint } : {}) };
}

async function statusTick() {
  let status = api('status');
  if (!status.ok || !status.value?.ok) return {
    ok: false, workflowId, action: 'status-failed',
    error: status.error ?? status.value?.reason ?? status.stderr ?? status.stdout,
  };
  const phase = status.value.phase;
  if (phase === 'finished') return { ok: true, workflowId, phase, action: 'finished' };
  let deadWorkersRecovered = null;
  if (repair && (status.value?.frontier?.deadWorkerJobs ?? []).length) {
    deadWorkersRecovered = recoverDeadWorkers(status.value);
    // The retries it queued make the frontier actionable: the Kernel tick below reads it fresh.
    const again = api('status');
    if (again.ok && again.value?.ok) status = again;
  }
  const heldWorkersReleased = repair && (status.value?.frontier?.heldWorkerJobs ?? []).length ? releaseHeldWorkers(status.value) : null;
  const result = kernelTick(status, phase);
  return { ...result, ...(deadWorkersRecovered ? { deadWorkersRecovered } : {}), ...(heldWorkersReleased ? { heldWorkersReleased } : {}) };
}

function kernelTick(status, phase) {
  const survey = api('survey');
  if (!survey.ok || !survey.value?.ok) return {
    ok: false, workflowId, phase, action: 'survey-failed',
    error: survey.error ?? survey.value?.reason ?? survey.stderr ?? survey.stdout,
  };
  const kernelSignal = (survey.value.signals ?? []).find(signal => signal.scope === 'kernel' && signal.key === workflowId);
  const signalValue = kernelSignal?.value ?? jsonFrom(kernelSignal?.value_json) ?? {};
  const terminal = signalValue.terminal ?? null;

  if (!terminal) {
    if (!repair) return { ok: true, workflowId, phase, action: 'restart-needed', reason: 'kernel signal/terminal absent' };
    const replaced = replaceKernel({ workflowId, phase });
    return { ...replaced, terminal: replaced.replacementTerminal ?? replaced.adoptedTerminal ?? null };
  }

  // An Orca outage is never a dead kernel: wait for Orca to answer, probe
  // again, and confirm a death with a second probe (scripts/kernel/host-outage.mjs).
  const verdict = settledKernelVerdict(terminal, repair ? {} : { waitMs: 0, settleMs: 0 });
  if (verdict.verdict === 'host-unavailable') return {
    ok: true, workflowId, phase, terminal, action: 'host-unavailable', reason: verdict.reason,
    ...(verdict.hostWait ? { hostWaitMs: verdict.hostWait.waitedMs } : {}),
  };
  if (verdict.verdict === 'unverified') return {
    ok: false, workflowId, phase, terminal, action: 'terminal-unverified',
    reason: `${verdict.reason}; an unproven death never replaces a kernel`,
  };
  if (DEAD_VERDICTS.has(verdict.verdict)) {
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: verdict.reason };
    return replaceKernel({ workflowId, phase, terminal, deathReason: verdict.reason });
  }
  const shown = verdict.shown;

  const read = terminalRead({ terminal, screen: true });
  if (!read.ok) return { ok: false, workflowId, phase, terminal, action: 'terminal-unreadable', error: read.error };
  // The kernel's agent exited and left its host shell: a responding Orca (the
  // show and the read both answered) shows a plain shell, which is a dead
  // kernel, not an 'observed' one. A second read after the settle confirms it;
  // start-workflow re-proves it, launches the replacement and then closes this
  // shell. An Orca outage never reaches here (host-unavailable above).
  const shellPrompt = exitedAgentPromptRow(read.screen);
  if (shellPrompt) {
    const deathReason = `agent exited: the kernel terminal is back at the shell prompt '${shellPrompt}'`;
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', state: 'agent-exited', shellPrompt, reason: deathReason };
    if (DEATH_SETTLE_MS > 0) sleepSync(DEATH_SETTLE_MS);
    const again = terminalRead({ terminal, screen: true });
    if (!again.ok || !exitedAgentPromptRow(again.screen)) return {
      ok: true, workflowId, phase, terminal, action: 'agent-exit-unconfirmed', state: 'agent-exited', shellPrompt,
      reason: again.ok ? 'the second read no longer ends in a shell prompt' : `the second read failed: ${again.error ?? 'unreadable'}`,
    };
    return replaceKernel({ workflowId, phase, terminal, state: 'agent-exited', shellPrompt, deathReason });
  }
  const screen = classifyKernelScreen(read.screen);
  const lastOutputAt = Number(shown.terminal?.lastOutputAt) || null;
  const outputAgeMs = lastOutputAt == null ? null : Math.max(0, Date.now() - lastOutputAt);
  // An `active` classification is trusted only while output is recent: two
  // starci-next Kernels printed nothing for 3.7 hours while an old spinner row
  // kept them "active" and the watchdog never woke them.
  const liveness = staleAwareState(screen.state, outputAgeMs, ACTIVE_STALE_MS);
  const classified = liveness.staleActive ? { ...screen, state: liveness.state } : screen;
  const stale = liveness.staleActive ? { screenState: screen.state, reason: 'stale-active', livenessReason: 'stale-active', activeStaleMs: ACTIVE_STALE_MS } : {};

  if (classified.state === 'queued-input' || classified.state === 'staged-input') {
    // A queued message is already the Kernel's input; Enter delivers it. A
    // staged paste (a wake typed but never submitted) is the same: Enter only,
    // never a second wake on top of it (inc-06aeecf432f1).
    if (!repair) return { ok: true, workflowId, phase, terminal, action: classified.state, outputAgeMs };
    // Delivery is proven from the screen, not Orca's receipt: a stalled Enter
    // whose frame left the input row submitted it (scripts/kernel/wake-delivery.mjs).
    const proof = sendEnterWithProof({ terminal });
    return { ok: proof.ok, workflowId, phase, terminal, action: proof.ok ? `${classified.state}-sent` : 'wake-failed', outputAgeMs,
      ...deliveryFieldsOf(proof), error: proof.ok ? null : (proof.sent?.error || proof.sendErrorCode || null) };
  }
  if (classified.state === 'turn-idle') {
    // A kernel waiting on the owner or on a running op has nothing to do; waking
    // it every tick only burns a turn. Wake only when status says the Kernel
    // can move something now (frontier.actionable).
    const actionable = status.value?.frontier?.actionable;
    if (actionable === false) return { ok: true, workflowId, phase, terminal, action: 'idle-waiting', ...stale, reason: status.value?.frontier?.reason ?? 'frontier not actionable', outputAgeMs };
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'wake-needed', ...stale, outputAgeMs };
    // Orca's agent_prompt_stalled/agent_prompt_blocked receipt is inconclusive:
    // a wake the screen shows landed or queued is woken (no retry, no failed
    // tick); only a screen-proven miss is wake-failed.
    const proof = sendWakeWithProof({ terminal, text: buildWakePrompt(workflowId, status.value?.kernel?.attempt ?? null), before: String(read.screen ?? '') });
    return {
      ok: proof.ok, workflowId, phase, terminal,
      // A shell got the wake (the agent exited under it): the next tick sees the shell and replaces the kernel.
      action: proof.ok ? 'woken' : proof.delivery === 'agent-exited' ? 'kernel-exited' : 'wake-failed', ...stale, outputAgeMs, ...deliveryFieldsOf(proof),
      ...(proof.shellPrompt ? { shellPrompt: proof.shellPrompt } : {}),
      receipt: proof.sent?.receipt ?? null, error: proof.ok ? null : (proof.sent?.error || proof.sendErrorCode || null),
    };
  }

  if (classified.state === 'failed') return {
    ok: false, workflowId, phase, terminal, action: 'kernel-failed-screen', outputAgeMs,
    reason: 'terminal shows an authentication/process failure; exact terminal must be reconciled before replacement',
  };
  if (classified.state === 'interactive-gate') return {
    ok: false, workflowId, phase, terminal, action: 'interactive-gate', gate: classified.gate ?? null, outputAgeMs,
    reason: `kernel terminal is waiting on an interactive gate (${classified.gate ?? 'unnamed'}); nothing is typed into it`,
  };
  return {
    ok: true, workflowId, phase, terminal,
    action: classified.state === 'active' ? 'active' : classified.state === 'wedged' ? 'kernel-wedged' : 'observed',
    state: classified.state, outputAgeMs,
  };
}

const print = result => {
  if (asJson) console.log(JSON.stringify(result));
  else console.log(`[Kernel watchdog] ${result.workflowId} phase=${result.phase ?? '?'} action=${result.action}${result.terminal ? ` terminal=${result.terminal}` : ''}${/^reload|^already/.test(result.action ?? '') ? ` pid=${result.pid ?? result.replacementPid ?? '?'}${result.reason ? ` reason=${result.reason}` : ''}${result.error ? ` error=${result.error}` : ''}` : ''}`);
};

/** The host lock that keeps one watchdog loop per workflow. */
export const watchdogLockName = (workflow) => `kernel-watchdog-${String(workflow).replace(/[^A-Za-z0-9._-]/g, '_')}`;

/**
 * What the loop process itself runs: its own file, its static imports, the cards they read. A change to any
 * of them in the live checkout, or a new runtime HEAD, reloads the loop. The per-tick child reads everything
 * fresh anyway.
 */
export const reloadWatchedFiles = (root = skillRoot) => [
  'scripts/kernel/watchdog.mjs', 'scripts/kernel/watchdog-log.mjs', 'scripts/kernel/terminal-liveness.mjs', 'scripts/kernel/wake-delivery.mjs',
  'scripts/kernel/host-outage.mjs', 'scripts/api/orca/terminal-read.mjs', 'scripts/api/orca/lib.mjs', 'scripts/lib/self-reload.mjs',
  'scripts/lib/hide-child-windows.mjs', 'scripts/connectors/lib.mjs', 'engine/config.mjs', 'modules/models/runtimes.yaml',
  'modules/models/agents/claude.yaml', 'modules/models/agents/codex.yaml', 'modules/models/agents/devin.yaml', 'modules/models/agents/qwen.yaml',
].map((rel) => path.join(root, ...rel.split('/')));

/**
 * The long-lived loop: tick, sleep, then the reload check. Seams: `tick` (one --once pass -> result), `sleep`,
 * `print`, `watch` (createReloadWatch) and `reload` (reexecSelf -> {ok, pid, error}). Returns {exitCode,
 * finished?} or {exitCode: 0, reloaded: pid} - the caller then exits without releasing the lock it handed over.
 */
export async function runWatchdogLoop({ workflow = workflowId, tick, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  print: out = print, interval = intervalMs, watch = null, reload = null, maxIterations = Infinity } = {}) {
  let exitCode = 0;
  for (let i = 0; i < maxIterations; i += 1) {
    const result = tick();
    out(result);
    if (!result.ok) exitCode = 1;
    if (result.action === 'finished') return { exitCode, finished: true };
    await sleep(interval);
    const check = watch?.check();
    if (!check?.reload || !reload) continue;
    watch.markAttempt();
    const handed = await reload(check);
    out({ ok: handed.ok === true, workflowId: workflow, action: handed.ok ? 'reloaded' : 'reload-failed', reason: check.reason,
      replacementPid: handed.pid ?? null, ...(handed.ok ? {} : { error: handed.error ?? null }) });
    if (handed.ok) return { exitCode: 0, reloaded: handed.pid };
  }
  return { exitCode };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!repo || !workflowId || (!once && !repair)) {
    console.error(`use: watchdog.mjs --repo <ledger-owner> --workflow <id> --repair [--interval-ms ${CADENCE_MS}] [--json]\n     watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]`);
    process.exit(2);
  }
  if (once) {
    const result = await watchdogTick();
    print(result);
    process.exitCode = result.ok ? 0 : 1;
  } else {
    // A replacement this loop's predecessor spawned takes its lock over; nothing else may.
    const handoverFrom = process.env[RELOAD_ENV.handoverFrom] ?? null;
    const reloadedAt = Number(process.env[RELOAD_ENV.reloadedAt]) || null;
    delete process.env[RELOAD_ENV.handoverFrom];
    delete process.env[RELOAD_ENV.reloadedAt];
    const lockName = watchdogLockName(workflowId);
    const held = claimOrTakeOver(lockName, { from: handoverFrom });
    if (!held.ok) {
      print({ ok: true, workflowId, action: 'already-watched', pid: held.holder?.pid ?? null });
      process.exit(0);
    }
    process.on('exit', held.release);
    if (held.takenOver) print({ ok: true, workflowId, action: 'reload-took-over', pid: process.pid, reason: `lock ${lockName} handed over by pid ${handoverFrom}` });
    // The long-lived loop runs every tick as a fresh `--once` child, so a
    // runtime fix to the liveness classifier or the wake rules reaches an
    // already-running watchdog on its next tick. A watchdog that imported the
    // classifier once at 03:37 kept calling yielded Kernels active all night
    // after the fixes landed. The loop process itself reloads on a new HEAD.
    const self = fileURLToPath(import.meta.url);
    const tick = () => {
      const child = spawnSync(process.execPath, [self, ...argv, '--once', '--json'], { encoding: 'utf8', windowsHide: true, timeout: Math.max(intervalMs, 120000) });
      const line = String(child.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
      try { return JSON.parse(line); } catch { return { ok: false, workflowId, action: 'tick-failed', error: (child.stderr || line || `exit ${child.status}`).slice(0, 400) }; }
    };
    // A log past its cap reloads the loop too: the replacement starts on a rotated file.
    const watch = createReloadWatch({ root: skillRoot, files: reloadWatchedFiles(), lastReloadAt: reloadedAt, logFile: watchdogLogFile(workflowId) });
    const reload = () => reexecSelf({ script: self, args: argv, logFile: watchdogLogFile(workflowId), lockName, cwd: skillRoot });
    const r = await runWatchdogLoop({ tick, watch, reload });
    if (r.reloaded) process.exit(0);
    process.exitCode = r.exitCode;
  }
}
