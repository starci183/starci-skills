#!/usr/bin/env node
// api.mjs — the kernel agent's ONLY gate to the ledger. One thin command per
// state operation; the long-lived [Kernel] never opens .starciwork/runtime.sqlite
// itself and never spawns op terminals by hand — `dispatch` owns that.
//
//   node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
//
//   survey   --repo <path> --workflow <id>
//   status   --repo <path> --workflow <id>
//   hierarchy --repo <path> --workflow <id>
//   plan     --repo <path> --workflow <id> --file <plan.json>
//   enqueue  --repo <path> --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
//            [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
//   estimate --repo <path> --files <n> [--assertions <n>] [--components <n>] [--records <n>]
//   route    --repo <path> --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
//   dispatch --repo <path> --job <job_id> [--model <target>] [--worktree <sel>] [--spawn] [--lease-ttl <ms>]
//   reconcile --repo <path> --job <job_id>
//   nudge    --repo <path> --job <job_id>
//   observe  --repo <path> --job <job_id> [--lines <n>]
//   settle   --repo <path> --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
//   report   --repo <path> --job <job_id> --report <file> [--outcome <done|partial|failed|ask|blocked>]
//   op-contract --repo <path> --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
//   check    --repo <path> --job <job_id> (--checks '<json>' | --checks-file <path>)
//   consume-report --repo <path> --job <job_id>
//   incident --repo <path> --workflow <id> --kind <k> --detail <s> [--op <opId>]
//   finish   --repo <path> --workflow <id>
//
// Every read prints a JSON-safe result; every write runs inside one
// ledger.transaction. --json gives the machine form; without it each command
// prints a compact human line. Bad arguments exit 2 with usage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openLedger, ledgerFileFor, machineFileFor, openMachine,
  newToken, JOB_STATUSES, reserveTwoPhase, transitionWorkflowToRunning,
} from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { deriveRetryLineage, ownedPathLeaseRequests } from '../../engine/admission.mjs';
import { allocationMs, allocationSettings } from '../../engine/config.mjs';
import { OP_REPORT_OUTCOMES, validateOpReport } from './report-envelope.mjs';
import { renderReportBlock } from './report-render.mjs';
import {
  spawnAgent, buildSpawnCommand, deliverPrompt, cleanupDeliveryArtifact,
  awaitSubmission, awaitAttestation,
} from '../agent/lib.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { classifyAgentScreen } from './terminal-liveness.mjs';
// Pool selection and launch-model resolution, plus the Orca orchestration
// wrappers the managed-agent dispatch path drives — one thin wrapper per
// calls.yaml verb (run-create/task-create/worker-start/dispatch/
// dispatch-show/worker-show/worker-stop/worker-release).
import { selectPool, resolveLaunchModel } from '../agent/models.mjs';
import { accountList } from '../api/orca/account-list.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { taskCreate } from '../api/orca/task-create.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { orchDispatch } from '../api/orca/orch-dispatch.mjs';
import { dispatchShow } from '../api/orca/dispatch-show.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// The status vocabulary is engine/ledger-db.mjs JOB_STATUSES; these are the
// three views this gate reasons in. enqueue writes 'queued' and settle writes
// 'succeeded'|'failed' — the durable engine's own words.
const FINAL_SETTLED = [...JOB_STATUSES.settled];
const SETTLED = [...JOB_STATUSES.settled, ...JOB_STATUSES.fenced];
const DISPATCHABLE = [...JOB_STATUSES.dispatchable];
// The reports.outcome vocabulary — the worker-facing half of the op IPC.
const REPORT_OUTCOMES = OP_REPORT_OUTCOMES;
// Kernel verdict ↔ worker outcome consistency at settle: a pass settles a
// `done` report, a fail settles `failed|partial`, a blocked verdict settles
// `blocked|ask` (an unanswered ask is a blocked op). A `done` report is only
// a worker claim: an independently recorded red check may overrule it to fail.
const VERDICT_OUTCOMES = { pass: ['done'], fail: ['failed', 'partial'], blocked: ['blocked', 'ask'] };
const CHECK_PASS_WORDS = new Set(['pass', 'passed', 'ok', 'green', 'success', 'succeeded']);
const CHECK_FAIL_WORDS = new Set(['fail', 'failed', 'error', 'red', 'blocked', 'not-run', 'not_run']);
const isCheckResultEnvelope = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.checks)) return false;
  return value.checks.length > 0 && value.checks.every((check) => {
    if (!check || typeof check !== 'object' || Array.isArray(check)) return false;
    if (typeof check.name !== 'string' || !check.name.trim()) return false;
    if (!Number.isInteger(check.exitCode)) return false;
    if (check.command != null && typeof check.command !== 'string') return false;
    if (check.evidence != null && typeof check.evidence !== 'string') return false;
    return true;
  });
};
const summarizeCheckEvidence = (value) => {
  if (isCheckResultEnvelope(value)) {
    const passed = value.checks.filter((check) => check.exitCode === 0).length;
    const failed = value.checks.length - passed;
    return { observed: value.checks.length, passed, failed, green: value.checks.length > 0 && failed === 0 };
  }
  const summary = { observed: 0, passed: 0, failed: 0 };
  const visit = (item, key = '') => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (Array.isArray(item)) { for (const entry of item) visit(entry, normalizedKey); return; }
    if (item && typeof item === 'object') {
      for (const [childKey, child] of Object.entries(item)) visit(child, childKey);
      return;
    }
    if (normalizedKey === 'exitcode' || normalizedKey === 'exit_code') {
      const code = Number(item);
      if (Number.isFinite(code)) {
        summary.observed += 1;
        if (code === 0) summary.passed += 1;
        else summary.failed += 1;
      }
      return;
    }
    if (typeof item === 'boolean' && /^(?:ok|pass|passed|success|succeeded)$/.test(normalizedKey)) {
      summary.observed += 1;
      if (item) summary.passed += 1;
      else summary.failed += 1;
      return;
    }
    if (typeof item !== 'string') return;
    const word = item.trim().toLowerCase();
    if (CHECK_PASS_WORDS.has(word)) { summary.observed += 1; summary.passed += 1; }
    else if (CHECK_FAIL_WORDS.has(word)) { summary.observed += 1; summary.failed += 1; }
  };
  visit(value);
  return { ...summary, green: summary.observed > 0 && summary.failed === 0 && summary.passed > 0 };
};

const usage = (code) => {
  console.error(`use: node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
  survey   --workflow <id>
  status   --workflow <id>
  hierarchy --workflow <id>
  plan     --workflow <id> --file <plan.json>
  enqueue  --workflow <id> --op <opId> --paths <csv> [--records <csv>] [--title <t>] [--risk <r>]
           [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
  estimate --files <n> [--assertions <n>] [--components <n>] [--records <n>]
           deterministic slice sizing from runtimes.yaml allocation.slicing
  route    --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
  dispatch --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
  reconcile --job <job_id>
  nudge    --job <job_id>
  observe  --job <job_id> [--lines <n>]
  settle   --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
  report   --job <job_id> --report <file> [--outcome <${REPORT_OUTCOMES.join("|")}>]
  op-contract --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
  check    --job <job_id> (--checks '<json>' | --checks-file <path>)
  consume-report --job <job_id>
  incident --workflow <id> --kind <k> --detail <s> [--op <opId>]
  finish   --workflow <id>`);
  process.exit(code);
};

const parseJson = (text, fallback = null) => { try { return JSON.parse(text); } catch { return fallback; } };
const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    const name = k.slice(2);
    if (['json', 'spawn'].includes(name)) { a[name] = true; continue; }
    const v = argv[++i];
    if (v === undefined) usage(2);
    a[name] = v;
  }
  return a;
};
const need = (cond, msg) => { if (!cond) { console.error(`api: ${msg}`); usage(2); } };

const openRepoLedger = (repo) => {
  const file = ledgerFileFor(repo); // throws ledger-root-is-runtime on a runtime root — deliberate
  if (!fs.existsSync(file)) throw Object.assign(new Error(`ledger-missing: ${file} — no .starciwork/runtime.sqlite at that repo`), { code: 'ledger-missing' });
  return openLedger({ file });
};

const emit = (out, human, asJson) => {
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else console.log(human);
};

// How recently a terminal must have printed for an unclassifiable screen to
// still count as a live turn. One authority: modules/models/runtimes.yaml
// allocation.liveness.activeUnclassifiedMs.
const ACTIVE_UNCLASSIFIED_MS = allocationMs('liveness.activeUnclassifiedMs');

const getWorkflow = (db, workflowId) => db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
const latestGoal = (db, workflowId) => db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
const goalJsonOf = (row) => parseJson(row?.json ?? '', {});
const jobPayloadOf = (row) => parseJson(row?.payload_json ?? '', {});
const operationTerminalHandleOf = (row, payload = jobPayloadOf(row)) => payload?.managed?.agentTerminalHandle
  ?? payload?.orca?.agentTerminalHandle
  ?? payload?.hierarchy?.runtime?.terminalHandle
  ?? (payload?.managed ? null : row?.worker_id)
  ?? null;
const observeOperationWorker = (job, now = Date.now()) => {
  const terminalHandle = operationTerminalHandleOf(job);
  if (!terminalHandle) return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null, liveness: 'unknown', reason: 'operation terminal handle unavailable', observedAt: now };
  try {
    const shown = terminalShow({ terminal: terminalHandle });
    const lastOutputAt = Number(shown?.terminal?.lastOutputAt);
    const outputAgeMs = Number.isFinite(lastOutputAt) ? Math.max(0, now - lastOutputAt) : null;
    const connected = shown?.connected === true, writable = shown?.writable === true;
    let screenState = null;
    if (shown?.ok && connected && writable) {
      try {
        const read = terminalRead({ terminal: terminalHandle, screen: true });
        if (read?.ok) screenState = classifyAgentScreen(read.screen).state;
      } catch { /* terminal-show fallback below remains conservative */ }
    }
    const liveness = !shown?.ok ? 'unknown'
      : !connected || !writable ? 'disconnected'
      : screenState === 'active' ? 'active'
      : screenState === 'turn-idle' ? 'turn-idle'
      : screenState === 'interactive-gate' ? 'interactive-gate'
      : screenState === 'failed' ? 'failed'
      : outputAgeMs != null && outputAgeMs <= ACTIVE_UNCLASSIFIED_MS ? 'active-unclassified'
      : 'live-idle';
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness, connected, writable,
      terminalStatus: shown?.terminal?.status ?? null, lastOutputAt: Number.isFinite(lastOutputAt) ? lastOutputAt : null,
      outputAgeMs, screenState, observedAt: now };
  } catch (error) {
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: 'unknown', reason: String(error?.message ?? error), observedAt: now };
  }
};

// A durable transition should wake the workflow coordinator immediately when
// its previous model turn has yielded back to the provider prompt.  The
// watchdog remains the coarse five-minute fallback; this path is event-driven
// and best-effort so a terminal transport failure can never roll back or hide
// the report row that was already committed.
const wakeKernelForTransition = (ledger, { workflowId, transition, jobId, dispatchId }) => {
  const db = ledger.db;
  const signal = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const terminal = parseJson(signal?.value_json ?? '')?.terminal ?? null;
  if (!terminal) return { action: 'kernel-signal-absent', terminal: null };
  try {
    const shown = terminalShow({ terminal });
    if (!shown?.ok || shown.connected !== true || shown.writable !== true) {
      return { action: 'kernel-unavailable', terminal, error: shown?.error ?? shown?.exitCause ?? null };
    }
    const read = terminalRead({ terminal, screen: true });
    if (!read?.ok) return { action: 'kernel-unreadable', terminal, error: read?.error ?? null };
    const state = classifyAgentScreen(read.screen).state;
    if (state !== 'turn-idle') return { action: 'kernel-active', terminal, state };
    const prompt = [
      `Durable transition wake for workflow ${workflowId}: ${transition}.`,
      `Operation job ${jobId} filed dispatch ${dispatchId}.`,
      'Re-read canonical api status and survey now; consume, independently check and settle the exact report, release its worker, then continue the approved frontier.',
      'This wake grants no new scope, path, retry or authority and must not duplicate an existing job or bypass an effect fence.',
    ].join(' ');
    const sent = terminalSend({ terminal, text: prompt, enter: true });
    if (!sent?.ok) return { action: 'kernel-wake-failed', terminal, state, error: sent?.error ?? null };
    ledger.transaction(() => ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'kernel-transition-woken',
      payload: { transition, jobId, dispatchId, terminal, priorState: state },
    }));
    return { action: 'kernel-woken', terminal, state, receipt: sent.receipt ?? null };
  } catch (error) {
    return { action: 'kernel-wake-error', terminal, error: String(error?.message ?? error) };
  }
};

/* --------------------------------------------------------------- nudge */
// A connected terminal at its provider input prompt is not an active model
// turn.  Nudge wakes that exact operation worker so it can file the report its
// accepted contract owes.  This is liveness maintenance only: it grants no
// paths or approval and never creates/retries/settles a job.
function cmdNudge(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  if (job.status !== 'running') throw Object.assign(new Error(`job ${jobId} is ${job.status}; nudge requires running`), { code: 'job-not-running' });
  const payload = jobPayloadOf(job);
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? job.worker_id;
  const report = dispatchId
    ? db.prepare('SELECT outcome,consumed_at FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId)
    : null;
  if (report) {
    const out = { ok: true, jobId, nudged: false, reason: 'report-filed', report };
    emit(out, `nudge skipped for ${jobId}: report already filed (${report.outcome})`, args.json);
    return;
  }
  const worker = observeOperationWorker(job);
  if (!worker.terminalHandle || !worker.connected || !worker.writable) {
    const out = { ok: false, jobId, nudged: false, reason: 'worker-unavailable', worker };
    emit(out, `nudge REFUSED for ${jobId}: exact worker is unavailable`, args.json);
    process.exit(1);
  }
  if (worker.liveness === 'active' || worker.liveness === 'active-unclassified') {
    const out = { ok: true, jobId, nudged: false, reason: 'worker-active', worker };
    emit(out, `nudge skipped for ${jobId}: exact worker is active`, args.json);
    return;
  }
  if (worker.liveness === 'interactive-gate' || worker.liveness === 'failed') {
    const out = { ok: false, jobId, nudged: false, reason: worker.liveness, worker };
    emit(out, `nudge REFUSED for ${jobId}: terminal state=${worker.liveness}`, args.json);
    process.exit(1);
  }
  if (!['turn-idle', 'live-idle'].includes(worker.liveness)) {
    const out = { ok: false, jobId, nudged: false, reason: 'worker-state-unknown', worker };
    emit(out, `nudge REFUSED for ${jobId}: terminal state=${worker.liveness}`, args.json);
    process.exit(1);
  }
  const prompt = [
    `Operation liveness wake for durable job ${jobId} (${job.op_id}) attempt ${job.attempt}.`,
    'Your accepted contract remains running but no durable report is filed.',
    'Re-read the exact contract with api op-contract, continue only inside its existing authority, and file exactly one api report.',
    'Report done, partial, failed, ask or blocked truthfully; do not wait for another chat prompt and do not widen scope.',
  ].join(' ');
  const sent = terminalSend({ terminal: worker.terminalHandle, text: prompt, enter: true });
  if (!sent.ok) {
    const out = { ok: false, jobId, nudged: false, reason: 'terminal-send-failed', worker, error: sent.error };
    emit(out, `nudge FAILED for ${jobId}: ${sent.error ?? 'terminal send failed'}`, args.json);
    process.exit(1);
  }
  ledger.transaction(() => ledger.appendEvent({
    workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    kind: 'op-worker-nudged', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness },
  }));
  const out = { ok: true, jobId, nudged: true, worker, receipt: sent.receipt ?? null };
  emit(out, `nudged ${jobId}: resumed exact worker ${worker.terminalHandle} to file its durable report`, args.json);
}

/* --------------------------------------------------------------- observe */
// READ-ONLY context: the kernel's only window onto its own job's exact op
// terminal — terminal-show liveness plus a bounded screen tail — so a ~3min
// cadence keeps reasoning context when an op is silent between reports. It
// never sends (that is `nudge`), never closes (that is `settle`), and an
// op's screen is NEVER proof: only a filed `api report` plus kernel-run
// `api check` rows settle a verdict. The sole durable write is a compact
// 'op-observed' event (handle, turnState, screen byte length — the screen
// itself stays out of the ledger).
const OBSERVE_SCREEN_LINES = 80;
const OBSERVE_TURN_STATES = { active: 'active', 'turn-idle': 'turn-idle', 'interactive-gate': 'turn-idle' };
function cmdObserve(ledger, args) {
  const db = ledger.db, jobId = args.job, now = Date.now();
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-not-found' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  let lines = OBSERVE_SCREEN_LINES;
  if (args.lines != null) {
    const n = Number(args.lines);
    need(Number.isInteger(n) && n > 0, `observe --lines must be a positive integer, got '${args.lines}'`);
    lines = n;
  }
  const handle = operationTerminalHandleOf(job);
  if (!handle) {
    const out = { ok: false, job: jobId, reason: 'no-live-worker', ledgerStatus: job.status };
    emit(out, `observe REFUSED for ${jobId}: no-live-worker (a ${job.status} job binds no worker terminal)`, args.json);
    process.exit(1);
  }
  // Host reads only — terminal-show for liveness, terminal-read for the
  // screen tail. A dead or unreadable terminal is a typed projection, not a
  // refusal: the kernel still needs the context to reason about the op.
  const terminal = { handle, connected: false, writable: false, status: null, idleMs: null };
  let screen = null, turnState = 'unknown', screenState = null;
  let shown;
  try { shown = terminalShow({ terminal: handle }); }
  catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  terminal.connected = shown?.ok === true && shown?.connected === true;
  terminal.writable = shown?.ok === true && shown?.writable === true;
  terminal.status = shown?.terminal?.status ?? null;
  const lastOutputAt = Number(shown?.terminal?.lastOutputAt);
  terminal.idleMs = Number.isFinite(lastOutputAt) ? Math.max(0, now - lastOutputAt) : null;
  if (!shown?.ok) turnState = 'unreadable';
  else if (!terminal.connected || !terminal.writable) turnState = 'disconnected';
  else {
    let read;
    try { read = terminalRead({ terminal: handle, screen: true }); }
    catch (error) { read = { ok: false, error: String(error?.message ?? error) }; }
    if (!read?.ok) turnState = 'unreadable';
    else {
      screenState = classifyAgentScreen(read.screen).state;
      turnState = OBSERVE_TURN_STATES[screenState] ?? 'unknown';
      screen = String(read.screen ?? '').split(/\r?\n/).slice(-lines).join('\n');
    }
  }
  if (screenState) terminal.screenState = screenState;
  ledger.transaction(() => ledger.appendEvent({
    workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    kind: 'op-observed',
    payload: { opId: job.op_id, attempt: job.attempt, terminal: handle, turnState, screenBytes: screen == null ? 0 : Buffer.byteLength(screen) },
  }));
  const out = { ok: true, job: jobId, jobId, opId: job.op_id, attempt: job.attempt, ledgerStatus: job.status, terminal, screen, turnState, observedAt: now };
  emit(out, [
    `observe ${jobId} — ${turnState} (terminal ${handle}, connected=${terminal.connected} writable=${terminal.writable}, screen ${screen == null ? 0 : screen.split('\n').length} lines)`,
    ...(screen == null ? [] : [screen]),
  ].join('\n'), args.json);
}
const AGENT_HIERARCHY_SCHEMA = 'starci/agent-hierarchy@1';
const workflowNodeId = (workflowId) => `workflow:${workflowId}`;
const kernelNodeId = (workflowId) => `agent:kernel:${workflowId}`;
const operationNodeId = (jobId) => `agent:operation:${jobId}`;
const profileProviderCache = new Map();
const providerForProfile = (profile) => {
  if (!profile) return null;
  if (profileProviderCache.has(profile)) return profileProviderCache.get(profile);
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${profile}.yaml`);
  let provider = null;
  try { provider = fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8'))?.provider ?? null) : null; } catch { provider = null; }
  profileProviderCache.set(profile, provider);
  return provider;
};

// Durable semantic hierarchy. Terminal tabs and pane ancestry are placement
// hints only; workflow/job identities survive terminal recreation, Kernel
// restarts and operation retries.
const hierarchyNodeOf = (row) => {
  const payload = jobPayloadOf(row);
  const stored = payload.hierarchy ?? {};
  const kernel = row.kind === 'kernel';
  const managed = payload.managed ?? {};
  const orca = payload.orca ?? {};
  const route = payload.route ?? {};
  const runtime = stored.runtime ?? {};
  const profile = runtime.profile ?? route.profile ?? payload.model ?? null;
  const profileProvider = providerForProfile(profile);
  return {
    nodeId: stored.nodeId ?? (kernel ? kernelNodeId(row.workflow_id) : operationNodeId(row.job_id)),
    parentNodeId: stored.parentNodeId ?? (kernel ? workflowNodeId(row.workflow_id) : kernelNodeId(row.workflow_id)),
    role: stored.role ?? (kernel ? 'kernel' : 'operation'),
    workflowId: row.workflow_id,
    jobId: row.job_id,
    opId: row.op_id ?? payload.opId ?? null,
    attempt: row.attempt,
    generation: row.generation,
    status: row.status,
    runtime: {
      host: runtime.host ?? route.host ?? 'orca',
      agent: runtime.agent ?? route.agent ?? payload.agent ?? payload.provider ?? profileProvider ?? null,
      provider: runtime.provider ?? payload.provider ?? route.agent ?? profileProvider ?? null,
      model: runtime.model ?? route.model ?? payload.modelId ?? null,
      profile,
      runtimePool: runtime.runtimePool ?? route.runtimePool ?? payload.model ?? null,
      runId: runtime.runId ?? managed.runId ?? orca.runId ?? null,
      taskId: runtime.taskId ?? managed.taskId ?? orca.taskId ?? null,
      dispatchId: runtime.dispatchId ?? managed.dispatchId ?? orca.dispatchId ?? null,
      terminalHandle: runtime.terminalHandle ?? managed.agentTerminalHandle ?? orca.agentTerminalHandle
        ?? (kernel ? row.worker_id : (managed.dispatchId ? null : row.worker_id)) ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const agentHierarchyOf = (db, workflowId) => {
  const workflow = getWorkflow(db, workflowId);
  if (!workflow) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const root = {
    nodeId: workflowNodeId(workflowId), role: 'workflow', workflowId,
    title: workflow.title ?? workflowId, status: workflow.phase ?? null,
    generation: workflow.generation ?? 0,
  };
  const nodes = db.prepare('SELECT * FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id').all(workflowId).map(hierarchyNodeOf);
  const edges = nodes.map((node) => ({
    parentNodeId: node.parentNodeId,
    childNodeId: node.nodeId,
    relation: node.role === 'kernel' ? 'coordinates' : 'dispatches',
  }));
  return { schema: AGENT_HIERARCHY_SCHEMA, workflow: root, nodes, edges };
};

/* ---------------------------------------------------------------- survey */
function cmdSurvey(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId), gj = goalJsonOf(g);
  const openJobs = db.prepare(
    `SELECT * FROM jobs WHERE workflow_id=? AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...FINAL_SETTLED)
    .map((r) => ({ job_id: r.job_id, op_id: r.op_id, kind: r.kind, status: r.status, attempt: r.attempt, generation: r.generation, worker_id: r.worker_id, payload: jobPayloadOf(r), created_at: r.created_at, updated_at: r.updated_at }));
  const inbox = db.prepare('SELECT * FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(workflowId)
    .map((r) => ({ ...r, payload: parseJson(r.payload_json), disposition: parseJson(r.disposition_json) }));
  const signals = db.prepare(
    `SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM signals
     WHERE (scope=? OR key=? OR scope=?) AND (expires_at IS NULL OR expires_at>?) ORDER BY scope,key`
  ).all(workflowId, workflowId, PROVIDER_HEALTH_SCOPE, now).map((r) => ({ ...r, value: parseJson(r.value_json) }));
  const events = db.prepare('SELECT seq,event_id,generation,entity_type,entity_id,kind,payload_json,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 10')
    .all(workflowId).reverse().map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
  const incidents = db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
  const out = {
    ok: true, workflowId,
    workflow: wf,
    goal: g ? {
      revision: g.revision, identity: g.goal_identity, markdown: g.markdown,
      opChain: gj.opChain ?? null, derivedPlan: gj.derivedPlan ?? null, json: gj,
    } : null,
    jobs: openJobs,
    inbox, signals, events,
    incidentsOpen: incidents,
    eventsHead: ledger.eventsHead(workflowId),
  };
  emit(out, [
    `workflow ${workflowId} — phase=${wf.phase ?? '-'} title=${wf.title ?? '-'}`,
    `goal rev ${g?.revision ?? '-'} (${g?.goal_identity ?? '-'}) chain: ${(gj.opChain?.legs ?? []).map((l) => l.op).join(' → ') || '(none stored)'}`,
    `open jobs: ${openJobs.length} (${openJobs.map((j) => `${j.job_id}:${j.status}`).join(', ') || 'none'})`,
    `inbox: ${inbox.length} rows (${inbox.filter((i) => i.status === 'pending').length} pending) | live signals: ${signals.length} | open incidents: ${incidents.length}`,
    `last events: ${events.map((e) => `${e.seq}:${e.kind}`).join(', ') || 'none'}`,
  ].join('\n'), args.json);
}

/* ---------------------------------------------------------------- status */
function cmdStatus(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const byStatus = {};
  for (const r of db.prepare('SELECT status,count(*) n FROM jobs WHERE workflow_id=? GROUP BY status ORDER BY status').all(workflowId)) byStatus[r.status] = r.n;
  const leases = db.prepare('SELECT resource_key,job_id,expires_at FROM leases WHERE workflow_id=? AND expires_at>? ORDER BY resource_key').all(workflowId, now);
  const inboxPending = db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(workflowId).n;
  // Filed op reports — the kernel's exact "is it done and with what result"
  // signal. dispatch_id binds the worker handle (falling back to the job id),
  // so each row joins back to its job either way.
  const reports = db.prepare(
    `SELECT r.dispatch_id, r.op_id, r.attempt, r.outcome, r.consumed_at, r.created_at,
            COALESCE(jw.job_id, jj.job_id, jp.job_id) AS job_id
     FROM reports r
     LEFT JOIN jobs jw ON jw.workflow_id=r.workflow_id AND jw.worker_id=r.dispatch_id
     LEFT JOIN jobs jj ON jj.workflow_id=r.workflow_id AND jj.job_id=r.dispatch_id
     LEFT JOIN jobs jp ON jp.workflow_id=r.workflow_id AND (
       json_extract(jp.payload_json,'$.orca.dispatchId')=r.dispatch_id OR
       json_extract(jp.payload_json,'$.managed.dispatchId')=r.dispatch_id OR
       json_extract(jp.payload_json,'$.hierarchy.runtime.dispatchId')=r.dispatch_id)
     WHERE r.workflow_id=? ORDER BY r.created_at`
  ).all(workflowId);
  // Report age alone is not worker liveness. Project the exact operation
  // terminal's host state and output freshness so the Kernel never labels a
  // live, thinking worker as wedged or attempts a duplicate same-job spawn.
  const workers = db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
    .all(workflowId, ...FINAL_SETTLED)
    .filter((job) => job.status === 'running' || operationTerminalHandleOf(job))
    .map((job) => observeOperationWorker(job, now));
  const openOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).get(workflowId, ...FINAL_SETTLED).n;
  const unconsumedReports = reports.filter((report) => !report.consumed_at).length;
  const nudgeReadyWorkers = workers.filter((worker) => ['turn-idle', 'live-idle'].includes(worker.liveness)
    && !reports.some((report) => report.job_id === worker.jobId));
  const frontierState = wf.phase === 'finished' ? 'finished'
    : unconsumedReports > 0 ? 'transition-ready'
    : nudgeReadyWorkers.length > 0 ? 'worker-nudge-ready'
    : openOperations > 0 ? 'engaged'
    : wf.phase === 'running' ? 'orphaned-frontier'
    : 'idle';
  const frontier = {
    state: frontierState,
    openOperations,
    unconsumedReports,
    nudgeReadyJobs: nudgeReadyWorkers.map((worker) => worker.jobId),
    reason: frontierState === 'orphaned-frontier'
      ? 'workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish'
      : frontierState === 'worker-nudge-ready'
        ? 'one or more exact running workers are at an idle provider prompt without a report; Kernel must call api nudge for each listed job now'
      : null,
  };
  const out = { ok: true, workflowId, phase: wf.phase ?? null, frontier, jobs: byStatus, activeLeases: leases, inboxPending, reports, workers };
  emit(out,
    `${workflowId} phase=${out.phase ?? '-'} frontier=${frontierState} jobs{${Object.entries(byStatus).map(([s, n]) => `${s}:${n}`).join(',') || '-'}} leases=${leases.length} inbox-pending=${inboxPending} reports=${reports.length}(${unconsumedReports} unconsumed) workers=${workers.map((w) => `${w.jobId}:${w.liveness}`).join(',') || '-'}`,
    args.json);
}

/* ------------------------------------------------------------- hierarchy */
function cmdHierarchy(ledger, args) {
  const out = { ok: true, ...agentHierarchyOf(ledger.db, args.workflow) };
  emit(out, [
    `${out.workflow.nodeId} (${out.workflow.status ?? '-'})`,
    ...out.nodes.map((node) => `  ${node.parentNodeId} -> ${node.nodeId} [${node.status}]${node.runtime.model ? ` ${node.runtime.agent ?? '-'} / ${node.runtime.model}` : ''}`),
  ].join('\n'), args.json);
}

/* ------------------------------------------------------------------ plan */
function cmdPlan(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const now = Date.now();
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw Object.assign(new Error(`plan file missing: ${file}`), { code: 'plan-file-missing' });
  const plan = parseJson(fs.readFileSync(file, 'utf8'));
  if (!plan || !Array.isArray(plan.legs) || plan.legs.some((l) => !l || typeof l.op !== 'string' || !l.op)) {
    throw Object.assign(new Error(`invalid plan file ${file} — expected {legs:[{op,paths?,notes?}]}`), { code: 'plan-file-invalid' });
  }
  const legs = plan.legs.map((l) => ({ op: l.op, ...(l.paths ? { paths: l.paths } : {}), ...(l.notes ? { notes: l.notes } : {}) }));
  const planOps = legs.map((l) => l.op);

  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId);
  const storedLegs = goalJsonOf(g)?.opChain?.legs ?? null;
  const storedOps = storedLegs ? storedLegs.map((l) => l?.op ?? l).filter(Boolean) : null;
  // Structural diff only: which stored legs the plan dropped, which plan ops
  // were never in the approved chain, whether shared ops changed order.
  const divergence = {
    storedOps: storedOps ?? null,
    planOps,
    missing: storedOps ? storedOps.filter((o) => !planOps.includes(o)) : [],
    extra: storedOps ? planOps.filter((o) => !storedOps.includes(o)) : [...planOps],
    reordered: storedOps
      ? JSON.stringify(storedOps.filter((o) => planOps.includes(o))) !== JSON.stringify(planOps.filter((o) => storedOps.includes(o)))
      : false,
    noStoredChain: storedOps === null,
  };
  divergence.diverged = divergence.missing.length > 0 || divergence.extra.length > 0 || divergence.reordered;

  const lineage = {
    replannedFrom: args['replanned-from'] ?? null,
    blocker: args.blocker ?? null,
    pathDelta: args['path-delta'] ?? null,
    routingReason: args['routing-reason'] ?? null,
  };
  let inboxApplied = 0;

  ledger.transaction(() => {
    if (g) {
      const gj = goalJsonOf(g);
      gj.derivedPlan = { legs, divergence, lineage, derivedAt: now };
      db.prepare('UPDATE goals SET json=? WHERE goal_seq=?').run(JSON.stringify(gj), g.goal_seq);
      inboxApplied = db.prepare("UPDATE inbox SET status='applied', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind='goal-revision' AND status='pending' AND key=?")
        .run(JSON.stringify({ action: 'plan-derived', revision: g.revision, lineage }), now, workflowId, `${workflowId}:${g.revision}`).changes;
    }
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'plan-derived', payload: { goal_revision: g?.revision ?? null, legs, divergence, lineage, inboxApplied, file },
    });
  });

  const out = { ok: true, workflowId, goalRevision: g?.revision ?? null, divergence, lineage, inboxApplied, legs };
  emit(out,
    `plan-derived for ${workflowId}: ${legs.length} legs — diverged=${divergence.diverged}` +
    (divergence.missing.length ? ` missing=[${divergence.missing.join(',')}]` : '') +
    (divergence.extra.length ? ` extra=[${divergence.extra.join(',')}]` : '') +
    (divergence.reordered ? ' reordered' : '') +
    (divergence.noStoredChain ? ' (no stored opChain to diff)' : ''),
    args.json);
}

/* -------------------------------------------------------------- estimate */
// Deterministic same-op slice sizing. The kernel measures the write scope and
// passes the counts; weights and bounds live in runtimes.yaml
// allocation.slicing so the estimate is a declared computation, never a
// model's guess. W = sum(weight * count) agent-minutes; slices =
// clamp(ceil(W / targetMinutes[1]), 1, maxSlices).
function cmdEstimate(ledger, args) {
  const slicing = allocationSettings().slicing ?? {};
  const weights = slicing.weights ?? {};
  const target = Array.isArray(slicing.targetMinutes) ? slicing.targetMinutes.map(Number) : [];
  const maxSlices = Number(slicing.maxSlices);
  if (target.length !== 2 || target.some((n) => !Number.isFinite(n) || n <= 0)
    || !Number.isFinite(maxSlices) || maxSlices < 1) {
    throw Object.assign(
      new Error('modules/models/runtimes.yaml allocation.slicing must declare {weights, targetMinutes:[lo,hi], maxSlices}'),
      { code: 'slicing-undeclared' });
  }
  const counts = {
    file: Math.max(0, Number(args.files) || 0),
    assertion: Math.max(0, Number(args.assertions) || 0),
    component: Math.max(0, Number(args.components) || 0),
    record: Math.max(0, Number(args.records) || 0),
  };
  if (!Object.values(counts).some((n) => n > 0)) {
    throw Object.assign(
      new Error('estimate needs at least one of --files/--assertions/--components/--records'),
      { code: 'estimate-no-measure' });
  }
  const unweighted = Object.entries(counts).filter(([k, n]) => n > 0 && !Number.isFinite(Number(weights[k])));
  if (unweighted.length) {
    throw Object.assign(
      new Error(`modules/models/runtimes.yaml allocation.slicing.weights declares no weight for ${unweighted.map(([k]) => k).join(', ')}`),
      { code: 'slicing-undeclared' });
  }
  const minutes = Object.entries(counts).reduce((sum, [k, n]) => sum + (Number(weights[k]) || 0) * n, 0);
  const slices = Math.min(maxSlices, Math.max(1, Math.ceil(minutes / target[1])));
  const perSliceMinutes = Math.round((minutes / slices) * 10) / 10;
  const out = {
    ok: true, minutes, slices, perSliceMinutes, counts, weights,
    targetMinutes: target, maxSlices,
    overTarget: slices >= maxSlices && perSliceMinutes > target[1],
  };
  emit(out, [
    `estimate: ${minutes} agent-min -> ${slices} slice(s) ~${perSliceMinutes}min each (target ${target[0]}-${target[1]}min, cap ${maxSlices})`,
    ...(out.overTarget ? [`  slice cap ${maxSlices} reached at ${perSliceMinutes}min/slice — prefer finer path decomposition before enqueue`] : []),
  ].join('\n'), args.json);
}

/* --------------------------------------------------------------- enqueue */
function cmdEnqueue(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (wf.phase === 'finished') {
    throw Object.assign(new Error(`workflow ${workflowId} is finished; a finished phase takes no new work`), { code: 'workflow-finished' });
  }
  const briefFile = path.join(skillRoot, 'modules', 'ops', 'ops', `${args.op}.yaml`);
  if (!fs.existsSync(briefFile)) {
    throw Object.assign(new Error(`unknown op ${args.op} — no brief at modules/ops/ops/${args.op}.yaml`), { code: 'unknown-op' });
  }
  const goal = latestGoal(db, workflowId);
  const ownedPaths = [...new Set(String(args.paths).split(',').map((s) => s.trim()).filter(Boolean))];
  // An op with no owned_paths is an unbounded write grant: the packet would
  // tell the worker "(per brief write-ceiling)" and nothing would fence it.
  if (ownedPaths.length === 0) {
    throw Object.assign(new Error(`--paths resolved to no path for ${args.op} — an op without owned_paths is an unbounded grant`), { code: 'empty-paths' });
  }
  const records = [...new Set(String(args.records ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  const cutValues = [args['cut-id'], args['cut-ordinal'], args['cut-total']];
  const hasCut = cutValues.some((value) => value != null);
  if (hasCut && cutValues.some((value) => value == null)) {
    throw Object.assign(new Error('cut enqueue requires --cut-id, --cut-ordinal and --cut-total together'), { code: 'cut-invalid' });
  }
  const cutOrdinal = hasCut ? Number(args['cut-ordinal']) : null;
  const cutTotal = hasCut ? Number(args['cut-total']) : null;
  if (hasCut && (!String(args['cut-id']).trim() || !Number.isInteger(cutOrdinal) || !Number.isInteger(cutTotal)
      || cutOrdinal < 1 || cutTotal < 2 || cutOrdinal > cutTotal)) {
    throw Object.assign(new Error('cut enqueue requires a non-empty id and integers 1 <= ordinal <= total with total >= 2'), { code: 'cut-invalid' });
  }
  const cut = hasCut ? { id: String(args['cut-id']).trim(), ordinal: cutOrdinal, total: cutTotal } : null;
  const jobId = `op-${args.op}-${newToken().slice(0, 10)}`;
  let payload;

  let job;
  ledger.transaction(() => {
    const attempt = db.prepare('SELECT COALESCE(MAX(attempt),0)+1 a FROM jobs WHERE workflow_id=? AND op_id=?').get(workflowId, args.op).a;
    // A retry's provenance. `attempt` is durable dispatch identity; the route's
    // limit is budgeted against `businessAttempt`, which only advances when the
    // prior attempt actually spent one — an infrastructure launch rejected
    // before any effect does not (engine/admission.mjs deriveRetryLineage).
    const priorJob = db.prepare('SELECT job_id,attempt,payload_json,result_json FROM jobs WHERE workflow_id=? AND op_id=? ORDER BY attempt DESC LIMIT 1')
      .get(workflowId, args.op);
    const retry = priorJob ? deriveRetryLineage(priorJob) : null;
    payload = {
      opId: args.op, records, owned_paths: ownedPaths, title: args.title ?? args.op, risk: args.risk ?? null,
      ...(cut ? { cut } : {}),
      ...(retry ? { retry } : {}),
      goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
      hierarchy: {
        schema: AGENT_HIERARCHY_SCHEMA,
        nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(workflowId),
        role: 'operation',
        workflowId,
        jobId,
        opId: args.op,
        attempt,
        generation: wf.generation ?? 0,
        runtime: { host: 'orca' },
      },
    };
    db.prepare(
      "INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?, 'op','op',?, 'queued',?,?)"
    ).run(jobId, workflowId, args.op, attempt, wf.generation ?? 0, JSON.stringify(payload), now, now);
    ledger.appendEvent({
      workflowId, entityType: 'job', entityId: jobId,
      kind: 'job-enqueued', payload: { opId: args.op, attempt, records: records.length, ownedPaths: ownedPaths.length, risk: payload.risk, cut },
    });
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, attempt: job.attempt, cut };
  emit(out, `enqueued ${jobId} (op ${args.op}, attempt ${job.attempt}, status ${job.status}${cut ? `, cut ${cut.ordinal}/${cut.total} ${cut.id}` : ''})`, args.json);
}

/* ----------------------------------------------------------------- route */
// The quota probe shells out to a provider CLI, so it is imported lazily and
// every probe degrades to {state:'unknown'} when it throws — routing still
// decides on the capacity rows it can prove (running counts, maxParallel,
// open incidents). A probe is evidence, never a verdict.
const quotaModule = import('../api/quota/index.mjs').catch(() => null);
const probeQuotaSafe = async (provider) => {
  try {
    const mod = await quotaModule;
    if (typeof mod?.probeQuota !== 'function') {
      return { state: 'unknown', usedPercent: null, detail: 'quota module unavailable' };
    }
    const probe = await mod.probeQuota(provider);
    return probe && typeof probe === 'object' ? probe : { state: 'unknown', usedPercent: null, detail: 'quota probe returned no result' };
  } catch (e) {
    return { state: 'unknown', usedPercent: null, detail: String(e?.message ?? e) };
  }
};

const csvList = (v) => (v == null ? [] : (Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim()).filter(Boolean));

const PROVIDER_HEALTH_SCOPE = 'provider-health';
const normalizeProviderId = (provider) => {
  const id = String(provider ?? '').trim().toLowerCase();
  if (id === 'fable' || id === 'claude-fable') return 'claude';
  return id.replace(/-agent$/, '');
};
const failureText = (...parts) => parts.map((part) => {
  if (part == null) return '';
  if (typeof part === 'string') return part;
  try { return JSON.stringify(part); } catch { return String(part); }
}).join(' ');
const confirmedAuthFailure = ({ step, signal, error, details } = {}) => {
  const stages = [step, details?.stage, details?.failedStage, details?.result?.stage, details?.result?.failedStage]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase());
  if (stages.includes('auth') || stages.includes('authentication')) return true;
  const text = failureText(signal, error, details).toLowerCase();
  return /(?:\b401\b|not[_ -]?authenticated|authentication (?:failed|required)|oauth[^\n]*(?:expired|invalid|rejected)|(?:access[_ -]?)?token[^\n]*(?:expired|invalid|rejected)|invalid api[- ]?key|missing credentials|credential[^\n]*(?:expired|invalid|rejected))/.test(text);
};
const providerHealthOf = (db, provider, now = Date.now()) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const row = db.prepare('SELECT value_json,at,expires_at FROM signals WHERE scope=? AND key=?')
    .get(PROVIDER_HEALTH_SCOPE, key);
  if (!row || (row.expires_at != null && row.expires_at <= now)) return null;
  const value = parseJson(row.value_json, {});
  return value?.status === 'unavailable' ? { ...value, at: row.at, expiresAt: row.expires_at } : null;
};
const providerCooldownMs = (failureKind) => {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'runtimes.yaml'), 'utf8'));
    const map = doc?.allocation?.cooldownMs ?? {};
    const value = Number(map[failureKind] ?? map.other);
    if (Number.isFinite(value) && value > 0) return value;
  } catch { /* contract fallback below */ }
  return 5 * 60 * 1000;
};
const writeProviderCircuit = (db, { provider, model, jobId, step, signal, error, now, failureKind = 'auth' }) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const expiresAt = now + providerCooldownMs(failureKind);
  const prior = providerHealthOf(db, key, now);
  const value = {
    schema: 'starci/provider-health@1', provider: key, status: 'unavailable',
    failureKind, model: model ?? null, jobId, step,
    signal: signal ?? null, detail: error ?? null, observedAt: now,
    failures: Number(prior?.failures ?? 0) + 1,
  };
  db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at)
    VALUES(?,?,NULL,NULL,?,?,?)
    ON CONFLICT(scope,key) DO UPDATE SET holder_pid=NULL,token=NULL,value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at`)
    .run(PROVIDER_HEALTH_SCOPE, key, JSON.stringify(value), now, expiresAt);
  return { ...value, expiresAt };
};

// `api route` — resolve the pool/model for one job and persist the decision on
// its payload so `dispatch --spawn` launches exactly what was routed. Bias:
// routing_bias {prefer[], avoid[]} on the workflow goal's json, with --prefer/
// --avoid flags taking precedence (flag entries lead the merged list).
// Difficulty: --difficulty > job payload.difficulty > 'medium'.
async function cmdRoute(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.status === 'effect_unknown') throw Object.assign(new Error(`job ${jobId} requires reconcile before it can be routed`), { code: 'job-reconcile-required' });
  if (FINAL_SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  if (job.status !== 'queued') throw Object.assign(new Error(`job ${jobId} cannot be routed while ${job.status}; only queued jobs are routable`), { code: 'job-not-queued' });
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of rerouting`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const kind = job.op_id ?? payload.opId;
  if (!kind) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  const gj = goalJsonOf(latestGoal(db, job.workflow_id));
  const goalBias = gj.routing_bias ?? {};
  const bias = {
    prefer: [...new Set([...csvList(args.prefer), ...csvList(goalBias.prefer)])],
    avoid: [...new Set([...csvList(args.avoid), ...csvList(goalBias.avoid)])],
  };
  const difficulty = args.difficulty ?? payload.difficulty ?? 'medium';

  // Capacity per runtimes.yaml pool: live running count, declared maxParallel,
  // the provider quota probe and the typed, expiring provider-health circuit.
  // Generic workflow incidents are evidence for the Kernel, not provider
  // health. Their free-form text can mention every fallback provider (for
  // example while documenting a recovered dispatch failure), so substring
  // matching them here would permanently poison every pool because incidents
  // are intentionally append-only until workflow finish.
  const rtFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  const rtDoc = fs.existsSync(rtFile) ? parseYaml(fs.readFileSync(rtFile, 'utf8')) : null;
  const pools = rtDoc?.runtimes ?? {};
  // A persisted payload.model marks a lane already committed: routed-but-queued,
  // leased and answering jobs hold the same pool slot a running one does, so
  // sequential route calls in one fan-out see the fleet filling instead of
  // piling every slice onto the first preferred pool.
  const runningByModel = {};
  for (const r of db.prepare(
    `SELECT payload_json FROM jobs WHERE status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`
  ).all(...FINAL_SETTLED)) {
    const p = parseJson(r.payload_json, {});
    if (p?.model) runningByModel[p.model] = (runningByModel[p.model] ?? 0) + 1;
  }
  let accounts = null;
  try { accounts = await accountList() ?? null; } catch { accounts = null; }
  const quotaByProvider = new Map();
  const capacity = {};
  for (const [poolId, rt] of Object.entries(pools)) {
    const target = rt?.target ?? poolId;
    const provider = rt?.provider ?? null;
    const providerKey = normalizeProviderId(provider);
    if (provider && !quotaByProvider.has(providerKey)) quotaByProvider.set(providerKey, await probeQuotaSafe(provider));
    const quota = provider ? quotaByProvider.get(providerKey)
      : { state: 'unknown', usedPercent: null, detail: 'pool declares no provider' };
    const providerHealth = provider ? providerHealthOf(db, provider) : null;
    capacity[target] = {
      running: runningByModel[target] ?? 0,
      maxParallel: rt?.maxParallel ?? null,
      quota,
      auth: providerHealth || quota?.state === 'dead' ? 'dead' : 'ok',
      authDetail: providerHealth?.detail ?? providerHealth?.signal ?? quota?.detail ?? null,
      providerHealth,
      openIncident: false,
    };
  }

  const decision = selectPool({ kind, difficulty, bias, capacity });
  if (!decision || decision.error) {
    const out = { ok: false, jobId, kind, difficulty, bias, error: decision?.error ?? 'selectPool returned no decision' };
    emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): ${out.error}`, args.json);
    process.exit(1);
  }

  const decided = {
    model: decision.target, modelId: decision.modelId ?? null, effort: decision.effort ?? null,
    routeChain: decision.chain ?? [], routeRejected: decision.rejected ?? [],
  };
  const selectedRuntime = Object.entries(pools)
    .find(([poolId, runtime]) => (runtime?.target ?? poolId) === decision.target)?.[1] ?? null;
  ledger.transaction(() => {
    const now = Date.now();
    const hierarchy = payload.hierarchy ?? {
      schema: AGENT_HIERARCHY_SCHEMA,
      nodeId: operationNodeId(jobId), parentNodeId: kernelNodeId(job.workflow_id),
      role: 'operation', workflowId: job.workflow_id, jobId, opId: kind,
      attempt: job.attempt, generation: job.generation,
    };
    hierarchy.runtime = {
      ...(hierarchy.runtime ?? {}), host: 'orca',
      agent: selectedRuntime?.provider ?? null,
      provider: selectedRuntime?.provider ?? null,
      model: decided.modelId,
      profile: decided.model,
      runtimePool: decided.model,
    };
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...payload, ...decided, difficulty, hierarchy }), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'route-decided', payload: { kind, difficulty, bias, ...decided },
    });
  });

  const out = { ok: true, jobId, kind, difficulty, bias, decision: decided, rejected: decided.routeRejected, ...(accounts ? { accounts } : {}) };
  emit(out, [
    `route ${jobId} (${kind}, ${difficulty}) → ${decided.model} model=${decided.modelId ?? '-'} effort=${decided.effort ?? '-'}`,
    `  chain: ${decided.routeChain.join(' → ') || '(none)'}`,
    ...(decided.routeRejected.length
      ? ['  rejected:', ...decided.routeRejected.map((r) => `    ${r.target}: ${r.reason}`)]
      : []),
  ].join('\n'), args.json);
}

/* -------------------------------------------------------------- dispatch */
const resolveModel = (target) => {
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  if (!fs.existsSync(file)) return { error: `no model profile ${target} at ${path.relative(skillRoot, file)}` };
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const orca = doc?.launch?.orca ?? {};
  return { target, provider: doc?.provider ?? null, kind: orca.kind ?? 'unknown', command: orca.command ?? null, profile: path.relative(skillRoot, file) };
};

// dispatch-op.mjs's packet builder is not exported (it runs main() on import),
// so the packet shape is replicated here: same fields, same returns contract.
const buildPacket = ({ job, payload, model, goal }) => ({
  op: job.op_id ?? payload.opId,
  brief: `modules/ops/ops/${job.op_id ?? payload.opId}.yaml`,
  context: {
    workflow: {
      id: job.workflow_id,
      goal_revision: payload.goal_binding?.revision ?? goal?.revision ?? null,
      goal_identity: payload.goal_binding?.identity ?? goal?.goal_identity ?? null,
    },
    attempt: job.attempt,
    records: payload.records ?? [],
    owned_paths: (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? { path: p } : p)),
    ...(payload.cut ? { cut: payload.cut } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.risk ? { risk: payload.risk } : {}),
  },
  constraints: { model: model.target, provider: model.provider, budget: payload.budget ?? null, lease: job.lease_token ?? null },
  returns: { verdict: 'pass|fail|blocked', evidence: ['...paths'], suspicion: 'string?' },
});

const buildPrompt = (packet, jobId, repo, priorFailures = []) => {
  const entrySkill = path.join(skillRoot, 'CONTEXT.md');
  const brief = path.join(skillRoot, packet.brief);
  const verdictContract = path.join(skillRoot, VERDICT_CONTRACT);
  return [
  `[Op] ${packet.op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}, attempt ${packet.context.attempt ?? 1}).`,
  ...(priorFailures.length ? [
    `prior_attempt_failures: an earlier attempt of this same op settled fail on the kernel checks below.`,
    `  They are your authoritative residual defects — verify and repair them first; records already on`,
    `  disk are prior attempts' output you must check, not license to file done. Re-filing another`,
    `  attempt's report or claiming done without new authored writes is an automatic fail:`,
    ...priorFailures.map((f) => `  - [${f.name}] ${f.evidence}`),
  ] : []),
  `MANDATORY LOAD ORDER — read before any action:`,
  `  1. ${entrySkill} — canonical Source runtime load order (the routed repository may not contain .claude)`,
  `  2. ${brief} — your contract. It declares your reads, writes, steps, proofs and blockers.`,
  `  3. ${verdictContract} — what your return must look like`,
  `source_runtime: ${skillRoot}`,
  `target_repository: ${repo}`,
  `brief: ${brief}  (your contract — never renegotiate it)`,
  `workflow: ${packet.context.workflow.id} goal_revision=${packet.context.workflow.goal_revision ?? '(unbound)'} goal_identity=${packet.context.workflow.goal_identity ?? '(unbound)'}`,
  `records: ${packet.context.records.join(', ') || '(none bound)'}`,
  ...(packet.context.cut ? [`cut: ${packet.context.cut.id} ordinal=${packet.context.cut.ordinal}/${packet.context.cut.total} — this job owns only this bounded SAME-op slice; never widen to sibling slices`] : []),
  `owned_paths: ${[...new Set(packet.context.owned_paths.map((p) => p.path))].join(', ') || '(per brief write-ceiling)'}`,
  `   only owned_paths may be modified; anything else is out of scope.`,
  `constraints: lease=${packet.constraints.lease ?? '(none)'} model=${packet.constraints.model} budget=${packet.constraints.budget ?? '(unset)'}`,
  `machines: check names in your brief (layoutPolicy.checks, proofs) are executable canonical validators — run them verbatim, never invent placeholder commands (e.g. validateWorkspace):`,
  `  starci-validate → node ${path.join(skillRoot, 'bin', 'starci.mjs')} validate <work-root-or-record-dir> [--json]`,
  `  starci-stacks-check → checkApplicationStacks({repoRoot,environment,deploymentModelFile}) in ${path.join(skillRoot, 'scripts', 'checks', 'stacks.mjs')}`,
  `  starci-code-patterns-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-scoped-lint.mjs')} --profile <nest|next> --root <repo> (--all|-- <files>)`,
  `  a check you cannot execute is reported as environment/unavailable evidence — a placeholder result is NOT proof of an upstream defect.`,
  `persistence: state lives in .starciwork/runtime.sqlite and files on disk — never in your memory.`,
  `reporting: your answer is a starci/op-report@1 JSON envelope — report.json on disk (the artifact) filed into the ledger (the durable signal):`,
  `  {"outcome":"${REPORT_OUTCOMES.join("|")}","summary":"<=600 chars","files":["paths under owned_paths"],"checks":[{"name","command","exitCode","evidence<=400ch"}],`,
  `   "open":[...] when partial, "question":{"text","options":[]} when ask, "blocker":{"kind","detail"} when blocked}`,
  `  run/task/dispatch/from are stamped by the api — never write another job's identity. File it:`,
  `  node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} report --repo ${repo} --job ${jobId} --report <path-to-report.json>`,
  `  read your contract the same way: node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} op-contract --repo ${repo} --job ${jobId}`,
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${verdictContract}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
  ].join('\n');
};

// dispatch-rejected — the shared refusal for every launch kind: the job must
// NEVER stand 'running' on a launch that failed. Job → failed with a typed
// result, lease rows released, one event — and when `incident` is set (the
// post-launch attestation failures) a typed infra-provider incident so survey
// sees it without parsing events. `terminal` is the launch's handle: a
// terminal handle for command-terminal jobs, a Dispatch id for managed ones.
const rejectDispatch = (ledger, job, jobId, op, model, {
  step, signal = null, error = null, terminal = null, incident = false,
  effectState = 'none', details = null, providerHealthEvidence = null,
}) => {
  const authFailure = Boolean(providerHealthEvidence) || confirmedAuthFailure({ step, signal, error, details });
  // rejectDispatch is reached only before an accepted operation contract or
  // business verdict. Once the host proves effectState:none, the same durable
  // candidate is safe to reroute regardless of whether the infrastructure
  // cause was auth, the machine arbiter, or worker startup. Provider auth has
  // the additional side effect of opening the typed provider circuit.
  const reusable = effectState === 'none';
  const status = reusable ? 'queued' : (['partial', 'unknown', 'committed'].includes(effectState) ? 'effect_unknown' : 'failed');
  let providerHealth = null;
  ledger.transaction(() => {
    const now = Date.now();
    const leasesReleased = effectState === 'none'
      ? ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes
      : 0;
    if (authFailure) {
      providerHealth = providerHealthEvidence ?? writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now,
      });
    } else if (step === 'readiness' && model?.provider) {
      // A spawned terminal that never reaches readiness means the provider's
      // launch path is broken, not the job. Open the same typed circuit (with
      // the shorter non-auth cooldown) so route/dispatch skip the dead pool
      // instead of burning attempts on repeated readiness timeouts.
      providerHealth = writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now,
        failureKind: 'readiness',
      });
    }
    const priorPayload = jobPayloadOf(job);
    if (terminal && MANAGED_KINDS.includes(model.kind)) {
      priorPayload.managed = {
        ...(priorPayload.managed ?? {}), dispatchId: terminal,
        rejectedBeforeContract: true,
      };
    }
    const result = {
      reason: 'dispatch-rejected', step, signal, detail: error, provider: model.provider,
      effectState, attemptConsumed: !reusable, retryable: reusable, providerHealth, at: now,
    };
    if (effectState === 'none') {
      ledger.db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, worker_id=NULL, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
        .run(status, JSON.stringify(priorPayload), JSON.stringify(result), now, jobId);
    } else {
      ledger.db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, worker_id=COALESCE(?,worker_id), updated_at=? WHERE job_id=?')
        .run(status, JSON.stringify(priorPayload), JSON.stringify(result), terminal, now, jobId);
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-rejected',
      payload: { op, step, signal, error, provider: model.provider, model: model.target, terminal,
        effectState, attemptConsumed: !reusable, retryable: reusable, leasesReleased, providerHealth },
    });
    if (providerHealth) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'provider', entityId: providerHealth.provider,
        kind: providerHealth.failureKind === 'auth' ? 'provider-auth-unavailable' : 'provider-unavailable',
        payload: providerHealth,
      });
    }
    // Provider auth is represented by the expiring provider-health circuit.
    // A permanent open incident would outlive that cooldown and prevent
    // recovery after the owner refreshes credentials.
    if (incident && !authFailure) {
      ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)")
        .run(`inc-${newToken().slice(0, 12)}`, job.workflow_id, op,
          `[infra-provider] ${JSON.stringify({ provider: model.provider, signal: signal ?? error ?? null, jobId })}`, now);
    }
  });
  return { status, effectState, attemptConsumed: !reusable, retryable: reusable, providerHealth };
};

/* ------------------------------------------------------ op IPC helpers */
// §6 admission for an op dispatch. The durable fence is taken BEFORE anything
// launches, on both launch kinds: one `path:<normalized owned_path>` resource
// per payload.owned_paths entry (capacity 1 = exclusive write ownership —
// seeded OR IGNORE so an operator-declared capacity is never overwritten),
// then reserveTwoPhase flips the job queued → leased with its fencing token
// and registers the ledger on the machine arbiter. The arbiter is REQUIRED by
// reserveTwoPhase's signature even for repo-only leases (it registers the
// ledger and would hold any machineNeeds) — the same openMachine handle
// settle already uses. An open failure returns !ok: a dispatch that cannot
// fence must not launch.
// Bounds a crashed worker's fence; settle releases early. One authority:
// modules/models/runtimes.yaml allocation.dispatchLeaseTtlMs.
const DISPATCH_LEASE_TTL_MS = allocationMs('dispatchLeaseTtlMs');
// engine/admission.mjs owns owned-path normalization and the capacity-1 lease
// request per minimal prefix — the same function the ledger's conflict finder
// resolves paths with, so a request and a held lease can never disagree.
const opLeaseRequests = (payload) => ownedPathLeaseRequests((payload.owned_paths ?? []).filter(Boolean));

const reserveOpLeases = (ledger, job, payload, { ttlMs = DISPATCH_LEASE_TTL_MS } = {}) => {
  const db = ledger.db, leases = opLeaseRequests(payload);
  // Declare the path resources; reserveTwoPhase then flips the job
  // queued → leased with its fencing token — it only admits 'queued'.
  ledger.transaction(() => {
    for (const l of leases) db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(l.resourceKey);
  });
  let machine;
  try { machine = openMachine({ file: machineFileFor() }); }
  catch (e) { return { ok: false, reasons: [`machine arbiter unavailable: ${String(e?.message ?? e)}`], machineUnavailable: true }; }
  try {
    return reserveTwoPhase(ledger, machine, {
      job: {
        jobId: job.job_id, workflowId: job.workflow_id, opId: job.op_id,
        attempt: job.attempt, generation: job.generation, kind: job.kind, role: job.role ?? null,
      },
      leases, ttlMs,
    });
  } finally { machine.close(); }
};

// The kernel → worker half of the op IPC: one contracts row per
// (workflow_id,op_id,attempt) carrying what the worker was actually asked to
// do — the rendered prompt plus the structured packet. Written before the job
// is marked running; dispatch_id is the worker's handle (terminal handle for
// command-terminal launches, Dispatch id for managed ones).
const buildContractMarkdown = ({ op, jobId, prompt, packet }) =>
  `# dispatch contract — [Op] ${op} (job ${jobId})\n\n${prompt}\n\n## packet\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\`\n`;
const fileContract = (db, { job, op, dispatchId, markdown, context, now }) =>
  db.prepare('INSERT OR REPLACE INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(job.workflow_id, op, job.attempt, dispatchId, markdown, JSON.stringify(context ?? null), now);

function cmdDispatch(ledger, args, repo) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  if (job.status !== 'queued') throw Object.assign(new Error(`job ${jobId} cannot dispatch while ${job.status}; settle/reconcile the current worker first`), { code: 'job-not-queued' });
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of dispatching a duplicate`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  const model = resolveModel(args.model ?? payload.model ?? 'qwen-agent'); // orchestrationDefault: qwen-agent
  if (model.error) throw Object.assign(new Error(model.error), { code: 'model-unknown' });
  const briefAbs = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  const briefExists = fs.existsSync(briefAbs);

  const packet = buildPacket({ job: { ...job, op_id: op }, payload, model, goal: latestGoal(db, job.workflow_id) });
  const priorFailures = job.attempt > 1 ? (() => {
    const row = db.prepare('SELECT attempt, checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt<? ORDER BY attempt DESC LIMIT 1')
      .get(job.workflow_id, op, job.attempt);
    if (!row) return [];
    return (JSON.parse(row.checks_json ?? '{}')?.checks ?? [])
      .filter((c) => c && c.exitCode !== 0)
      .map((c) => ({ name: c.name ?? 'unnamed-check', evidence: `attempt ${row.attempt}: ${String(c.evidence ?? '').slice(0, 400)}` }));
  })() : [];
  const prompt = buildPrompt(packet, jobId, repo, priorFailures);
  const worktree = args.worktree ?? repo;
  const title = `[Op] ${op}`;
  // The composed command is what a spawn would actually run — card env prefix
  // + credential strip + requirements (the --yolo/dangerous flags). Dry-run
  // prints it so reviewers see the injected flags, not just the profile body.
  const spawnCmd = model.kind === 'command-terminal'
    ? buildSpawnCommand({ provider: model.provider, command: model.command })
    : null;
  const composedCommand = spawnCmd?.command ?? model.command;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'run', argv: ['orchestration', 'run-create', '--objective', `[Workflow] ${job.workflow_id}`, '--from', '<kernel-terminal>', '--json'], note: 'created once per workflow; later operations reuse it' },
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.attempt}`, '--display-name', title, '--spec', '<prompt>', '--from', '<kernel-terminal>', '--json'] },
      { step: 'create', argv: ['terminal', 'create', '--worktree', worktree, '--title', title, '--command', composedCommand ?? '<command>', '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle>', '--screen', '--json'], note: 'readiness — verify the prompt landed before sending' },
      { step: 'dispatch', argv: ['orchestration', 'dispatch', '--task', '<operation-task-id>', '--to', '<handle>', '--from', '<kernel-terminal>', '--run', '<workflow-run-id>', '--return-preamble', '--json'] },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle>', '--text', '<dispatch-preamble>', '--enter', '--json'] },
    ]
    : [
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.attempt}`, '--display-name', title, '--spec', '<prompt>', '--from', '<kernel-terminal>', '--json'] },
      { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--model', '<resolved-model-id>', '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>', '--json'], note: `${model.target} is a managed agent; worker-start owns dispatch/injection and must not be followed by orchestration dispatch` },
    ];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      leases: opLeaseRequests(payload),
      spawnCommand: spawnCmd
        ? { command: spawnCmd.command ?? null, commandSource: spawnCmd.commandSource ?? null, ...(spawnCmd.error ? { error: spawnCmd.error } : {}) }
        : { command: null, error: `${model.target} is launch kind '${model.kind}' — composed by 'orca orchestration worker-start', not terminal create` },
      orca: { worktree, title, launchKind: model.kind, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target} (${model.kind})`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  records: ${packet.context.records.join(', ') || '(none)'}`,
      ...(packet.context.cut ? [`  cut: ${packet.context.cut.id} ${packet.context.cut.ordinal}/${packet.context.cut.total}`] : []),
      `  owned_paths: ${packet.context.owned_paths.map((p) => p.path).join(', ') || '(none)'}`,
      `  spawn command: ${out.spawnCommand.command ?? `(none — ${out.spawnCommand.error})`}`,
      ...(out.spawnCommand.commandSource ? [`  command source: ${out.spawnCommand.commandSource}`] : []),
      '  orca commands:', ...out.orca.commands.map((c) => `    $ ${c.cli}`),
      '  (dry run — pass --spawn to launch)',
    ].join('\n'), args.json);
    return;
  }

  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  // A route decision may have been persisted before another job proves the
  // shared provider credential is dead. Re-check the durable provider circuit
  // before taking leases or creating an Orca Task so an already-routed sibling
  // pool cannot slip through the circuit.
  const providerHealth = providerHealthOf(db, model.provider);
  if (providerHealth) {
    const error = `provider ${providerHealth.failureKind ?? 'auth'} unavailable (${providerHealth.provider}); circuit open until ${providerHealth.expiresAt ?? 'explicit recovery'}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: 'provider-health', error, effectState: 'none', details: providerHealth,
      providerHealthEvidence: providerHealth,
    });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, providerHealth },
      `dispatch REJECTED for ${jobId} (provider-health): ${error}; logical attempt retained`, args.json);
    process.exit(1);
  }
  // §6 admission — the repo-path leases and the job's fencing token are taken
  // BEFORE anything launches, for both launch kinds. A refusal (a live lease
  // already owns a path, or the machine arbiter can't open) is a dispatch
  // rejection: the worker must never be what discovers the write set was
  // already taken, and an unfenced dispatch is exactly what this layer kills.
  const leaseTtlMs = Number(args['lease-ttl'] ?? payload.leaseTtlMs ?? 0) || DISPATCH_LEASE_TTL_MS;
  let reserve;
  try {
    reserve = reserveOpLeases(ledger, job, payload, { ttlMs: leaseTtlMs });
  } catch (e) {
    // Identity/status refusal (job already leased/running, or row drift): the
    // job is left untouched — an operator error, not a dispatch rejection.
    const error = String(e?.message ?? e);
    emit({ ok: false, jobId, refused: 'reserve-failed', error }, `dispatch REFUSED for ${jobId}: ${error}`, args.json);
    process.exit(1);
  }
  if (!reserve.ok) {
    const reason = (reserve.reasons ?? [reserve.reason]).filter(Boolean).join('; ') || 'reservation refused';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'reserve', error: reason });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, reserve },
      `dispatch REJECTED for ${jobId} (reserve): ${reason} — job status=failed`, args.json);
    process.exit(1);
  }
  // Managed-agent launch (managed-agent / native-managed-agent): the run →
  // task → worker-start → return-preamble → attest pipeline owns this profile.
  if (MANAGED_KINDS.includes(model.kind)) {
    return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve });
  }
  if (model.kind !== 'command-terminal') {
    throw Object.assign(new Error(`spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`), { code: 'managed-agent' });
  }
  // Command-terminal agents still join the workflow's Orca Run. Create the
  // operation Task first, then create/attest the terminal, dispatch that Task
  // to the exact handle and submit Orca's returned preamble. This gives Qwen
  // and Devin the same durable Kernel → Task → Dispatch hierarchy as managed
  // workers without pretending Orca owns their process lifecycle.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) {
    rejectDispatch(ledger, job, jobId, op, model, { step: 'run-create', error: run.error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'run-create', error: run.error },
      `dispatch REJECTED for ${jobId} (run-create): ${run.error}`, args.json);
    process.exit(1);
  }
  const { runId, kernelHandle } = run;
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.attempt, kernelHandle });
  if (!task?.ok || !task.taskId) {
    const error = task?.error ?? 'task-create returned no taskId';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'task-create', error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'task-create', error },
      `dispatch REJECTED for ${jobId} (task-create): ${error}`, args.json);
    process.exit(1);
  }
  const taskId = task.taskId;

  // spawnAgent assembles the command and attests readiness/model, but prompt
  // delivery is delayed until Orca returns this Task's authoritative preamble.
  const spawned = spawnAgent({
    provider: model.provider, worktree, title, prompt: null,
    command: model.command, dispatchId: jobId,
  });
  const handle = spawned.terminal ?? null;
  const spawn = { step: spawned.step, error: spawned.error, signal: spawned.signal ?? null, command: spawned.command, handle };
  spawn.ok = spawned.ok === true;
  if (!spawn.ok) {
    // dispatch-rejected: the job must NEVER sit 'running' on a dead spawn.
    // Job → failed with a typed result, lease rows released, one event — and
    // for attestation rejections a typed infra-provider incident so survey
    // sees it without parsing events. Terminal is already closed by spawnAgent.
    const reason = spawned.signal ?? spawned.error ?? `spawn failed at ${spawned.step}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: spawned.step, signal: spawned.signal ?? null, error: spawned.error ?? null,
      terminal: handle, incident: spawned.step === 'attestation', details: spawned,
    });
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, spawn: { ...spawn, reason } };
    emit(out, `dispatch REJECTED for ${jobId} (${spawned.step}): ${reason} — job status=${rejection.status}, terminal closed`, args.json);
    process.exit(1);
  }

  let artifact = null;
  const rejectCommand = ({ step, error = null, signal = null, dispatchId = null, incident = false, details = null }) => {
    cleanupDeliveryArtifact(artifact);
    if (handle) terminalClose({ terminal: handle });
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId ?? handle, incident, effectState: 'none', details,
    });
    const reason = signal ?? error ?? `command-terminal dispatch failed at ${step}`;
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, step, dispatchId, terminal: handle, error: reason },
      `dispatch REJECTED for ${jobId} (${step}): ${reason}`, args.json);
    process.exit(1);
  };

  const dispatched = orchDispatch({ task: taskId, to: handle, from: kernelHandle, run: runId });
  const dispatchId = dispatched?.dispatchId ?? null;
  if (!dispatched?.ok || !dispatchId || !dispatched.preamble) {
    return rejectCommand({ step: 'dispatch', dispatchId, error: dispatched?.error ?? 'orchestration dispatch returned no dispatch/preamble' });
  }
  const adapter = spawnCmd?.adapter;
  const sent = deliverPrompt({ handle, adapter, prompt: dispatched.preamble, worktree, dispatchId });
  artifact = sent.artifact ?? null;
  if (!sent.ok) return rejectCommand({ step: 'send', dispatchId, error: sent.error ?? 'terminal send failed' });
  const submitted = awaitSubmission(handle, adapter);
  if (!submitted.ok) return rejectCommand({ step: 'submission', dispatchId, signal: submitted.signal ?? null,
    error: submitted.reason, details: submitted });
  const attested = awaitAttestation(handle, adapter);
  if (!attested.ok) return rejectCommand({ step: 'attestation', dispatchId, signal: attested.signal,
    error: `attestation rejected: ${attested.signal}`, incident: true, details: attested });
  cleanupDeliveryArtifact(artifact);
  artifact = null;
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || shown.assigneeHandle !== handle) {
    return rejectCommand({ step: 'dispatch-show', dispatchId, error: shown?.error ?? `expected assignee ${handle}, got ${shown?.assigneeHandle ?? 'none'}` });
  }

  payload.orca = { ...(payload.orca ?? {}), runId, taskId, dispatchId, agentTerminalHandle: handle };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.attempt, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider,
    model: payload.modelId ?? null, profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: handle,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  ledger.transaction(() => {
    const now = Date.now();
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      context: { packet, worktree, model: model.target, orca: payload.orca, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing } },
    });
    db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, result_json=NULL, updated_at=? WHERE job_id=?")
      .run(handle, JSON.stringify(payload), now, jobId);
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, generation: job.generation });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, terminal: handle, dispatch: dispatchId, runId, taskId, model: model.target, worktree, nodeId: payload.hierarchy.nodeId, parentNodeId: payload.hierarchy.parentNodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  });
  const out = { ok: true, jobId, spawned: true, handle, dispatchId, packet, spawn, hierarchy: payload.hierarchy,
    orca: { runId, taskId, dispatchId, assignee: handle } };
  emit(out, `dispatched ${jobId} — [Op] ${op} on ${handle} (${model.target}, dispatch ${dispatchId}); job status=running`, args.json);
}

// launch.orca.kind values that take the managed pipeline — profiles write
// 'managed-agent', agent cards write 'native-managed-agent'; both mean
// orchestration worker-start, never terminal create.
const MANAGED_KINDS = ['native-managed-agent', 'managed-agent'];

// One Orca Run per workflow, bound to the dedicated Kernel terminal. The Run
// is created lazily by the first operation so Kernel boot stays independent of
// launcher context. Every operation Task in that Run is therefore a semantic
// child of the Kernel coordinator even when its terminal is a peer tab in the
// same worktree.
function ensureWorkflowRun(ledger, { job, jobId, payload }) {
  const db = ledger.db;
  const kernelJob = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1").get(job.workflow_id);
  const kernelPayload = jobPayloadOf(kernelJob);
  let runId = kernelPayload?.orca?.runId ?? payload?.orca?.runId ?? null;
  if (runId) return { ok: true, runId, kernelJob, kernelPayload, kernelHandle: kernelJob?.worker_id ?? null };

  const wf = getWorkflow(db, job.workflow_id);
  const objective = `[Workflow] ${job.workflow_id} — ${wf?.title ?? job.workflow_id}`;
  const created = runCreate({ objective, from: kernelJob?.worker_id ?? null });
  if (!created?.ok || !created.runId) {
    return { ok: false, error: created?.error ?? 'run-create returned no runId', kernelJob, kernelPayload };
  }
  runId = created.runId;
  ledger.transaction(() => {
    const now = Date.now();
    if (kernelJob) {
      kernelPayload.orca = { ...(kernelPayload.orca ?? {}), runId };
      kernelPayload.hierarchy = kernelPayload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: kernelNodeId(job.workflow_id),
        parentNodeId: workflowNodeId(job.workflow_id), role: 'kernel',
        workflowId: job.workflow_id, jobId: kernelJob.job_id,
        attempt: kernelJob.attempt, generation: kernelJob.generation,
      };
      kernelPayload.hierarchy.runtime = { ...(kernelPayload.hierarchy.runtime ?? {}), host: 'orca', runId };
      db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(kernelPayload), now, kernelJob.job_id);
    } else {
      payload.orca = { ...(payload.orca ?? {}), runId };
      payload.hierarchy = payload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
        workflowId: job.workflow_id, jobId, opId: job.op_id,
        attempt: job.attempt, generation: job.generation,
      };
      payload.hierarchy.runtime = { ...(payload.hierarchy.runtime ?? {}), host: 'orca', runId };
      db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(payload), now, jobId);
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'run-created', payload: { runId, kernelTerminal: kernelJob?.worker_id ?? null, storedOn: kernelJob ? kernelJob.job_id : jobId },
    });
  });
  return { ok: true, runId, kernelJob, kernelPayload, kernelHandle: kernelJob?.worker_id ?? null };
}

const createOperationTask = ({ runId, prompt, op, title, attempt, kernelHandle }) =>
  taskCreate({
    run: runId,
    spec: prompt,
    taskTitle: `${op} #${attempt}`,
    displayName: title,
    from: kernelHandle,
  });

// Orca can report worker-start as effect_unknown when prompt injection stalls,
// even though the exact worker process has already exited.  A retained
// terminal with reason=identity_unproven is then bookkeeping, not a live
// process.  This is the narrow proof accepted by calls.yaml: exact worker,
// failed before model input, process gone, and release either completed or
// retained only because there is no remaining process identity to release.
const managedNoEffectProof = ({ shown, release }) => {
  const result = shown?.result ?? {};
  const observation = result.observation ?? {};
  const terminal = result.terminal ?? observation.terminal ?? result.worker?.terminal ?? {};
  const workerStage = result.worker?.stage ?? result.stage ?? null;
  const lastFailure = result.dispatch?.last_failure ?? shown?.dispatch?.last_failure ?? null;
  const exactExited = observation.exactWorker === true && (
    observation.status === 'exited'
    || (terminal.connected === false && terminal.writable === false)
  );
  const releaseSettled = release?.ok === true || (
    release?.state === 'retained' && release?.result?.reason === 'identity_unproven'
  );
  return shown?.ok === true
    && shown?.state === 'failed'
    && workerStage === 'dispatch_input'
    && lastFailure === 'agent_prompt_stalled'
    && exactExited
    && releaseSettled;
};

const cleanupManagedWorker = (dispatchId) => {
  if (!dispatchId) return { effectState: 'partial', stop: null, release: null, observation: null };
  let stop = null, release = null, observation = null;
  try { stop = workerStop({ dispatch: dispatchId }); }
  catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  try { release = workerRelease({ dispatch: dispatchId }); }
  catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  try { observation = workerShow({ dispatch: dispatchId }); }
  catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
  const provenNoEffect = managedNoEffectProof({ shown: observation, release });
  const effectState = provenNoEffect || (stop?.ok && release?.ok)
    ? 'none'
    : ([stop?.effectState, release?.effectState].includes('unknown') ? 'unknown' : 'partial');
  return { effectState, stop, release, observation, provenNoEffect };
};

// Managed-agent dispatch: run → task → worker-start → worker-show attestation.
// worker-start owns Task injection; issuing orchestration dispatch again would
// double-dispatch the Task and is a typed runtime rejection. Any step's failure takes the same dispatch-rejected
// path as a dead terminal spawn (job failed + event + infra-provider incident
// on attestation failures) — after stopping and releasing whatever partial
// Dispatch the attempt created, per calls.yaml settle-dispatch.
function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve }) {
  const db = ledger.db;

  const reconcileFailure = (effectState, dispatchId) => {
    if (effectState === 'none') return { effectState: 'none', observation: null, cleanup: null };
    if (effectState === 'unknown') {
      if (!dispatchId) return { effectState: 'unknown', observation: null, cleanup: null };
      let observation;
      try { observation = workerShow({ dispatch: dispatchId }); }
      catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
      if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state))
        return { effectState: 'unknown', observation, cleanup: null };
      const cleanup = cleanupManagedWorker(dispatchId);
      return { effectState: cleanup.effectState, observation, cleanup };
    }
    const cleanup = cleanupManagedWorker(dispatchId);
    return { effectState: cleanup.effectState, observation: null, cleanup };
  };

  const reject = ({ step, signal = null, error = null, dispatchId = null, incident = false,
    effectState = 'none', details = null }) => {
    const reconciliation = reconcileFailure(effectState, dispatchId);
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId, incident,
      effectState: reconciliation.effectState, details,
    });
    const reason = signal ?? error ?? `managed dispatch failed at ${step}`;
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection,
      managed: { step, dispatchId, effectState: reconciliation.effectState,
        ...(reconciliation.observation ? { observation: reconciliation.observation } : {}),
        ...(reconciliation.cleanup ? { cleanup: reconciliation.cleanup } : {}) } };
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=${rejection.status}, effect=${reconciliation.effectState}${reconciliation.cleanup ? `, worker ${dispatchId} cleanup stop=${reconciliation.cleanup.stop?.ok} release=${reconciliation.cleanup.release?.ok}` : ''}`, args.json);
    process.exit(1);
  };

  // 1. Launch model: the `api route` decision on the job payload wins; without
  // it resolveLaunchModel picks the pool's pin for the job's difficulty.
  let modelId = payload.modelId ?? null;
  let effort = payload.effort ?? null;
  if (!modelId) {
    const resolved = resolveLaunchModel(model.target, payload.difficulty ?? 'medium');
    if (!resolved || resolved.error || !resolved.modelId) {
      return reject({ step: 'route', error: resolved?.error ?? 'resolveLaunchModel returned no modelId' });
    }
    modelId = resolved.modelId;
    effort = resolved.effort ?? null;
  }

  // 2. Run id — one workflow Run, with the Kernel terminal as coordinator.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) return reject({ step: 'run-create', error: run.error });
  const { runId, kernelHandle } = run;

  // 3. Task — the operation's contract. The spec is the rendered packet prompt
  // (the same text a command-terminal launch would have sent).
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.attempt, kernelHandle });
  if (!task?.ok || !task.taskId) {
    return reject({ step: 'task-create', error: task?.error ?? 'task-create returned no taskId' });
  }
  const taskId = task.taskId;

  // 4. worker-start — outcome ok means a ready worker (calls.yaml classify:
  // exit 0 + result.state 'ready'). Anything else, including a receipt with no
  // dispatchId, is a rejection; a partial effect is stopped + released.
  const started = workerStart({
    task: taskId, worktree, agent: model.provider, model: modelId, effort,
    displayName: title, run: runId, from: kernelHandle,
  });
  const dispatchId = started?.dispatchId ?? null;
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return reject({
      step: 'worker-start', dispatchId,
      error: started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
      effectState: started?.effectState ?? 'unknown', details: started,
    });
  }

  // 5. Resolve the exact terminal worker-start already dispatched. This is a
  // read/attestation step, not a second orchestration dispatch.
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || !shown.assigneeHandle) {
    return reject({ step: 'dispatch-show', error: shown?.error ?? 'dispatch-show returned no assignee', dispatchId,
      effectState: 'partial', details: shown });
  }

  // Managed workers created inside an existing worktree receive Orca's
  // default `worker-task_<id>` terminal title; worker-start creation labels
  // do not apply there. Rename the exact attested assignee so the visible UI
  // preserves the semantic [Op] role. A presentation failure must not stop a
  // healthy worker, but it is returned and persisted for diagnosis.
  let terminalTitle = null;
  try { terminalTitle = terminalRename({ terminal: shown.assigneeHandle, title }); }
  catch (e) { terminalTitle = { ok: false, terminal: shown.assigneeHandle, title, error: String(e?.message ?? e) }; }

  // 6. Attest — the worker's EFFECTIVE agent/model must equal what routing
  // decided. A mismatch is a provider-side defect: rejected with the typed
  // infra-provider incident (same as a terminal attestation rejection).
  const attest = workerShow({ dispatch: dispatchId });
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  if (attest?.ok !== true || effAgent !== model.provider || effModel !== modelId) {
    return reject({
      step: 'attestation', dispatchId, incident: true,
      signal: `worker attest failed: expected agent=${model.provider} model=${modelId}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      effectState: 'partial', details: attest,
    });
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId, agentTerminalHandle: shown.assigneeHandle,
    terminalTitle: title, terminalTitleApplied: terminalTitle?.ok === true };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  payload.modelId = modelId;
  payload.effort = effort;
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.attempt, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider, model: modelId,
    profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: shown.assigneeHandle,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  ledger.transaction(() => {
    const now = Date.now();
    // Same contract-first order as the terminal path: the contracts row is
    // the dispatch authority; dispatch_id is the worker's Dispatch id.
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      context: { packet, worktree, model: model.target, managed: payload.managed, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing } },
    });
    db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, result_json=NULL, updated_at=? WHERE job_id=?")
      .run(dispatchId, JSON.stringify(payload), now, jobId);
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, generation: job.generation });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, dispatch: dispatchId, model: model.target, worktree, managed: true, runId, taskId, modelId, parentNodeId: payload.hierarchy.parentNodeId, nodeId: payload.hierarchy.nodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  });
  const out = {
    ok: true, jobId, spawned: true, dispatchId, packet,
    managed: { runId, taskId, dispatchId, modelId, effort, assignee: shown.assigneeHandle, terminalTitle },
    hierarchy: payload.hierarchy,
  };
  emit(out, `dispatched ${jobId} — [Op] ${op} managed worker ${dispatchId} (${model.target}/${modelId}, task ${taskId}); job status=running`, args.json);
}

/* ----------------------------------------------------------- reconcile */
// Re-open an effect_unknown dispatch only when the host can now prove that
// the exact managed worker never crossed the operation boundary.  This is an
// infrastructure retry, so it preserves the same job id and attempt number.
// Ambiguous state remains fenced and requires owner/runtime intervention.
function cmdReconcile(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  const payload = jobPayloadOf(job);
  if (job.status === 'queued') {
    const worker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
    const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? null;
    const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, job.op_id, job.attempt);
    if (worker?.connected && worker?.writable && contract && (!dispatchId || contract.dispatch_id === dispatchId)) {
      const reserve = reserveOpLeases(ledger, job, payload);
      if (!reserve?.ok) {
        throw Object.assign(new Error(`live worker ${worker.terminalHandle} cannot recover its exact lease: ${(reserve?.reasons ?? [reserve?.reason]).filter(Boolean).join('; ') || 'reservation refused'}`), {
          code: 'live-worker-lease-conflict', worker, reserve,
        });
      }
      const workerId = payload.managed?.dispatchId ?? worker.terminalHandle;
      ledger.transaction(() => {
        const now = Date.now();
        const result = { reason: 'live-worker-reconciled', effectState: 'committed', attemptConsumed: false,
          worker: worker.terminalHandle, dispatchId: contract.dispatch_id, leaseToken: reserve.leaseToken, at: now };
        db.prepare("UPDATE jobs SET status='running',worker_id=?,result_json=?,updated_at=? WHERE job_id=?")
          .run(workerId, JSON.stringify(result), now, jobId);
        ledger.appendEvent({
          workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
          kind: 'live-worker-reconciled', payload: { terminal: worker.terminalHandle, dispatchId: contract.dispatch_id,
            attempt: job.attempt, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
        });
      });
      const out = { ok: true, jobId, reconciled: true, status: 'running', attempt: job.attempt,
        effectState: 'committed', worker, dispatchId: contract.dispatch_id, leasesRecovered: reserve.leases?.length ?? opLeaseRequests(payload).length };
      emit(out, `reconciled ${jobId}: reattached live worker ${worker.terminalHandle}; exact leases restored; no duplicate spawned`, args.json);
      return;
    }
    const out = { ok: true, jobId, reconciled: false, alreadyQueued: true, attempt: job.attempt };
    emit(out, `reconcile ${jobId}: already queued (attempt ${job.attempt})`, args.json);
    return;
  }
  if (job.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; reconcile requires effect_unknown`), { code: 'job-not-reconcilable' });
  }
  const dispatchId = payload.managed?.dispatchId
    ?? (String(job.worker_id ?? '').startsWith('ctx_') || String(job.worker_id ?? '').startsWith('dispatch-') ? job.worker_id : null);
  if (!dispatchId) throw Object.assign(new Error(`job ${jobId} has no managed dispatch identity`), { code: 'dispatch-identity-missing' });

  // An accepted contract or worker report is evidence that the operation may
  // have begun.  Never turn that evidence back into a reusable launch slot.
  const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, job.op_id, job.attempt);
  const report = db.prepare('SELECT dispatch_id,outcome FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (contract || report) {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: 'unknown',
      reason: contract ? 'accepted-contract-exists' : 'worker-report-exists', contract: contract ?? null, report: report ?? null };
    emit(out, `reconcile REFUSED for ${jobId}: ${out.reason}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  const cleanup = cleanupManagedWorker(dispatchId);
  if (cleanup.effectState !== 'none') {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: cleanup.effectState, cleanup };
    emit(out, `reconcile WAIT for ${jobId}: effect=${cleanup.effectState}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  let machineRefs = [], leasesReleased = 0;
  ledger.transaction(() => {
    const now = Date.now();
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL')
      .all(jobId).map((r) => r.machine_ref);
    leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    const nextPayload = jobPayloadOf(job);
    delete nextPayload.managed;
    if (nextPayload.hierarchy?.runtime) {
      const { taskId, dispatchId: ignoredDispatch, terminalHandle, ...runtime } = nextPayload.hierarchy.runtime;
      nextPayload.hierarchy.runtime = runtime;
    }
    const result = {
      reason: 'dispatch-reconciled', dispatchId, effectState: 'none',
      attemptConsumed: false, retryable: true, proof: {
        exactWorker: cleanup.observation?.result?.observation?.exactWorker === true,
        workerState: cleanup.observation?.state ?? null,
        workerStage: cleanup.observation?.result?.worker?.stage ?? cleanup.observation?.result?.stage ?? null,
        lastFailure: cleanup.observation?.result?.dispatch?.last_failure ?? cleanup.observation?.dispatch?.last_failure ?? null,
        releaseState: cleanup.release?.state ?? null,
        releaseReason: cleanup.release?.result?.reason ?? null,
      }, at: now,
    };
    db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,payload_json=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?")
      .run(JSON.stringify(nextPayload), JSON.stringify(result), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-reconciled', payload: { dispatchId, effectState: 'none', attempt: job.attempt,
        attemptConsumed: false, leasesReleased, machineRefs, proof: result.proof },
    });
  });

  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  const out = { ok: true, jobId, reconciled: true, dispatchId, status: 'queued', attempt: job.attempt,
    effectState: 'none', attemptConsumed: false, leasesReleased, machineRefsReleased, cleanup };
  emit(out, `reconciled ${jobId}: ${dispatchId} proved no-effect; same attempt ${job.attempt} queued (leases released: ${leasesReleased})`, args.json);
}

/* ---------------------------------------------------------------- settle */
function cmdSettle(ledger, args, repo) {
  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  const reportAbs = args.report
    ? [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p))
    : null;
  if (args.report && !reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });

  let machineRefs = [], released = 0, job, reportsConsumed = false, reportFiled = false, reportOutcome = null;
  let checkEvidence = { observed: 0, passed: 0, failed: 0, green: false }, claimOverruled = false;
  ledger.transaction(() => {
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
    if (SETTLED.includes(job.status) && job.status !== 'effect_unknown') {
      throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
    }
    if (verdict === 'pass') requireDispatchedReportBinding(db, job);
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.report = reportAbs;
    payload.settledAt = Date.now();
    const status = verdict === 'pass' ? 'succeeded' : 'failed';
    const checkRow = db.prepare('SELECT checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, jobOpOf(job), job.attempt);
    const checksEnvelope = parseJson(checkRow?.checks_json);
    const recordedChecks = Array.isArray(checksEnvelope?.checks) ? checksEnvelope.checks : [];
    checkEvidence = summarizeCheckEvidence(checksEnvelope);
    const result = { verdict, report: reportAbs, at: payload.settledAt, checkEvidence };
    // The worker's claim is the reports row keyed by its dispatch. No row yet:
    // a --report file that is itself a valid op-report@1 envelope is filed on
    // the job's behalf first; anything else (markdown, absent — a dead worker)
    // settles on the kernel's verdict alone.
    const dispatchId = reportDispatchIdOf(job);
    const row = db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId);
    let envelope = null;
    if (row) envelope = parseJson(row.report_json);
    if (!row && reportAbs) {
      const ownedPaths = (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
      const valid = validateOpReport(parseJson(fs.readFileSync(reportAbs, 'utf8')), { ownedPaths, identity: reportIdentityOf(job) });
      if (valid.ok) {
        envelope = valid.report;
        db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
          .run(job.workflow_id, dispatchId, jobOpOf(job), job.attempt, job.generation, envelope.outcome, JSON.stringify(envelope), job.worker_id ?? null, payload.settledAt);
      }
    }
    if (envelope?.outcome) {
      reportOutcome = envelope.outcome;
      reportFiled = true;
      if (!VERDICT_OUTCOMES[verdict].includes(envelope.outcome)) {
        if (verdict === 'fail' && envelope.outcome === 'done' && checkEvidence.failed > 0) {
          claimOverruled = true;
          result.claimOverruled = true;
        } else {
          throw Object.assign(new Error(`verdict '${verdict}' cannot settle a report of outcome '${envelope.outcome}'`), { code: 'verdict-outcome-mismatch' });
        }
      }
    }
    if (verdict === 'pass') {
      if (reportOutcome !== 'done') {
        throw Object.assign(new Error(`pass requires a filed done report for ${jobId}`), { code: 'pass-report-missing' });
      }
      if (!checkEvidence.green) {
        throw Object.assign(new Error(`pass requires independently recorded green checks for ${jobId}`), { code: 'checks-not-green' });
      }
      if (payload.cut) {
        const requiredNames = payload.cut.ordinal < payload.cut.total
          ? ['cut-slice-postcondition', 'cut-regression-inventory']
          : ['cut-slice-postcondition', 'cut-regression-inventory', 'full-regression-final'];
        const missing = requiredNames.filter((name) => !recordedChecks.some((check) => check?.name === name && check.exitCode === 0));
        if (missing.length) {
          throw Object.assign(new Error(`cut pass for ${jobId} missing required green checks: ${missing.join(', ')}`), {
            code: 'cut-checks-missing', cut: payload.cut, missing,
          });
        }
      }
    }
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map((r) => r.machine_ref);
    released = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
      .run(status, JSON.stringify(payload), JSON.stringify(result), payload.settledAt, jobId);
    // Integrating the verdict consumes the job's reports row — the durable
    // worker→kernel signal is spent exactly once (dispatch_id is the worker's
    // handle, falling back to the job id when none was ever bound).
    reportsConsumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(payload.settledAt, job.workflow_id, reportDispatchIdOf(job)).changes > 0;
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-settled', payload: { verdict, status, report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, leasesReleased: released, machineRefs, reportsConsumed },
    });
  });

  // Mirror of releaseTwoPhase's machine half: lease rows are gone; now release
  // the paired machine tokens. Best-effort — a missing machine db never fails
  // the settle (the ledger row is already the record).
  let machineReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger settle stands; machine TTLs expire on their own */ }
  }

  // The settled op's Orca terminal is released with its leases — worker_id is
  // the handle. Runs after the settled state is written; a close failure
  // never un-settles.
  // Managed jobs hold a Dispatch id in worker_id, not a terminal handle — they
  // take the worker-stop/-release path below, never terminal close.
  const managed = jobPayloadOf(job)?.managed ?? null;
  let terminalClosed = null;
  if (job.worker_id && !managed) {
    const closed = terminalClose({ terminal: job.worker_id });
    terminalClosed = { handle: job.worker_id, ok: closed.ok === true, ...(closed.error ? { error: closed.error } : {}) };
  }

  // Managed settle — calls.yaml settle-dispatch: worker-stop then
  // worker-release the exact Dispatch. A stop that classifies unknown is
  // reconciled by a worker-show read and the residual state is recorded on
  // the settle result (worker-abandon stays out of scope here — it is only
  // legal once the attempt's own terminal is proven closed). A stop/release
  // failure never un-settles the job; the ledger row already stands.
  let managedWorker = null;
  if (managed?.dispatchId) {
    let stop = null, release = null, residual = null;
    try { stop = workerStop({ dispatch: managed.dispatchId }); }
    catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    if (stop?.ok !== true || stop?.outcome === 'unknown') {
      try {
        const shown = workerShow({ dispatch: managed.dispatchId });
        residual = { ok: shown?.ok === true, state: shown?.state ?? null, effective: shown?.effective ?? null };
      } catch (e) { residual = { error: String(e?.message ?? e) }; }
    }
    try { release = workerRelease({ dispatch: managed.dispatchId }); }
    catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    managedWorker = {
      dispatchId: managed.dispatchId,
      stop: { ok: stop?.ok === true, outcome: stop?.outcome ?? null, state: stop?.state ?? null, ...(stop?.error ? { error: stop.error } : {}) },
      release: { ok: release?.ok === true, outcome: release?.outcome ?? null, state: release?.state ?? null, ...(release?.error ? { error: release.error } : {}) },
      ...(residual ? { residual } : {}),
    };
  }

  const status = verdict === 'pass' ? 'succeeded' : 'failed';
  const out = { ok: true, jobId, verdict, status, report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, leasesReleased: released, machineRefsReleased: machineReleased, reportsConsumed, terminalClosed, ...(managedWorker ? { managedWorker } : {}) };
  emit(out, `settled ${jobId} verdict=${verdict} status=${status} (leases released: ${released}${reportsConsumed ? ', report consumed' : ''}${terminalClosed ? `, terminal ${terminalClosed.handle} closed=${terminalClosed.ok}` : ''}${managedWorker ? `, worker ${managedWorker.dispatchId} stop=${managedWorker.stop.ok} release=${managedWorker.release.ok}` : ''})`, args.json);
}

/* -------------------------------------------------------------- incident */
function cmdIncident(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const incidentId = `inc-${newToken().slice(0, 12)}`;
  ledger.transaction(() => {
    db.prepare(
      "INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)"
    ).run(incidentId, workflowId, args.op ?? null, `[${args.kind}] ${args.detail}`, now);
    ledger.appendEvent({
      workflowId, entityType: 'incident', entityId: incidentId,
      kind: 'incident-raised', payload: { kind: args.kind, detail: args.detail, opId: args.op ?? null },
    });
  });
  const out = { ok: true, incidentId, workflowId, kind: args.kind, status: 'open' };
  emit(out, `incident ${incidentId} open on ${workflowId} — ${args.kind}: ${args.detail}`, args.json);
}

/* ---------------------------------------------------------------- finish */
function cmdFinish(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const already = wf.phase === 'finished';

  const openOperations = db.prepare(
    `SELECT job_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...FINAL_SETTLED);
  if (!already && openOperations.length) {
    throw Object.assign(new Error(`workflow ${workflowId} still has ${openOperations.length} unsettled operation(s)`), {
      code: 'workflow-open-jobs', openJobs: openOperations,
    });
  }

  const kernelSignal = db.prepare("SELECT token,value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const kernelJob = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY created_at DESC LIMIT 1").get(workflowId);
  const kernelPayload = kernelJob ? jobPayloadOf(kernelJob) : null;
  const kernelTerminal = parseJson(kernelSignal?.value_json)?.terminal
    ?? kernelJob?.worker_id
    ?? kernelPayload?.hierarchy?.runtime?.terminalHandle
    ?? null;

  // Finish ≠ erase: goals/events/jobs history stays. Live Kernel custody does
  // not: release the singleton signal and settle its job before asking Orca
  // to close the exact terminal.
  let closed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0;
  ledger.transaction(() => {
    db.prepare("UPDATE workflows SET phase='finished', finished_json=?, updated_at=? WHERE workflow_id=?")
      .run(JSON.stringify({ finishedAt: now, by: 'kernel-api' }), now, workflowId);
    closed = db.prepare("UPDATE inbox SET status='done', applied_at=? WHERE workflow_id=? AND status NOT IN ('done','applied')").run(now, workflowId).changes;
    kernelSignalsReleased = db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId).changes;
    if (kernelJob) {
      const nextPayload = { ...kernelPayload, finishedAt: now };
      if (nextPayload.hierarchy?.runtime) {
        nextPayload.hierarchy = { ...nextPayload.hierarchy, runtime: {
          ...nextPayload.hierarchy.runtime, terminalHandle: null, releasedAt: now,
        } };
      }
      kernelJobsSettled = db.prepare("UPDATE jobs SET status='succeeded',worker_id=NULL,lease_token=NULL,deadline=NULL,payload_json=?,result_json=?,updated_at=? WHERE job_id=? AND status NOT IN ('succeeded','failed')")
        .run(JSON.stringify(nextPayload), JSON.stringify({ verdict: 'pass', reason: 'workflow-finished', at: now }), now, kernelJob.job_id).changes;
      db.prepare('DELETE FROM leases WHERE job_id=?').run(kernelJob.job_id);
    }
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'workflow-finished', payload: { inboxClosed: closed, alreadyFinished: already, kernelSignalsReleased, kernelJobsSettled, kernelTerminal },
    });
  });
  const out = { ok: true, workflowId, phase: 'finished', inboxClosed: closed, alreadyFinished: already,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal) };
  emit(out, `workflow ${workflowId} finished${already ? ' (was already finished)' : ''} — inbox rows closed: ${closed}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${kernelTerminal ? `, terminal ${kernelTerminal} close requested` : ''}; history preserved`, args.json);
  // Emit the durable receipt first because a Kernel normally closes its own
  // terminal here. The ledger is already authoritative if the host closes the
  // PTY before the terminal-close client can print its own receipt.
  if (kernelTerminal) {
    try { terminalClose({ terminal: kernelTerminal }); } catch { /* finished state stands; monitor reconciles host cleanup */ }
  }
}

/* ------------------------------------------------------------- op IPC */
// The op-IPC durability verbs: contracts out (kernel→worker, written at
// dispatch), reports in (worker→kernel, filed by the worker), checks beside
// them. The files on disk stay the artifacts; the rows are the durable
// signal the kernel consumes.
const resolveJob = (db, jobId) => {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  return job;
};
const jobOpOf = (job) => job.op_id ?? jobPayloadOf(job).opId ?? null;
// reports.dispatch_id is the orchestration Dispatch id whenever one exists.
// command-terminal jobs retain their terminal handle in worker_id for exact
// cleanup, so payload.orca.dispatchId is the durable report identity.
const reportDispatchIdOf = (job) => {
  const payload = jobPayloadOf(job);
  return payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? job.worker_id ?? job.job_id;
};
const REPORTABLE_JOB_STATUSES = new Set(['running', 'answering', 'effect_unknown']);
const explicitReportDispatchIdOf = (job) => {
  const payload = jobPayloadOf(job);
  return payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? null;
};
const requireDispatchedReportBinding = (db, job) => {
  if (!REPORTABLE_JOB_STATUSES.has(job.status)) {
    throw Object.assign(new Error(`job ${job.job_id} cannot file or verify a worker report while ${job.status}`), {
      code: 'report-job-not-active', status: job.status,
    });
  }
  const dispatchId = explicitReportDispatchIdOf(job);
  if (!dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no bound operation dispatch`), { code: 'report-dispatch-unbound' });
  }
  const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, jobOpOf(job), job.attempt);
  if (!contract || contract.dispatch_id !== dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no contract bound to dispatch ${dispatchId}`), {
      code: 'report-contract-unbound', dispatchId,
    });
  }
  return dispatchId;
};
const parseAttempt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error(`--attempt must be a positive integer, got '${v}'`), { code: 'bad-attempt' });
  return n;
};

/* --------------------------------------------------------------- report */
// Worker-facing: the report file is a starci/op-report@1 JSON envelope — the
// row is the durable signal and the ONLY shape the kernel reads
// (UNIQUE(workflow_id,dispatch_id) makes a re-file idempotent). The api stamps
// run/task/dispatch/from from the job row; a file that claims a different
// identity is report-invalid. --outcome is optional consistency: when given it
// must equal the envelope's outcome.
const reportIdentityOf = (job) => {
  const payload = jobPayloadOf(job);
  return { run: payload.managed?.runId ?? payload.orca?.runId ?? null,
           task: payload.managed?.taskId ?? payload.orca?.taskId ?? null,
           dispatch: reportDispatchIdOf(job), from: job.job_id };
};
function cmdReport(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const jobPayload = jobPayloadOf(job);
  requireDispatchedReportBinding(db, job);
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });
  const parsed = parseJson(fs.readFileSync(reportAbs, 'utf8'));
  const ownedPaths = (jobPayload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
  const valid = validateOpReport(parsed, { ownedPaths, identity: reportIdentityOf(job) });
  if (!valid.ok) throw Object.assign(new Error(`report fails starci/op-report@1: ${valid.reasons.join('; ')}`), { code: 'report-invalid' });
  const report = valid.report;
  if (args.outcome && args.outcome !== report.outcome)
    throw Object.assign(new Error(`--outcome '${args.outcome}' contradicts the envelope's '${report.outcome}'`), { code: 'outcome-mismatch' });
  const dispatchId = report.dispatch, op = jobOpOf(job);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(job.workflow_id, dispatchId, op, job.attempt, job.generation, report.outcome, JSON.stringify(report),
        jobPayload.managed?.agentTerminalHandle ?? jobPayload.orca?.agentTerminalHandle ?? job.worker_id ?? null, now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'report-filed', payload: { dispatchId, op, attempt: job.attempt, outcome: report.outcome, report: reportAbs },
    });
  });
  const kernelWake = wakeKernelForTransition(ledger, {
    workflowId: job.workflow_id,
    transition: `report-filed:${report.outcome}`,
    jobId: job.job_id,
    dispatchId,
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, outcome: report.outcome, report: reportAbs, kernelWake };
  emit(out, `report filed for ${job.job_id} (dispatch ${dispatchId}, outcome ${report.outcome})`, args.json);
  // The op terminal gets the canonical human rendering of the filed row — the
  // reports row is the truth, this block is its projection.
  console.log(renderReportBlock(report));
}

/* ---------------------------------------------------------- op-contract */
// The worker reads its own contract: print the markdown to stdout. --job
// resolves (workflow,op,attempt); --workflow + --op [--attempt] works too
// (latest attempt's contract when --attempt is omitted).
function cmdOpContract(ledger, args) {
  const db = ledger.db;
  let workflowId, op, attempt = parseAttempt(args.attempt);
  if (args.job) {
    const job = resolveJob(db, args.job);
    workflowId = job.workflow_id; op = args.op ?? jobOpOf(job);
    if (attempt == null) attempt = job.attempt;
  } else {
    workflowId = args.workflow; op = args.op;
    if (attempt == null) attempt = db.prepare('SELECT MAX(attempt) a FROM contracts WHERE workflow_id=? AND op_id=?').get(workflowId, op)?.a ?? null;
  }
  const row = attempt == null ? null
    : db.prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId, op, attempt);
  if (!row) throw Object.assign(new Error(`no contract row for ${workflowId}/${op} attempt ${attempt ?? '(none filed)'}`), { code: 'contract-missing' });
  if (args.json) {
    emit({ ok: true, workflowId, op, attempt: row.attempt, dispatchId: row.dispatch_id, markdown: row.markdown, context: parseJson(row.context_json), createdAt: row.created_at }, '', true);
  } else {
    process.stdout.write(row.markdown.endsWith('\n') ? row.markdown : `${row.markdown}\n`);
  }
}

/* ---------------------------------------------------------------- check */
// The verification half: upsert the re-run check results for an op attempt
// (one row per workflow_id,op_id,attempt).
function cmdCheck(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const op = args.op ?? jobOpOf(job);
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity — pass --op`), { code: 'job-no-op' });
  const attempt = parseAttempt(args.attempt) ?? job.attempt;
  const raw = args.checks ?? (() => {
    const file = [path.resolve(args['checks-file']), path.resolve(repo, args['checks-file'])].find((p) => fs.existsSync(p));
    if (!file) throw Object.assign(new Error(`checks file missing: ${args['checks-file']}`), { code: 'checks-file-missing' });
    return fs.readFileSync(file, 'utf8');
  })();
  const parsed = parseJson(raw);
  if (!isCheckResultEnvelope(parsed)) {
    throw Object.assign(new Error('checks payload must be an object with a non-empty checks[] of {name, exitCode, command?, evidence?} entries'), { code: 'checks-invalid' });
  }
  if (attempt !== job.attempt) {
    throw Object.assign(new Error(`checks attempt ${attempt} does not match job ${job.job_id} attempt ${job.attempt}`), {
      code: 'checks-attempt-mismatch', attempt, jobAttempt: job.attempt,
    });
  }
  const dispatchId = requireDispatchedReportBinding(db, job);
  const reportRow = db.prepare('SELECT dispatch_id FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (!reportRow) {
    throw Object.assign(new Error(`job ${job.job_id} has no filed worker report for dispatch ${dispatchId}`), {
      code: 'checks-report-missing', dispatchId,
    });
  }
  const checkEvidence = summarizeCheckEvidence(parsed);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(job.workflow_id, op, attempt, JSON.stringify(parsed), now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'checks-recorded', payload: { op, attempt },
    });
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, op, attempt, checks: parsed.checks.length, checkEvidence };
  emit(out, `checks recorded for ${job.job_id} (op ${op}, attempt ${attempt})`, args.json);
}

/* -------------------------------------------------------- consume-report */
// Kernel-facing: mark the job's reports row integrated so it is never read
// as a live answer again.
function cmdConsumeReport(ledger, args) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const dispatchId = reportDispatchIdOf(job);
  let consumed = false;
  ledger.transaction(() => {
    const now = Date.now();
    consumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(now, job.workflow_id, dispatchId).changes > 0;
    if (consumed) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
        kind: 'report-consumed', payload: { dispatchId },
      });
    }
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, consumed };
  emit(out, `consume-report ${job.job_id} (dispatch ${dispatchId}): ${consumed ? 'report consumed' : 'no unconsumed report row'}`, args.json);
}

/* ------------------------------------------------------------------ main */
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());

  const required = {
    survey: ['workflow'], status: ['workflow'], hierarchy: ['workflow'], plan: ['workflow', 'file'],
    enqueue: ['workflow', 'op', 'paths'], estimate: [], route: ['job'], dispatch: ['job'],
    reconcile: ['job'], nudge: ['job'], observe: ['job'],
    settle: ['job', 'verdict'],
    report: ['job', 'report'], 'op-contract': [], check: ['job'],
    'consume-report': ['job'],
    incident: ['workflow', 'kind', 'detail'],
    finish: ['workflow'],
  };
  if (!required[cmd]) usage(2);
  for (const k of required[cmd]) need(args[k], `${cmd} needs --${k}`);
  if (cmd === 'settle' && !['pass', 'fail', 'blocked'].includes(args.verdict)) need(false, `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);
  if (cmd === 'report' && args.outcome) need(REPORT_OUTCOMES.includes(args.outcome), `report --outcome must be ${REPORT_OUTCOMES.join('|')}, got '${args.outcome}'`);
  if (cmd === 'op-contract') need(args.job || (args.workflow && args.op), 'op-contract needs --job <job_id> or --workflow <id> --op <opId> [--attempt <n>]');
  if (cmd === 'check') need(args.checks != null || args['checks-file'], 'check needs --checks <json> or --checks-file <path>');

  let ledger;
  try {
    ledger = openRepoLedger(repo);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
    process.exit(1);
  }
  try {
    switch (cmd) {
      case 'survey': return cmdSurvey(ledger, args);
      case 'status': return cmdStatus(ledger, args);
      case 'hierarchy': return cmdHierarchy(ledger, args);
      case 'plan': return cmdPlan(ledger, args);
      case 'enqueue': return cmdEnqueue(ledger, args);
      case 'estimate': return cmdEstimate(ledger, args);
      case 'route': return await cmdRoute(ledger, args);
      case 'dispatch': return cmdDispatch(ledger, args, repo);
      case 'reconcile': return cmdReconcile(ledger, args);
      case 'nudge': return cmdNudge(ledger, args);
      case 'observe': return cmdObserve(ledger, args);
      case 'settle': return cmdSettle(ledger, args, repo);
      case 'report': return cmdReport(ledger, args, repo);
      case 'op-contract': return cmdOpContract(ledger, args);
      case 'check': return cmdCheck(ledger, args, repo);
      case 'consume-report': return cmdConsumeReport(ledger, args);
      case 'incident': return cmdIncident(ledger, args);
      case 'finish': return cmdFinish(ledger, args);
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code }));
    process.exit(1);
  } finally {
    ledger.close();
  }
}

main();
