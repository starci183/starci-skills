#!/usr/bin/env node
// watchdog.mjs — liveness-only supervisor for one durable Kernel workflow.
//
// The watchdog is deliberately NOT a second orchestrator.  It may read the
// canonical status/survey projections, observe the attested Kernel terminal,
// wake the same terminal after an LLM turn falls back to its input prompt, or
// ask start-workflow to replace a terminal proven disconnected.  It never
// plans, enqueues, routes, dispatches, reconciles, settles or finishes Ops.
//
//   node scripts/kernel/watchdog.mjs --repo <ledger-owner> --workflow <id>
//       [--interval-ms <ms>] [--once] [--repair] [--json]
//
// The default cadence is modules/models/runtimes.yaml allocation.watchdogCadenceMs.

// Without --repair this is a read-only health probe.  --repair is appropriate
// only after the owner has authorized unattended continuation of the already
// approved workflow; it does not create a new workflow or widen its authority.

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs } from '../../engine/config.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { classifyAgentScreen } from './terminal-liveness.mjs';

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

export const buildWakePrompt = workflow => [
  `Watchdog liveness wake for ${workflow}.`,
  'The approved workflow is still phase=running, but the prior model turn returned to the terminal input prompt.',
  'Re-read canonical api status and survey now and continue the exact durable frontier.',
  'This wake grants no new approval, path, scope or operation decision: never duplicate an existing job or bypass an effect fence.',
  'Handle every filed Op outcome through consume-report/check/settle and the declared retry or incident path.',
  'Reason and act until the current durable state has no immediately executable transition.',
  `If the workflow is then legitimately waiting for an active Op, a lease, a not-before time, or a new report/message, record the exact wait reason and yield the model turn immediately; the external watchdog owns the ${Math.round(intervalMs / 60_000)}-minute cadence and will wake this same Kernel identity.`,
  'Never run Start-Sleep, shell sleep, a timer, or an in-turn polling loop to keep the model turn alive. Yielding is not workflow completion and grants no owner gate.',
].join(' ');

const api = command => runNodeJson(apiFile, [command, '--repo', path.resolve(repo), '--workflow', workflowId, '--json']);

export async function watchdogTick() {
  const status = api('status');
  if (!status.ok || !status.value?.ok) return {
    ok: false, workflowId, action: 'status-failed',
    error: status.error ?? status.value?.reason ?? status.stderr ?? status.stdout,
  };
  const phase = status.value.phase;
  if (phase === 'finished') return { ok: true, workflowId, phase, action: 'finished' };

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
    const started = runNodeJson(startFile, ['--repo', path.resolve(repo), '--goal', workflowId, '--json']);
    return {
      ok: started.ok && started.value?.ok !== false,
      workflowId, phase, action: started.ok ? 'restarted' : 'restart-failed',
      terminal: started.value?.terminal ?? null,
      detail: started.value ?? started.stderr ?? started.stdout,
    };
  }

  const shown = terminalShow({ terminal });
  if (!shown.ok || !shown.connected || !shown.writable) {
    if (!repair) return {
      ok: true, workflowId, phase, terminal, action: 'restart-needed',
      reason: shown.error || shown.exitCause || 'kernel terminal disconnected or unwritable',
    };
    const started = runNodeJson(startFile, ['--repo', path.resolve(repo), '--goal', workflowId, '--json']);
    return {
      ok: started.ok && started.value?.ok !== false,
      workflowId, phase, terminal, action: started.ok ? 'restarted' : 'restart-failed',
      replacementTerminal: started.value?.terminal ?? null,
      detail: started.value ?? started.stderr ?? started.stdout,
    };
  }

  const read = terminalRead({ terminal, screen: true });
  if (!read.ok) return { ok: false, workflowId, phase, terminal, action: 'terminal-unreadable', error: read.error };
  const classified = classifyKernelScreen(read.screen);
  const lastOutputAt = Number(shown.terminal?.lastOutputAt) || null;
  const outputAgeMs = lastOutputAt == null ? null : Math.max(0, Date.now() - lastOutputAt);

  if (classified.state === 'turn-idle') {
    // A kernel waiting on the owner or on a running op has nothing to do; waking
    // it every tick only burns a turn. Wake only when status says the Kernel
    // can move something now (frontier.actionable).
    const actionable = status.value?.frontier?.actionable;
    if (actionable === false) return { ok: true, workflowId, phase, terminal, action: 'idle-waiting', reason: status.value?.frontier?.reason ?? 'frontier not actionable', outputAgeMs };
    if (!repair) return { ok: true, workflowId, phase, terminal, action: 'wake-needed', outputAgeMs };
    const sent = terminalSend({ terminal, text: buildWakePrompt(workflowId), enter: true });
    return {
      ok: sent.ok, workflowId, phase, terminal,
      action: sent.ok ? 'woken' : 'wake-failed', outputAgeMs,
      receipt: sent.receipt ?? null, error: sent.error ?? null,
    };
  }

  if (classified.state === 'failed') return {
    ok: false, workflowId, phase, terminal, action: 'kernel-failed-screen', outputAgeMs,
    reason: 'terminal shows an authentication/process failure; exact terminal must be reconciled before replacement',
  };
  if (classified.state === 'interactive-gate') return {
    ok: false, workflowId, phase, terminal, action: 'interactive-gate', outputAgeMs,
    reason: 'kernel terminal is waiting on an interactive permission/trust gate',
  };
  return {
    ok: true, workflowId, phase, terminal,
    action: classified.state === 'active' ? 'active' : 'observed',
    state: classified.state, outputAgeMs,
  };
}

const print = result => {
  if (asJson) console.log(JSON.stringify(result));
  else console.log(`[Kernel watchdog] ${result.workflowId} phase=${result.phase ?? '?'} action=${result.action}${result.terminal ? ` terminal=${result.terminal}` : ''}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!repo || !workflowId) {
    console.error(`use: watchdog.mjs --repo <ledger-owner> --workflow <id> [--interval-ms ${CADENCE_MS}] [--once] [--repair] [--json]`);
    process.exit(2);
  }
  let exitCode = 0;
  do {
    const result = await watchdogTick();
    print(result);
    if (!result.ok) exitCode = 1;
    if (once || result.action === 'finished') break;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (true);
  process.exitCode = exitCode;
}
