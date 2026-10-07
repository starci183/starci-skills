#!/usr/bin/env node
// start-workflow.mjs — executable half of modules/kernel/start-workflow.yaml.
// Claims the oldest pending goal from the ledger inbox and spawns ONE long-lived
// [Kernel] agent terminal bound to that workflow_id. One kernel per workflow —
// enforced by a signals singleton row, never by politeness.
//
// Orca is always the execution host. The kernel agent/model is chosen by
// layered routing: explicit --agent >
// config.yaml kernel (pin or group) > route-model. Without an override
// this script first reads the owner config <skillRoot>/config.yaml
// (gitignored, seeded from config.example.yaml by the installer): a kernel
// agent or model pin decides the seat outright (routedBy: config). An
// explicit pin is authoritative and fails closed when its agent is dead or
// its model cannot be resolved; it is never substituted. A kernel group
// ({group: [{agent, model?}...]}) is an ordered member list tried with the
// provider availability signals. With neither this script asks
// scripts/route/route-model.mjs for the model.manageWorkflow
// kernelFunctionKind (risk high, --repo for the provider circuit) and maps
// its pick and fallback chain to agents via modules/models/registry.yaml pools/targets.
// Router refusal or exhaustion is a typed failure, never an implicit Devin kernel.
//
// Every Kernel is an Orca worker (modules/kernel/start-workflow.yaml): the launching
// terminal (the owner's chat, the Supervisor, the watchdog's run; ORCA_TERMINAL_HANDLE) creates the Kernel's entry Run
// and coordinates it, the Kernel's Task carries its prompt, and `orca orchestration worker-start --agent <agent>
// [--model <id> --effort <level>]` starts it (scripts/agent/lib.mjs startAgent). worker-show attests the effective
// agent and model. The Kernel then creates its workflow Run from its own terminal and coordinates its ops there
// (cli.mjs ensureWorkflowRun). A restart reuses the entry Run while Orca knows it and accepts the new Task.
//
//   starci workflow start --repo <path> [--goal <workflow_id>] [--agent <name>] [--launched-by watchdog|supervisor] [--plan] [--json]
//
// A replacement needs a kernel proven dead: worker-show on its Dispatch. An Orca outage is refused with step
// host-unavailable and exit 75, touching nothing; a kernel job whose own Dispatch is still alive while its signal is gone
// is refused with step kernel-worker-alive (exit 3) - never a second Kernel beside it. A terminal without its immutable
// Dispatch identity remains unverified until affirmative reconciliation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createKernelRoute, kernelBias, kernelPlanFields } from './kernel-route.mjs';
import { kernelLaunchStatus, launchAuthorityText, launchPlanText } from './start-workflow-display.mjs';
import { openLedger, ledgerFileFor, transitionWorkflowToRunning, bindKernelJob, releaseKernelJob, recordJobResult, setSignal, clearSignal, updateSignal, openIncident, setInboxStatus } from '../../engine/db/ledger.mjs';
// The kernel seat's boot count lives in its payload (hierarchy.attempt); jobs.try_no is the op-try ordinal only.
const kernelAttemptOf = (row) => parseJsonOr(row?.payload_json)?.hierarchy?.attempt ?? 0;
import { inspectOwnerConfig, loadConfig } from '../../engine/config.mjs';
import { launchKernelGroup } from './launch-kernel-group.mjs';
import { expiredKernelStartupHealth } from './kernel-startup-capacity.mjs';
import { ownerReserveGrant, ownerBiasTrust, planAgentAdmission } from '../agent/admission.mjs';
import { prepareProviderBudget } from '../agent/provider-budget.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { releaseWorkflowWorker as releaseManagedWorker, recoverWorkflowLaunch } from './workflow-launch-custody.mjs';
import { DEFAULT_OWNER_LANGUAGE } from '../machine/home.mjs';
import { parseJson, parseJsonOr, readJsonFile } from '../lib/json.mjs';
import { workflowDisplayName, workflowNameOf } from '../lib/display-names.mjs';
import { KERNEL_BOOT_FILES, currentRuntimeRev, revRootOf, shortRev } from './runtime-rev.mjs';
import { ensureWorkflowWorktree, workflowAppRepo } from './workflow-worktree.mjs';
import { ensureWorkflowHost, installWorkflowTree, workflowStartAuthority, commitWorkflowStart, recordWorkflowStartFailure, workflowSender, closedGoalMessage } from './workflow-startup.mjs';
import { workflowCaller } from '../agent/caller-context.mjs';
import { guardLaunch, bindGuardTerminal, unbindGuardTerminal, guardReceiptErrors } from '../guards/hook-install.mjs';
import { readEnv } from '../lib/env.mjs';
import { arg as argvValue } from '../lib/cli-arg.mjs';
import { foldCase, realPath } from '../lib/path-key.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const sourceRoot = path.dirname(skillRoot);
const arg = (n, d = null) => argvValue(process.argv, n, d);
const repo = path.resolve(arg('repo', process.cwd()));
const agentOverride = arg('agent');
const goalId = arg('goal'); // explicit <workflow_id> — per modules/kernel/start-workflow.yaml
const asJson = process.argv.includes('--json');
const planOnly = process.argv.includes('--plan');
// Who ran this launch, named in a replacement's prompt and its event: the watchdog's --repair
// (every restart-all relaunch too), else the supervisor running start-workflow directly.
const LAUNCHERS = { watchdog: "the watchdog's kernel repair", supervisor: 'the supervisor' };
const launchedBy = arg('launched-by', 'supervisor');
if (!Object.hasOwn(LAUNCHERS, launchedBy)) {
  console.error(`start-workflow: --launched-by must be one of ${Object.keys(LAUNCHERS).join(', ')} (got ${launchedBy})`);
  process.exit(2);
}

// How long a Kernel launch holds its startup reservation: worker-start blocks until the agent is ready (calls.yaml
// worker-start timeoutMs 150000), plus the Run and Task calls around it.
const KERNEL_START_RESERVATION_MS = 240000;

// Owner config: <skillRoot>/config.yaml — the per-project config seeded from
// config.example.yaml by the installer (gitignored), read through the one
// reader in engine/config.mjs. A missing, unparsable or schema-short file is
// never fatal — routing falls through to route-model and says why.
// STARCI_OWNER_ROOT points the reader at a different directory holding a
// config.yaml (test and tooling seam).
const ownerRoot = readEnv('STARCI_OWNER_ROOT') ? path.resolve(readEnv('STARCI_OWNER_ROOT')) : skillRoot;
// One routing scope per launcher; all config, probes and route calls stay deferred.
const { resolveKernelRoute, memberLabel, memberSummary } = createKernelRoute({ skillRoot, repo, agentOverride, ownerRoot });

// The launch lives in scripts/agent/lib.mjs startAgent: the Kernel is an orca orchestration worker-start worker of
// its own entry Run (the launching terminal coordinates it), attested from worker-show. No caller assembles a provider
// command: Orca composes it, with the owner's per-agent default args.

const samePath = (left, right) => foldCase(realPath(left)) === foldCase(realPath(right));

function projectContext() {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  if (!fs.existsSync(projects)) return null;
  for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'work.json');
    const doc = readJsonFile(file);
    if (doc?.schema !== 'starci/workspace-binding@2' || typeof doc?.repository?.pathFromSource !== 'string') continue;
    const app = path.resolve(sourceRoot, doc.repository.pathFromSource);
    if (!samePath(app, repo)) continue;
    const fe = path.resolve(app, doc.sides?.fe ?? 'fe');
    const be = path.resolve(app, doc.sides?.be ?? 'be');
    return { file, project: doc.project ?? entry.name, be, fe };
  }
  return null;
}

const context = projectContext();
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'cli.mjs');
const promptTemplate = fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'kernel-prompt.md'), 'utf8');
// The runtime rev this boot reads its kernel files at (runtime-rev.mjs): named in the prompt and recorded as
// boot delivery provenance; only a current Kernel's explicit READ attestation acknowledges it.
const bootRuntimeRev = currentRuntimeRev(revRootOf());
const renderKernelPrompt = ({ workflowId, inboxId, goalRevision, launchAuthority = '' }) => promptTemplate
  .replaceAll('{launchAuthority}', launchAuthority)
  .replaceAll('{workflowId}', workflowId)
  .replaceAll('{inboxId}', String(inboxId))
  .replaceAll('{goalRevision}', String(goalRevision))
  .replaceAll('{sourceRoot}', sourceRoot)
  .replaceAll('{skillRoot}', skillRoot)
  .replaceAll('{repo}', repo)
  .replaceAll('{ledgerFile}', ledgerFileFor(repo))
  .replaceAll('{bindingFile}', context?.file ?? '(no matching project binding; --repo is authoritative)')
  .replaceAll('{frontendRoot}', context?.fe ?? '(not bound)')
  .replaceAll('{ownerLanguage}', inspectOwnerConfig(ownerRoot).config?.language ?? DEFAULT_OWNER_LANGUAGE)
  .replaceAll('{apiFile}', apiFile)
  .replaceAll('{runtimeRev}', shortRev(bootRuntimeRev) ?? 'unknown');

const MANAGED_DEAD_STATE = /stop|fail|dead|exit|release|abandon/i;

// A live signal is proven, not assumed: worker-show reports a non-terminal worker state for the seat's Dispatch.
// An unknown execution remains fenced; a restart first proves the old Dispatch's terminal and process tree closed.
async function signalHealth(signal) {
  if (!signal) return { live: false, reason: 'absent', terminal: null };
  const value = parseJson(signal.value_json, {});
  if (value.state === 'launch-unknown') return { live: false, hostUnavailable: true,
    reason: 'prior Kernel launch effect requires definitive reconciliation', terminal: value.terminal ?? null, value };
  if (value.state === 'starting' && signal.expires_at > Date.now()) {
    return { live: true, reason: 'startup reservation active', terminal: null, value };
  }
  if (value.state === 'starting') return expiredKernelStartupHealth({ ledgerId: ledger.ledgerId ?? ledger.path, workflowId: signal.key, value });
  if (value.dispatch) {
    const shown = workerShow({ dispatch: value.dispatch });
    // An Orca that does not answer proves nothing about the worker: host-unavailable, never a dead seat.
    if (shown?.hostUnavailable) return { live: false, hostUnavailable: true, reason: shown.error ?? 'worker-show did not answer', terminal: value.terminal ?? null, value };
    const state = shown?.state ?? null;
    const live = shown?.ok === true && !(state && MANAGED_DEAD_STATE.test(state));
    return {
      live, terminal: null, value,
      reason: live ? `worker ${state ?? 'ready'}` : (shown?.error || `worker state ${state ?? 'unreadable'}`),
    };
  }
  if (value.terminal) return {live:false,unverified:true,reason:'the terminal has no immutable worker Dispatch identity',terminal:value.terminal,value};
  return { live: false, reason: 'seat has no worker', terminal: value.terminal ?? null, value };
}

// A refusal that changed nothing: JSON on stdout (the watchdog reads it) and a
// distinct exit code - 75 (EX_TEMPFAIL) when Orca is not answering.
function refuse(step, fields = {}, code = 1) {
  const out = { ok: false, step, ...fields };
  if (asJson) console.log(JSON.stringify(out));
  else console.error(`start-workflow: ${step}: ${fields.error ?? ''}`);
  process.exit(code);
}
// A finished or archived goal never re-enters the queue and never gets a Kernel.
function refuseClosedGoal(goal, wf) {
  const closed = closedGoalMessage(goal, wf); if (closed) { console.error(closed); process.exit(1); }
}
const EXIT_HOST_UNAVAILABLE = 75;
const EXIT_KERNEL_ALIVE = 3;

// Settlement of a stale Kernel's Dispatch: worker-stop then worker-release (calls.yaml settle-dispatch), recorded as
// the seat's terminalClosed receipt, including verified terminal and process-tree exit. A refused release is the
// kernel-stale-terminal-unclosed residue, never silence. Never throws.

const ledger = openLedger({ file: ledgerFileFor(repo) });
try {
  const pendingTarget = goalId
    ? ledger.db.prepare("SELECT workflow_id FROM inbox WHERE kind='goal' AND status='pending' AND workflow_id=? LIMIT 1").get(goalId)?.workflow_id
    : ledger.db.prepare("SELECT workflow_id FROM inbox WHERE kind='goal' AND status='pending' ORDER BY inbox_id LIMIT 1").get()?.workflow_id;
  const claimedTarget = goalId
    ? ledger.db.prepare("SELECT workflow_id FROM inbox WHERE kind='goal' AND status='claimed' AND workflow_id=? LIMIT 1").get(goalId)?.workflow_id
    : ledger.db.prepare("SELECT workflow_id FROM inbox WHERE kind='goal' AND status='claimed' ORDER BY inbox_id LIMIT 1").get()?.workflow_id;
  const target = goalId || pendingTarget || claimedTarget;

  // --plan: show exactly what would happen, mutate nothing. The skill presents
  // this to the owner; only an explicit ok|OK|oK re-runs without it.
  if (planOnly) {
    if (!target) { console.log(asJson ? '{"plan":true,"reason":"queue-empty"}' : 'PLAN — queue empty, nothing to start'); process.exit(0); }
    const wf = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(target);
    // A finished or archived workflow's goal is closed — even --plan refuses to plan a restart.
    refuseClosedGoal(target, wf);
    const g = ledger.db.prepare('SELECT revision,goal_identity,json,approved_by FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(target);
    const inbox = ledger.db.prepare("SELECT inbox_id,status FROM inbox WHERE kind='goal' AND workflow_id=?").get(target);
    const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
    const health = await signalHealth(signal);
    const chain = parseJson(g?.json)?.opChain?.legs?.map(l => l.op) ?? null;
    const route = await resolveKernelRoute(ledger.db);
    const priorKernel = ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${target}`);
    const admission = planAgentAdmission({ role: 'kernel', scopeId: `${ledger.ledgerId ?? ledger.path}:${target}:kernel-attempt:${kernelAttemptOf(priorKernel) + 1}`,
      bias: kernelBias(parseJsonOr(g?.json)?.routing_bias, route), ownerGrant: ownerReserveGrant(g), biasTrusted: ownerBiasTrust(g) || Boolean(route.pin), tier: route.tier ?? null,
      allowGroup: (route.members ?? [route]).map((member) => ({ id: member.id, provider: member.agent, model: member.model, effort: member.effort, pool: member.pool })) });
    const out = {
      plan: true, workflowId: target, title: workflowDisplayName(wf), slug: wf?.title ?? null, phase: wf?.phase,
      goalRevision: g?.revision ?? null, goalIdentity: g?.goal_identity ?? null,
      opChain: chain, inbox: inbox?.status ?? 'none',
      host: 'orca', executionHost: 'orca', routedBy: route.routedBy,
      launch: 'worker',
      admission,
      ...kernelPlanFields(route, admission),
      ...(route.route?.profile ? { profile: route.route.profile } : {}),
      ...(route.runtimePool ? { runtimePool: route.runtimePool } : {}),
      config: route.config ?? (route.routedBy === 'override' ? { file: 'not consulted — explicit agent flag wins' } : { file: null }),
      ...(route.route ? { route: route.route } : {}),
      ...(route.error ? { step: route.errorStep ?? 'kernel-route', routeError: route.error } : {}),
      ...(route.warnings?.length ? { warnings: route.warnings } : {}),
      ...(route.members ? { group: route.members.map(memberSummary), fallThrough: route.fallThrough === true } : {}),
      sourceHost: sourceRoot, projectBinding: context?.file ?? null,
      ledger: ledgerFileFor(repo), frontend: context?.fe ?? null, sender: workflowSender({ env: process.env, launchedBy, ledger, workflowId: target }),
      kernel: kernelLaunchStatus({ health, signal, route }),
    };
    console.log(launchPlanText({ asJson, out, wf, target, chain, route, memberLabel }));
    process.exit(out.routeError ? 1 : 0);
  }

  // A finished or archived workflow's goal is closed — starting it again is refused.
  if (goalId) refuseClosedGoal(goalId, ledger.db.prepare('SELECT phase,archived_at FROM workflows WHERE workflow_id=?').get(goalId));

  if (!target) { console.log(asJson ? '{"ok":true,"reason":"queue-empty"}' : 'queue empty — no pending or claimed goal'); process.exit(0); }

  const startInput = () => ({ workflow: ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(target),
    goal: ledger.db.prepare('SELECT revision,goal_identity,markdown,json,approved_by FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(target) });
  const { workflow: startWorkflow, goal: startGoal } = startInput();
  const startAuthority = workflowStartAuthority({ workflow: startWorkflow, goal: startGoal });
  if (!startAuthority.ok) refuse(startAuthority.reason, { workflowId: target, authority: startAuthority });
  const sender = workflowSender({ env: process.env, launchedBy, ledger, workflowId: target }); if (!sender.ok) refuse(sender.reason, { workflowId: target, error: sender.error });
  const hostStartup = await ensureWorkflowHost({ workflow: startWorkflow, goal: startGoal, caller: workflowCaller(process.argv.slice(2)), env: process.env });
  if (hostStartup.ok !== true || hostStartup.ready !== true)
    refuse(hostStartup.reason ?? 'workflow-host-not-ready', { workflowId: target, startup: hostStartup },
      hostStartup.host?.items?.some((item) => item.id === 'orca' && item.status === 'red') ? EXIT_HOST_UNAVAILABLE : 1);
  const currentStartAuthority = () => {
    const authority = workflowStartAuthority(startInput());
    return authority.ok && (authority.goalRevision !== startAuthority.goalRevision || authority.goalIdentity !== startAuthority.goalIdentity
      || authority.generation !== startAuthority.generation)
      ? { ok: false, reason: 'workflow-goal-unverified', detail: 'the accepted goal changed during startup' } : authority;
  };
  const afterHostAuthority = currentStartAuthority();
  if (!afterHostAuthority.ok) refuse(afterHostAuthority.reason, { workflowId: target, authority: afterHostAuthority, startup: hostStartup });

  // A signal is only live when its Orca terminal is connected and writable. A
  // NULL expiry is not immortality: terminal identity is the health proof.
  let priorSignal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
  if (parseJsonOr(priorSignal?.value_json)?.state === 'launch-unknown') {
    const recovery = recoverWorkflowLaunch(ledger, { workflowId: target, signal: priorSignal, env: process.env });
    if (!recovery.ok) refuse('kernel-launch-unreconciled', { workflowId: target, recovery }, EXIT_HOST_UNAVAILABLE);
    priorSignal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
  }
  const priorHealth = await signalHealth(priorSignal);
  if (priorSignal && priorHealth.live) {
    const out = { ok: true, workflowId: target, kernel: priorSignal.token, terminal: priorHealth.value?.terminal ?? null,
      ...(priorHealth.value?.dispatch ? { dispatch: priorHealth.value.dispatch } : {}), replaced: false, note: priorHealth.reason };
    out.startup = hostStartup;
    console.log(asJson ? JSON.stringify(out) : `kernel already live for ${target} (${priorSignal.token})`);
    process.exit(0);
  }
  // An Orca outage or an unsettled refusal proves nothing: touch no seat.
  if (priorSignal && priorHealth.hostUnavailable)
    refuse('host-unavailable', { workflowId: target, terminal: priorHealth.value?.terminal ?? null, error: priorHealth.reason }, EXIT_HOST_UNAVAILABLE);
  if (priorSignal && priorHealth.unverified)
    refuse('kernel-terminal-unverified', { workflowId: target, terminal: priorHealth.value?.terminal ?? null, error: priorHealth.reason });
  // The seat may be gone while the Kernel is not (a restart that failed during an Orca outage cleared the signal of
  // a Kernel that kept running): the kernel job's own Dispatch is asked before a second one starts.
  {
    const kernelJob = ledger.db.prepare('SELECT status,payload_json FROM jobs WHERE job_id=?').get(`kernel-${target}`);
    const managed = parseJsonOr(kernelJob?.payload_json)?.managed ?? null;
    if (managed?.dispatchId && managed.dispatchId !== priorHealth.value?.dispatch) {
      const shown = workerShow({ dispatch: managed.dispatchId });
      if (shown?.hostUnavailable) refuse('host-unavailable', { workflowId: target, dispatch: managed.dispatchId, error: shown.error }, EXIT_HOST_UNAVAILABLE);
      if (shown?.ok === true && !(shown.state && MANAGED_DEAD_STATE.test(shown.state)))
        refuse('kernel-worker-alive', { workflowId: target, dispatch: managed.dispatchId, terminal: managed.agentTerminalHandle ?? null, jobStatus: kernelJob.status,
          error: `kernel job Dispatch ${managed.dispatchId} is alive (worker ${shown.state ?? 'ready'}); stop it with orca orchestration worker-stop before launching a second kernel` }, EXIT_KERNEL_ALIVE);
    }
  }
  const beforeSeatAuthority = currentStartAuthority();
  if (!beforeSeatAuthority.ok) refuse(beforeSeatAuthority.reason, { workflowId: target, authority: beforeSeatAuthority, startup: hostStartup });
  let staleKernel = null;
  if (priorSignal) {
    staleKernel = { token: priorSignal.token, terminal: priorHealth.value?.terminal ?? null,
      ...(priorHealth.value?.dispatch ? { dispatch: priorHealth.value.dispatch } : {}), reason: priorHealth.reason };
    // A stale Kernel may still hold a live Orca worker — settle the exact old Dispatch (stop + release) before the
    // seat is cleared so the replacement never runs beside a zombie — one workflow, one Kernel.
    if (priorHealth.value?.dispatch) staleKernel.terminalClosed = releaseManagedWorker(priorHealth.value.dispatch, staleKernel.terminal);
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(target);
    const at = Date.now();
    const unclosed = staleKernel.terminalClosed && staleKernel.terminalClosed.ok !== true
      ? staleKernel.terminalClosed : null;
    if (unclosed) {
      ledger.transaction(() => {
        ledger.appendEvent({ workflowId: target, entityType: 'kernel', entityId: target,
          generation: workflow?.generation ?? 0, kind: 'kernel-stale-terminal-unclosed',
          payload: { ...unclosed, reason: priorHealth.reason }, createdAt: at });
        openIncident(ledger.db, { incidentId: `inc-${crypto.randomBytes(6).toString('hex')}`, workflowId: target, kind: 'runtime-defect', owner: 'supervisor', at,
          lastProgress: `[orca-tree] ${JSON.stringify({ code: 'kernel-stale-terminal-unclosed', ...unclosed })}` });
      });
      refuse('kernel-stale-terminal-unclosed', { workflowId: target, terminal: staleKernel.terminal,
        effectState: 'unknown', error: unclosed.error, closure: unclosed });
    }
    ledger.transaction(() => {
      clearSignal(ledger.db, { scope: 'kernel', key: target, token: priorSignal.token });
      // The dead kernel's seat is released (running -> ready); the replacement below binds it again.
      if (releaseKernelJob(ledger.db, { workflowId: target, reason: 'kernel-stale-cleared', at }))
        recordJobResult(ledger.db, { jobId: `kernel-${target}`, result: { reason: priorHealth.reason, terminal: staleKernel.terminal }, at });
      ledger.appendEvent({ workflowId: target, entityType: 'kernel', entityId: target,
        generation: workflow?.generation ?? 0, kind: 'kernel-stale-cleared', payload: staleKernel, createdAt: at });
    });
  }

  // 1. Claim the goal atomically — the named one, or the oldest pending.
  let claim = null;
  let claimAuthority = null;
  ledger.transaction(() => {
    claimAuthority = currentStartAuthority();
    if (!claimAuthority.ok) return;
    const row = ledger.db.prepare("SELECT inbox_id,workflow_id,payload_json,status FROM inbox WHERE kind='goal' AND status='pending' AND workflow_id=? LIMIT 1").get(target);
    if (!row) return;
    setInboxStatus(ledger.db, { inboxId: row.inbox_id, status: 'claimed' });
    claim = row;
  });
  if (!claimAuthority.ok) refuse(claimAuthority.reason, { workflowId: target, authority: claimAuthority, startup: hostStartup });
  if (!claim) {
    // Nothing pending — re-bind the same durable claimed goal. Agent churn
    // increments the kernel attempt, not the workflow generation.
    const orphaned = ledger.db.prepare(
      "SELECT inbox_id,workflow_id,payload_json,status FROM inbox WHERE kind='goal' AND status='claimed' AND workflow_id=? LIMIT 1"
    ).get(target);
    if (!orphaned) { console.log(asJson ? '{"ok":true,"reason":"queue-empty"}' : 'queue empty — no pending goal, no dead kernel'); process.exit(0); }
    claim = orphaned;
  }
  const workflowId = claim.workflow_id;
  const replaced = claim.status === 'claimed' || Boolean(staleKernel);

  // 2. Reserve the singleton before spawning. The short expiry recovers a
  // launcher crash between claim and terminal attestation.
  const token = `kernel-${crypto.randomBytes(6).toString('hex')}`;
  const reservationAt = Date.now();
  const reservationExpires = reservationAt + 120000;
  let reservationAuthority;
  const reserved = ledger.transaction(() => {
    reservationAuthority = currentStartAuthority();
    if (!reservationAuthority.ok) return false;
    const occupied = ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=? AND (expires_at IS NULL OR expires_at>?)").get(workflowId, reservationAt);
    if (occupied) return false;
    setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, holderPid: process.pid, token, value: { state: 'starting' }, at: reservationAt, expiresAt: reservationExpires });
    return true;
  });
  if (!reserved) {
    if (!reservationAuthority.ok) refuse(reservationAuthority.reason, { workflowId, authority: reservationAuthority, startup: hostStartup });
    const occupied = ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    const out = { ok: true, workflowId, kernel: occupied?.token ?? null, replaced: false, note: 'kernel startup already reserved' };
    console.log(asJson ? JSON.stringify(out) : `kernel startup already reserved for ${workflowId}`);
    process.exit(0);
  }

  let route;
  // The tab title a person reads: the workflow's display name (starci kernel rename; define-goal derives it), the
  // goal slug before one exists. workflow_id stays the key (the signal, the kernel job, the ledger).
  const kernelName = workflowNameOf(ledger.db, workflowId);
  const title = `[Kernel] ${kernelName}`;
  const goal = ledger.db.prepare('SELECT revision,goal_identity,json,approved_by FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
  const goalBridge = (() => { const j = parseJsonOr(goal?.json); return j.definedBy === 'supervisor' ? (j.bridge ?? { bridgeId: null }) : null; })();
  const firstBoot = ledger.db.prepare("SELECT created_at FROM events WHERE workflow_id=? AND kind='kernel-booted' ORDER BY seq LIMIT 1").get(workflowId);
  const priorKernelJob = ledger.db.prepare('SELECT payload_json,worker_id FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  // restartAuthority: why this launch is a replacement, stated in the prompt and the receipt.
  const restartAuthority = replaced ? {
    reason: staleKernel?.reason ? `failed its liveness check (${staleKernel.reason})` : 'lost its seat (no live kernel signal after a host or Orca restart)',
    previousTerminal: staleKernel?.terminal ?? priorKernelJob?.worker_id ?? null,
    previousAttempt: priorKernelJob ? kernelAttemptOf(priorKernelJob) : null,
    launchedBy,
  } : null;
  const launchAuthority = launchAuthorityText({ workflowId, goalRevision: goal?.revision ?? 0, goalIdentity: goal?.goal_identity ?? null,
    approvedAt: firstBoot?.created_at ? new Date(firstBoot.created_at).toISOString() : null, bridge: goalBridge,
    restart: restartAuthority && { ...restartAuthority, attempt: kernelAttemptOf(priorKernelJob) + 1, launcher: LAUNCHERS[launchedBy] } });
  const prompt = renderKernelPrompt({ workflowId, inboxId: claim.inbox_id, goalRevision: goal?.revision ?? 0, launchAuthority });
  const failStart = (step, error, handle = null, extra = {}, exitCode = 1) => {
    const failure = recordWorkflowStartFailure(ledger, { workflowId, token, holderPid: process.pid, step, error, handle, extra });
    console.error(JSON.stringify({ ok: false, workflowId, ...failure }));
    process.exit(exitCode);
  };
  try {
    prepareProviderBudget();
    route = await resolveKernelRoute(ledger.db);
  } catch (error) {
    failStart('admission', `provider store preparation failed: ${error.message}`);
  }
  for (const warning of route.warnings ?? []) console.error(`start-workflow: warning: ${warning}`);
  if (route.error)
    failStart(route.errorStep ?? 'kernel-route', route.error, null, { agent: route.agent ?? null, requestedModel: route.model ?? null });
  const beforeTreeAuthority = currentStartAuthority();
  if (!beforeTreeAuthority.ok) failStart(beforeTreeAuthority.reason, 'the accepted goal changed during route preparation', null,
    { reason: beforeTreeAuthority.reason, authority: beforeTreeAuthority, startup: hostStartup });
  // modules/kernel/start-workflow.yaml spawn.fallThrough: a group member whose start left no effect (worker-start
  // refused before a Dispatch existed, or its Dispatch was proven gone and released) hands the same boot and
  // reservation to the next member. Anything else ends the boot.
  const members = route.members?.length ? route.members : [route];
  // The workflow's ONE worktree (owner decision WFWT, scripts/kernel/workflow-worktree.mjs): Orca creates it before the
  // Kernel starts - an existing worktree takes launch trust - and the Kernel and every op of the workflow work in it.
  // EVERY workflow has one - the bound app checkout's, else the git checkout of the ledger repo (the runtime repo
  // included). A ledger repo in no git checkout has none: the Kernel starts on it, and starci kernel dispatch refuses its ops
  // workflow-worktree-missing.
  const appRepo = workflowAppRepo(repo);
  let workflowWorktree = null;
  let workflowInstall = null;
  if (appRepo) {
    const ensured = ensureWorkflowWorktree({ env: process.env }, { workflowId, appRepo, ledgerId: ledger.ledgerId ?? null });
    if (!ensured.ok) failStart(ensured.reason === 'worktree-cap' ? 'worktree-cap' : 'workflow-worktree', ensured.detail ?? ensured.reason, null,
      { reason: ensured.reason, appRepo, ...(ensured.cap != null ? { live: ensured.live, cap: ensured.cap } : {}) });
    workflowWorktree = ensured.record;
    if (ensured.created) {
      const wf = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
      ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, generation: wf?.generation ?? 0, kind: 'workflow-worktree-created',
        payload: { orcaWorktreeId: workflowWorktree.orcaWorktreeId, path: workflowWorktree.path, branch: workflowWorktree.branch, appRepo } }));
    }
    workflowInstall = await installWorkflowTree({ record: workflowWorktree, env: process.env });
    if (!workflowInstall.ok) failStart('workflow-worktree-install', workflowInstall.error ?? workflowInstall.reason, null,
      { reason: workflowInstall.reason, workflowWorktree, install: workflowInstall });
    const wf = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, generation: wf?.generation ?? 0,
      kind: 'workflow-worktree-installed', payload: { orcaWorktreeId: workflowWorktree.orcaWorktreeId, ...workflowInstall } }));
  }
  const kernelWorktree = workflowWorktree?.path ?? repo;
  // The Kernel's guard: the same job guard an op gets (scripts/guards/hook-install.mjs
  // guardLaunch), role 'kernel', naming the workflow worktree and owning no path. It is bound to the Kernel's Orca
  // terminal the moment worker-start names it, so the PreToolUse command guard refuses the Kernel's raw git history
  // changes, worktree adds, recursive deletes, kills by name and raw agent launches; its `node cli.mjs <verb>` calls
  // pass. The history hook is refreshed in the workflow worktree so it skips the kernel role (the runtime's own git
  // under the Kernel's api calls). Best effort, as for an op: a guard that cannot be put in place rides on the
  // kernel-booted receipt as kernel-guard-unbound, never refusing the boot.
  const kernelJobId = `kernel-${workflowId}`;
  let kernelGuard;
  try {
    let guardConfig = null;
    try { guardConfig = loadConfig(); } catch { guardConfig = null; }
    kernelGuard = guardLaunch({ skillRoot, jobId: kernelJobId, workflowId, ledgerRepo: repo, owned: [], role: 'kernel',
      repos: workflowWorktree ? [workflowWorktree.path] : [], config: guardConfig, workflowWorktree: workflowWorktree?.path ?? null }).receipt;
  } catch (e) { kernelGuard = { error: String(e?.message ?? e) }; }
  const bindKernelGuard = (handle) => {
    if (typeof kernelGuard.jobFile !== 'string') return;
    try { kernelGuard.terminal = bindGuardTerminal({ skillRoot, handle, jobFile: kernelGuard.jobFile }); }
    catch (e) { kernelGuard.terminal = { error: String(e?.message ?? e) }; }
  };
  // The Kernel is a worker of its own entry Run (scripts/agent/lib.mjs startAgent; the launching terminal is its
  // coordinator). worker-start blocks until the agent is ready, so the reservation is stretched past its timeout first.
  const priorManaged = parseJsonOr(priorKernelJob?.payload_json)?.managed ?? null;
  const entry = sender.handle;
  const specFile = path.join(path.dirname(ledgerFileFor(repo)), 'kernel', `${workflowId}.a${kernelAttemptOf(priorKernelJob) + 1}.prompt.md`);
  const beforeLaunchAuthority = currentStartAuthority();
  if (!beforeLaunchAuthority.ok) failStart(beforeLaunchAuthority.reason, 'the accepted goal changed before Kernel launch', null,
    { reason: beforeLaunchAuthority.reason, authority: beforeLaunchAuthority, startup: hostStartup, workflowWorktree, install: workflowInstall });
  const kernelLaunch = launchKernelGroup({ ledger, workflowId, token, expected: startAuthority, route, members, reservationMs: KERNEL_START_RESERVATION_MS,
    hostUnavailableExit: EXIT_HOST_UNAVAILABLE, memberLabel, failStart, launch: { worktree: kernelWorktree, title, prompt, specFile, config: route.ownerConfig,
      role: 'kernel', scopeId: `${ledger.ledgerId ?? ledger.path}:${workflowId}:kernel-attempt:${kernelAttemptOf(priorKernelJob) + 1}`,
      bias: kernelBias(parseJsonOr(goal?.json)?.routing_bias, route), ownerGrant: ownerReserveGrant(goal), biasTrusted: ownerBiasTrust(goal) || Boolean(route.pin), tier: route.tier ?? null,
      objective: `[Kernel] ${kernelName} — ${workflowId}`, entry, priorRunId: priorManaged?.runId ?? null, onCreated: bindKernelGuard,
      request: { workflow: workflowId, kernelAttempt: kernelAttemptOf(priorKernelJob) + 1, reservation: token } } });
  const { spawned, fellThrough } = kernelLaunch;
  route = kernelLaunch.route;
  const handle = spawned.terminal;
  const workerId = handle;
  // The replaced Kernel's terminal no longer carries this workflow's guard.
  if (!kernelGuard.terminal) bindKernelGuard(handle);
  const priorHandle = priorManaged?.agentTerminalHandle ?? null;
  const guardErrors = guardReceiptErrors(kernelGuard);
  if (guardErrors.length) console.error(`start-workflow: warning: kernel-guard-unbound: ${guardErrors.join('; ')}`);
  const guardReceipt = { ...kernelGuard, ...(guardErrors.length ? { code: 'kernel-guard-unbound', errors: guardErrors } : {}) };
  const kernelModel = route.model;
  const kernelEffort = route.effort ?? null;
  const modelAuthority = spawned.modelAuthority ?? null, effectiveModel = spawned.effective?.model ?? null;
  const modelAttested = Boolean(kernelModel && spawned.model === kernelModel && effectiveModel === kernelModel);

  const now = Date.now();
  const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  const generation = workflow?.generation ?? 0;
  const previousJob = ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const previousPayload = parseJsonOr(previousJob?.payload_json);
  const attempt = kernelAttemptOf(previousJob) + 1;
  const routeInfo = { host: 'orca', agent: route.agent, routedBy: route.routedBy, model: kernelModel,
    effort: kernelEffort, profile: route.route?.profile ?? null, runtimePool: route.runtimePool ?? null, launch: 'worker',
    modelAuthority, effectiveModel, modelAttested };
  const managed = { runId: spawned.runId, taskId: spawned.taskId, dispatchId: spawned.dispatchId, agentTerminalHandle: handle,
    admission: spawned.admission ?? null,
    terminalTitle: title, terminalTitleApplied: spawned.titleApplied === true };

  let publication;
  try {
    publication = commitWorkflowStart(ledger, { workflowId, expected: startAuthority, token, holderPid: process.pid, at: now }, () => {
    if (!updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, holderPid: process.pid, at: now, expiresAt: null,
      value: { terminal: handle, dispatch: spawned.dispatchId, runId: spawned.runId, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAuthority, effectiveModel, modelAttested } }))
      throw new Error('kernel-start-reservation-lost');
    // A restart replaces the SEAT, not the workflow's Orca identity. Writing a
    // fresh object over payload_json dropped orca.runId, so the next dispatch's
    // ensureWorkflowRun saw no Run and created a second one — the two-tree
    // sidebar. The new payload is merged OVER the previous one so durable
    // Orca facts (orca.*, hierarchy.runtime.runId) survive agent churn while
    // every seat fact (route, terminalHandle, attempt) is replaced.
    const nextPayload = {
      inbox_id: claim.inbox_id,
      goal_revision: goal?.revision ?? 0,
      route: routeInfo,
      managed,
      hierarchy: {
        schema: 'starci/agent-hierarchy@1',
        nodeId: `agent:kernel:${workflowId}`,
        parentNodeId: `workflow:${workflowId}`,
        role: 'kernel',
        workflowId,
        jobId: `kernel-${workflowId}`,
        attempt,
        generation,
        runtime: {
          host: 'orca',
          agent: route.agent,
          provider: route.agent,
          model: kernelModel,
          modelAuthority, effectiveModel, modelAttested,
          profile: route.route?.profile ?? null,
          runtimePool: route.runtimePool ?? null,
          terminalHandle: handle,
        },
      },
    };
    const payload = JSON.stringify({
      ...previousPayload,
      ...nextPayload,
      ...(previousPayload.orca && { orca: { ...previousPayload.orca } }),
      hierarchy: {
        ...previousPayload.hierarchy,
        ...nextPayload.hierarchy,
        runtime: { ...previousPayload.hierarchy?.runtime, ...nextPayload.hierarchy.runtime },
      },
    });
    // The kernel row is born running and bound to its worker; a released seat (ready) is re-bound, a live one adopted.
    bindKernelJob(ledger.db, { workflowId, workerId, payload: parseJson(payload), generation, reason: replaced ? 'kernel-restarted' : 'kernel-booted', at: now });
    transitionWorkflowToRunning(ledger, { workflowId, now, generation });
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation,
      kind: replaced ? 'kernel-restarted' : 'kernel-booted',
      payload: { terminal: handle, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAuthority, effectiveModel, modelAttested,
        inboxId: claim.inbox_id, attempt, launchedBy,
        startup: hostStartup, ...(workflowInstall ? { install: workflowInstall } : {}),
        nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`,
        sourceHost: sourceRoot, projectBinding: context?.file ?? null, ...(staleKernel ? { replacedKernel: staleKernel } : {}),
        ...(restartAuthority ? { restartAuthority } : {}),
        managed,
        ...(workflowWorktree ? { workflowWorktree: { orcaWorktreeId: workflowWorktree.orcaWorktreeId, path: workflowWorktree.path, branch: workflowWorktree.branch } } : {}),
        ...(spawned.trust ? { trust: spawned.trust } : {}),
        guard: guardReceipt,
        ...(fellThrough.length ? { fellThrough } : {}),
      },
      createdAt: now });
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation, kind: 'runtime-read-delivered',
      payload: { rev: bootRuntimeRev, files: [...KERNEL_BOOT_FILES], source: 'boot', attempt }, createdAt: now });
    });
  } catch (error) {
    publication = { ok: false, reason: 'kernel-seat-publication-failed', error: String(error?.message ?? error) };
  }
  if (!publication.ok) {
    // The attested launch is still ours even when approval or the singleton changed while Orca was awaited.
    const cleanup = releaseManagedWorker(spawned.dispatchId, handle);
    if (cleanup.ok) { try { unbindGuardTerminal({ skillRoot, handle }); } catch { /* pruned by age later */ } }
    failStart(publication.reason, publication.error ?? 'Kernel launch lost its final publication authority', handle,
      { authority: publication.authority ?? null, dispatch: spawned.dispatchId, admission: spawned.admission ?? null,
        effectState: cleanup.ok ? 'none' : 'unknown', cleanup });
  }
  if (priorHandle && priorHandle !== handle) { try { unbindGuardTerminal({ skillRoot, handle: priorHandle }); } catch { /* pruned by age later */ } }

  const out = { ok: true, workflowId, kernel: token, terminal: handle, host: 'orca', executionHost: 'orca',
    startup: hostStartup, ...(workflowInstall ? { install: workflowInstall } : {}),
    agent: route.agent, routedBy: route.routedBy, launch: routeInfo.launch, modelAuthority, effectiveModel, modelAttested,
    ...(kernelModel ? { model: kernelModel } : {}), ...(kernelEffort ? { effort: kernelEffort } : {}),
    ...(route.route?.profile ? { profile: route.route.profile } : {}),
    ...(route.runtimePool ? { runtimePool: route.runtimePool } : {}),
    ...(route.warnings?.length ? { warnings: route.warnings } : {}),
    ...(fellThrough.length ? { fellThrough } : {}),
    dispatch: spawned.dispatchId, runId: spawned.runId, taskId: spawned.taskId, guard: guardReceipt,
    ...(workflowWorktree ? { workflowWorktree: { orcaWorktreeId: workflowWorktree.orcaWorktreeId, path: workflowWorktree.path, branch: workflowWorktree.branch } } : {}),
    hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}` },
    replaced, attempt, generation, sourceHost: sourceRoot, projectBinding: context?.file ?? null, promptSubmitted: true,
    launchAuthority: restartAuthority
      ? { kind: 'replacement', goalRevision: goal?.revision ?? 0, goalIdentity: goal?.goal_identity ?? null,
        approvedAt: firstBoot?.created_at ?? null, ...restartAuthority, confirmationRequested: false }
      : { kind: 'first-boot', goalRevision: goal?.revision ?? 0, goalIdentity: goal?.goal_identity ?? null, confirmationRequested: false } };
  console.log(asJson ? JSON.stringify(out, null, 2)
    : `[Kernel] ${kernelName} (${workflowId}) booted as worker ${spawned.dispatchId} (terminal ${handle}) with ${route.agent}/${kernelModel} (routedBy: ${route.routedBy}) — inbox ${claim.inbox_id} claimed`);
} finally { ledger.close(); }
