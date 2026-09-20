#!/usr/bin/env node
// start-workflow.mjs — executable half of modules/kernel/start-workflow.yaml.
// Claims the oldest pending goal from the ledger inbox and spawns ONE long-lived
// [Kernel] agent terminal bound to that workflow_id. One kernel per workflow —
// enforced by a signals singleton row, never by politeness.
//
// Orca is always the execution host. The kernel agent/model is chosen by
// layered routing: explicit --agent >
// config.yaml kernel.agent/kernel.model > route-model. Without an override
// this script first reads the owner config <skillRoot>/config.yaml
// (gitignored, seeded from config.example.yaml by the installer): a kernel
// agent or model pin decides the seat outright (routedBy: config). An
// explicit pin is authoritative and fails closed when its agent is dead or
// its model cannot be resolved; it is never substituted. With no pin this
// script asks scripts/route/route-model.mjs for the
// model.manageWorkflow kernelFunctionKind (risk high) and maps the picked
// runtimePool to its agent via modules/models/profiles/<target>.yaml. Router
// refusal or exhaustion is a typed failure, never an implicit Devin kernel.
// Spawn flags come from the agent's adapter card
// modules/models/agents/<agent>.yaml, not a hardcoded map.
//
// Every kernel is a dedicated Orca command terminal. It is not an operation
// worker and boot never creates an orchestration Run/Task/Dispatch. The
// terminal command pins the resolved model/effort using adapter-card data;
// the model is accepted only after its exact id renders on screen.
//
//   node scripts/kernel/start-workflow.mjs --repo <path> [--goal <workflow_id>] [--agent <name>] [--plan] [--json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { buildSpawnCommand, spawnAgent } from '../agent/lib.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';

const skillRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const sourceRoot = path.dirname(skillRoot);
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const repo = path.resolve(arg('repo', process.cwd()));
const agentOverride = arg('agent');
const goalId = arg('goal'); // explicit <workflow_id> — per modules/kernel/start-workflow.yaml
const asJson = process.argv.includes('--json');
const planOnly = process.argv.includes('--plan');

const ROUTE_MODEL = path.join(skillRoot, 'scripts', 'route', 'route-model.mjs');
const KERNEL_ROUTE = { kind: 'model.manageWorkflow', risk: 'high' }; // selection.yaml kernelFunctionKinds

// Owner config: <skillRoot>/config.yaml — the per-project config seeded from
// config.example.yaml by the installer (gitignored). engine/config.mjs is
// tried first for an owner-config reader; when it exports none the yaml is
// parsed directly with the same parser the rest of this file uses.
// A missing or unparsable file is never fatal — routing falls through to
// route-model. STARCI_OWNER_ROOT points the reader at a
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

// Next eligible runtimePool after a dead routed agent: live probe state is fed into
// scripts/agent/models.mjs selectPool's capacity map (a dead agent
// disqualifies every pool it owns), the dead pick's target is biased out, and
// selection walks the tier∩role chain for the kernel-manager role (decide).
// Explicit owner pins never enter this function: they fail closed.
async function nextEligiblePool(excludeTarget, warnings) {
  const sel = await loadModelSelection();
  if (typeof sel?.selectPool !== 'function') return null;
  const runtimesFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  let runtimes = null;
  try { runtimes = parseYaml(fs.readFileSync(runtimesFile, 'utf8')); } catch { return null; }
  const capacity = {};
  for (const [target, spec] of Object.entries(runtimes?.runtimes ?? {})) {
    const agent = spec?.provider;
    if (!agent) continue;
    const probe = await probeAgent(agent);
    if (probe?.state === 'dead') {
      capacity[target] = { auth: 'dead', quota: { state: 'dead' } };
      const warning = `runtimePool '${target}' ineligible — agent '${agent}' probe is dead (${probe.detail ?? 'not authenticated'})`;
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
  const agent = agentForTarget(pool.target);
  return agent ? { agent, target: pool.target, modelId: pool.modelId ?? null, effort: pool.effort ?? null } : null;
}

async function completeKernelRoute(route) {
  if (route.error || !route.agent) return route;
  let model = route.model ?? route.route?.model ?? null;
  let effort = route.effort ?? route.route?.effort ?? null;
  const runtimePool = route.route?.target ?? poolTargetForAgent(route.agent);
  if (!model || !effort) {
    const selection = await loadModelSelection();
    if (typeof selection?.resolveLaunchModel === 'function' && runtimePool) {
      try {
        const resolved = selection.resolveLaunchModel(runtimePool, KERNEL_ROUTE.risk);
        model = model ?? resolved?.modelId ?? null;
        effort = effort ?? resolved?.effort ?? null;
      } catch { /* converted to a typed route error below */ }
    }
  }
  if (!model)
    return { ...route, runtimePool, error: `kernel agent '${route.agent}' has no resolvable model for ${KERNEL_ROUTE.kind}/${KERNEL_ROUTE.risk}` };
  return { ...route, model, effort, runtimePool };
}

// Resolve the dedicated Kernel terminal's agent/model. Config pins and CLI
// overrides are authority, not preferences: a dead agent, unknown bare model
// or agent/model mismatch fails closed instead of choosing a substitute.
async function resolveKernelRoute() {
  if (agentOverride) {
    const probe = await probeAgent(agentOverride);
    if (probe?.state === 'dead')
      return { agent: agentOverride, routedBy: 'override', warnings: [],
        errorStep: 'kernel-pin-unavailable',
        error: `explicit kernel agent '${agentOverride}' probe is dead (${probe.detail ?? 'not authenticated'})` };
    return completeKernelRoute({ agent: agentOverride, routedBy: 'override', warnings: [] });
  }
  const owner = await readOwnerConfig();
  const kc = owner.config?.kernel;
  const cfgAgent = typeof kc?.agent === 'string' && kc.agent.trim() ? kc.agent.trim() : null;
  const cfgModel = typeof kc?.model === 'string' && kc.model.trim() ? kc.model.trim() : null;
  const cfgEffort = (typeof kc?.effort === 'string' && kc.effort.trim() ? kc.effort.trim() : null)
    ?? (typeof owner.config?.effort === 'string' && owner.config.effort.trim() ? owner.config.effort.trim() : null);
  const config = owner.config || owner.error ? {
    file: owner.config ? ownerFileLabel(owner.file) : null,
    agent: cfgAgent, model: cfgModel, effort: cfgEffort,
    budgets: owner.config?.budgets ?? null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.engineError ? { engineLoader: owner.engineError } : {}),
  } : null;
  const warnings = [];
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
    return completeKernelRoute({ agent: cfgAgent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings });
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
    return completeKernelRoute({ agent, routedBy: 'config', model: cfgModel, effort: cfgEffort, config, warnings });
  }
  const r = spawnSync(process.execPath,
    [ROUTE_MODEL, '--kind', KERNEL_ROUTE.kind, '--risk', KERNEL_ROUTE.risk, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  let result = null;
  try { result = JSON.parse(r.stdout || 'null'); } catch { /* non-JSON output */ }
  const pick = result?.pick ?? null;
  if (r.error || r.status !== 0 || !pick?.target) {
    return {
      agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: r.error?.message ?? (r.status === 0 ? 'route-model returned no pick' : result?.rule ?? `route-model exited ${r.status}`),
    };
  }
  const profileFile = path.join(skillRoot, 'modules', 'models', pick.profile ?? `profiles/${pick.target}.yaml`);
  let agent = null;
  try { agent = parseYaml(fs.readFileSync(profileFile, 'utf8'))?.provider ?? null; } catch { /* unreadable profile */ }
  if (!agent) {
    return { agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
      error: `profile for runtimePool '${pick.target}' declares no execution agent` };
  }
  // Unpinned routing may walk another eligible runtimePool, but never invents
  // a hard-coded Devin fallback.
  const routedProbe = await probeAgent(agent);
  if (routedProbe?.state === 'dead') {
    const warning = `routed agent '${agent}' (${pick.target}) probe is dead (${routedProbe.detail ?? 'not authenticated'}) — taking the next eligible runtimePool`;
    warnings.push(warning);
    console.error(`start-workflow: warning: ${warning}`);
    const next = await nextEligiblePool(pick.target, warnings);
    if (!next) {
      return { agent: null, routedBy: 'route-model', effort: cfgEffort, config, warnings,
        error: `routed agent '${agent}' is dead and no eligible runtimePool remained` };
    }
    return completeKernelRoute({
      agent: next.agent, routedBy: 'route-model', effort: cfgEffort ?? next.effort ?? null, config, warnings,
      route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: next.target, model: next.modelId ?? null,
        effort: next.effort ?? null, profile: pick.profile ?? null, mode: pick.mode ?? null, rule: result.rule ?? null, skippedDead: pick.target },
    });
  }
  return completeKernelRoute({
    agent, routedBy: 'route-model', effort: cfgEffort, config, warnings,
    route: { kind: KERNEL_ROUTE.kind, risk: KERNEL_ROUTE.risk, target: pick.target, model: pick.model ?? null,
      profile: pick.profile ?? null, mode: pick.mode ?? null, rule: result.rule ?? null },
  });
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
    const route = await resolveKernelRoute();
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
      sourceHost: sourceRoot, projectBinding: context?.file ?? null,
      ledger: ledgerFileFor(repo), frontend: context?.fe ?? null,
      kernel: health.live
        ? `LIVE (${signal.token}; ${health.reason}) — will not spawn a second`
        : signal
          ? `STALE (${signal.token}; ${health.reason}) — will replace on start`
          : route.error
            ? `BLOCKED (${route.error})`
            : `will spawn [Kernel] ${route.agent}/${route.model} in a dedicated Orca terminal`,
      command: cmd.command ?? null, commandSource: cmd.commandSource ?? null,
      ...(cmd.error ? { commandError: cmd.error } : {}),
    };
    const routeLine = `  host: orca | agent: ${route.agent ?? '(unresolved)'} | model: ${route.model ?? '(unresolved)'} (routedBy: ${route.routedBy}`
      + (route.routedBy === 'config' ? ` — ${route.config?.file} kernel.${route.config?.agent ? 'agent' : 'model'} pin` : '')
      + (route.route ? ` — ${route.route.target} ${route.route.model ?? ''} [${route.route.mode}]` : '')
      + (route.error ? ` — ${route.error}` : '') + ')';
    const budgets = route.config?.budgets;
    const budgetLine = budgets && Object.values(budgets).some(v => v != null)
      ? `\n  budgets (config.yaml): ${['maxOps', 'perOpMs', 'dailyTokens'].map(k => `${k}=${budgets[k] ?? 'unbounded'}`).join('  ')}`
      : '';
    const warningLine = (route.warnings ?? []).map((w) => `\n  warning: ${w}`).join('');
    console.log(asJson ? JSON.stringify(out, null, 2)
      : `PLAN — start workflow ${target}\n  title: ${wf?.title}\n  phase: ${wf?.phase} | goal rev ${out.goalRevision} (${out.goalIdentity}) | inbox: ${out.inbox}\n  op chain: ${chain ? chain.join(' → ') : 'kernel derives at boot'}\n  kernel: ${out.kernel}\n${routeLine}\n  launch: ${out.launch}\n  config: ${out.config.file ?? 'absent — routing falls to route-model'}${route.effort ? `  effort=${route.effort}` : ''}${budgetLine}${warningLine}\n  command: ${out.command ?? '(unavailable)'}\n  command source: ${out.commandSource ?? '(unavailable)'}`);
    process.exit(route.error || cmd.error ? 1 : 0);
  }

  // A finished workflow's goal is closed — starting it again is refused.
  if (goalId) {
    const wf = ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(goalId);
    if (wf?.phase === 'finished') { console.error(`goal ${goalId} is finished — finished goals never re-enter the queue`); process.exit(1); }
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

  // 3. Launch one dedicated [Kernel] Orca terminal. A Kernel is not an Orca
  // operation worker, so boot performs no run/task/dispatch mutation.
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
  if (route.error)
    failStart(route.errorStep ?? 'kernel-route', route.error, null, { agent: route.agent ?? null, requestedModel: route.model ?? null });
  const spawned = spawnAgent({ provider: route.agent, model: route.model, effort: route.effort,
    worktree: repo, title, prompt, kernel: true, dispatchId: `kernel-${workflowId}` });
  if (!spawned.ok)
    failStart(spawned.step, spawned.error, spawned.terminal ?? null,
      { agent: route.agent, requestedModel: route.model, ...(spawned.signal ? { signal: spawned.signal } : {}) });
  const handle = spawned.terminal;
  const workerId = handle;
  const kernelModel = route.model;
  const kernelEffort = route.effort ?? null;

  const now = Date.now();
  const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  const generation = workflow?.generation ?? 0;
  const previousJob = ledger.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const attempt = previousJob ? previousJob.attempt + 1 : 1;
  const routeInfo = { host: 'orca', agent: route.agent, routedBy: route.routedBy, model: kernelModel,
    effort: kernelEffort, profile: route.route?.profile ?? null, runtimePool: route.runtimePool ?? null, launch: 'terminal' };

  ledger.transaction(() => {
    ledger.db.prepare("UPDATE signals SET holder_pid=?,value_json=?,at=?,expires_at=NULL WHERE scope='kernel' AND key=? AND token=?")
      .run(process.pid, JSON.stringify({ terminal: handle, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAttested: true }), now, workflowId, token);
    const payload = JSON.stringify({
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
    });
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
      payload: { terminal: handle, host: 'orca', agent: route.agent, routedBy: route.routedBy,
        model: kernelModel, effort: kernelEffort, launch: routeInfo.launch, modelAttested: true,
        inboxId: claim.inbox_id, attempt,
        nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`,
        sourceHost: sourceRoot, projectBinding: context?.file ?? null, ...(staleKernel ? { replacedKernel: staleKernel } : {}) },
      createdAt: now });
  });

  const out = { ok: true, workflowId, kernel: token, terminal: handle, host: 'orca', executionHost: 'orca',
    agent: route.agent, routedBy: route.routedBy, launch: routeInfo.launch, modelAttested: true,
    ...(kernelModel ? { model: kernelModel } : {}), ...(kernelEffort ? { effort: kernelEffort } : {}),
    ...(route.route?.profile ? { profile: route.route.profile } : {}),
    ...(route.runtimePool ? { runtimePool: route.runtimePool } : {}),
    ...(route.warnings?.length ? { warnings: route.warnings } : {}),
    hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}` },
    replaced, attempt, generation, sourceHost: sourceRoot, projectBinding: context?.file ?? null, promptSubmitted: true };
  console.log(asJson ? JSON.stringify(out, null, 2)
    : `[Kernel] ${workflowId} booted in Orca terminal ${handle} with ${route.agent}/${kernelModel} (routedBy: ${route.routedBy}) — inbox ${claim.inbox_id} claimed`);
} finally { ledger.close(); }
