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
// its pick and fallback chain to agents via modules/models/profiles/<target>.yaml.
// Router refusal or exhaustion is a typed failure, never an implicit Devin kernel.
// Spawn flags come from the agent's adapter card
// modules/models/agents/<agent>.yaml, not a hardcoded map.
//
// Every kernel is a dedicated Orca command terminal. It is not an operation
// worker and boot never creates an orchestration Run/Task/Dispatch. The
// terminal command pins the resolved model/effort using adapter-card data;
// the model is accepted only after its exact id renders on screen.
//
//   node scripts/kernel/start-workflow.mjs --repo <path> [--goal <workflow_id>] [--agent <name>] [--plan] [--json]
//   node scripts/kernel/start-workflow.mjs --repo <path> --goal <workflow_id> --adopt <terminal> [--json]
//
// A replacement needs a kernel proven dead by a RESPONDING Orca
// (scripts/kernel/host-outage.mjs). An Orca outage (runtime_unavailable,
// orca.exe ENOENT during an update) is refused with step host-unavailable and
// exit 75, touching nothing; a kernel job whose terminal is still alive while
// its signal is gone is refused with step kernel-terminal-alive (exit 3), and
// --adopt <terminal> binds that live kernel back: signal re-written, job
// running, the residue incidents of the failed restart resolved.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLedger, ledgerFileFor, transitionWorkflowToRunning } from '../../engine/ledger-db.mjs';
import { inspectOwnerConfig } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { buildSpawnCommand, spawnAgent } from '../agent/lib.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { kernelTerminalVerdict } from './host-outage.mjs';
import { classifyAgentScreen, exitedAgentPromptRow } from './terminal-liveness.mjs';
import { closeExitedTerminal } from './close-op-terminal.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { resolveLaunchModel, providerAvailability, providerCircuitOf, orderByAvailability } from '../agent/models.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const sourceRoot = path.dirname(skillRoot);
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const repo = path.resolve(arg('repo', process.cwd()));
const agentOverride = arg('agent');
const goalId = arg('goal'); // explicit <workflow_id> — per modules/kernel/start-workflow.yaml
const asJson = process.argv.includes('--json');
const adoptHandle = arg('adopt');
const planOnly = process.argv.includes('--plan');

const ROUTE_MODEL = path.join(skillRoot, 'scripts', 'route', 'route-model.mjs');
const KERNEL_ROUTE = { kind: 'model.manageWorkflow', risk: 'high' }; // selection.yaml kernelFunctionKinds
// The launch steps that fail before the model took any input — the only ones a
// group boot falls through on. An unreadable contract falls through on none.
const FALL_THROUGH_STEPS = (() => {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'start-workflow.yaml'), 'utf8'));
    const steps = doc?.spawn?.fallThrough?.noEffectSteps;
    return new Set(Array.isArray(steps) ? steps.filter(s => typeof s === 'string') : []);
  } catch { return new Set(); }
})();

// Owner config: <skillRoot>/config.yaml — the per-project config seeded from
// config.example.yaml by the installer (gitignored), read through the one
// reader in engine/config.mjs. A missing, unparsable or schema-short file is
// never fatal — routing falls through to route-model and says why.
// STARCI_OWNER_ROOT points the reader at a different directory holding a
// config.yaml (test and tooling seam).
const ownerRoot = process.env.STARCI_OWNER_ROOT ? path.resolve(process.env.STARCI_OWNER_ROOT) : skillRoot;
const ownerFileLabel = (file) => ownerRoot === skillRoot ? path.relative(skillRoot, file) : file;

// Provider liveness probe: scripts/api/quota/index.mjs exports
// probeQuota(provider) → {state, usedPercent, detail}; 'dead' means the
// provider is not authenticated. It is imported lazily and every failure
// degrades to 'unknown' — a probe is evidence, never a verdict, and a kernel
// must still boot when the provider CLI cannot answer. Probes are memoized
// per process — one account-list read serves every candidate.
const probeCache = new Map();
async function probeAgent(agent) {
  if (probeCache.has(agent)) return probeCache.get(agent);
  const file = path.join(skillRoot, 'scripts', 'api', 'quota', 'index.mjs');
  let probe = { state: 'unknown', detail: 'quota probe not installed' };
  if (fs.existsSync(file)) {
    try {
      const mod = await import(pathToFileURL(file).href);
      probe = typeof mod.probeQuota === 'function'
        ? (await mod.probeQuota(agent) ?? { state: 'unknown' })
        : { state: 'unknown', detail: 'quota module exports no probeQuota' };
    } catch (e) { probe = { state: 'unknown', detail: `quota probe threw: ${e.message}` }; }
  }
  probeCache.set(agent, probe && typeof probe === 'object' ? probe : { state: 'unknown' });
  return probeCache.get(agent);
}

// The pool target a provider pin launches on: the runtimes.yaml pool owned by
// that provider that carries the kernel-manager role (decide) first, else the
// provider's first pool.
function poolTargetForAgent(agent) {
  const file = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
  const owned = Object.entries(doc?.runtimes ?? {}).filter(([, rt]) => rt?.provider === agent);
  return owned.find(([, rt]) => Array.isArray(rt?.roles) && rt.roles.includes('decide'))?.[0]
    ?? owned[0]?.[0] ?? null;
}

// kernel.model resolves its provider through the runtime pools: a model id a
// pool pins (runtimes.*.models[role]) or the pool target itself names the
// provider. runtimes.yaml is the single capacity/model-pin authority.
function agentForModel(model) {
  const file = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
  for (const [id, rt] of Object.entries(doc?.runtimes ?? {})) {
    if (id === model || rt?.target === model) return rt?.provider ?? null;
    if (Object.values(rt?.models ?? {}).includes(model)) return rt?.provider ?? null;
  }
  return null;
}

// A pool target's provider is declared by its model profile
// (modules/models/profiles/<target>.yaml).
function agentForTarget(target) {
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  try { return parseYaml(fs.readFileSync(file, 'utf8'))?.provider ?? null; } catch { return null; }
}

// One provider's availability for a kernel group member: the quota probe plus
// this ledger's provider-health circuit (scripts/agent/models.mjs).
async function memberAvailability(agent, db) {
  const probe = await probeAgent(agent);
  let circuit = null;
  try { circuit = db ? providerCircuitOf(db, agent) : null; } catch { circuit = null; }
  return providerAvailability({ probe, circuit });
}

async function completeKernelRoute(route) {
  if (route.error || !route.agent) return route;
  let model = route.model ?? route.route?.model ?? null;
  let effort = route.effort ?? route.route?.effort ?? null;
  const runtimePool = route.route?.target ?? poolTargetForAgent(route.agent);
  if ((!model || !effort) && runtimePool) {
    try {
      const resolved = resolveLaunchModel(runtimePool, KERNEL_ROUTE.risk);
      model = model ?? resolved?.modelId ?? null;
      effort = effort ?? resolved?.effort ?? null;
    } catch { /* converted to a typed route error below */ }
  }
  if (!model)
    return { ...route, runtimePool, error: `kernel agent '${route.agent}' has no resolvable model for ${KERNEL_ROUTE.kind}/${KERNEL_ROUTE.risk}` };
  return { ...route, model, effort, runtimePool };
}

// Resolve the dedicated Kernel terminal's agent/model. Config pins and CLI
// overrides are authority, not preferences: a dead agent, unknown bare model
// or agent/model mismatch fails closed instead of choosing a substitute.
// A config.yaml kernel group and the unpinned think-group route are ordered
// member lists instead: `members` is the launch order after availability
// (unavailable skipped, limited last) and `fallThrough` lets the boot move to
// the next member on a no-effect launch refusal (modules/kernel/start-workflow.yaml
// spawn.fallThrough). The route's top-level agent/model are members[0].
const single = (route) => (route.error ? route : { ...route, members: [route], fallThrough: false });
const groupRoute = (members, extra) => ({ ...members[0], members, fallThrough: true, ...extra });
const memberLabel = (m) => `${m.agent}/${m.model ?? '(pool model)'}`;
const memberSummary = (m) => ({ agent: m.agent, model: m.model ?? null, effort: m.effort ?? null,
  runtimePool: m.runtimePool ?? null, ...(m.availability ? { availability: m.availability.state } : {}) });

async function resolveKernelRoute(db) {
  if (agentOverride) {
    const probe = await probeAgent(agentOverride);
    if (probe?.state === 'dead')
      return { agent: agentOverride, routedBy: 'override', warnings: [],
        errorStep: 'kernel-pin-unavailable',
        error: `explicit kernel agent '${agentOverride}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return single(await completeKernelRoute({ agent: agentOverride, routedBy: 'override', warnings: [] }));
  }
  const owner = inspectOwnerConfig(ownerRoot);
  const kc = owner.config?.kernel;
  const cfgGroup = Array.isArray(kc?.group) ? kc.group.filter(m => typeof m?.agent === 'string' && m.agent.trim())
    .map(m => ({ agent: m.agent.trim(), model: typeof m.model === 'string' && m.model.trim() ? m.model.trim() : null })) : null;
  const cfgAgent = !cfgGroup && typeof kc?.agent === 'string' && kc.agent.trim() ? kc.agent.trim() : null;
  const cfgModel = !cfgGroup && typeof kc?.model === 'string' && kc.model.trim() ? kc.model.trim() : null;
  const cfgEffort = (typeof kc?.effort === 'string' && kc.effort.trim() ? kc.effort.trim() : null)
    ?? (typeof owner.config?.effort === 'string' && owner.config.effort.trim() ? owner.config.effort.trim() : null);
  const config = owner.config || owner.error ? {
    file: owner.config ? ownerFileLabel(owner.file) : null,
    agent: cfgAgent, model: cfgModel, effort: cfgEffort,
    ...(cfgGroup ? { group: cfgGroup } : {}),
    budgets: owner.config?.budgets ?? null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.invalid ? { configInvalid: owner.invalid } : {}),
  } : null;
  const warnings = [];
  const warn = (warning) => { warnings.push(warning); console.error(`start-workflow: warning: ${warning}`); };
  if (cfgGroup?.length) {
    const availability = new Map();
    for (const m of cfgGroup) if (!availability.has(m.agent)) availability.set(m.agent, await memberAvailability(m.agent, db));
    const { ordered, unavailable } = orderByAvailability(cfgGroup, m => availability.get(m.agent));
    for (const u of unavailable) warn(`kernel group member ${memberLabel(u)} skipped — ${u.availability.reason}`);
    const members = [];
    for (const m of ordered) {
      const modelAgent = m.model ? agentForModel(m.model) : null;
      if (modelAgent && modelAgent !== m.agent) { warn(`kernel group member ${memberLabel(m)} skipped — model is owned by agent '${modelAgent}'`); continue; }
      const completed = await completeKernelRoute({ agent: m.agent, routedBy: 'config', model: m.model, effort: cfgEffort, config, warnings, availability: m.availability });
      if (completed.error) { warn(`kernel group member ${memberLabel(m)} skipped — ${completed.error}`); continue; }
      members.push(completed);
    }
    if (!members.length)
      return { agent: cfgGroup[0].agent, routedBy: 'config', model: cfgGroup[0].model, effort: cfgEffort, config, warnings,
        members: [], fallThrough: true, errorStep: 'kernel-group-unavailable',
        error: `kernel group has no available member: ${warnings.join('; ')}` };
    return groupRoute(members);
  }
  if (cfgAgent) {
    const modelAgent = cfgModel ? agentForModel(cfgModel) : null;
    if (modelAgent && modelAgent !== cfgAgent)
      return { agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        error: `kernel pin mismatch: agent '${cfgAgent}' cannot launch model '${cfgModel}' owned by agent '${modelAgent}'` };
    const probe = await probeAgent(cfgAgent);
    if (probe?.state === 'dead')
      return { agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        errorStep: 'kernel-pin-unavailable',
        error: `kernel pin failed closed: agent '${cfgAgent}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return single(await completeKernelRoute({ agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings }));
  } else if (cfgModel) {
    const agent = agentForModel(cfgModel);
    if (!agent)
      return { agent: null, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        error: `kernel model pin '${cfgModel}' is not declared by any runtimePool` };
    const probe = await probeAgent(agent);
    if (probe?.state === 'dead')
      return { agent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings,
        errorStep: 'kernel-pin-unavailable',
        error: `kernel model pin '${cfgModel}' failed closed: agent '${agent}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return single(await completeKernelRoute({ agent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings }));
  }
  // Unpinned: route-model resolves the think group quota-aware (selection.yaml
  // decisionFlow kernel-function + kernel-availability) and reads this repo's
  // provider-health circuit; its pick and fallbackChain are the members.
  const r = spawnSync(process.execPath,
    [ROUTE_MODEL, '--kind', KERNEL_ROUTE.kind, '--risk', KERNEL_ROUTE.risk, '--repo', repo, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  let result = null;
  try { result = JSON.parse(r.stdout || 'null'); } catch { /* non-JSON output */ }
  const pick = result?.pick ?? null;
  if (r.error || r.status !== 0 || !pick?.target) {
    return {
      agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: r.error?.message ?? (r.status === 0 ? 'route-model returned no pick' : result?.rule ?? `route-model exited ${r.status}`)
        + ((result?.rejected ?? []).length ? ` — ${result.rejected.map(x => `${x.target}: ${(x.reasons ?? [])[0] ?? 'rejected'}`).join('; ')}` : ''),
    };
  }
  const members = [];
  for (const [i, c] of [pick, ...(result.fallbackChain ?? [])].entries()) {
    const agent = agentForTarget(c.target);
    if (!agent) { warn(`profile for runtimePool '${c.target}' declares no execution agent`); continue; }
    // Unpinned routing never invents a hard-coded Devin fallback: only
    // route-model's own members, re-probed so a dead agent is never launched.
    const probe = await probeAgent(agent);
    if (probe?.state === 'dead') { warn(`routed agent '${agent}' (${c.target}) probe is dead (${probe.detail ?? 'not authenticated'}) — taking the next member`); continue; }
    const completed = await completeKernelRoute({
      agent, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      ...(result.availability?.[c.target] ? { availability: result.availability[c.target] } : {}),
      route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: c.target, model: c.model ?? null,
        profile: i === 0 ? (pick.profile ?? null) : `profiles/${c.target}.yaml`, mode: c.mode ?? null, rule: result.rule ?? null },
    });
    if (completed.error) { warn(completed.error); continue; }
    members.push(completed);
  }
  if (!members.length)
    return { agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: `no routed kernel member is launchable (${warnings.join('; ')})` };
  return groupRoute(members);
}

// Spawn command + terminal lifecycle live in scripts/agent/lib.mjs —
// buildSpawnCommand reads the agent's adapter card (credential refresh,
// env strip, commandRequirements incl. --yolo/dangerous flags), spawnAgent
// runs create → readiness → deliver → submission. Bypass flags can no longer
// be forgotten because no caller assembles a provider command by hand.

const canonicalPath = (value) => {
  const resolved = path.resolve(value);
  try { return fs.realpathSync.native(resolved); } catch { return resolved; }
};
const samePath = (left, right) => process.platform === 'win32'
  ? canonicalPath(left).toLowerCase() === canonicalPath(right).toLowerCase()
  : canonicalPath(left) === canonicalPath(right);

function projectContext() {
  const projects = path.join(sourceRoot, '.workspaces', 'projects');
  if (!fs.existsSync(projects)) return null;
  for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'work.json');
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const be = doc?.repositories?.be?.pathFromSource
      ? path.resolve(sourceRoot, doc.repositories.be.pathFromSource)
      : null;
    if (!be || !samePath(be, repo)) continue;
    const fe = doc?.repositories?.fe?.pathFromSource
      ? path.resolve(sourceRoot, doc.repositories.fe.pathFromSource)
      : null;
    return { file, project: doc.project ?? entry.name, be, fe };
  }
  return null;
}

const context = projectContext();
const apiFile = path.join(skillRoot, 'scripts', 'kernel', 'api.mjs');
const promptTemplate = fs.readFileSync(path.join(skillRoot, 'modules', 'kernel', 'kernel-prompt.md'), 'utf8');
const renderKernelPrompt = ({ workflowId, inboxId, goalRevision }) => promptTemplate
  .replaceAll('{workflowId}', workflowId)
  .replaceAll('{inboxId}', String(inboxId))
  .replaceAll('{goalRevision}', String(goalRevision))
  .replaceAll('{sourceRoot}', sourceRoot)
  .replaceAll('{skillRoot}', skillRoot)
  .replaceAll('{repo}', repo)
  .replaceAll('{ledgerFile}', ledgerFileFor(repo))
  .replaceAll('{bindingFile}', context?.file ?? '(no matching project binding; --repo is authoritative)')
  .replaceAll('{frontendRoot}', context?.fe ?? '(not bound)')
  .replaceAll('{ownerLanguage}', inspectOwnerConfig(ownerRoot).config?.language ?? 'en')
  .replaceAll('{apiFile}', apiFile);

const MANAGED_DEAD_STATE = /stop|fail|dead|exit|release|abandon/i;

// The bare shell prompt a connected kernel terminal ends in once its agent
// exited (terminal-liveness.mjs exitedAgentPromptRow), or null. An unreadable
// frame proves nothing and reads null.
function agentExitedRow(handle) {
  try {
    const read = terminalRead({ terminal: handle, screen: true });
    return read?.ok ? exitedAgentPromptRow(read.screen) : null;
  } catch { return null; }
}

// A live signal is proven, not assumed: command-terminal kernels by a
// connected+writable terminal, managed kernels by worker-show reporting a
// non-terminal worker state. Nothing that cannot be proven live blocks a
// restart — but a restart of a managed kernel first stops and releases the
// old dispatch so a zombie worker is never left running beside its successor.
async function signalHealth(signal) {
  if (!signal) return { live: false, reason: 'absent', terminal: null };
  if (signal.expires_at !== null && signal.expires_at <= Date.now()) {
    return { live: false, reason: 'startup reservation expired', terminal: null };
  }
  let value = null;
  try { value = JSON.parse(signal.value_json || '{}'); } catch { value = {}; }
  if (value.state === 'starting' && signal.expires_at > Date.now()) {
    return { live: true, reason: 'startup reservation active', terminal: null, value };
  }
  if (value.dispatch) {
    const shown = workerShow({ dispatch: value.dispatch });
    const state = shown?.state ?? null;
    const live = shown?.ok === true && !(state && MANAGED_DEAD_STATE.test(state));
    return {
      live, terminal: null, value,
      reason: live ? `worker ${state ?? 'ready'}` : (shown?.error || `worker state ${state ?? 'unreadable'}`),
    };
  }
  if (!value.terminal) return { live: false, reason: 'signal has no terminal handle', terminal: null, value };
  // A running Orca that no longer knows the handle (every terminal after a
  // host reboot) proves there is nothing left to close (gone). An Orca that
  // does not answer proves nothing (hostUnavailable), and neither does a
  // refusal the listing cannot settle (unverified).
  const probe = kernelTerminalVerdict(value.terminal);
  // A connected terminal whose agent exited is a plain shell, not a kernel:
  // dead on a responding Orca, closed only after its replacement launched.
  const exited = probe.verdict === 'live' ? agentExitedRow(value.terminal) : null;
  if (exited) return { live: false, agentExited: true, shellPrompt: exited,
    reason: `agent exited: the terminal is back at the shell prompt '${exited}'`, terminal: probe.shown?.terminal ?? null, value };
  return { live: probe.verdict === 'live', gone: probe.verdict === 'gone',
    hostUnavailable: probe.verdict === 'host-unavailable', unverified: probe.verdict === 'unverified',
    errorCode: probe.errorCode ?? null, reason: probe.reason, terminal: probe.shown?.terminal ?? null, value };
}

// A refusal that changed nothing: JSON on stdout (the watchdog reads it) and a
// distinct exit code - 75 (EX_TEMPFAIL) when Orca is not answering.
function refuse(step, fields = {}, code = 1) {
  const out = { ok: false, step, ...fields };
  if (asJson) console.log(JSON.stringify(out));
  else console.error(`start-workflow: ${step}: ${fields.error ?? ''}`);
  process.exit(code);
}
const EXIT_HOST_UNAVAILABLE = 75;
const EXIT_KERNEL_ALIVE = 3;
const parseJson = (text) => { try { return JSON.parse(text || '{}') ?? {}; } catch { return {}; } };

// The kernel job's own terminal handles: the worker_id and the hierarchy seat.
function kernelJobHandles(job) {
  if (!job) return [];
  const payload = parseJson(job.payload_json);
  return [...new Set([job.worker_id, payload?.hierarchy?.runtime?.terminalHandle].filter(Boolean))];
}

// Bind a live kernel terminal back to its workflow (--adopt). The terminal must
// be proven this workflow's kernel (the kernel job or a kernel event names it),
// live on a responding Orca, in this repo's worktree and showing an agent; the
// current signal must not be a different live kernel.
async function adoptKernel(workflowId, handle) {
  const wf = ledger.db.prepare('SELECT phase,generation FROM workflows WHERE workflow_id=?').get(workflowId);
  if (!wf) refuse('adopt-no-workflow', { workflowId, terminal: handle, error: `no workflow ${workflowId}` });
  const jobId = `kernel-${workflowId}`;
  const job = ledger.db.prepare('SELECT job_id,status,worker_id,attempt,payload_json FROM jobs WHERE job_id=?').get(jobId);
  if (!job) refuse('adopt-no-kernel-job', { workflowId, terminal: handle, error: `${jobId} does not exist; boot the kernel instead` });
  const events = ledger.db.prepare("SELECT kind,payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='kernel' AND payload_json LIKE ? ORDER BY created_at")
    .all(workflowId, `%${handle}%`).map((e) => ({ ...e, payload: parseJson(e.payload_json) }));
  const namedByEvent = events.some((e) => e.payload?.terminal === handle || e.payload?.handle === handle);
  if (!kernelJobHandles(job).includes(handle) && !namedByEvent)
    refuse('adopt-terminal-not-this-kernel', { workflowId, terminal: handle,
      error: `${handle} is neither ${jobId}'s terminal nor named by a kernel event of ${workflowId}` });

  const priorSignal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const priorValue = parseJson(priorSignal?.value_json);
  let priorHealth = null;
  if (priorSignal && priorValue.terminal !== handle) {
    priorHealth = await signalHealth(priorSignal);
    if (priorHealth.hostUnavailable) refuse('host-unavailable', { workflowId, terminal: handle, error: priorHealth.reason }, EXIT_HOST_UNAVAILABLE);
    if (priorHealth.live) refuse('kernel-already-live', { workflowId, terminal: handle, liveTerminal: priorValue.terminal ?? null,
      error: `${workflowId} already has a live kernel (${priorValue.terminal ?? priorSignal.token}); quit and close it first` });
    if (priorHealth.unverified) refuse('kernel-terminal-unverified', { workflowId, terminal: priorValue.terminal ?? null, error: priorHealth.reason });
  }

  const probe = kernelTerminalVerdict(handle);
  if (probe.verdict === 'host-unavailable') refuse('host-unavailable', { workflowId, terminal: handle, error: probe.reason }, EXIT_HOST_UNAVAILABLE);
  if (probe.verdict !== 'live') refuse('adopt-terminal-not-live', { workflowId, terminal: handle, error: probe.reason });
  const worktreePath = probe.shown?.terminal?.worktreePath ?? null;
  if (worktreePath && !samePath(worktreePath, repo))
    refuse('adopt-terminal-wrong-worktree', { workflowId, terminal: handle, error: `${handle} runs in ${worktreePath}, not ${repo}` });
  const read = terminalRead({ terminal: handle, screen: true });
  // A frame that ends in a bare shell prompt: the kernel's agent exited and
  // the terminal is a plain shell. It is replaced, never adopted.
  const shellPrompt = read.ok ? exitedAgentPromptRow(read.screen) : null;
  if (shellPrompt)
    refuse('adopt-terminal-agent-exited', { workflowId, terminal: handle, screenState: 'agent-exited', shellPrompt,
      error: `${handle} is back at the shell prompt '${shellPrompt}': its agent exited, so it is a dead kernel to replace, not one to adopt` });
  const screenState = read.ok ? classifyAgentScreen(read.screen).state : 'unreadable';
  if (['failed', 'unknown', 'unreadable'].includes(screenState))
    refuse('adopt-terminal-no-agent', { workflowId, terminal: handle, screenState,
      error: `${handle} shows no agent session (${screenState}); a bare shell or a dead agent is not a kernel` });

  // The seat facts the terminal was launched with, from its own boot event.
  const boot = [...events].reverse().find((e) => ['kernel-booted', 'kernel-restarted', 'kernel-adopted'].includes(e.kind) && e.payload?.terminal === handle)?.payload ?? {};
  const agent = boot.agent ?? probe.shown?.terminal?.agentIdentity ?? null;
  const seat = { terminal: handle, host: 'orca', agent, routedBy: boot.routedBy ?? 'adopted', model: boot.model ?? null,
    effort: boot.effort ?? null, launch: 'terminal', modelAttested: boot.modelAttested === true, adopted: true };
  const token = `kernel-${crypto.randomBytes(6).toString('hex')}`;
  const now = Date.now();
  const previousPayload = parseJson(job.payload_json);
  const payload = JSON.stringify({
    ...previousPayload,
    route: { ...(previousPayload.route ?? {}), host: 'orca', agent, routedBy: seat.routedBy, model: seat.model, effort: seat.effort, launch: 'terminal' },
    hierarchy: { ...(previousPayload.hierarchy ?? {}),
      runtime: { ...(previousPayload.hierarchy?.runtime ?? {}), host: 'orca', agent, provider: agent, model: seat.model, terminalHandle: handle } },
  });
  let resolved = [];
  ledger.transaction(() => {
    ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,?,?,?,NULL)")
      .run(workflowId, process.pid, token, JSON.stringify(seat), now);
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id=?,result_json=NULL,payload_json=?,updated_at=? WHERE job_id=?")
      .run(handle, payload, now, jobId);
    // The failed restart recorded this very terminal as unclosed residue; it is the kernel again.
    resolved = ledger.db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE '%kernel-stale-terminal-unclosed%' AND last_progress LIKE ?")
      .all(workflowId, `%${handle}%`).map((row) => row.incident_id);
    for (const id of resolved) ledger.db.prepare("UPDATE incidents SET status='resolved',updated_at=? WHERE incident_id=?").run(now, id);
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: wf.generation ?? 0, kind: 'kernel-adopted', createdAt: now,
      payload: { ...seat, screenState, attempt: job.attempt,
        previousJob: { status: job.status, worker_id: job.worker_id },
        previousSignal: priorSignal ? { token: priorSignal.token, terminal: priorValue.terminal ?? null, reason: priorHealth?.reason ?? null } : null,
        resolvedIncidents: resolved } });
  });
  // The signal's own terminal was an exited agent's shell: closed now that a live kernel holds the seat.
  const exitedClosed = priorHealth?.agentExited ? closeExitedKernelTerminals(workflowId, [priorValue.terminal], handle) : [];
  const out = { ok: true, workflowId, kernel: token, terminal: handle, adopted: true, agent, model: seat.model, screenState,
    previousJobStatus: job.status, resolvedIncidents: resolved, replaced: false,
    ...(exitedClosed.length ? { exitedTerminalsClosed: exitedClosed } : {}) };
  console.log(asJson ? JSON.stringify(out) : `[Kernel] ${workflowId} adopted live terminal ${handle} (${agent ?? 'agent?'}; ${screenState})`);
  process.exit(0);
}

// Best-effort settlement of a managed dispatch (stale kernel replacement or a
// failed launch with residual effects): worker-stop then worker-release,
// matching calls.yaml's settle-dispatch recovery. Never throws.
function releaseManagedWorker(dispatchId) {
  if (!dispatchId) return;
  try { workerStop({ dispatch: dispatchId }); } catch { /* best-effort */ }
  try { workerRelease({ dispatch: dispatchId }); } catch { /* best-effort */ }
}

// A stale command-terminal kernel (launch: terminal — the Devin/Codex/Qwen
// seat) leaves a live Orca terminal behind: clearing the signal removes the
// ledger's handle on it, not the PTY. That is how one workflow grew two
// [Kernel] rows in the sidebar (fable.md orca-hierarchy, root cause 2). The
// close is best-effort but never silent: a failure is returned and recorded
// as kernel-stale-terminal-unclosed.
function closeStaleKernelTerminal(handle) {
  if (!handle) return null;
  let closed;
  try { closed = terminalClose({ terminal: handle }); }
  catch (e) { closed = { ok: false, error: String(e?.message ?? e) }; }
  return { handle, ok: closed?.ok === true, ...(closed?.error ? { error: String(closed.error) } : {}) };
}

// A kernel terminal whose agent exited is a bare shell left open beside its
// replacement. It is closed only AFTER the replacement (or an adopted kernel)
// holds the seat, and only on fresh proof that it is still a bare shell or
// disconnected (close-op-terminal.mjs closeExitedTerminal) - one workflow, one
// kernel terminal. Each result is recorded (kernel-exited-terminal-closed); a
// terminal left open is an open kernel-stale-terminal-unclosed incident.
function closeExitedKernelTerminals(workflowId, handles, liveHandle) {
  const results = [];
  for (const handle of new Set(handles.filter(Boolean))) {
    if (handle === liveHandle) continue;
    results.push(closeExitedTerminal(handle));
  }
  if (!results.length) return results;
  const at = Date.now();
  const generation = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId)?.generation ?? 0;
  const unclosed = results.filter((r) => !r.closed && r.proof !== 'gone');
  ledger.transaction(() => {
    // A shell now closed (or gone) is no longer residue: its open unclosed-terminal incidents resolve.
    for (const r of results.filter((x) => x.closed || x.proof === 'gone')) {
      const ids = ledger.db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE '%kernel-stale-terminal-unclosed%' AND last_progress LIKE ?")
        .all(workflowId, `%${r.handle}%`).map((row) => row.incident_id);
      for (const id of ids) ledger.db.prepare("UPDATE incidents SET status='resolved',updated_at=? WHERE incident_id=?").run(at, id);
      if (ids.length) r.resolvedIncidents = ids;
    }
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation, kind: 'kernel-exited-terminal-closed',
      payload: { liveTerminal: liveHandle, terminals: results }, createdAt: at });
    for (const r of unclosed) {
      ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,NULL,0,0,0,0,?,'open',?)")
        .run(`inc-${crypto.randomBytes(6).toString('hex')}`, workflowId,
          `[orca-tree] ${JSON.stringify({ code: 'kernel-stale-terminal-unclosed', handle: r.handle, ok: false, agentExited: true,
            ...(r.proof ? { proof: r.proof } : {}), error: r.error ?? r.reason ?? null })}`, at);
    }
  });
  for (const r of unclosed) console.error(`start-workflow: warning: exited kernel terminal ${r.handle} was not closed (${r.error ?? r.reason ?? 'no reason given'}) — incident opened`);
  return results;
}

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
    const wf = ledger.db.prepare('SELECT title,phase FROM workflows WHERE workflow_id=?').get(target);
    // A finished workflow's goal is closed — even --plan refuses to plan a restart.
    if (wf?.phase === 'finished') { console.error(`goal ${target} is finished — finished goals never re-enter the queue`); process.exit(1); }
    const g = ledger.db.prepare('SELECT revision,goal_identity,json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(target);
    const inbox = ledger.db.prepare("SELECT inbox_id,status FROM inbox WHERE kind='goal' AND workflow_id=?").get(target);
    const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
    const health = await signalHealth(signal);
    const chain = (() => { try { return JSON.parse(g?.json || '{}').opChain?.legs?.map(l => l.op) ?? null; } catch { return null; } })();
    const route = await resolveKernelRoute(ledger.db);
    const cmd = route.error
      ? { error: route.error }
      : buildSpawnCommand({ provider: route.agent, kernel: true, model: route.model, effort: route.effort });
    const out = {
      plan: true, workflowId: target, title: wf?.title, phase: wf?.phase,
      goalRevision: g?.revision ?? null, goalIdentity: g?.goal_identity ?? null,
      opChain: chain, inbox: inbox?.status ?? 'none',
      host: 'orca', executionHost: 'orca', agent: route.agent ?? null, routedBy: route.routedBy,
      launch: 'terminal',
      ...(route.model ? { model: route.model } : {}),
      ...(route.effort ? { effort: route.effort } : {}),
      ...(route.route?.profile ? { profile: route.route.profile } : {}),
      ...(route.runtimePool ? { runtimePool: route.runtimePool } : {}),
      config: route.config ?? (route.routedBy === 'override' ? { file: 'not consulted — explicit agent flag wins' } : { file: null }),
      ...(route.route ? { route: route.route } : {}),
      ...(route.error ? { step: route.errorStep ?? 'kernel-route', routeError: route.error } : {}),
      ...(route.warnings?.length ? { warnings: route.warnings } : {}),
      ...(route.members ? { group: route.members.map(memberSummary), fallThrough: route.fallThrough === true } : {}),
      sourceHost: sourceRoot, projectBinding: context?.file ?? null,
      ledger: ledgerFileFor(repo), frontend: context?.fe ?? null,
      kernel: health.live
        ? `LIVE (${signal.token}; ${health.reason}) — will not spawn a second`
        : health.hostUnavailable || health.unverified
          ? `UNPROVEN (${signal.token}; ${health.reason}) — no replacement until Orca proves it dead`
        : signal
          ? `STALE (${signal.token}; ${health.reason}) — will replace on start`
          : route.error
            ? `BLOCKED (${route.error})`
            : `will spawn [Kernel] ${route.agent}/${route.model} in a dedicated Orca terminal`,
      command: cmd.command ?? null, commandSource: cmd.commandSource ?? null,
      ...(cmd.error ? { commandError: cmd.error } : {}),
    };
    const routeLine = `  host: orca | agent: ${route.agent ?? '(unresolved)'} | model: ${route.model ?? '(unresolved)'} (routedBy: ${route.routedBy}`
      + (route.routedBy === 'config' ? ` — ${route.config?.file} ${route.config?.group ? 'kernel.group' : `kernel.${route.config?.agent ? 'agent' : 'model'} pin`}` : '')
      + (route.route ? ` — ${route.route.target} ${route.route.model ?? ''} [${route.route.mode}]` : '')
      + (route.error ? ` — ${route.error}` : '') + ')';
    const budgets = route.config?.budgets;
    const budgetLine = budgets && Object.values(budgets).some(v => v != null)
      ? `\n  budgets (config.yaml): ${['maxOps', 'perOpMs', 'dailyTokens'].map(k => `${k}=${budgets[k] ?? 'unbounded'}`).join('  ')}`
      : '';
    const warningLine = (route.warnings ?? []).map((w) => `\n  warning: ${w}`).join('');
    const groupLine = route.members?.length > 1
      ? `\n  group: ${route.members.map(m => memberLabel(m) + (m.availability?.state && m.availability.state !== 'available' ? ` (${m.availability.state})` : '')).join(' → ')} — a no-effect launch refusal falls through to the next member`
      : '';
    console.log(asJson ? JSON.stringify(out, null, 2)
      : `PLAN — start workflow ${target}\n  title: ${wf?.title}\n  phase: ${wf?.phase} | goal rev ${out.goalRevision} (${out.goalIdentity}) | inbox: ${out.inbox}\n  op chain: ${chain ? chain.join(' → ') : 'kernel derives at boot'}\n  kernel: ${out.kernel}\n${routeLine}${groupLine}\n  launch: ${out.launch}\n  config: ${out.config.file ?? 'absent — routing falls to route-model'}${route.effort ? `  effort=${route.effort}` : ''}${budgetLine}${warningLine}\n  command: ${out.command ?? '(unavailable)'}\n  command source: ${out.commandSource ?? '(unavailable)'}`);
    process.exit(route.error || cmd.error ? 1 : 0);
  }

  // A finished workflow's goal is closed — starting it again is refused.
  if (goalId) {
    const wf = ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(goalId);
    if (wf?.phase === 'finished') { console.error(`goal ${goalId} is finished — finished goals never re-enter the queue`); process.exit(1); }
  }

  if (adoptHandle) {
    if (!goalId) refuse('adopt-needs-goal', { terminal: adoptHandle, error: '--adopt needs --goal <workflow_id>' });
    await adoptKernel(goalId, adoptHandle);
  }

  if (!target) { console.log(asJson ? '{"ok":true,"reason":"queue-empty"}' : 'queue empty — no pending or claimed goal'); process.exit(0); }

  // A signal is only live when its Orca terminal is connected and writable. A
  // NULL expiry is not immortality: terminal identity is the health proof.
  const priorSignal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
  const priorHealth = await signalHealth(priorSignal);
  if (priorSignal && priorHealth.live) {
    const out = { ok: true, workflowId: target, kernel: priorSignal.token, terminal: priorHealth.value?.terminal ?? null,
      ...(priorHealth.value?.dispatch ? { dispatch: priorHealth.value.dispatch } : {}), replaced: false, note: priorHealth.reason };
    console.log(asJson ? JSON.stringify(out) : `kernel already live for ${target} (${priorSignal.token})`);
    process.exit(0);
  }
  // An Orca outage or an unsettled refusal proves nothing: touch no seat.
  if (priorSignal && priorHealth.hostUnavailable)
    refuse('host-unavailable', { workflowId: target, terminal: priorHealth.value?.terminal ?? null, error: priorHealth.reason }, EXIT_HOST_UNAVAILABLE);
  if (priorSignal && priorHealth.unverified)
    refuse('kernel-terminal-unverified', { workflowId: target, terminal: priorHealth.value?.terminal ?? null, error: priorHealth.reason });
  // The seat may be gone while the kernel is not: a restart that failed during
  // an Orca outage stopped the job and deleted the signal of a kernel that kept
  // running. Never launch a second kernel beside it; --adopt binds it back.
  // A kernel job terminal whose agent exited is a bare shell, not a kernel:
  // it does not block the launch and is closed once the replacement is up.
  const exitedKernelTerminals = [];
  {
    const kernelJob = ledger.db.prepare('SELECT status,worker_id,payload_json FROM jobs WHERE job_id=?').get(`kernel-${target}`);
    for (const handle of kernelJobHandles(kernelJob)) {
      if (handle === priorHealth.value?.terminal) continue;
      const probe = kernelTerminalVerdict(handle);
      if (probe.verdict === 'host-unavailable')
        refuse('host-unavailable', { workflowId: target, terminal: handle, error: probe.reason }, EXIT_HOST_UNAVAILABLE);
      if (probe.verdict === 'unverified')
        refuse('kernel-terminal-unverified', { workflowId: target, terminal: handle, error: probe.reason });
      if (probe.verdict === 'live' && agentExitedRow(handle)) { exitedKernelTerminals.push(handle); continue; }
      if (probe.verdict === 'live')
        refuse('kernel-terminal-alive', { workflowId: target, terminal: handle, jobStatus: kernelJob.status,
          error: `kernel job terminal ${handle} is alive (job ${kernelJob.status}); adopt it with --adopt ${handle} instead of launching a second kernel` }, EXIT_KERNEL_ALIVE);
    }
  }
  let staleKernel = null;
  if (priorSignal) {
    staleKernel = { token: priorSignal.token, terminal: priorHealth.value?.terminal ?? null,
      ...(priorHealth.value?.dispatch ? { dispatch: priorHealth.value.dispatch } : {}), reason: priorHealth.reason };
    // A stale managed kernel may still hold a live Orca worker — settle the
    // exact old dispatch (stop + release) before the seat is cleared so the
    // replacement never runs beside a zombie.
    // A restart closes the previous kernel terminal BEFORE the new one is
    // recorded — one workflow, one live kernel terminal.
    if (priorHealth.value?.dispatch) releaseManagedWorker(priorHealth.value.dispatch);
    else if (priorHealth.agentExited) {
      // The exited agent's shell stays open until the replacement launched.
      Object.assign(staleKernel, { agentExited: true, shellPrompt: priorHealth.shellPrompt, terminalClose: 'after-replacement' });
      exitedKernelTerminals.unshift(staleKernel.terminal);
    }
    else if (priorHealth.gone) staleKernel.terminalClosed = { handle: staleKernel.terminal, ok: true, gone: true };
    else staleKernel.terminalClosed = closeStaleKernelTerminal(staleKernel.terminal);
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(target);
    const at = Date.now();
    const unclosed = staleKernel.terminalClosed && staleKernel.terminalClosed.ok !== true
      ? staleKernel.terminalClosed : null;
    ledger.transaction(() => {
      ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=? AND token=?").run(target, priorSignal.token);
      ledger.db.prepare("UPDATE jobs SET status='stopped', result_json=?, updated_at=? WHERE job_id=? AND status='running'")
        .run(JSON.stringify({ reason: priorHealth.reason, terminal: staleKernel.terminal }), at, `kernel-${target}`);
      ledger.appendEvent({ workflowId: target, entityType: 'kernel', entityId: target,
        generation: workflow?.generation ?? 0, kind: 'kernel-stale-cleared', payload: staleKernel, createdAt: at });
      // A terminal the host refused to close outlives this restart and becomes
      // the duplicate kernel nobody owns. The restart still proceeds — a dead
      // kernel must be replaced — but the residue is an open incident, so
      // survey and check-orca-tree both see it.
      if (unclosed) {
        ledger.appendEvent({ workflowId: target, entityType: 'kernel', entityId: target,
          generation: workflow?.generation ?? 0, kind: 'kernel-stale-terminal-unclosed',
          payload: { ...unclosed, reason: priorHealth.reason }, createdAt: at });
        ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,NULL,0,0,0,0,?,'open',?)")
          .run(`inc-${crypto.randomBytes(6).toString('hex')}`, target,
            `[orca-tree] ${JSON.stringify({ code: 'kernel-stale-terminal-unclosed', ...unclosed })}`, at);
      }
    });
    if (unclosed) console.error(`start-workflow: warning: stale kernel terminal ${unclosed.handle} could not be closed (${unclosed.error ?? 'no reason given'}) — incident opened`);
  }

  // 1. Claim the goal atomically — the named one, or the oldest pending.
  let claim = null;
  ledger.transaction(() => {
    const row = ledger.db.prepare("SELECT inbox_id,workflow_id,payload_json,status FROM inbox WHERE kind='goal' AND status='pending' AND workflow_id=? LIMIT 1").get(target);
    if (!row) return;
    ledger.db.prepare("UPDATE inbox SET status='claimed',applied_at=? WHERE inbox_id=? AND status='pending'").run(Date.now(), row.inbox_id);
    claim = row;
  });
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
  const reserved = ledger.transaction(() => {
    const occupied = ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=? AND (expires_at IS NULL OR expires_at>?)").get(workflowId, reservationAt);
    if (occupied) return false;
    ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,?,?,?,?)")
      .run(workflowId, process.pid, token, JSON.stringify({ state: 'starting' }), reservationAt, reservationExpires);
    return true;
  });
  if (!reserved) {
    const occupied = ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
    const out = { ok: true, workflowId, kernel: occupied?.token ?? null, replaced: false, note: 'kernel startup already reserved' };
    console.log(asJson ? JSON.stringify(out) : `kernel startup already reserved for ${workflowId}`);
    process.exit(0);
  }

  // 3. Launch one dedicated [Kernel] Orca terminal. A Kernel is not an Orca
  // operation worker, so boot performs no run/task/dispatch mutation.
  let route = await resolveKernelRoute(ledger.db);
  for (const warning of route.warnings ?? []) console.error(`start-workflow: warning: ${warning}`);
  const title = `[Kernel] ${workflowId}`;
  const goal = ledger.db.prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
  const prompt = renderKernelPrompt({ workflowId, inboxId: claim.inbox_id, goalRevision: goal?.revision ?? 0 });
  const failStart = (step, error, handle = null, extra = {}) => {
    const at = Date.now();
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => {
      ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=? AND token=?").run(workflowId, token);
      ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId,
        generation: workflow?.generation ?? 0, kind: 'kernel-start-failed', payload: { step, error, terminal: handle, ...extra }, createdAt: at });
    });
    console.error(JSON.stringify({ ok: false, workflowId, step, error, terminal: handle, ...extra }));
    process.exit(1);
  };
  if (route.error)
    failStart(route.errorStep ?? 'kernel-route', route.error, null, { agent: route.agent ?? null, requestedModel: route.model ?? null });
  // modules/kernel/start-workflow.yaml spawn.fallThrough: a group member refused
  // before the model took any input, with its terminal closed, hands the same
  // boot and reservation to the next member. Anything else ends the boot.
  const members = route.members?.length ? route.members : [route];
  const fellThrough = [];
  let spawned = null;
  for (const [index, member] of members.entries()) {
    spawned = spawnAgent({ provider: member.agent, model: member.model, effort: member.effort,
      worktree: repo, title, prompt, kernel: true, dispatchId: `kernel-${workflowId}` });
    // gate-auto-approved: each launch gate the runtime answered for this member.
    const answered = (spawned.gateAnswers ?? []).filter((a) => a?.keystroke);
    if (answered.length) {
      const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
      ledger.transaction(() => {
        for (const a of answered) ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId,
          generation: workflow?.generation ?? 0, kind: 'gate-auto-approved',
          payload: { gate: a.gate, keystroke: a.keystroke, answered: a.answered === true, cleared: a.cleared === true,
            provider: member.agent, terminal: spawned.terminal ?? null, ...(a.reason ? { reason: a.reason } : {}) } });
      });
    }
    if (spawned.ok) { route = { ...member, warnings: route.warnings, members: route.members, fallThrough: route.fallThrough }; break; }
    const failure = { agent: member.agent, requestedModel: member.model, ...(spawned.signal ? { signal: spawned.signal } : {}),
      ...(spawned.state ? { state: spawned.state } : {}), ...(spawned.gate ? { gate: spawned.gate, remedy: spawned.remedy ?? null } : {}),
      ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}),
      ...(spawned.trust ? { trust: spawned.trust } : {}),
      ...(spawned.errorCode ? { errorCode: spawned.errorCode } : {}),
      ...(spawned.terminalClosed ? { terminalClosed: spawned.terminalClosed } : {}) };
    const next = members[index + 1] ?? null;
    const noEffect = FALL_THROUGH_STEPS.has(spawned.step);
    // A create whose effect was unknown is closed only when its reconciliation
    // closed every terminal it found and no handle-less tab is still pending.
    const recovery = spawned.createRecovery;
    const recoveryClosed = !recovery || (recovery.closed.every((c) => c.ok) && !recovery.pendingTabs?.length
      && !recovery.unowned?.length);
    const closed = (!spawned.terminal || spawned.terminalClosed?.ok === true) && recoveryClosed;
    if (!route.fallThrough || !next || !noEffect || !closed)
      failStart(spawned.step, spawned.error, spawned.terminal ?? null,
        { ...failure, ...(fellThrough.length ? { fellThrough } : {}),
          ...(route.fallThrough && next ? { fallThroughRefused: !noEffect ? `step '${spawned.step}' may have had effect` : 'the failed terminal was not closed' } : {}) });
    const at = Date.now();
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => {
      ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: workflow?.generation ?? 0,
        kind: 'kernel-start-failed', createdAt: at,
        payload: { step: spawned.step, error: spawned.error, terminal: spawned.terminal ?? null, ...failure,
          fellThroughTo: { agent: next.agent, model: next.model ?? null } } });
      // The next member gets a full startup window of its own.
      ledger.db.prepare("UPDATE signals SET expires_at=? WHERE scope='kernel' AND key=? AND token=?").run(at + 120000, workflowId, token);
    });
    fellThrough.push({ agent: member.agent, model: member.model ?? null, step: spawned.step, error: spawned.error,
      ...(spawned.gate ? { gate: spawned.gate } : {}) });
    console.error(`start-workflow: warning: kernel member ${memberLabel(member)} refused at ${spawned.step} (${spawned.error}) — falling through to ${memberLabel(next)}`);
  }
  const handle = spawned.terminal;
  const workerId = handle;
  const kernelModel = route.model;
  const kernelEffort = route.effort ?? null;

  const now = Date.now();
  const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  const generation = workflow?.generation ?? 0;
  const previousJob = ledger.db.prepare('SELECT attempt,payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const previousPayload = (() => { try { return JSON.parse(previousJob?.payload_json || '{}') ?? {}; } catch { return {}; } })();
  const attempt = previousJob ? previousJob.attempt + 1 : 1;
  const routeInfo = { host: 'orca', agent: route.agent, routedBy: route.routedBy, model: kernelModel,
    effort: kernelEffort, profile: route.route?.profile ?? null, runtimePool: route.runtimePool ?? null, launch: 'terminal' };

  ledger.transaction(() => {
    ledger.db.prepare("UPDATE signals SET holder_pid=?,value_json=?,at=?,expires_at=NULL WHERE scope='kernel' AND key=? AND token=?")
      .run(process.pid, JSON.stringify({ terminal: handle, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAttested: true }), now, workflowId, token);
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
          profile: route.route?.profile ?? null,
          runtimePool: route.runtimePool ?? null,
          terminalHandle: handle,
        },
      },
    };
    const payload = JSON.stringify({
      ...previousPayload,
      ...nextPayload,
      ...(previousPayload.orca ? { orca: { ...previousPayload.orca } } : {}),
      hierarchy: {
        ...(previousPayload.hierarchy ?? {}),
        ...nextPayload.hierarchy,
        runtime: { ...(previousPayload.hierarchy?.runtime ?? {}), ...nextPayload.hierarchy.runtime },
      },
    });
    if (previousJob) {
      ledger.db.prepare("UPDATE jobs SET attempt=?,generation=?,payload_json=?,status='running',worker_id=?,result_json=NULL,updated_at=? WHERE job_id=?")
        .run(attempt, generation, payload, workerId, now, `kernel-${workflowId}`);
    } else {
      ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,?,'kernel','kernel',?,'running',?,?,?)")
        .run(`kernel-${workflowId}`, workflowId, null, generation, payload, workerId, now, now);
    }
    transitionWorkflowToRunning(ledger, { workflowId, now, generation });
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation,
      kind: replaced ? 'kernel-restarted' : 'kernel-booted',
      payload: { terminal: handle, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAttested: true,
        inboxId: claim.inbox_id, attempt,
        nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`,
        sourceHost: sourceRoot, projectBinding: context?.file ?? null, ...(staleKernel ? { replacedKernel: staleKernel } : {}),
        ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}),
        ...(spawned.trust ? { trust: spawned.trust } : {}),
        ...(fellThrough.length ? { fellThrough } : {}) },
      createdAt: now });
  });

  // The replacement holds the seat: the exited kernel's shell is closed now.
  const exitedClosed = closeExitedKernelTerminals(workflowId, exitedKernelTerminals, handle);

  const out = { ok: true, workflowId, kernel: token, terminal: handle, host: 'orca', executionHost: 'orca',
    ...(exitedClosed.length ? { exitedTerminalsClosed: exitedClosed } : {}),
    agent: route.agent, routedBy: route.routedBy, launch: routeInfo.launch, modelAttested: true,
    ...(kernelModel ? { model: kernelModel } : {}), ...(kernelEffort ? { effort: kernelEffort } : {}),
    ...(route.route?.profile ? { profile: route.route.profile } : {}),
    ...(route.runtimePool ? { runtimePool: route.runtimePool } : {}),
    ...(route.warnings?.length ? { warnings: route.warnings } : {}),
    ...(fellThrough.length ? { fellThrough } : {}),
    hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}` },
    replaced, attempt, generation, sourceHost: sourceRoot, projectBinding: context?.file ?? null, promptSubmitted: true };
  console.log(asJson ? JSON.stringify(out, null, 2)
    : `[Kernel] ${workflowId} booted in Orca terminal ${handle} with ${route.agent}/${kernelModel} (routedBy: ${route.routedBy}) — inbox ${claim.inbox_id} claimed`);
} finally { ledger.close(); }
