// worker-verbs-start.mjs - validate the worker request (registry, worktree, spec) before asking Orca to create a supervised worker.
import fs from 'node:fs';
import path from 'node:path';
import { loadModelRegistry } from '../agent/model-registry.mjs';
import { spawnAgent } from '../agent/lib.mjs';
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
  for (const [id, row] of Object.entries(registry?.models ?? {})) {
    if (row?.provider === agent) models.add(id);
  }
  for (const pool of Object.values(registry?.pools ?? {})) {
    if (pool?.provider !== agent) continue;
    if (pool.defaultModel) models.add(String(pool.defaultModel));
    for (const model of Object.values(pool.models ?? {})) {
      if (model) models.add(String(model));
    }
  }
  for (const target of Object.values(registry?.targets ?? {})) {
    if (target?.runtime === agent && target.defaultModel) models.add(String(target.defaultModel));
  }
  return models;
}

function defaultModelOf(registry, agent) {
  const pool = Object.values(registry?.pools ?? {}).find((row) => row?.provider === agent);
  const target = registry?.targets?.[`${agent}-agent`] ?? Object.values(registry?.targets ?? {}).find((row) => row?.runtime === agent);
  return pool?.defaultModel ?? target?.defaultModel ?? null;
}

function hasBriefExtension(line, start) {
  let end = start;
  while (end < line.length && !/[\s"'<>]/.test(line[end])) end++;
  return end - start > 1 && /\.(?:md|txt|ya?ml)\b/i.test(line.slice(start + 1, end));
}

function briefReference(line) {
  for (let index = 0; index < line.length; index++) {
    if (index === 0 && hasBriefExtension(line, index)) return true;
    if (/\s|["'(]/.test(line[index]) && hasBriefExtension(line, index + 1)) return true;
  }
  return false;
}

function prepareWorkerStart(ctx, deps) {
  const args = ctx?.args ?? {};
  const agent = clean(args.agent);
  const cwd = path.resolve(ctx?.cwd ?? process.cwd());
  let registry;
  try { registry = deps.registry ?? loadModelRegistry(); }
  catch (error) { return refusal(`model registry is unavailable: ${error.message}`); }
  if (!agentsOf(registry).has(agent)) return refusal(`unknown agent '${agent || '(empty)'}'`);
  if (args.model && agent === 'devin') return refusal("agent 'devin' does not take --model");
  if (['cursor', 'claude'].includes(agent) && availabilityOf(registry, agent) === 'unavailable')
    return refusal(`agent '${agent}' is marked unavailable in the model registry`);
  const allowedModels = modelsOf(registry, agent);
  if (args.model && allowedModels.size && !allowedModels.has(String(args.model)))
    return refusal(`model '${args.model}' is not registered for agent '${agent}'`);
  const model = args.model ?? (agent === 'devin' ? defaultModelOf(registry, agent) : null);
  if (!model) return refusal('--model must name a concrete registered model');
  const title = clean(args['task-title']);
  if (!title) return refusal('--task-title is required');
  const spec = resolveWorkerSpec(args.spec, cwd, deps);
  if (spec.error) return refusal(spec.error);
  return { args, agent, cwd, model, title, spec };
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
  const prepared = prepareWorkerStart(ctx, deps);
  if (prepared.code != null) return prepared;
  const { args, agent, cwd, model, title, spec } = prepared;

  const ps = await (deps.worktreePs ?? worktreePs)();
  if (!ps?.ok) return { code: 1, text: `starci worker start: ${ps?.error ?? 'Orca worktree listing failed'}`,
    data: { schema: 'starci/worker-start@1', ok: false } };
  if (ps.truncated || ps.omittedHostIds?.length) return { code: 1, text: 'starci worker start: Orca returned an incomplete host worktree listing',
    data: { schema: 'starci/worker-start@1', ok: false } };
  const requested = clean(args.worktree);
  if (!requested) return refusal('--worktree is required');
  const target = registeredWorktree(ps.worktrees ?? [], requested, cwd);
  if (!target) return refusal(`worktree is not registered for this repository: ${requested}`);

  const started = await (deps.spawnAgent ?? spawnAgent)({
    env: ctx?.env ?? process.env,
    provider: agent, model, worktree: target.path, spec: spec.spec, taskTitle: title, title,
    role: 'worker', allowGroup: [{ provider: agent, model }],
    run: args.run, from: readEnv('ORCA_TERMINAL_HANDLE', ctx?.env),
    request: { run: args.run, worktree: target.path, title, spec: spec.spec },
    io: { start: deps.workerStart, show: deps.workerShow, trust: deps.trust, hostAgent: deps.hostAgent,
      rename: deps.terminalRename, admission: deps.admission, recordLaunch: deps.recordLaunch },
  });
  if (consumerFenced(started)) return refusal('caller is not bound to this Run; run orca orchestration run-create in this same terminal, then retry');
  if (!started?.ok) return { code: 1, text: `starci worker start: ${started?.error ?? started?.errorCode ?? 'worker-start failed'}`,
    data: { schema: 'starci/worker-start@1', ok: false, outcome: started?.outcome ?? null, effectState: started?.effectState ?? null } };
  const data = { schema: 'starci/worker-start@1', ok: true, dispatchId: started.dispatchId, terminalHandle: started.terminal,
    taskId: started.taskId ?? null, runId: started.runId ?? args.run ?? null, agent, model, worktree: target.path,
    admission: started.admission ?? null, effective: started.effective ?? null };
  return { code: 0, text: `started ${data.dispatchId} on ${data.terminalHandle}`, data };
}
