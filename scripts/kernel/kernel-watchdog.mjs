#!/usr/bin/env node
// watchdog.mjs — one liveness pass over one durable Kernel seat. The reconciler's Host controller runs it for every
// running workflow (scripts/reconciler/controllers/host.mjs, concern host.kernel-seat); it is not a loop (owner
// ruling 2026-09-28: the reconciler is the only loop). It never plans, routes, dispatches, settles or
// finishes a workflow: settles and worker recovery are the Job controller's, quota probes the Resource controller's,
// housekeeping the GC controller's, the footprint scan the Host controller's own step.
//
//   starci machine kernel-watchdog --repo <ledger-owner> --workflow <id> --once [--repair] [--json]
//
// --once without --repair is the read-only probe: it reports restart-needed / wake-needed and acts on nothing.
// --repair continues an approved workflow; it never creates one or widens its authority. It reads canonical
// status/survey and the attested Kernel terminal, then:
//   - replaces the Kernel through start-workflow when worker-show reports its Dispatch ended, or a responding Orca
//     proves its terminal disconnected or gone (twice) or back at a bare shell (two reads); a live kernel job worker
//     whose seat was lost is left running (already-live);
//   - presses Enter on a queued or staged input, and wakes a turn-idle Kernel when the frontier is actionable;
//   - repairs the seat's tab title.
// An Orca outage (runtime_unavailable, orca.exe ENOENT) is host-unavailable: waited out and re-verified, never a
// restart (scripts/kernel/host-outage.mjs). The cadence is the Host controller's (modules/reconciler/host.yaml).

import '../api/process/hide-child-windows.mjs';
import path from 'node:path';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { tabTitlesOf } from './terminal-dedupe.mjs';
import { classifyAgentScreen, staleAwareState, outputAgeOf, exitedAgentPromptRow } from '../lib/terminal-liveness.mjs';
import { sendWakeWithProof, sendEnterWithProof, deliveryFieldsOf, wakeSendRefused, WAKE_BOUNDS, withWakeIdentity } from './wake-delivery.mjs';
import { closeOperationTerminal } from './close-op-terminal.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { settledKernelVerdict, DEAD_VERDICTS, DEATH_SETTLE_MS } from './host-outage.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { stopAndRelease } from '../machine/worker-close.mjs';
// worker-show states that end a worker (start-workflow.mjs MANAGED_DEAD_STATE).
const DEAD_WORKER_STATE = /stop|fail|dead|exit|release|abandon/i;
import { jsonFromStdout } from '../lib/json.mjs';
import { revWakeLine } from './runtime-rev.mjs';
import { openDecisionRow } from '../machine/decisions.mjs';
import { isMain } from '../lib/is-main.mjs';
import { arg as argvValue } from '../lib/cli-arg.mjs';
import { createKernelTick } from './kernel-watchdog-tick.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'cli.mjs');
const startFile = path.join(skillRoot, 'scripts', 'kernel', 'start-workflow.mjs');

const argv = process.argv.slice(2);
const valueOf = (name, fallback = null) => argvValue(argv, name, fallback);
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

const runNodeJson = (file, args) => {
  const result = runNode([file, ...args], {
    cwd: skillRoot,
    timeout: 120_000,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    value: jsonFromStdout(result.stdout),
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    error: result.error?.message ?? null,
  };
};

const classifyKernelScreen = classifyAgentScreen;

export const buildWakePrompt = (workflow, attempt = null, revLine = null) => withWakeIdentity([
  `Watchdog liveness wake for ${workflow}: phase=running and the prior model turn returned to the input prompt; act on it now.`,
  'Re-read canonical starci kernel status and survey. The runtime settles green reports itself; decide every needs-kernel-decision item first (starci kernel status settleDecisions: settle it fail/blocked, route its retry or incident, or check+settle what the settler could not verify), then work the ranked actions and the frontier until nothing is immediately executable.',
  `If it is then waiting on an active Op, a lease, a not-before time or a report/message, record the exact wait and yield the model turn immediately; the runtime (the reconciler Host controller) owns the ~${Math.round(intervalMs / 60_000)}-minute cadence and wakes this same Kernel.`,
  'Never run Start-Sleep, shell sleep, a timer or an in-turn polling loop.',
  WAKE_BOUNDS,
].join(' '), workflow, attempt, revLine);
/** The liveness wake this tick would type, from one starci kernel status read: its seat attempt and its kernelRev (runtime-rev.mjs). */
export const wakePromptOf = (workflow, statusValue) =>
  buildWakePrompt(workflow, statusValue?.kernel?.attempt ?? null, statusValue?.kernel ? revWakeLine(statusValue?.kernelRev, workflow) : null);

/** Repair only the Orca tab title: the agent owns the pane title and may change it on every turn. */
export function repairKernelTabTitle(terminal, name, { list = () => terminalList({ includeVisualLayouts: true }), tabTitles = tabTitlesOf,
  rename = (handle, title) => terminalRename({ terminal: handle, title }) } = {}) {
  if (!terminal) return null;
  try {
    const listed = list();
    if (!listed?.ok) return { ok: false, error: listed?.error ?? 'terminal list unavailable' };
    if (!(listed.terminals ?? []).some((t) => t.handle === terminal && t.connected !== false)) return { ok: false, error: 'terminal absent from listing' };
    const title = `[Kernel] ${name}`;
    if (tabTitles(listed.visualLayouts ?? [], listed.terminals).get(terminal) === title) return null;
    const result = rename(terminal, title);
    return { ok: result?.ok === true, terminal, title, ...(result?.ok ? {} : { error: result?.error ?? 'terminal rename failed' }) };
  } catch (error) { return { ok: false, terminal, error: String(error?.message ?? error) }; }
}

const api = command => runNodeJson(apiFile, [command, '--repo', path.resolve(repo), '--workflow', workflowId, '--json']);

// Replace the seat through start-workflow, which re-proves the old kernel dead
// itself. Its refusals are answers, not failures: an Orca that is not answering
// (step host-unavailable) is waited out by the next tick, and a kernel job whose
// own Dispatch is still alive (step kernel-worker-alive) is already live - never a
// second kernel beside it.
// A start answer {replaced:false} (the seat's terminal still connected, a startup already reserved) replaced
// nothing: it is 'already-live', never 'restarted' - the Host counts every 'restarted' against
// maxReplacementsPerHour (scripts/reconciler/controllers/host.mjs REPLACED), and on 2026-09-29 a timed-out
// tab close that start-workflow answered "terminal connected" was counted as the 4th and quarantined the seat.
/** The watchdog answer of a start-workflow run {ok, value, stderr, stdout} past its host-unavailable and live-worker steps. Pure. */
export function startAnswerOf(started, base = {}) {
  const live = started.ok && started.value?.replaced === false;
  let action = 'restart-failed';
  if (live) action = 'already-live';
  else if (started.ok) action = 'restarted';
  return {
    ...base, ok: started.ok && started.value?.ok !== false, action,
    ...(live ? { note: started.value?.note ?? null } : {}),
    replacementTerminal: started.value?.terminal ?? null,
    detail: started.value ?? started.stderr ?? started.stdout,
  };
}
const replaceKernel = (base) => {
  const started = runNodeJson(startFile, ['--repo', path.resolve(repo), '--goal', workflowId, '--launched-by', 'watchdog', '--json']);
  const step = started.value?.step ?? null;
  if (step === 'host-unavailable') return { ...base, ok: true, action: 'host-unavailable', reason: started.value?.error ?? null };
  if (step === 'kernel-worker-alive') return { ...base, ok: true, action: 'already-live', note: started.value?.error ?? null,
    replacementTerminal: null, detail: started.value };
  return startAnswerOf(started, base);
};

// Orca 1.4.209 binds a send to the terminal's process incarnation: a kernel terminal created before
// an Orca update shows writable on `terminal show` yet refuses every write terminal_not_writable
// (the worker side records the same refusal op-worker-unwritable, scripts/kernel/cli.mjs). A refused
// kernel wake send is recorded kernel-wake-unwritable, and a refusal newer than the terminal's last
// output is not typed again: the stale incarnation is closed with `terminal close` itself - a typed
// quit and an Orca interrupt are refused the same way - and start-workflow replaces the seat.
const KERNEL_UNWRITABLE_EVENT = 'kernel-wake-unwritable';
const KERNEL_NOT_WRITABLE = 'terminal_not_writable';
const withKernelLedger = (fn) => {
  try {
    const ledger = openLedger({ file: ledgerFileFor(path.resolve(repo)) });
    try { return fn(ledger); } finally { ledger.close(); }
  } catch { return null; }
};
const kernelWakeRefusedAt = (terminal) => withKernelLedger((ledger) => ledger.db.prepare(
  "SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.terminal')=?")
  .get(workflowId, KERNEL_UNWRITABLE_EVENT, terminal)?.at ?? null);
const recordKernelWakeRefused = (terminal, proof) => withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({
  workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_UNWRITABLE_EVENT,
  payload: { terminal, errorCode: KERNEL_NOT_WRITABLE, sendErrorCode: proof?.sendErrorCode ?? KERNEL_NOT_WRITABLE } }))?.created_at ?? Date.now());
// The kernel job's worker ({dispatchId, agentTerminalHandle}) when the seat signal is gone, or null.
const lostSeatWorker = () => withKernelLedger((ledger) => {
  const row = ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const managed = jsonFromStdout(row?.payload_json)?.managed ?? null;
  return managed?.dispatchId && managed.agentTerminalHandle ? managed : null;
});
// A bare shell prompt at the end of the frame on two reads (the death settle between them): the agent exited.
const exitedTwice = (handle) => {
  const exited = () => { try { const r = terminalRead({ terminal: handle, screen: true }); return r?.ok ? exitedAgentPromptRow(r.screen) : null; } catch { return null; } };
  if (!exited()) return false;
  if (DEATH_SETTLE_MS > 0) sleepSync(DEATH_SETTLE_MS);
  return Boolean(exited());
};
// A host call, not typed input: it lands where a quit send cannot. A worker-start Kernel is fenced and released by its
// Dispatch (worker-stop + worker-release), so Orca never reports it live again and start-workflow replaces it; a seat
// with no Dispatch has only its terminal to close.
const closeKernelTerminal = (handle, dispatch = null) => {
  if (dispatch) {
    const released = stopAndRelease(dispatch);
    return { handle, dispatch, ok: released.ok, ...(released.ok ? {} : { error: released.release.error ?? released.stop.error ?? 'worker-release refused' }) };
  }
  let closed = null;
  try { closed = closeOperationTerminal(handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
  return { handle, ok: closed?.ok === true, ...(closed?.error ? { error: String(closed.error) } : {}) };
};
// The unwritable stale incarnation: record the refusal (once), close the terminal, replace the seat.
const replaceUnwritableKernel = ({ phase, terminal, dispatch = null, stale, outputAgeMs, proof = null, refusedAt = null }) => {
  const sendRefusedAt = refusedAt ?? (proof != null ? recordKernelWakeRefused(terminal, proof) : kernelWakeRefusedAt(terminal));
  const terminalClosed = closeKernelTerminal(terminal, dispatch);
  const base = { workflowId, phase, terminal, ...stale, outputAgeMs, sendRefused: true,
    sendErrorCode: proof?.sendErrorCode ?? KERNEL_NOT_WRITABLE, ...(sendRefusedAt != null ? { sendRefusedAt } : {}), terminalClosed };
  if (!terminalClosed.ok) return { ...base, ok: false, action: 'kernel-terminal-close-failed',
    error: terminalClosed.error ?? 'the unwritable kernel terminal could not be closed' };
  return replaceKernel({ ...base, deathReason: `kernel terminal ${terminal} refused the wake send ${KERNEL_NOT_WRITABLE} on a stale-active frame (a stale process incarnation); closed without a quit` });
};

// A kernel whose wake keeps missing is dead to the loop even when Orca still lists its terminal
// connected: when every Devin terminal died on 2026-09-28 (Kernels included) the watchdogs typed a
// screen-proven-missed wake every tick for 2h15m ('wake-failed') until a hand repair. Each miss is
// recorded kernel-wake-failed {terminal}; WAKE_FAIL_REPLACE misses on one terminal with no output since
// the first of them, the first at least WAKE_FAIL_WINDOW_MS ago, close the terminal and replace the seat.
const KERNEL_WAKE_FAILED_EVENT = 'kernel-wake-failed';
export const WAKE_FAIL_REPLACE = 3;
export const WAKE_FAIL_WINDOW_MS = 10 * 60_000;
const recordKernelWakeFailed = (terminal, detail) => withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({
  workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_WAKE_FAILED_EVENT, payload: { terminal, ...detail } })));
const kernelWakeFailures = (terminal) => withKernelLedger((ledger) => ledger.db.prepare(
  "SELECT created_at FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.terminal')=? ORDER BY seq").all(workflowId, KERNEL_WAKE_FAILED_EVENT, terminal)
  .map((row) => row.created_at)) ?? [];
/** Whether a terminal's misses prove a dead kernel: {dead, misses, firstAt}. Output after a miss resets the count. */
export function wakeFailuresProveDead(failedAts, { lastOutputAt = null, now = Date.now() } = {}) {
  const misses = failedAts.filter((at) => !(Number.isFinite(lastOutputAt) && at < lastOutputAt));
  const firstAt = misses.length ? Math.min(...misses) : null;
  return { dead: misses.length >= WAKE_FAIL_REPLACE && firstAt != null && now - firstAt >= WAKE_FAIL_WINDOW_MS, misses: misses.length, firstAt };
}
// H11: a stall wake the Kernel RECEIVED must lead somewhere. Each delivered wake is recorded kernel-woken {terminal};
// the Kernel "moved" when the workflow gained a job event (enqueue, dispatch, settle, drop) or a record the Kernel wrote
// itself (a decision, a proposal, an ask superseded, a peer message acked...) after that wake. WAKE_IDLE_REPLACE
// delivered wakes in a row with no move, the first at least WAKE_IDLE_WINDOW_MS old, replace the Kernel (a Kernel that
// reads its wake and does nothing is as stuck as a dead one); a stall that survives an idle replacement made within
// IDLE_REPLACED_WINDOW_MS goes to the owner as one Decision Item (progress-stall, decider owner) instead of another
// replace. Only a Kernel-authored job move clears that streak: op-dispatched/op-settled come from the dispatch path and
// the settle tail, and the Kernel's own records (it is responding, e.g. holding behind an ask it cannot serve) reset the
// wakes only. On 2026-09-29 a product's auth Kernel was replaced 5 times while it wrote kernel-decision/kernel-proposal
// records between wakes that piled up within 90 s, and an op-settled between streaks kept the escalation from firing.
const KERNEL_WOKEN_EVENT = 'kernel-woken';
const KERNEL_IDLE_REPLACED_EVENT = 'kernel-replaced-idle';
const WAKE_IDLE_REPLACE = 3;
export const WAKE_IDLE_WINDOW_MS = WAKE_FAIL_WINDOW_MS;
const IDLE_REPLACED_WINDOW_MS = 60 * 60_000;
// Kernel-authored job moves: reset the wakes and the idle-replaced streak.
const KERNEL_MOVES = new Set(['job-enqueued', 'follow-on-enqueued', 'job-dropped', 'kernel-graph-edit', 'lifecycle', 'phase-transition']);
// Progress the Kernel did not author, and the Kernel's own records: reset the wakes only.
const KERNEL_ACTIVITY = new Set(['op-dispatched', 'op-settled', 'kernel-decision', 'kernel-decision-result', 'kernel-proposal',
  'autopilot-deferred-to-handover', 'ask-superseded', 'ask-answered', 'peer-message-acked', 'runtime-rev-acked']);
const recordKernelWoken = (terminal, detail) => withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({
  workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_WOKEN_EVENT, payload: { terminal, ...detail } })));
/**
 * {wakes, firstWakeAt, replaced, due}: delivered wakes since the Kernel's last move or record (firstWakeAt the
 * created_at of the first), idle replacements within IDLE_REPLACED_WINDOW_MS since its last job move, and whether H11
 * acts (WAKE_IDLE_REPLACE wakes, the first at least WAKE_IDLE_WINDOW_MS old). Pure over the ledger rows {kind, created_at}.
 */
export function idleWakesOf(rows, { now = Date.now() } = {}) {
  let wakes = 0, firstWakeAt = null, replacedAts = [];
  for (const row of rows) {
    if (KERNEL_MOVES.has(row.kind)) { wakes = 0; firstWakeAt = null; replacedAts = []; }
    else if (KERNEL_ACTIVITY.has(row.kind)) { wakes = 0; firstWakeAt = null; }
    else if (row.kind === KERNEL_WOKEN_EVENT) { if (wakes === 0) { firstWakeAt = Number(row.created_at) || null; } wakes += 1; }
    else if (row.kind === KERNEL_IDLE_REPLACED_EVENT) { replacedAts.push(Number(row.created_at) || 0); wakes = 0; firstWakeAt = null; }
  }
  const replaced = replacedAts.filter((at) => now - at < IDLE_REPLACED_WINDOW_MS).length;
  const due = wakes >= WAKE_IDLE_REPLACE && firstWakeAt != null && now - firstWakeAt >= WAKE_IDLE_WINDOW_MS;
  return { wakes, firstWakeAt, replaced, due };
}
const IDLE_KINDS = [...KERNEL_MOVES, ...KERNEL_ACTIVITY, KERNEL_WOKEN_EVENT, KERNEL_IDLE_REPLACED_EVENT];
const kernelIdleWakes = () => withKernelLedger((ledger) => idleWakesOf(ledger.db.prepare(
  `SELECT kind, created_at FROM events WHERE workflow_id=? AND kind IN (${IDLE_KINDS.map(() => '?').join(',')}) ORDER BY seq`)
  .all(workflowId, ...IDLE_KINDS))) ?? { wakes: 0, firstWakeAt: null, replaced: 0, due: false };
const escalateIdleStall = ({ phase, terminal, idle, outputAgeMs }) => {
  let decision = null;
  try {
    decision = withKernelLedger((ledger) => openDecisionRow(ledger, { kind: 'progress-stall', decider: 'owner', workflowId, entity: { type: 'workflow', id: workflowId },
      idempotencyKey: `kernel-idle-after-replace:${workflowId}:${idle.replaced}`, by: 'kernel-watchdog',
      summary: `the Kernel of ${workflowId} was replaced after ${WAKE_IDLE_REPLACE} delivered wakes with no move and its replacement is idle again: the frontier needs the owner (read starci kernel status, then decide or starci kernel lifecycle --pause)` })?.di ?? null);
  } catch (error) { decision = { error: String(error?.message ?? error).slice(0, 200) }; }
  return { ok: true, workflowId, phase, terminal, action: 'stall-escalated', idle, outputAgeMs, decision: decision?.id ?? decision };
};
// A close that failed (terminal_tab_close_timeout on a saturated host) replaced nothing: it answers
// kernel-terminal-close-failed like replaceUnwritableKernel and never runs start-workflow, and an idle
// replacement is recorded only once its terminal closed.
const closeFailed = (base, terminalClosed, what) => ({ ...base, terminalClosed, ok: false, action: 'kernel-terminal-close-failed',
  error: terminalClosed.error ?? `the ${what} kernel terminal could not be closed` });
export const replaceIdleKernel = ({ phase, terminal, dispatch = null, stale, outputAgeMs, idle }, deps = {}) => {
  const close = deps.closeKernelTerminal ?? closeKernelTerminal;
  const openLedger = deps.withKernelLedger ?? withKernelLedger;
  const replace = deps.replaceKernel ?? replaceKernel;
  const terminalClosed = close(terminal, dispatch);
  if (!terminalClosed.ok) return closeFailed({ workflowId, phase, terminal, ...stale, outputAgeMs, idle }, terminalClosed, 'idle');
  openLedger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_IDLE_REPLACED_EVENT, payload: { terminal, wakes: idle.wakes } })));
  return replace({ workflowId, phase, terminal, ...stale, outputAgeMs, terminalClosed,
    deathReason: `kernel ${terminal} received ${idle.wakes} wakes with an actionable frontier and made no move: replaced (H11)` });
};

export const replaceWakeDeadKernel = ({ phase, terminal, dispatch = null, stale, outputAgeMs, misses, firstAt }, deps = {}) => {
  const close = deps.closeKernelTerminal ?? closeKernelTerminal;
  const replace = deps.replaceKernel ?? replaceKernel;
  const terminalClosed = close(terminal, dispatch);
  if (!terminalClosed.ok) return closeFailed({ workflowId, phase, terminal, ...stale, outputAgeMs, misses, firstAt }, terminalClosed, 'wake-dead');
  return replace({ workflowId, phase, terminal, ...stale, outputAgeMs, terminalClosed,
    deathReason: `kernel terminal ${terminal} missed ${misses} wakes since ${new Date(firstAt).toISOString()} with no output: a dead kernel behind a listed terminal` });
};



async function watchdogTick() {
  return statusTick();
}

async function statusTick() {
  const status = api('status');
  if (!status.ok || !status.value?.ok) return {
    ok: false, workflowId, action: 'status-failed',
    error: status.error ?? status.value?.reason ?? status.stderr ?? status.stdout,
  };
  const phase = status.value.phase;
  if (phase === 'finished') return { ok: true, workflowId, phase, action: 'finished' };
  // An archived workflow is stopped for good: its Kernel is never replaced.
  if (status.value.archivedAt != null || phase === 'archived') return { ok: true, workflowId, phase, action: 'archived', archivedAt: status.value.archivedAt ?? null };
  // Q14 / MB-08: only a running workflow's Kernel is repaired, woken or relaunched. A paused, stopped (or not yet
  // started) workflow is left alone - nothing but the owner's starci kernel lifecycle --resume brings it back.
  if (phase !== 'running') return { ok: true, workflowId, phase, action: 'not-running' };
  const result = kernelTick(status, phase);
  // Creation supplies the title, but a moved/restored tab can lose it. The sidebar reads
  // visualLayouts' tab title, not terminal-list's agent-controlled pane title.
  const titleTerminal = result.replacementTerminal ?? result.terminal;
  const titleRepair = repair && titleTerminal && (result.replacementTerminal || !['host-unavailable', 'terminal-unverified', 'restart-failed', 'terminal-unreadable', 'restart-needed', 'agent-exit-unconfirmed', 'kernel-terminal-close-failed'].includes(result.action))
    ? repairKernelTabTitle(titleTerminal, status.value.title ?? workflowId) : null;
  // The runtime revision the Kernel acked and the wake this tick types (or would type): a read-only --once
  // probe shows what the next wake carries (runtime-rev.mjs).
  const kernelRev = status.value?.kernelRev ?? null;
  return { ...result, ...(titleRepair ? { titleRepair } : {}), ...(kernelRev ? { kernelRev, nextWake: wakePromptOf(workflowId, status.value) } : {}) };
}


const wakeActionOf = (proof) => {
  if (proof.ok) return 'woken';
  return proof.delivery === 'agent-exited' ? 'kernel-exited' : 'wake-failed';
};
const finalKernelAction = (state) => {
  if (state === 'active') return 'active';
  return state === 'wedged' ? 'kernel-wedged' : 'observed';
};
const kernelTick = createKernelTick({ api, workflowId, repair, lostSeatWorker, exitedTwice, stopAndRelease, replaceKernel,
  workerShow, DEAD_WORKER_STATE, settledKernelVerdict, DEAD_VERDICTS, terminalRead, classifyKernelScreen, outputAgeOf,
  staleAwareState, ACTIVE_STALE_MS, exitedAgentPromptRow, DEATH_SETTLE_MS, sleepSync, kernelWakeFailures,
  wakeFailuresProveDead, replaceWakeDeadKernel, sendEnterWithProof, recordKernelWakeFailed, deliveryFieldsOf,
  kernelWakeRefusedAt, replaceUnwritableKernel, kernelIdleWakes, escalateIdleStall, replaceIdleKernel,
  sendWakeWithProof, wakePromptOf, recordKernelWoken, wakeSendRefused, wakeActionOf, finalKernelAction, jsonFromStdout });
const printLineOf = (result) => {
  const terminal = result.terminal ? ` terminal=${result.terminal}` : ''; let restart = '';
  if (/^reload|^already/.test(result.action ?? '')) {
    const pid = result.pid ?? result.replacementPid ?? '?', reason = result.reason ? ` reason=${result.reason}` : '', error = result.error ? ` error=${result.error}` : '';
    restart = ` pid=${pid}${reason}${error}`;
  }
  return `[Kernel watchdog] ${result.workflowId} phase=${result.phase ?? '?'} action=${result.action}${terminal}${restart}`;
};
const print = result => {
  if (asJson) console.log(JSON.stringify(result));
  else console.log(printLineOf(result));
};

if (isMain(import.meta.url)) {
  if (!repo || !workflowId || !once) {
    console.error('use: starci machine kernel-watchdog --repo <ledger-owner> --workflow <id> --once [--repair] [--json]  (the Host controller runs it; there is no loop)');
    process.exit(2);
  }
  const result = await watchdogTick();
  print(result);
  process.exitCode = result.ok ? 0 : 1;
}
