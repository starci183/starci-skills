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
// provider or model pin decides the seat outright (routedBy: config). With no
// pin it asks scripts/route/route-model.mjs for the model.manageWorkflow
// kernelFunctionKind (risk high) and maps the picked target to its provider
// via modules/models/profiles/<target>.yaml. Router refusal or failure is a
// typed fallback to provider devin (routedBy: fallback); --provider is an
// explicit operator override (routedBy: override). Spawn flags come from the
// provider's adapter card modules/models/agents/<provider>.yaml, not a
// hardcoded map.
//
//   node scripts/kernel/start-workflow.mjs --repo <path> [--goal <workflow_id>] [--provider <name>] [--plan] [--json]
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
// route-model exactly as before.
async function readOwnerConfig() {
  const file = path.join(skillRoot, 'config.yaml');
  if (!fs.existsSync(file)) return { file, config: null, error: null };
  const engineLoader = path.join(skillRoot, 'engine', 'config.mjs');
  let engineError = null;
  if (fs.existsSync(engineLoader)) {
    try {
      const mod = await import(pathToFileURL(engineLoader).href);
      for (const name of ['loadOwnerConfig', 'readOwnerConfig'])
        if (typeof mod[name] === 'function')
          return { file, config: mod[name](skillRoot) ?? null, error: null };
    } catch (e) { engineError = `engine/config.mjs: ${e.message}`; }
  }
  try {
    const config = parseYaml(fs.readFileSync(file, 'utf8')) ?? null;
    return { file, config, error: null, ...(engineError ? { engineError } : {}) };
  } catch (e) { return { file, config: null, error: `config.yaml unparsable: ${e.message}`, ...(engineError ? { engineError } : {}) }; }
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

// Which provider hosts the kernel. Precedence: --provider flag > config.yaml
// kernel.provider/kernel.model pin > route-model (the selection.yaml machinery
// ops route through, resolving kernelFunctionKind model.manageWorkflow —
// pick.target is a pool target whose model profile declares the provider).
// Router refusal ('no eligible model', exit 1) or failure is a typed fallback
// to devin.
async function resolveKernelRoute() {
  if (providerOverride) return { provider: providerOverride, routedBy: 'override' };
  const owner = await readOwnerConfig();
  const kc = owner.config?.kernel;
  const cfgProvider = typeof kc?.provider === 'string' && kc.provider.trim() ? kc.provider.trim() : null;
  const cfgModel = typeof kc?.model === 'string' && kc.model.trim() ? kc.model.trim() : null;
  const cfgEffort = (typeof kc?.effort === 'string' && kc.effort.trim() ? kc.effort.trim() : null)
    ?? (typeof owner.config?.effort === 'string' && owner.config.effort.trim() ? owner.config.effort.trim() : null);
  const config = owner.config || owner.error ? {
    file: owner.config ? path.relative(skillRoot, owner.file) : null,
    provider: cfgProvider, model: cfgModel, effort: cfgEffort,
    budgets: owner.config?.budgets ?? null,
    ...(owner.error ? { error: owner.error } : {}),
    ...(owner.engineError ? { engineLoader: owner.engineError } : {}),
  } : null;
  // config.yaml pin: provider decides directly; a bare model pin resolves its
  // provider through runtimes.yaml. An unknown model id warns and falls through.
  if (cfgProvider)
    return { provider: cfgProvider, routedBy: 'config', model: cfgModel, effort: cfgEffort, config };
  if (cfgModel) {
    const provider = providerForModel(cfgModel);
    if (provider) return { provider, routedBy: 'config', model: cfgModel, effort: cfgEffort, config };
    if (config) config.modelWarning = `kernel.model '${cfgModel}' is not pinned by any runtimes.yaml pool — ignored`;
  }
  const r = spawnSync(process.execPath,
    [ROUTE_MODEL, '--kind', KERNEL_ROUTE.kind, '--risk', KERNEL_ROUTE.risk, '--json'],
    { encoding: 'utf8', timeout: 60000, cwd: skillRoot });
  let result = null;
  try { result = JSON.parse(r.stdout || 'null'); } catch { /* non-JSON output */ }
  const pick = result?.pick ?? null;
  if (r.error || r.status !== 0 || !pick?.target) {
    return {
      provider: 'devin', routedBy: 'fallback', effort: cfgEffort, config,
      routeError: r.error?.message ?? (r.status === 0 ? 'route-model returned no pick' : result?.rule ?? `route-model exited ${r.status}`),
    };
  }
  const profileFile = path.join(skillRoot, 'modules', 'models', pick.profile ?? `profiles/${pick.target}.yaml`);
  let provider = null;
  try { provider = parseYaml(fs.readFileSync(profileFile, 'utf8'))?.provider ?? null; } catch { /* unreadable profile */ }
  if (!provider) {
    return { provider: 'devin', routedBy: 'fallback', effort: cfgEffort, config, routeError: `profile for ${pick.target} declares no provider` };
  }
  return {
    provider, routedBy: 'route-model', effort: cfgEffort, config,
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

function signalHealth(signal) {
  if (!signal) return { live: false, reason: 'absent', terminal: null };
  if (signal.expires_at !== null && signal.expires_at <= Date.now()) {
    return { live: false, reason: 'startup reservation expired', terminal: null };
  }
  let value = null;
  try { value = JSON.parse(signal.value_json || '{}'); } catch { value = {}; }
  if (value.state === 'starting' && signal.expires_at > Date.now()) {
    return { live: true, reason: 'startup reservation active', terminal: null, value };
  }
  if (!value.terminal) return { live: false, reason: 'signal has no terminal handle', terminal: null, value };
  const shown = terminalShow({ terminal: value.terminal });
  const live = shown.ok && shown.connected && shown.writable;
  return { live, reason: live ? 'terminal connected' : (shown.error || shown.exitCause || 'terminal disconnected'), terminal: shown.terminal, value };
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
    const health = signalHealth(signal);
    const chain = (() => { try { return JSON.parse(g?.json || '{}').opChain?.legs?.map(l => l.op) ?? null; } catch { return null; } })();
    const route = await resolveKernelRoute();
    const cmd = buildSpawnCommand({ provider: route.provider, kernel: true });
    const out = {
      plan: true, workflowId: target, title: wf?.title, phase: wf?.phase,
      goalRevision: g?.revision ?? null, goalIdentity: g?.goal_identity ?? null,
      opChain: chain, inbox: inbox?.status ?? 'none',
      provider: route.provider, routedBy: route.routedBy,
      ...(route.model ? { model: route.model } : {}),
      ...(route.effort ? { effort: route.effort } : {}),
      config: route.config ?? (route.routedBy === 'override' ? { file: 'not consulted — --provider flag wins' } : { file: null }),
      ...(route.route ? { route: route.route } : {}),
      ...(route.routeError ? { routeError: route.routeError } : {}),
      sourceHost: sourceRoot, projectBinding: context?.file ?? null,
      ledger: ledgerFileFor(repo), frontend: context?.fe ?? null,
      kernel: health.live
        ? `LIVE (${signal.token}; ${health.reason}) — will not spawn a second`
        : signal
          ? `STALE (${signal.token}; ${health.reason}) — will replace on start`
          : `will spawn [Kernel] on ${route.provider}`,
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
    console.log(asJson ? JSON.stringify(out, null, 2)
      : `PLAN — start workflow ${target}\n  title: ${wf?.title}\n  phase: ${wf?.phase} | goal rev ${out.goalRevision} (${out.goalIdentity}) | inbox: ${out.inbox}\n  op chain: ${chain ? chain.join(' → ') : 'kernel derives at boot'}\n  kernel: ${out.kernel}\n${routeLine}\n  config: ${out.config.file ?? 'absent — routing falls to route-model'}${route.config?.modelWarning ? ` (${route.config.modelWarning})` : ''}${route.effort ? `  effort=${route.effort}` : ''}${budgetLine}\n  command: ${out.command}\n  command source: ${out.commandSource}`);
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
  const priorHealth = signalHealth(priorSignal);
  if (priorSignal && priorHealth.live) {
    const out = { ok: true, workflowId: target, kernel: priorSignal.token, terminal: priorHealth.value?.terminal ?? null, replaced: false, note: priorHealth.reason };
    console.log(asJson ? JSON.stringify(out) : `kernel already live for ${target} (${priorSignal.token})`);
    process.exit(0);
  }
  let staleKernel = null;
  if (priorSignal) {
    staleKernel = { token: priorSignal.token, terminal: priorHealth.value?.terminal ?? null, reason: priorHealth.reason };
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

  // 3. Spawn the [Kernel] terminal — host routed (or overridden), command
  // and flags from the provider's adapter card via the agent spawn pipeline
  // (create → readiness → deliver → submission, all card-driven).
  const route = await resolveKernelRoute();
  const title = `[Kernel] ${workflowId}`;
  const goal = ledger.db.prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);
  const prompt = renderKernelPrompt({ workflowId, inboxId: claim.inbox_id, goalRevision: goal?.revision ?? 0 });
  const spawned = spawnAgent({ provider: route.provider, worktree: repo, title, prompt, kernel: true, dispatchId: `kernel-${workflowId}` });
  const failStart = (step, error, handle = null) => {
    const at = Date.now();
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => {
      ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=? AND token=?").run(workflowId, token);
      ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId,
        generation: workflow?.generation ?? 0, kind: 'kernel-start-failed', payload: { step, error, terminal: handle }, createdAt: at });
    });
    console.error(JSON.stringify({ ok: false, workflowId, step, error, terminal: handle }));
    process.exit(1);
  };
  if (!spawned.ok) failStart(spawned.step, spawned.error, spawned.terminal ?? null);
  const handle = spawned.terminal;

  const now = Date.now();
  const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
  const generation = workflow?.generation ?? 0;
  const previousJob = ledger.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
  const attempt = previousJob ? previousJob.attempt + 1 : 1;

  ledger.transaction(() => {
    ledger.db.prepare("UPDATE signals SET holder_pid=?,value_json=?,at=?,expires_at=NULL WHERE scope='kernel' AND key=? AND token=?")
      .run(process.pid, JSON.stringify({ terminal: handle, provider: route.provider, routedBy: route.routedBy, model: route.model ?? null, effort: route.effort ?? null }), now, workflowId, token);
    const payload = JSON.stringify({ inbox_id: claim.inbox_id, goal_revision: goal?.revision ?? 0,
      route: { provider: route.provider, routedBy: route.routedBy, model: route.model ?? null, effort: route.effort ?? null } });
    if (previousJob) {
      ledger.db.prepare("UPDATE jobs SET attempt=?,generation=?,payload_json=?,status='running',worker_id=?,result_json=NULL,updated_at=? WHERE job_id=?")
        .run(attempt, generation, payload, handle, now, `kernel-${workflowId}`);
    } else {
      ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,1,?,'kernel','kernel',?,'running',?,?,?)")
        .run(`kernel-${workflowId}`, workflowId, null, generation, payload, handle, now, now);
    }
    ledger.db.prepare('UPDATE workflows SET updated_at=? WHERE workflow_id=?').run(now, workflowId);
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation,
      kind: replaced ? 'kernel-restarted' : 'kernel-booted',
      payload: { terminal: handle, provider: route.provider, routedBy: route.routedBy, model: route.model ?? null, effort: route.effort ?? null, inboxId: claim.inbox_id, attempt,
        sourceHost: sourceRoot, projectBinding: context?.file ?? null, ...(staleKernel ? { replacedKernel: staleKernel } : {}) },
      createdAt: now });
  });

  const out = { ok: true, workflowId, kernel: token, terminal: handle, provider: route.provider, routedBy: route.routedBy,
    ...(route.model ? { model: route.model } : {}), ...(route.effort ? { effort: route.effort } : {}),
    replaced, attempt, generation, sourceHost: sourceRoot, projectBinding: context?.file ?? null, promptSubmitted: true };
  console.log(asJson ? JSON.stringify(out, null, 2) : `[Kernel] ${workflowId} booted on ${route.provider} (${handle}, routedBy: ${route.routedBy}) — inbox ${claim.inbox_id} claimed`);
} finally { ledger.close(); }
