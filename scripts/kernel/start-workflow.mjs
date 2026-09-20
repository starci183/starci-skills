#!/usr/bin/env node
// start-workflow.mjs — executable half of modules/kernel/start-workflow.yaml.
// Claims the oldest pending goal from the ledger inbox and spawns ONE long-lived
// [Kernel] agent terminal bound to that workflow_id. One kernel per workflow —
// enforced by a signals singleton row, never by politeness.
//
// The kernel host is chosen by layered routing: explicit --provider >
// config.yaml kernel.provider/kernel.model > route-model. Without --provider
// this script first reads the owner config <skillRoot>/config.yaml
// (gitignored, seeded from config.example.yaml by the installer): a kernel
// provider or model pin decides the seat outright (routedBy: config). A pin
// is ignored — never fatal — when its provider's quota probe reports 'dead'
// (not authenticated): the pin falls through to route-model with a printed
// warning. With no pin it asks scripts/route/route-model.mjs for the
// model.manageWorkflow kernelFunctionKind (risk high) and maps the picked
// target to its provider via modules/models/profiles/<target>.yaml. Router
// refusal or failure is a typed fallback to provider devin
// (routedBy: fallback); --provider is an explicit operator override
// (routedBy: override). Spawn flags come from the provider's adapter card
// modules/models/agents/<provider>.yaml, not a hardcoded map.
//
// Launch kind is card-driven: providers whose agent card declares
// kind: native-managed-agent (claude, codex) launch as an Orca-supervised
// worker — run-create → task-create → worker-start → dispatch
// --return-preamble → worker-show attestation — and the kernel job's
// worker_id is the Dispatch id. command-terminal-agent providers (qwen,
// devin) keep the spawnAgent terminal pipeline unchanged.
//
//   node scripts/kernel/start-workflow.mjs --repo <path> [--goal <workflow_id>] [--provider <name>] [--plan] [--json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { buildSpawnCommand, spawnAgent, loadAdapter } from '../agent/lib.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const sourceRoot = path.dirname(skillRoot);
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const repo = path.resolve(arg('repo', process.cwd()));
const providerOverride = arg('provider'); // explicit operator override — skips model routing
const goalId = arg('goal'); // explicit <workflow_id> — per modules/kernel/start-workflow.yaml
const asJson = process.argv.includes('--json');
const planOnly = process.argv.includes('--plan');

const ROUTE_MODEL = path.join(skillRoot, 'scripts', 'route', 'route-model.mjs');
const KERNEL_ROUTE = { kind: 'model.manageWorkflow', risk: 'high' }; // selection.yaml kernelFunctionKinds

// Owner config: <skillRoot>/config.yaml — the per-project config seeded from
// config.example.yaml by the installer (gitignored). engine/config.mjs is the
// canonical loader once it exports an owner-config reader; until then the
// yaml is parsed directly with the same parser the rest of this file uses.
// A missing or unparsable file is never fatal — routing falls through to
// route-model exactly as before. STARCI_OWNER_ROOT points the reader at a
// different directory holding a config.yaml (test and tooling seam).
const ownerRoot = process.env.STARCI_OWNER_ROOT ? path.resolve(process.env.STARCI_OWNER_ROOT) : skillRoot;
const ownerFileLabel = (file) => ownerRoot === skillRoot ? path.relative(skillRoot, file) : file;
async function readOwnerConfig() {
  const file = path.join(ownerRoot, 'config.yaml');
  if (!fs.existsSync(file)) return { file, config: null, error: null };
  const engineLoader = path.join(skillRoot, 'engine', 'config.mjs');
  let engineError = null;
  if (fs.existsSync(engineLoader)) {
    try {
      const mod = await import(pathToFileURL(engineLoader).href);
      for (const name of ['loadOwnerConfig', 'readOwnerConfig'])
        if (typeof mod[name] === 'function')
          return { file, config: mod[name](ownerRoot) ?? null, error: null };
    } catch (e) { engineError = `engine/config.mjs: ${e.message}`; }
  }
  try {
    const config = parseYaml(fs.readFileSync(file, 'utf8')) ?? null;
    return { file, config, error: null, ...(engineError ? { engineError } : {}) };
  } catch (e) { return { file, config: null, error: `config.yaml unparsable: ${e.message}`, ...(engineError ? { engineError } : {}) }; }
}

// Provider liveness probe: scripts/api/quota/index.mjs exports
// probeQuota(provider) → {state, usedPercent, detail}; 'dead' means the
// provider is not authenticated. The module is a pinned sibling-lane dep —
// absent or broken is 'unknown', never a crash and never a verdict. Probes
// are memoized per process — one account-list read serves every candidate.
const probeCache = new Map();
async function probeProvider(provider) {
  if (probeCache.has(provider)) return probeCache.get(provider);
  const file = path.join(skillRoot, 'scripts', 'api', 'quota', 'index.mjs');
  let probe = { state: 'unknown', detail: 'quota probe not installed' };
  if (fs.existsSync(file)) {
    try {
      const mod = await import(pathToFileURL(file).href);
      probe = typeof mod.probeQuota === 'function'
        ? (await mod.probeQuota(provider) ?? { state: 'unknown' })
        : { state: 'unknown', detail: 'quota module exports no probeQuota' };
    } catch (e) { probe = { state: 'unknown', detail: `quota probe threw: ${e.message}` }; }
  }
  probeCache.set(provider, probe && typeof probe === 'object' ? probe : { state: 'unknown' });
  return probeCache.get(provider);
}

// The orchestration wrappers (run-create, task-create, worker-start,
// dispatch, worker-show, worker-stop, worker-release, …) land in
// scripts/api/orca/ as thin per-verb modules over lib.mjs — same pattern as
// terminal-*.mjs. Merged lazily from every sibling file so a checkout where
// they have not landed yet still runs the command-terminal kernel path.
async function loadOrchestrationApi() {
  const dir = path.join(skillRoot, 'scripts', 'api', 'orca');
  const fns = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    try { Object.assign(fns, await import(pathToFileURL(path.join(dir, file)).href)); } catch { /* half-landed lane — keep looking */ }
  }
  return fns;
}

// scripts/agent/models.mjs (pinned sibling lane) resolves the launch model a
// pool target carries: resolveLaunchModel(target, difficulty) →
// {modelId, effort}. Absent lane → null, the caller keeps its own value.
async function loadModelSelection() {
  const file = path.join(skillRoot, 'scripts', 'agent', 'models.mjs');
  if (!fs.existsSync(file)) return null;
  try { return await import(pathToFileURL(file).href); } catch { return null; }
}

// The pool target a provider pin launches on: the runtimes.yaml pool owned by
// that provider that carries the kernel-manager role (decide) first, else the
// provider's first pool.
function poolTargetForProvider(provider) {
  const file = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; }
  const owned = Object.entries(doc?.runtimes ?? {}).filter(([, rt]) => rt?.provider === provider);
  return owned.find(([, rt]) => Array.isArray(rt?.roles) && rt.roles.includes('decide'))?.[0]
    ?? owned[0]?.[0] ?? null;
}

// kernel.model resolves its provider through the runtime pools: a model id a
// pool pins (runtimes.*.models[role]) or the pool target itself names the
// provider. runtimes.yaml is the single capacity/model-pin authority.
function providerForModel(model) {
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
function providerForTarget(target) {
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  try { return parseYaml(fs.readFileSync(file, 'utf8'))?.provider ?? null; } catch { return null; }
}

// Next eligible pool after a dead provider: live probe state is fed into
// scripts/agent/models.mjs selectPool's capacity map (a dead provider
// disqualifies every pool it owns), the dead pick's target is biased out, and
// selection walks the tier∩role chain for the kernel-manager role (decide).
// Returns {provider, target, modelId, effort} or null when no lane is live.
async function nextEligiblePool(excludeTarget, warnings) {
  const sel = await loadModelSelection();
  if (typeof sel?.selectPool !== 'function') return null;
  const runtimesFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  let runtimes = null;
  try { runtimes = parseYaml(fs.readFileSync(runtimesFile, 'utf8')); } catch { return null; }
  const capacity = {};
  for (const [target, spec] of Object.entries(runtimes?.runtimes ?? {})) {
    const provider = spec?.provider;
    if (!provider) continue;
    const probe = await probeProvider(provider);
    if (probe?.state === 'dead') {
      capacity[target] = { auth: 'dead', quota: { state: 'dead' } };
      const warning = `pool '${target}' ineligible — provider '${provider}' probe is dead (${probe.detail ?? 'not authenticated'})`;
      warnings.push(warning);
      console.error(`start-workflow: warning: ${warning}`);
    }
  }
  let pool = null;
  try {
    pool = sel.selectPool({
      kind: KERNEL_ROUTE.kind, role: 'decide', difficulty: KERNEL_ROUTE.risk,
      bias: excludeTarget ? { avoid: [excludeTarget] } : null,
      capacity, runtimes,
    });
  } catch { return null; }
  if (!pool?.target) return null;
  const provider = providerForTarget(pool.target);
  return provider ? { provider, target: pool.target, modelId: pool.modelId ?? null, effort: pool.effort ?? null } : null;
}

// Which provider hosts the kernel. Precedence: --provider flag > config.yaml
// kernel.provider/kernel.model pin > route-model (the selection.yaml machinery
// ops route through, resolving kernelFunctionKind model.manageWorkflow —
// pick.target is a pool target whose model profile declares the provider).
// A pin whose provider probes 'dead' (not authenticated) is IGNORED — printed
// warning, then routing falls through to route-model; an unauthed pin never
// fails the workflow. Router refusal ('no eligible model', exit 1) or failure
// is a typed fallback to devin.
async function resolveKernelRoute() {
  if (providerOverride) return { provider: providerOverride, routedBy: 'override' };
  const owner = await readOwnerConfig();
  const kc = owner.config?.kernel;
  const cfgProvider = typeof kc?.provider === 'string' && kc.provider.trim() ? kc.provider.trim() : null;
  const cfgModel = typeof kc?.model === 'string' && kc.model.trim() ? kc.model.trim() : null;
  const cfgEffort = (typeof kc?.effort === 'string' && kc.effort.trim() ? kc.effort.trim() : null)
    ?? (typeof owner.config?.effort === 'string' && owner.config.effort.trim() ? owner.config.effort.trim() : null);
  const config = owner.config || owner.error ? {
    file: owner.config ? ownerFileLabel(owner.file) : null,
    provider: cfgProvider, model: cfgModel, effort: cfgEffort,
    budgets: owner.config?.budgets ?? null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.engineError ? { engineLoader: owner.engineError } : {}),
  } : null;
  const warnings = [];
  // A pinned provider that is not authenticated is ignored, not fatal: warn
  // and fall through to the next eligible route. --provider is the operator's
  // explicit override and is never second-guessed by the probe.
  const pinDead = async (provider, label) => {
    const probe = await probeProvider(provider);
    if (probe?.state !== 'dead') return null;
    const warning = `kernel pin ${label} ignored — provider '${provider}' probe is dead (${probe.detail ?? 'not authenticated'}); routing falls through`;
    warnings.push(warning);
    console.error(`start-workflow: warning: ${warning}`);
    return { provider, probe };
  };
  // config.yaml pin: provider decides directly; a bare model pin resolves its
  // provider through runtimes.yaml. An unknown model id warns and falls through.
  if (cfgProvider) {
    const dead = await pinDead(cfgProvider, `provider '${cfgProvider}'`);
    if (!dead)
      return { provider: cfgProvider, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings };
    if (config) config.pinIgnored = { provider: cfgProvider, reason: 'probe-dead', detail: dead.probe?.detail ?? null };
  } else if (cfgModel) {
    const provider = providerForModel(cfgModel);
    if (provider) {
      const dead = await pinDead(provider, `model '${cfgModel}'`);
      if (!dead) return { provider, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings };
      if (config) config.pinIgnored = { model: cfgModel, provider, reason: 'probe-dead', detail: dead.probe?.detail ?? null };
    } else if (config) config.modelWarning = `kernel.model '${cfgModel}' is not pinned by any runtimes.yaml pool — ignored`;
  }
  const r = spawnSync(process.execPath,
    [ROUTE_MODEL, '--kind', KERNEL_ROUTE.kind, '--risk', KERNEL_ROUTE.risk, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  let result = null;
  try { result = JSON.parse(r.stdout || 'null'); } catch { /* non-JSON output */ }
  const pick = result?.pick ?? null;
  if (r.error || r.status !== 0 || !pick?.target) {
    return {
      provider: 'devin', routedBy: 'fallback', effort: cfgEffort, config, warnings,
      routeError: r.error?.message ?? (r.status === 0 ? 'route-model returned no pick' : result?.rule ?? `route-model exited ${r.status}`),
    };
  }
  const profileFile = path.join(skillRoot, 'modules', 'models', pick.profile ?? `profiles/${pick.target}.yaml`);
  let provider = null;
  try { provider = parseYaml(fs.readFileSync(profileFile, 'utf8'))?.provider ?? null; } catch { /* unreadable profile */ }
  if (!provider) {
    return { provider: 'devin', routedBy: 'fallback', effort: cfgEffort, config, warnings, routeError: `profile for ${pick.target} declares no provider` };
  }
  // A routed provider that is not authenticated is skipped exactly like a dead
  // pin: warn, then the next eligible pool from the selection chain takes the
  // seat. Routing never lands the kernel on a provably dead provider.
  const routedProbe = await probeProvider(provider);
  if (routedProbe?.state === 'dead') {
    const warning = `routed provider '${provider}' (${pick.target}) probe is dead (${routedProbe.detail ?? 'not authenticated'}) — taking the next eligible pool`;
    warnings.push(warning);
    console.error(`start-workflow: warning: ${warning}`);
    const next = await nextEligiblePool(pick.target, warnings);
    if (!next) {
      return { provider: 'devin', routedBy: 'fallback', effort: cfgEffort, config, warnings,
        routeError: `routed provider '${provider}' is dead and no eligible pool remained` };
    }
    return {
      provider: next.provider, routedBy: 'route-model', effort: cfgEffort ?? next.effort ?? null, config, warnings,
      route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: next.target, model: next.modelId ?? null, effort: next.effort ?? null, mode: pick.mode ?? null, rule: result.rule ?? null, skippedDead: pick.target },
    };
  }
  return {
    provider, routedBy: 'route-model', effort: cfgEffort, config, warnings,
    route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: pick.target, model: pick.model ?? null, mode: pick.mode ?? null, rule: result.rule ?? null },
  };
}

// Spawn command + terminal lifecycle live in scripts/agent/lib.mjs —
// buildSpawnCommand reads the provider's adapter card (credential refresh,
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
  .replaceAll('{apiFile}', apiFile);

const MANAGED_DEAD_STATE = /stop|fail|dead|exit|release|abandon/i;

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
    const orch = await loadOrchestrationApi();
    if (typeof orch.workerShow !== 'function')
      return { live: true, reason: 'managed kernel dispatch recorded; worker-show probe unavailable', terminal: null, value };
    const shown = orch.workerShow({ dispatch: value.dispatch });
    const state = shown?.state ?? null;
    const live = shown?.ok === true && !(state && MANAGED_DEAD_STATE.test(state));
    return {
      live, terminal: null, value,
      reason: live ? `worker ${state ?? 'ready'}` : (shown?.error || `worker state ${state ?? 'unreadable'}`),
    };
  }
  if (!value.terminal) return { live: false, reason: 'signal has no terminal handle', terminal: null, value };
  const shown = terminalShow({ terminal: value.terminal });
  const live = shown.ok && shown.connected && shown.writable;
  return { live, reason: live ? 'terminal connected' : (shown.error || shown.exitCause || 'terminal disconnected'), terminal: shown.terminal, value };
}

// Best-effort settlement of a managed dispatch (stale kernel replacement or a
// failed launch with residual effects): worker-stop then worker-release,
// matching calls.yaml's settle-dispatch recovery. Never throws.
async function releaseManagedWorker(dispatchId) {
  if (!dispatchId) return;
  const orch = await loadOrchestrationApi();
  try { orch.workerStop?.({ dispatch: dispatchId }); } catch { /* best-effort */ }
  try { orch.workerRelease?.({ dispatch: dispatchId }); } catch { /* best-effort */ }
}

// Managed kernel launch — the provider's card declares
// kind: native-managed-agent (claude/codex), so the kernel seat is an
// Orca-supervised worker, not a terminal. Host-contract sequence:
//   run-create(objective = workflow title) → task-create(spec = kernel
//   prompt, display [Kernel]) → worker-start(task, worktree, agent =
//   provider, model, effort, run) → dispatch --return-preamble → worker-show
//   attestation of the effective agent/model. worker_id is the Dispatch id.
async function launchManagedKernel({ route, workflowId, title, prompt }) {
  const orch = await loadOrchestrationApi();
  const missing = ['runCreate', 'taskCreate', 'workerStart', 'dispatchShow', 'orchDispatch', 'workerShow']
    .filter((n) => typeof orch[n] !== 'function');
  if (missing.length)
    return { ok: false, step: 'orchestration-api',
      error: `managed kernel launch on '${route.provider}' needs the scripts/api/orca orchestration wrappers (${missing.join(', ')}) — not present in this checkout` };

  // Launch model precedence: config kernel.model pin > route-model pick >
  // scripts/agent/models.mjs resolveLaunchModel over the routed pool target.
  let model = route.model ?? route.route?.model ?? null;
  let effort = route.effort ?? route.route?.effort ?? null;
  if (!model || !effort) {
    const sel = await loadModelSelection();
    const target = route.route?.target ?? poolTargetForProvider(route.provider);
    if (typeof sel?.resolveLaunchModel === 'function' && target) {
      try {
        const resolved = sel.resolveLaunchModel(target, KERNEL_ROUTE.risk);
        model = model ?? resolved?.modelId ?? null;
        effort = effort ?? resolved?.effort ?? null;
      } catch { /* unresolved model stays null — Orca applies its own default */ }
    }
  }

  const wf = ledger.db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId);
  const run = orch.runCreate({ objective: wf?.title ?? title, from: null });
  if (!run?.ok || !run.runId)
    return { ok: false, step: 'run-create', error: run?.error ?? 'run-create returned no run id' };
  const runId = run.runId;

  const task = orch.taskCreate({ run: runId, spec: prompt, taskTitle: title, displayName: title, from: null });
  if (!task?.ok || !task.taskId)
    return { ok: false, step: 'task-create', error: task?.error ?? 'task-create returned no task id', runId };
  const taskId = task.taskId;

  const worker = orch.workerStart({ task: taskId, worktree: repo, agent: route.provider, model, effort, run: runId });
  const dispatchId = worker?.dispatchId ?? null;
  if (!worker?.ok || !dispatchId) {
    await releaseManagedWorker(dispatchId);
    return { ok: false, step: 'worker-start', runId, taskId, dispatchId,
      error: worker?.error ?? `worker-start returned state '${worker?.state ?? 'none'}'` };
  }

  // The prompt reaches the worker through the task preamble — dispatch
  // --return-preamble is the contract call that binds and returns it. The
  // assignee handle is read by dispatch-show, same as the op launcher.
  const assignee = orch.dispatchShow({ task: taskId });
  if (!assignee?.ok) {
    await releaseManagedWorker(dispatchId);
    return { ok: false, step: 'dispatch-show', runId, taskId, dispatchId,
      error: assignee?.error ?? 'dispatch-show returned no assignee' };
  }
  const dispatched = orch.orchDispatch({ task: taskId, to: assignee.assigneeHandle ?? dispatchId, run: runId });
  if (!dispatched?.ok) {
    await releaseManagedWorker(dispatchId);
    return { ok: false, step: 'dispatch', runId, taskId, dispatchId,
      error: dispatched?.error ?? 'orchestration dispatch --return-preamble failed' };
  }

  // Attestation before the seat is accepted: worker-show must report a live
  // worker whose effective agent (and model, when one was requested) is what
  // routing resolved — never mark the kernel running on a mismatched worker.
  const shown = orch.workerShow({ dispatch: dispatchId });
  if (!shown?.ok) {
    await releaseManagedWorker(dispatchId);
    return { ok: false, step: 'attestation', runId, taskId, dispatchId,
      error: shown?.error ?? 'worker-show attestation failed' };
  }
  const effective = shown.effective ?? {};
  const agentOk = !effective.agent || effective.agent === route.provider;
  const modelOk = !model || !effective.model || effective.model === model;
  if (!agentOk || !modelOk) {
    await releaseManagedWorker(dispatchId);
    return { ok: false, step: 'attestation', runId, taskId, dispatchId,
      error: `worker effective ${effective.agent ?? '?'}/${effective.model ?? '?'} does not match resolved ${route.provider}/${model ?? '(default)'}` };
  }
  return {
    ok: true, dispatchId, runId, taskId, model, effort,
    preamble: dispatched.preamble ?? null,
    attested: { state: shown.state ?? null, effective },
  };
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
    // A finished workflow's goal is retired — even --plan refuses to plan a restart.
    if (wf?.phase === 'finished') { console.error(`goal ${target} is finished — retired goals never re-enter the queue`); process.exit(1); }
    const g = ledger.db.prepare('SELECT revision,goal_identity,json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(target);
    const inbox = ledger.db.prepare("SELECT inbox_id,status FROM inbox WHERE kind='goal' AND workflow_id=?").get(target);
    const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(target);
    const health = await signalHealth(signal);
    const chain = (() => { try { return JSON.parse(g?.json || '{}').opChain?.legs?.map(l => l.op) ?? null; } catch { return null; } })();
    const route = await resolveKernelRoute();
    const launchKind = loadAdapter(route.provider).card?.kind ?? null;
    const managed = launchKind === 'native-managed-agent';
    const cmd = managed
      ? { command: null, commandSource: 'orca orchestration run-create → task-create → worker-start → dispatch --return-preamble → worker-show' }
      : buildSpawnCommand({ provider: route.provider, kernel: true });
    const out = {
      plan: true, workflowId: target, title: wf?.title, phase: wf?.phase,
      goalRevision: g?.revision ?? null, goalIdentity: g?.goal_identity ?? null,
      opChain: chain, inbox: inbox?.status ?? 'none',
      provider: route.provider, routedBy: route.routedBy,
      launch: managed ? 'managed-orchestration' : 'command-terminal',
      ...(route.model ? { model: route.model } : {}),
      ...(route.effort ? { effort: route.effort } : {}),
      config: route.config ?? (route.routedBy === 'override' ? { file: 'not consulted — --provider flag wins' } : { file: null }),
      ...(route.route ? { route: route.route } : {}),
      ...(route.routeError ? { routeError: route.routeError } : {}),
      ...(route.warnings?.length ? { warnings: route.warnings } : {}),
      sourceHost: sourceRoot, projectBinding: context?.file ?? null,
      ledger: ledgerFileFor(repo), frontend: context?.fe ?? null,
      kernel: health.live
        ? `LIVE (${signal.token}; ${health.reason}) — will not spawn a second`
        : signal
          ? `STALE (${signal.token}; ${health.reason}) — will replace on start`
          : `will spawn [Kernel] on ${route.provider}${managed ? ' (managed worker)' : ''}`,
      command: cmd.command ?? null, commandSource: cmd.commandSource ?? null,
      ...(cmd.error ? { commandError: cmd.error } : {}),
    };
    const routeLine = `  provider: ${route.provider} (routedBy: ${route.routedBy}`
      + (route.routedBy === 'config' ? ` — ${route.config?.file} kernel.${route.config?.provider ? 'provider' : 'model'} pin` : '')
      + (route.route ? ` — ${route.route.target} ${route.route.model ?? ''} [${route.route.mode}]` : '')
      + (route.routeError ? ` — ${route.routeError}` : '') + ')';
    const budgets = route.config?.budgets;
    const budgetLine = budgets && Object.values(budgets).some(v => v != null)
      ? `\n  budgets (config.yaml): ${['maxOps', 'perOpMs', 'dailyTokens'].map(k => `${k}=${budgets[k] ?? 'unbounded'}`).join('  ')}`
      : '';
    const warningLine = (route.warnings ?? []).map((w) => `\n  warning: ${w}`).join('');
    console.log(asJson ? JSON.stringify(out, null, 2)
      : `PLAN — start workflow ${target}\n  title: ${wf?.title}\n  phase: ${wf?.phase} | goal rev ${out.goalRevision} (${out.goalIdentity}) | inbox: ${out.inbox}\n  op chain: ${chain ? chain.join(' → ') : 'kernel derives at boot'}\n  kernel: ${out.kernel}\n${routeLine}\n  launch: ${out.launch}\n  config: ${out.config.file ?? 'absent — routing falls to route-model'}${route.config?.modelWarning ? ` (${route.config.modelWarning})` : ''}${route.config?.pinIgnored ? ` (pin ignored: ${route.config.pinIgnored.reason})` : ''}${route.effort ? `  effort=${route.effort}` : ''}${budgetLine}${warningLine}\n  command: ${out.command ?? '(managed orchestration — no terminal command)'}\n  command source: ${out.commandSource}`);
    process.exit(0);
  }

  // A finished workflow's goal is retired — starting it again is refused.
  if (goalId) {
    const wf = ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(goalId);
    if (wf?.phase === 'finished') { console.error(`goal ${goalId} is finished — retired goals never re-enter the queue`); process.exit(1); }
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
  let staleKernel = null;
  if (priorSignal) {
    staleKernel = { token: priorSignal.token, terminal: priorHealth.value?.terminal ?? null,
      ...(priorHealth.value?.dispatch ? { dispatch: priorHealth.value.dispatch } : {}), reason: priorHealth.reason };
    // A stale managed kernel may still hold a live Orca worker — settle the
    // exact old dispatch (stop + release) before the seat is cleared so the
    // replacement never runs beside a zombie.
    if (priorHealth.value?.dispatch) await releaseManagedWorker(priorHealth.value.dispatch);
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(target);
    const at = Date.now();
    ledger.transaction(() => {
      ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=? AND token=?").run(target, priorSignal.token);
      ledger.db.prepare("UPDATE jobs SET status='stopped', result_json=?, updated_at=? WHERE job_id=? AND status='running'")
        .run(JSON.stringify({ reason: priorHealth.reason, terminal: staleKernel.terminal }), at, `kernel-${target}`);
      ledger.appendEvent({ workflowId: target, entityType: 'kernel', entityId: target,
        generation: workflow?.generation ?? 0, kind: 'kernel-stale-cleared', payload: staleKernel, createdAt: at });
    });
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

  // 3. Launch the [Kernel] — host routed (or overridden). Providers whose
  // agent card is kind: native-managed-agent (claude/codex) launch through
  // Orca orchestration (run → task → worker-start → dispatch → attestation);
  // command-terminal providers keep the spawnAgent pipeline (create →
  // readiness → deliver → submission, all card-driven).
  const route = await resolveKernelRoute();
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
  const managed = loadAdapter(route.provider).card?.kind === 'native-managed-agent';
  let handle = null, managedLaunch = null;
  if (managed) {
    managedLaunch = await launchManagedKernel({ route, workflowId, title, prompt });
    if (!managedLaunch.ok)
      failStart(managedLaunch.step, managedLaunch.error, null,
        { runId: managedLaunch.runId ?? null, taskId: managedLaunch.taskId ?? null, dispatchId: managedLaunch.dispatchId ?? null });
  } else {
    const spawned = spawnAgent({ provider: route.provider, worktree: repo, title, prompt, kernel: true, dispatchId: `kernel-${workflowId}` });
    if (!spawned.ok) failStart(spawned.step, spawned.error, spawned.terminal ?? null);
    handle = spawned.terminal;
  }
  const dispatchId = managedLaunch?.dispatchId ?? null;
  const workerId = dispatchId ?? handle;
  const kernelModel = managedLaunch?.model ?? route.model ?? null;
  const kernelEffort = managedLaunch?.effort ?? route.effort ?? null;

  const now = Date.now();
  const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  const generation = workflow?.generation ?? 0;
  const previousJob = ledger.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const attempt = previousJob ? previousJob.attempt + 1 : 1;
  const routeInfo = { provider: route.provider, routedBy: route.routedBy, model: kernelModel, effort: kernelEffort, launch: managed ? 'managed' : 'terminal' };

  ledger.transaction(() => {
    ledger.db.prepare("UPDATE signals SET holder_pid=?,value_json=?,at=?,expires_at=NULL WHERE scope='kernel' AND key=? AND token=?")
      .run(process.pid, JSON.stringify({ terminal: handle, dispatch: dispatchId, run: managedLaunch?.runId ?? null, task: managedLaunch?.taskId ?? null,
        provider: route.provider, routedBy: route.routedBy, model: kernelModel, effort: kernelEffort, launch: routeInfo.launch }), now, workflowId, token);
    const payload = JSON.stringify({ inbox_id: claim.inbox_id, goal_revision: goal?.revision ?? 0,
      route: routeInfo,
      // api.mjs's managed dispatch reuses the workflow run from
      // kernelPayload.orca.runId — same key, same shape.
      ...(managedLaunch ? { orca: { runId: managedLaunch.runId, taskId: managedLaunch.taskId, dispatchId } } : {}) });
    if (previousJob) {
      ledger.db.prepare("UPDATE jobs SET attempt=?,generation=?,payload_json=?,status='running',worker_id=?,result_json=NULL,updated_at=? WHERE job_id=?")
        .run(attempt, generation, payload, workerId, now, `kernel-${workflowId}`);
    } else {
      ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,?,'kernel','kernel',?,'running',?,?,?)")
        .run(`kernel-${workflowId}`, workflowId, null, generation, payload, workerId, now, now);
    }
    // Phase transition — the canonical write (api.mjs dispatch carries the
    // same update as a safety net). Guarded on phase='queued' so a kernel
    // restart is idempotent and a finished/archived workflow is never
    // regressed; the event is appended only when the row actually moved.
    const transitioned = ledger.db.prepare("UPDATE workflows SET phase='running',updated_at=? WHERE workflow_id=? AND phase='queued'")
      .run(now, workflowId);
    if (transitioned.changes > 0) {
      ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, generation,
        kind: 'phase-transition', payload: { from: 'queued', to: 'running' }, createdAt: now });
    } else {
      ledger.db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(now, workflowId);
    }
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation,
      kind: replaced ? 'kernel-restarted' : 'kernel-booted',
      payload: { terminal: handle, dispatch: dispatchId, run: managedLaunch?.runId ?? null, task: managedLaunch?.taskId ?? null,
        provider: route.provider, routedBy: route.routedBy, model: kernelModel, effort: kernelEffort, launch: routeInfo.launch,
        ...(managedLaunch?.attested ? { attested: managedLaunch.attested } : {}),
        inboxId: claim.inbox_id, attempt,
        sourceHost: sourceRoot, projectBinding: context?.file ?? null, ...(staleKernel ? { replacedKernel: staleKernel } : {}) },
      createdAt: now });
  });

  const out = { ok: true, workflowId, kernel: token, terminal: handle, provider: route.provider, routedBy: route.routedBy,
    launch: routeInfo.launch,
    ...(dispatchId ? { dispatch: dispatchId, run: managedLaunch.runId, task: managedLaunch.taskId } : {}),
    ...(kernelModel ? { model: kernelModel } : {}), ...(kernelEffort ? { effort: kernelEffort } : {}),
    ...(route.warnings?.length ? { warnings: route.warnings } : {}),
    replaced, attempt, generation, sourceHost: sourceRoot, projectBinding: context?.file ?? null, promptSubmitted: true };
  console.log(asJson ? JSON.stringify(out, null, 2)
    : `[Kernel] ${workflowId} booted on ${route.provider} (${managed ? `worker ${dispatchId}` : handle}, routedBy: ${route.routedBy}) — inbox ${claim.inbox_id} claimed`);
} finally { ledger.close(); }
