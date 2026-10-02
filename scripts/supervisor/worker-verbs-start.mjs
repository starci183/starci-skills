// worker-verbs-start.mjs - validate the worker request (registry, worktree, spec) before asking Orca to create a supervised worker.
import fs from 'node:fs';
import path from 'node:path';
import { loadModelRegistry } from '../agent/model-registry.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { worktreePs } from '../api/orca/worktree-ps.mjs';
import { readEnv } from '../lib/env.mjs';
import { registeredWorktree } from './worker-verbs-list.mjs';

const refusal = (message, extra = {}) => ({ code: 2, text: `starci worker start: ${message}`,
  data: { schema: 'starci/worker-start@1', ok: false, ...extra } });
const clean = (value) => String(value ?? '').trim();

const agentsOf = (registry) => {
  if (Array.isArray(registry?.runtimes)) return new Set(registry.runtimes.map(String));
  return new Set(Object.keys(registry?.runtimes ?? {}));
};

function availabilityOf(registry, agent) {
  const target = registry?.targets?.[`${agent}-agent`] ?? registry?.targets?.[agent] ?? null;
  const runtime = Array.isArray(registry?.runtimes) ? null : registry?.runtimes?.[agent];
  const declared = registry?.agents?.[agent] ?? runtime ?? target;
  if (!declared) return null;
  if (declared.available === false || declared.availability === 'unavailable' || declared.status === 'unavailable') return 'unavailable';
  if (declared.available === true || declared.availability === 'available' || declared.status === 'available') return 'available';
  return null;
}

function modelsOf(registry, agent) {
  const models = new Set();
  for (const [id, row] of Object.entries(registry?.models ?? {})) if (row?.provider === agent) models.add(id);
  for (const pool of Object.values(registry?.pools ?? {})) {
    if (pool?.provider !== agent) continue;
    if (pool.defaultModel) models.add(String(pool.defaultModel));
    for (const model of Object.values(pool.models ?? {})) if (model) models.add(String(model));
  }
  for (const target of Object.values(registry?.targets ?? {})) if (target?.runtime === agent && target.defaultModel) models.add(String(target.defaultModel));
  return models;
}

function defaultModelOf(registry, agent) {
  const pool = Object.values(registry?.pools ?? {}).find((row) => row?.provider === agent);
  const target = registry?.targets?.[`${agent}-agent`] ?? Object.values(registry?.targets ?? {}).find((row) => row?.runtime === agent);
  return pool?.defaultModel ?? target?.defaultModel ?? null;
}

function briefReference(line) {
  return /(?:^|\s|["'(])[^\s"'<>]+\.(?:md|txt|ya?ml)\b/i.test(line);
}

function resolveWorkerSpec(value, cwd, { readFile = (file) => fs.readFileSync(file, 'utf8'), exists = fs.existsSync } = {}) {
  const supplied = clean(value);
  if (!supplied) return { error: '--spec is required' };
  if (supplied.startsWith('@')) {
    const file = path.resolve(cwd, supplied.slice(1));
    if (!exists(file)) return { error: `spec file does not exist: ${supplied.slice(1)}` };
    const spec = String(readFile(file)).trim();
    return spec ? { spec, file } : { error: `spec file is empty: ${supplied.slice(1)}` };
  }
  const file = path.resolve(cwd, supplied);
  if (!/[\r\n]/.test(supplied) && exists(file)) return { spec: file, file };
  if (/[\r\n]/.test(supplied)) return { error: '--spec text must be one line or use @file' };
  if (!briefReference(supplied)) return { error: '--spec text must point to a brief file' };
  return { spec: supplied, file: null };
}

const consumerFenced = (result) => result?.errorCode === 'consumer_fenced'
  || /consumer_fenced|consumer fenced/i.test(`${result?.error ?? ''} ${result?.errorReceipt?.message ?? ''}`);

/** Start one supervised worker after registry, worktree and spec validation. */
export async function workerStartVerb(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const agent = clean(args.agent);
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  let registry;
  try {
    registry = deps.registry ?? loadModelRegistry();
  } catch (error) { return refusal(`model registry is unavailable: ${error.message}`); }
  if (!agentsOf(registry).has(agent)) return refusal(`unknown agent '${agent || '(empty)'}'`);
  if (args.model && agent === 'devin') return refusal("agent 'devin' does not take --model");
  if (['cursor', 'claude'].includes(agent) && availabilityOf(registry, agent) === 'unavailable')
    return refusal(`agent '${agent}' is marked unavailable in the model registry`);
  const allowedModels = modelsOf(registry, agent);
  if (args.model && allowedModels.size && !allowedModels.has(String(args.model)))
    return refusal(`model '${args.model}' is not registered for agent '${agent}'`);
  const model = args.model ?? (agent === 'devin' ? null : defaultModelOf(registry, agent));
  const title = clean(args['task-title']);
  if (!title) return refusal('--task-title is required');
  const spec = resolveWorkerSpec(args.spec, cwd, deps);
  if (spec.error) return refusal(spec.error);

  const ps = await (deps.worktreePs ?? worktreePs)();
  if (!ps?.ok) return { code: 1, text: `starci worker start: ${ps?.error ?? 'Orca worktree listing failed'}`,
    data: { schema: 'starci/worker-start@1', ok: false } };
  if (ps.truncated || ps.omittedHostIds?.length) return { code: 1, text: 'starci worker start: Orca returned an incomplete host worktree listing',
    data: { schema: 'starci/worker-start@1', ok: false } };
  const requested = clean(args.worktree);
  if (!requested) return refusal('--worktree is required');
  const target = registeredWorktree(ps.worktrees ?? [], requested, cwd);
  if (!target) return refusal(`worktree is not registered for this repository: ${requested}`);

  const started = await (deps.workerStart ?? workerStart)({
    agent, ...(model ? { model } : {}), worktree: `path:${target.path}`, spec: spec.spec, taskTitle: title,
    run: args.run, from: readEnv('ORCA_TERMINAL_HANDLE', ctx?.env),
  });
  if (consumerFenced(started)) return refusal('caller is not bound to this Run; run orca orchestration run-create in this same terminal, then retry');
  if (!started?.ok) return { code: 1, text: `starci worker start: ${started?.error ?? started?.errorCode ?? 'worker-start failed'}`,
    data: { schema: 'starci/worker-start@1', ok: false, outcome: started?.outcome ?? null, effectState: started?.effectState ?? null } };
  const data = { schema: 'starci/worker-start@1', ok: true, dispatchId: started.dispatchId, terminalHandle: started.agentTerminalHandle,
    taskId: started.taskId ?? null, runId: started.runId ?? args.run ?? null, agent, model, worktree: target.path };
  return { code: 0, text: `started ${data.dispatchId} on ${data.terminalHandle}`, data };
}
