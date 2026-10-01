#!/usr/bin/env node
// watchdog.mjs — one liveness pass over one durable Kernel seat. The reconciler's Host controller runs it for every
// running workflow (scripts/reconciler/controllers/host.mjs, concern host.kernel-seat); it is no longer a loop (owner
// ruling 2026-09-28 "on error, delete it outright": the reconciler is the only loop). It never plans, routes, dispatches, settles or
// finishes a workflow: settles and worker recovery are the Job controller's, quota probes the Resource controller's,
// housekeeping the GC controller's, the footprint scan the Host controller's own step.
//
//   node scripts/kernel/kernel-watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]
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
import fs from 'node:fs';
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
import { sleepSync } from '../api/orca/lib.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { stopAndRelease } from '../machine/close-verify.mjs';
// worker-show states that end a worker (start-workflow.mjs MANAGED_DEAD_STATE).
const DEAD_WORKER_STATE = /stop|fail|dead|exit|release|abandon/i;
import { readJsonFile } from '../lib/json.mjs';
import { revWakeLine } from './runtime-rev.mjs';
import { openDecisionRow } from '../machine/decisions.mjs';
import { isMain } from '../lib/is-main.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'cli.mjs');
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
  const result = runNode([file, ...args], {
    cwd: skillRoot,
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

export const buildWakePrompt = (workflow, attempt = null, revLine = null) => withWakeIdentity([
  `Watchdog liveness wake for ${workflow}: phase=running and the prior model turn returned to the input prompt; act on it now.`,
  'Re-read canonical api status and survey. The runtime settles green reports itself; decide every needs-kernel-decision item first (api status settleDecisions: settle it fail/blocked, route its retry or incident, or check+settle what the settler could not verify), then work the ranked actions and the frontier until nothing is immediately executable.',
  `If it is then waiting on an active Op, a lease, a not-before time or a report/message, record the exact wait and yield the model turn immediately; the runtime (the reconciler Host controller) owns the ~${Math.round(intervalMs / 60_000)}-minute cadence and wakes this same Kernel.`,
  'Never run Start-Sleep, shell sleep, a timer or an in-turn polling loop.',
  WAKE_BOUNDS,
].join(' '), workflow, attempt, revLine);
/** The liveness wake this tick would type, from one api status read: its seat attempt and its kernelRev (runtime-rev.mjs). */
export const wakePromptOf = (workflow, statusValue) =>
  buildWakePrompt(workflow, statusValue?.kernel?.attempt ?? null, statusValue?.kernel ? revWakeLine(statusValue?.kernelRev, workflow) : null);

/** Repair only the Orca tab title: the agent owns the pane title and may change it on every turn. */
export function repairKernelTabTitle(terminal, name, { list = () => terminalList({ includeVisualLayouts: true }), tabTitles = tabTitlesOf,
  rename = (handle, title) => terminalRename({ terminal: handle, title }) } = {}) {
  if (!terminal) return null;
  try {
    const listed = list();
    if (!listed?.ok) return { ok: false, error: listed?.error ?? 'terminal list unavailable' };
    const row = (listed.terminals ?? []).find((t) => t.handle === terminal && t.connected !== false);
    if (!row) return { ok: false, error: 'terminal absent from listing' };
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
  return {
    ...base, ok: started.ok && started.value?.ok !== false, action: live ? 'already-live' : started.ok ? 'restarted' : 'restart-failed',
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
  const managed = jsonFrom(row?.payload_json)?.managed ?? null;
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
// wakes only. On 2026-09-29 the nivo-auth Kernel was replaced 5 times while it wrote kernel-decision/kernel-proposal
// records between wakes that piled up within 90 s, and an op-settled between streaks kept the escalation from firing.
const KERNEL_WOKEN_EVENT = 'kernel-woken';
const KERNEL_IDLE_REPLACED_EVENT = 'kernel-replaced-idle';
export const WAKE_IDLE_REPLACE = 3;
export const WAKE_IDLE_WINDOW_MS = WAKE_FAIL_WINDOW_MS;
export const IDLE_REPLACED_WINDOW_MS = 60 * 60_000;
// Kernel-authored job moves: reset the wakes and the idle-replaced streak.
const KERNEL_MOVES = ['job-enqueued', 'follow-on-enqueued', 'job-dropped', 'kernel-graph-edit', 'lifecycle', 'phase-transition'];
// Progress the Kernel did not author, and the Kernel's own records: reset the wakes only.
const KERNEL_ACTIVITY = ['op-dispatched', 'op-settled', 'kernel-decision', 'kernel-decision-result', 'kernel-proposal',
  'autopilot-deferred-to-handover', 'ask-superseded', 'ask-answered', 'peer-message-acked', 'runtime-rev-acked'];
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
    if (KERNEL_MOVES.includes(row.kind)) { wakes = 0; firstWakeAt = null; replacedAts = []; }
    else if (KERNEL_ACTIVITY.includes(row.kind)) { wakes = 0; firstWakeAt = null; }
    else if (row.kind === KERNEL_WOKEN_EVENT) { if (wakes === 0) firstWakeAt = Number(row.created_at) || null; wakes += 1; }
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
      summary: `the Kernel of ${workflowId} was replaced after ${WAKE_IDLE_REPLACE} delivered wakes with no move and its replacement is idle again: the frontier needs the owner (read api status, then decide or api lifecycle --pause)` })?.di ?? null);
  } catch (error) { decision = { error: String(error?.message ?? error).slice(0, 200) }; }
  return { ok: true, workflowId, phase, terminal, action: 'stall-escalated', idle, outputAgeMs, decision: decision?.id ?? decision };
};
// A close that failed (terminal_tab_close_timeout on a saturated host) replaced nothing: it answers
// kernel-terminal-close-failed like replaceUnwritableKernel and never runs start-workflow, and an idle
// replacement is recorded only once its terminal closed.
const closeFailed = (base, terminalClosed, what) => ({ ...base, terminalClosed, ok: false, action: 'kernel-terminal-close-failed',
  error: terminalClosed.error ?? `the ${what} kernel terminal could not be closed` });
const replaceIdleKernel = ({ phase, terminal, dispatch = null, stale, outputAgeMs, idle }) => {
  const terminalClosed = closeKernelTerminal(terminal, dispatch);
  if (!terminalClosed.ok) return closeFailed({ workflowId, phase, terminal, ...stale, outputAgeMs, idle }, terminalClosed, 'idle');
  withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_IDLE_REPLACED_EVENT, payload: { terminal, wakes: idle.wakes } })));
  return replaceKernel({ workflowId, phase, terminal, ...stale, outputAgeMs, terminalClosed,
    deathReason: `kernel ${terminal} received ${idle.wakes} wakes with an actionable frontier and made no move: replaced (H11)` });
};

const replaceWakeDeadKernel = ({ phase, terminal, dispatch = null, stale, outputAgeMs, misses, firstAt }) => {
  const terminalClosed = closeKernelTerminal(terminal, dispatch);
  if (!terminalClosed.ok) return closeFailed({ workflowId, phase, terminal, ...stale, outputAgeMs, misses, firstAt }, terminalClosed, 'wake-dead');
  return replaceKernel({ workflowId, phase, terminal, ...stale, outputAgeMs, terminalClosed,
    deathReason: `kernel terminal ${terminal} missed ${misses} wakes since ${new Date(firstAt).toISOString()} with no output: a dead kernel behind a listed terminal` });
};



export async function watchdogTick() {
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
  // started) workflow is left alone - nothing but the owner's api lifecycle --resume brings it back.
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
    // The seat is gone but the kernel job's own worker may still hold a Dispatch Orca calls live (start-workflow then
    // refuses a second Kernel, kernel-worker-alive). When that worker's frame proves its agent exited - a bare shell
    // prompt on two reads - it is fenced and released first, so the replacement is not refused.
    const lost = lostSeatWorker();
    const fenced = lost && exitedTwice(lost.agentTerminalHandle) ? stopAndRelease(lost.dispatchId) : null;
    const replaced = replaceKernel({ workflowId, phase, ...(fenced ? { fenced, lostSeat: lost } : {}) });
    return { ...replaced, terminal: replaced.replacementTerminal ?? null };
  }

  // The Kernel is a worker-start worker: its Dispatch's worker state is the first liveness proof. A seat with no
  // Dispatch is not one: start-workflow replaces it with a worker.
  if (!signalValue.dispatch) {
    const deathReason = 'seat has no worker';
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: deathReason };
    return replaceKernel({ workflowId, phase, terminal, deathReason });
  }
  const worker = workerShow({ dispatch: signalValue.dispatch });
  if (worker?.hostUnavailable) return { ok: true, workflowId, phase, terminal, action: 'host-unavailable', reason: worker.error ?? 'worker-show did not answer' };
  if (worker?.ok && worker.state && DEAD_WORKER_STATE.test(worker.state)) {
    const deathReason = `kernel worker ${signalValue.dispatch} is ${worker.state}`;
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'restart-needed', reason: deathReason };
    return replaceKernel({ workflowId, phase, terminal, deathReason, fenced: stopAndRelease(signalValue.dispatch) });
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
    return replaceKernel({ workflowId, phase, terminal, deathReason: verdict.reason, fenced: stopAndRelease(signalValue.dispatch) });
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
    return replaceKernel({ workflowId, phase, terminal, state: 'agent-exited', shellPrompt, deathReason, fenced: stopAndRelease(signalValue.dispatch) });
  }
  const screen = classifyKernelScreen(read.screen);
  const { lastOutputAt, outputAgeMs } = outputAgeOf(shown.terminal?.lastOutputAt);
  // An `active` classification is trusted only while output is recent: two
  // Kernels of one product printed nothing for 3.7 hours while an old spinner row
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
    const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
    if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, dispatch: signalValue.dispatch, stale, outputAgeMs, ...earlier });
    const proof = sendEnterWithProof({ terminal });
    if (!proof.ok) recordKernelWakeFailed(terminal, { state: classified.state, sendErrorCode: proof.sendErrorCode ?? null });
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
    // A wake send Orca already refused terminal_not_writable on this frame is not typed again.
    const refusedAt = liveness.staleActive ? kernelWakeRefusedAt(terminal) : null;
    if (refusedAt != null && refusedAt > (lastOutputAt ?? 0))
      return replaceUnwritableKernel({ phase, terminal, dispatch: signalValue.dispatch, stale, outputAgeMs, refusedAt });
    // Orca's agent_prompt_stalled/agent_prompt_blocked receipt is inconclusive:
    // a wake the screen shows landed or queued is woken (no retry, no failed
    // tick); only a screen-proven miss is wake-failed.
    const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
    if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, dispatch: signalValue.dispatch, stale, outputAgeMs, ...earlier });
    const idle = kernelIdleWakes();
    if (idle.due) return idle.replaced ? escalateIdleStall({ phase, terminal, idle, outputAgeMs }) : replaceIdleKernel({ phase, terminal, dispatch: signalValue.dispatch, stale, outputAgeMs, idle });
    const proof = sendWakeWithProof({ terminal, text: wakePromptOf(workflowId, status.value), before: String(read.screen ?? '') });
    if (!proof.ok && proof.delivery !== 'agent-exited') recordKernelWakeFailed(terminal, { state: classified.state, sendErrorCode: proof.sendErrorCode ?? null, delivery: proof.delivery ?? null });
    if (proof.ok) recordKernelWoken(terminal, { delivery: proof.delivery ?? null, idleWakes: idle.wakes + 1 });
    // Frozen spinner + lastOutputAt older than activeStaleMs + a refused send: the kernel's
    // terminal-incarnation-stale. The terminal is closed without a quit (refused too; an Orca
    // interrupt is refused as well) and the seat replaced through start-workflow.
    if (!proof.ok && liveness.staleActive && wakeSendRefused(proof))
      return replaceUnwritableKernel({ phase, terminal, dispatch: signalValue.dispatch, stale, outputAgeMs, proof });
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


if (isMain(import.meta.url)) {
  if (!repo || !workflowId || !once) {
    console.error('use: watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]  (the Host controller runs it; there is no loop)');
    process.exit(2);
  }
  const result = await watchdogTick();
  print(result);
  process.exitCode = result.ok ? 0 : 1;
}
