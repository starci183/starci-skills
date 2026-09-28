#!/usr/bin/env node
// watchdog.mjs — one liveness pass over one durable Kernel seat. The reconciler's Host controller runs it for every
// running workflow (scripts/reconciler/controllers/host.mjs, concern host.kernel-seat); it is no longer a loop (owner
// ruling 2026-09-28 "có lỗi xóa luôn": the reconciler is the only loop). It never plans, routes, dispatches, settles or
// finishes a workflow: settles and worker recovery are the Job controller's, quota probes the Resource controller's,
// housekeeping the GC controller's, the footprint scan the Host controller's own step.
//
//   node scripts/kernel/watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]
//
// --once without --repair is the read-only probe: it reports restart-needed / wake-needed and acts on nothing.
// --repair continues an approved workflow; it never creates one or widens its authority. It reads canonical
// status/survey and the attested Kernel terminal, then:
//   - replaces the Kernel through start-workflow when a responding Orca proves its terminal disconnected or gone
//     (twice) or back at a bare shell (two reads), and adopts back a live kernel whose seat was lost;
//   - presses Enter on a queued or staged input, and wakes a turn-idle Kernel when the frontier is actionable;
//   - repairs the seat's tab title.
// An Orca outage (runtime_unavailable, orca.exe ENOENT) is host-unavailable: waited out and re-verified, never a
// restart (scripts/kernel/host-outage.mjs). The cadence is the Host controller's (modules/reconciler/host.yaml).

import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { tabTitlesOf } from './terminal-dedupe.mjs';
import { classifyAgentScreen, staleAwareState, outputAgeOf, exitedAgentPromptRow } from './terminal-liveness.mjs';
import { sendWakeWithProof, sendEnterWithProof, deliveryFieldsOf, wakeSendRefused, WAKE_BOUNDS, withWakeIdentity } from './wake-delivery.mjs';
import { closeOperationTerminal } from './close-op-terminal.mjs';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { settledKernelVerdict, DEAD_VERDICTS, DEATH_SETTLE_MS } from './host-outage.mjs';
import { sleepSync } from '../api/orca/lib.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { revWakeLine } from './runtime-rev.mjs';
import { openDecisionRow } from '../reconciler/decisions.mjs';

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

// Orca 1.4.209 binds a send to the terminal's process incarnation: a kernel terminal created before
// an Orca update shows writable on `terminal show` yet refuses every write terminal_not_writable
// (the worker side records the same refusal op-worker-unwritable, scripts/kernel/api.mjs). A refused
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
// Terminal close is a host call, not typed input: it lands where a quit send cannot.
const closeKernelTerminal = (handle) => {
  let closed = null;
  try { closed = closeOperationTerminal(handle); } catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
  return { handle, ok: closed?.ok === true, ...(closed?.error ? { error: String(closed.error) } : {}) };
};
// The unwritable stale incarnation: record the refusal (once), close the terminal, replace the seat.
const replaceUnwritableKernel = ({ phase, terminal, stale, outputAgeMs, proof = null, refusedAt = null }) => {
  const sendRefusedAt = refusedAt ?? (proof != null ? recordKernelWakeRefused(terminal, proof) : kernelWakeRefusedAt(terminal));
  const terminalClosed = closeKernelTerminal(terminal);
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
// the Kernel "moved" when the workflow gained a job event of its own (enqueue, dispatch, settle, drop) after that wake.
// WAKE_IDLE_REPLACE delivered wakes in a row with no move replace the Kernel (a Kernel that reads its wake and does
// nothing is as stuck as a dead one); a stall that survives a replacement goes to the owner as one Decision Item
// (progress-stall, decider owner) instead of more wakes.
const KERNEL_WOKEN_EVENT = 'kernel-woken';
const KERNEL_IDLE_REPLACED_EVENT = 'kernel-replaced-idle';
export const WAKE_IDLE_REPLACE = 3;
const KERNEL_MOVES = ['job-enqueued', 'follow-on-enqueued', 'op-dispatched', 'op-settled', 'job-dropped', 'kernel-graph-edit', 'lifecycle', 'phase-transition'];
const recordKernelWoken = (terminal, detail) => withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({
  workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_WOKEN_EVENT, payload: { terminal, ...detail } })));
/** {wakes, replaced}: delivered wakes and idle replacements since the Kernel's last move. Pure over the ledger rows. */
export function idleWakesOf(rows) {
  let wakes = 0, replaced = 0;
  for (const row of rows) {
    if (KERNEL_MOVES.includes(row.kind)) { wakes = 0; replaced = 0; }
    else if (row.kind === KERNEL_WOKEN_EVENT) wakes += 1;
    else if (row.kind === KERNEL_IDLE_REPLACED_EVENT) { replaced += 1; wakes = 0; }
  }
  return { wakes, replaced };
}
const kernelIdleWakes = () => withKernelLedger((ledger) => idleWakesOf(ledger.db.prepare(
  `SELECT kind FROM events WHERE workflow_id=? AND kind IN (${[...KERNEL_MOVES, KERNEL_WOKEN_EVENT, KERNEL_IDLE_REPLACED_EVENT].map(() => '?').join(',')}) ORDER BY seq`)
  .all(workflowId, ...KERNEL_MOVES, KERNEL_WOKEN_EVENT, KERNEL_IDLE_REPLACED_EVENT))) ?? { wakes: 0, replaced: 0 };
const escalateIdleStall = ({ phase, terminal, idle, outputAgeMs }) => {
  let decision = null;
  try {
    decision = withKernelLedger((ledger) => openDecisionRow(ledger, { kind: 'progress-stall', decider: 'owner', workflowId, entity: { type: 'workflow', id: workflowId },
      idempotencyKey: `kernel-idle-after-replace:${workflowId}:${idle.replaced}`, by: 'kernel-watchdog',
      summary: `the Kernel of ${workflowId} was replaced after ${WAKE_IDLE_REPLACE} delivered wakes with no move and its replacement is idle again: the frontier needs the owner (read api status, then decide or api lifecycle --pause)` })?.di ?? null);
  } catch (error) { decision = { error: String(error?.message ?? error).slice(0, 200) }; }
  return { ok: true, workflowId, phase, terminal, action: 'stall-escalated', idle, outputAgeMs, decision: decision?.id ?? decision };
};
const replaceIdleKernel = ({ phase, terminal, stale, outputAgeMs, idle }) => {
  withKernelLedger((ledger) => ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: KERNEL_IDLE_REPLACED_EVENT, payload: { terminal, wakes: idle.wakes } })));
  const terminalClosed = closeKernelTerminal(terminal);
  return replaceKernel({ workflowId, phase, terminal, ...stale, outputAgeMs, terminalClosed,
    deathReason: `kernel ${terminal} received ${idle.wakes} wakes with an actionable frontier and made no move: replaced (H11)` });
};

const replaceWakeDeadKernel = ({ phase, terminal, stale, outputAgeMs, misses, firstAt }) => {
  const terminalClosed = closeKernelTerminal(terminal);
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
  const titleTerminal = result.replacementTerminal ?? result.adoptedTerminal ?? result.terminal;
  const titleRepair = repair && titleTerminal && (result.replacementTerminal || result.adoptedTerminal || !['host-unavailable', 'terminal-unverified', 'restart-failed', 'adopt-failed', 'terminal-unreadable', 'restart-needed', 'agent-exit-unconfirmed', 'kernel-terminal-close-failed'].includes(result.action))
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
  const { lastOutputAt, outputAgeMs } = outputAgeOf(shown.terminal?.lastOutputAt);
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
    const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
    if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, stale, outputAgeMs, ...earlier });
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
      return replaceUnwritableKernel({ phase, terminal, stale, outputAgeMs, refusedAt });
    // Orca's agent_prompt_stalled/agent_prompt_blocked receipt is inconclusive:
    // a wake the screen shows landed or queued is woken (no retry, no failed
    // tick); only a screen-proven miss is wake-failed.
    const earlier = wakeFailuresProveDead(kernelWakeFailures(terminal), { lastOutputAt });
    if (earlier.dead) return replaceWakeDeadKernel({ phase, terminal, stale, outputAgeMs, ...earlier });
    const idle = kernelIdleWakes();
    if (idle.wakes >= WAKE_IDLE_REPLACE) return idle.replaced ? escalateIdleStall({ phase, terminal, idle, outputAgeMs }) : replaceIdleKernel({ phase, terminal, stale, outputAgeMs, idle });
    const proof = sendWakeWithProof({ terminal, text: wakePromptOf(workflowId, status.value), before: String(read.screen ?? '') });
    if (!proof.ok && proof.delivery !== 'agent-exited') recordKernelWakeFailed(terminal, { state: classified.state, sendErrorCode: proof.sendErrorCode ?? null, delivery: proof.delivery ?? null });
    if (proof.ok) recordKernelWoken(terminal, { delivery: proof.delivery ?? null, idleWakes: idle.wakes + 1 });
    // Frozen spinner + lastOutputAt older than activeStaleMs + a refused send: the kernel's
    // terminal-incarnation-stale. The terminal is closed without a quit (refused too; an Orca
    // interrupt is refused as well) and the seat replaced through start-workflow.
    if (!proof.ok && liveness.staleActive && wakeSendRefused(proof))
      return replaceUnwritableKernel({ phase, terminal, stale, outputAgeMs, proof });
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


if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!repo || !workflowId || !once) {
    console.error('use: watchdog.mjs --repo <ledger-owner> --workflow <id> --once [--repair] [--json]  (the Host controller runs it; there is no loop)');
    process.exit(2);
  }
  const result = await watchdogTick();
  print(result);
  process.exitCode = result.ok ? 0 : 1;
}
