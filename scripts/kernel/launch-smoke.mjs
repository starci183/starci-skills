#!/usr/bin/env node
// launch-smoke.mjs — the pre-workflow launch smoke (starci/launch-smoke@2): proves on the live Orca host that every
// nesting path the runtime uses starts its agents through orchestration worker-start, at the depth Orca reports, and that
// one Kernel workflow runs in ONE workflow worktree (contract change workflow-worktree).
//
//   supervisor-worker  entry (0) -> [Supervisor] (1) -> [Worker] (2)
//                      the [Worker] is started by scripts/agent/start-worker.mjs startWorkerAgent from the
//                      Supervisor's own terminal, in the Run that terminal creates and coordinates.
//   op-critic          entry (0) -> [Kernel] (1) -> [Op] be (2) -> draw critic (3)
//                      the [Op] is started the api dispatch way (scripts/agent/lib.mjs startAgent: run-create --from
//                      <kernel terminal>, task-create --run --from, worker-start --task --run --from); the critic by
//                      scripts/work/draw-critic.mjs launchCriticWorker on its criticWorkspace placement, from the Op's
//                      terminal.
//   workflow-worktree  before the Kernel starts, scripts/kernel/workflow-worktree.mjs ensureWorkflowWorktree has Orca create
//                      the workflow worktree (`orca worktree create --name wf-<id> --base-branch main --setup run`, a real
//                      npm ci, no junctions) and registers it; it must appear in `orca worktree list`, and the Kernel then
//                      starts with `worker-start --worktree <that path>` (an existing tree, so launch trust is written into
//                      it first). The workflow branch is the one the registry names (Orca's wf-<id>). The Kernel's stage starts one be op and one fe op IN PARALLEL in that
//                      worktree (opWorktreeArgs; canDispatchConcurrently says yes across sides); each writes one owned
//                      file. Each green op is a checkpoint (scripts/kernel/workflow-checkpoint.mjs checkpointOp) whose
//                      gate base is the previous checkpoint (gateBaseOf). Then a second be op, started from the Kernel's
//                      terminal once no be op runs (same side: serial), writes its file and FAILS: preserveAndReset keeps
//                      its work on preserved/<id>/<op> and the worktree is back on the last checkpoint. Finally, with every
//                      agent released, finishWorkflow fast-forwards the app's main and marks the worktree release-pending;
//                      the host-side controller must then remove it (gone from `orca worktree list`, its directory and
//                      branch gone), and only after that main's checkout must hold exactly the two green files more, byte
//                      for byte (every other tracked file and the node_modules listing unchanged).
//
// Every agent is a no-op on the cheapest model modules/models/runtimes.yaml pins (priced by modules/models/prices.yaml):
// a leaf writes its result line (`mark`; an op also writes its owned file in the workflow worktree) and reports
// worker_done; a parent first runs its `stage` (which starts its children from the parent's own terminal, the way the
// runtime does) and then does the same. The smoke reads each worker back (worker-read), checks the depth and the creator
// Dispatch worker-show reports, then - deepest first - stops a worker that has not settled, releases every worker, closes a
// Task its worker did not settle, removes the critic's placement, finishes the workflow and waits for the host-side
// controller to remove its worktree (when the workflow never finished, or the controller never removed it, it releases the
// worktree through releaseWorkflowWorktree) and removes its own state directory. It prints one JSON result.
//
//   node scripts/kernel/launch-smoke.mjs --app-repo <app main checkout> [--entry <terminal>] [--timeout-ms <n>] [--out <file>]
//     the smoke; the entry is the terminal it runs in (ORCA_TERMINAL_HANDLE) - the owner's chat or a plain shell,
//     never an agent. The app repository is a SCRATCH app registered in Orca: the finish fast-forwards and pushes its
//     main with the smoke's two files. The reconciler must run (its host-side controller removes the worktree). Exit 0
//     when every path is ok, 1 otherwise, 2 with no entry terminal.
//   node scripts/kernel/launch-smoke.mjs stage --as <role>   (a parent agent runs it in its terminal)
//   node scripts/kernel/launch-smoke.mjs mark --as <role>    (every agent runs it: its result line)
// An agent's command names only its role: the smoke's state directory (under <os temp>/starci-launch-smoke/) is found
// by the agent's own terminal, ORCA_TERMINAL_HANDLE (resolveState). A random path in a spec is one an agent can mistype
// (the first live run: a Kernel dropped one character of it and its stage never ran).
//
// It is step `launch-smoke` of the pre-workflow readiness (docs/releasing.md "Pre-workflow readiness", docs/host-contract.md); it starts real agents, so it
// is run by hand once per runtime release, never by a check or a spec (tests/kernel/launch-smoke.spec.mjs fakes the client).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeProfile } from '../../engine/config.mjs';
import { loadPrices, priceOf } from '../lib/llm-usage.mjs';
import { safeRemoveTree } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { gitResult } from '../api/git/lib.mjs';
import { holdStage, releaseStageHold } from './launch-smoke-hold.mjs';

export const SMOKE_SCHEMA = 'starci/launch-smoke@2';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(SKILL_ROOT, 'scripts', 'kernel', 'launch-smoke.mjs');
const slash = (p) => String(p).replaceAll('\\', '/');

/**
 * Each role: its depth under the entry, its parent role, its title; an op role also its side (be/fe) and whether its
 * no-op fails on purpose. `by: 'smoke'` is a role the smoke itself starts from its parent's terminal (the api dispatch
 * shape: the dispatcher names the Kernel terminal as --from) instead of the parent's stage.
 */
export const ROLES = Object.freeze({
  supervisor: { depth: 1, parent: null, title: '[Supervisor] launch smoke' },
  worker: { depth: 2, parent: 'supervisor', title: '[Worker] launch smoke' },
  kernel: { depth: 1, parent: null, title: '[Kernel] launch smoke' },
  op: { depth: 2, parent: 'kernel', title: '[Op] launch smoke be', side: 'be' },
  opFe: { depth: 2, parent: 'kernel', title: '[Op] launch smoke fe', side: 'fe' },
  opFail: { depth: 2, parent: 'kernel', title: '[Op] launch smoke be fail', side: 'be', fails: true, by: 'smoke' },
  critic: { depth: 3, parent: 'op', title: '[Critic] launch smoke' },
});
export const PATHS = Object.freeze({
  'supervisor-worker': ['supervisor', 'worker'],
  'op-critic': ['kernel', 'op', 'critic'],
  'workflow-worktree': ['kernel', 'op', 'opFe', 'opFail'],
});
/** The children a parent's stage starts, in parallel. */
export const CHILDREN = Object.freeze(Object.fromEntries(Object.keys(ROLES).map((p) => [p, Object.entries(ROLES).filter(([, r]) => r.parent === p && r.by !== 'smoke').map(([role]) => role)]).filter(([, c]) => c.length)));
const OP_ROLES = Object.freeze(Object.keys(ROLES).filter((r) => ROLES[r].side));
// Deepest first: a child is settled and released while its creator's terminal still exists.
const CLEANUP_ORDER = Object.freeze(['critic', 'op', 'opFe', 'opFail', 'worker', 'kernel', 'supervisor']);
// worker-show: a Dispatch that will do nothing more.
const SETTLED_STATUS = new Set(['completed', 'succeeded', 'failed', 'cancelled']);
const ENDED_STATE = new Set(['done', 'completed', 'succeeded', 'failed', 'stopped', 'released', 'exited']);
const GREEN_STATUS = new Set(['completed', 'succeeded']);
const TIER_ORDER = ['easy', 'medium', 'hard', 'insane'];

/**
 * The no-op agent: the cheapest model a runtimes.yaml pool pins at any tier (input + output list price per 1M tokens;
 * an unpriced model is never picked), with that tier's effort. {provider, model, effort, pool, tier, usdPerMTok} | {error}.
 */
export function noopAgent({ runtimes = runtimeProfile(), prices = loadPrices() } = {}) {
  const found = [];
  for (const [pool, def] of Object.entries(runtimes?.runtimes ?? {})) {
    for (const [tier, model] of Object.entries(def?.models ?? {})) {
      const price = priceOf(model, prices);
      if (!price || !Number.isFinite(Number(price.input)) || !Number.isFinite(Number(price.output)) || price.input == null || price.output == null) continue;
      found.push({ provider: def.provider, model, effort: def.effort?.[tier] ?? null, pool, tier, usdPerMTok: Number(price.input) + Number(price.output) });
    }
  }
  const rank = (t) => { const i = TIER_ORDER.indexOf(t); return i < 0 ? TIER_ORDER.length : i; };
  found.sort((a, b) => a.usdPerMTok - b.usdPerMTok || rank(a.tier) - rank(b.tier) || a.pool.localeCompare(b.pool));
  return found[0] ?? { error: 'no runtimes.yaml pool pins a priced model (modules/models/prices.yaml)' };
}

/**
 * The Orca client: the runtime's own launchers, the scripts/api/orca wrappers and the workflow-worktree runtime
 * (scripts/kernel/workflow-worktree.mjs, scripts/kernel/workflow-checkpoint.mjs), each replaceable (specs). `ctx` is
 * the context those two modules take; `git` runs one git command ({ok, stdout, error}).
 */
export async function defaultClient() {
  const [lib, startWorker, critic, show, read, stop, release, update, list, wt, cp, tree] = await Promise.all([
    import('../agent/lib.mjs'), import('../agent/start-worker.mjs'), import('../work/draw-critic.mjs'),
    import('../api/orca/worker-show.mjs'), import('../api/orca/worker-read.mjs'), import('../api/orca/worker-stop.mjs'),
    import('../api/orca/worker-release.mjs'), import('../api/orca/task-update.mjs'),
    import('../api/orca/worktree-list.mjs'), import('./workflow-worktree.mjs'), import('./workflow-checkpoint.mjs'), import('../machine/workflow-tree.mjs')]);
  return {
    startAgent: lib.startAgent, startWorkerAgent: startWorker.startWorkerAgent,
    criticWorkspace: critic.criticWorkspace, removeCriticWorkspace: critic.removeCriticWorkspace, launchCriticWorker: critic.launchCriticWorker,
    workerShow: show.workerShow, workerRead: read.workerRead, workerStop: stop.workerStop, workerRelease: release.workerRelease,
    taskUpdate: update.taskUpdate, worktreeList: list.worktreeList,
    // The context of parts A and B. The smoke's ops are no-op agents, so no review.verify op runs: the smoke attests that
    // step itself through part B's `verify` seam, and the result says so (workflow.finish.steps).
    ctx: { verify: () => ({ ok: true, jobId: null, detail: 'launch smoke: its ops are no-op agents, no review.verify op runs' }) },
    workflow: {
      spec: wt.workflowWorktreeSpec, ensure: wt.ensureWorkflowWorktree, of: tree.workflowWorktreeOf, opArgs: wt.opWorktreeArgs,
      sideOf: wt.sideOf, canDispatchConcurrently: wt.canDispatchConcurrently, release: wt.releaseWorkflowWorktree,
      checkpointOp: cp.checkpointOp, gateBaseOf: tree.gateBaseOf, preserveAndReset: cp.preserveAndReset, finish: cp.finishWorkflow,
    },
    git: (args, dir) => gitResult(args, { dir }),
  };
}

// ------------------------------------------------------------------ state directory
/** Where every smoke run keeps its state directory. */
export const stateParentOf = (tmp = os.tmpdir()) => path.join(tmp, 'starci-launch-smoke');
const dirs = (state) => ({ agents: path.join(state, 'agents'), stages: path.join(state, 'stages'), results: path.join(state, 'results') });
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); };
const agentFile = (state, role) => path.join(dirs(state).agents, `${role}.json`);
const stageFile = (state, role) => path.join(dirs(state).stages, `${role}.json`);
const resultFile = (state, role) => path.join(dirs(state).results, `${role}.txt`);
const planFile = (state) => path.join(state, 'plan.json');
export const planOf = (state) => readJson(planFile(state));
export const agentOf = (state, role) => readJson(agentFile(state, role));
const settle = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };
const settleAsync = async (fn) => { try { return await fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

// ------------------------------------------------------------------ the workflow worktree
/** The app-relative file an op role owns in the workflow worktree. */
// Each no-op file sits in a slot every scaffolded app owns, so the finish gate's lint judges the smoke and not an invented
// folder: a be op writes a payload fixture (be.tests.fixtures, src/tests/fixtures/<name>.<role>.json), an fe op a static
// file of the app's first fe application (fe.app-optional, apps/<app>/public/).
const OWNED_SLUG = Object.freeze({ op: 'be', opFe: 'fe', opFail: 'be-fail' });
export const ownedFileOf = (role, workflowId, feApp) => (ROLES[role].side === 'be'
  ? `be/src/tests/fixtures/launch-smoke-${workflowId}-${OWNED_SLUG[role]}.payload.json`
  : `fe/apps/${feApp}/public/launch-smoke-${workflowId}-${OWNED_SLUG[role]}.txt`);
/** The app's first fe application (hfs.json sides.fe.apps[0].name): the fe op's file goes under its public/ folder. */
export function feAppOf(appRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(appRoot, 'hfs.json'), 'utf8'))?.sides?.fe?.apps?.[0]?.name ?? null; } catch { return null; }
}
/** The bytes an op role writes into its owned file. */
export const ownedTextOf = (role, workflowId) => (ROLES[role].side === 'be'
  ? `${JSON.stringify({ schema: SMOKE_SCHEMA, workflowId, role })}\n`
  : `${SMOKE_SCHEMA} ${workflowId} ${role}\n`);
/** The op record the dispatcher judges (sideOf, canDispatchConcurrently): its owned paths, app-relative. */
export const opRecordOf = (role, workflowId, feApp) => ({ jobId: `${workflowId}:${role}`, opId: role, owned_paths: [ownedFileOf(role, workflowId, feApp)] });

/** worker-start's worktree arguments (['--worktree', x, '--repo', y, ...]) as startAgent's named options. */
export function worktreeParamsOf(args = []) {
  const out = {};
  const names = { worktree: 'worktree', repo: 'repo', 'base-branch': 'baseBranch', name: 'name' };
  for (let i = 0; i < args.length; i += 1) {
    const flag = /^--(.+)$/.exec(String(args[i]))?.[1];
    if (flag && names[flag] && i + 1 < args.length) { out[names[flag]] = args[i + 1]; i += 1; }
  }
  return out;
}

/**
 * The byte manifest of an app's main checkout: its HEAD, every tracked file's sha256 read from disk (a missing file is
 * null), and the sorted top-level node_modules listing (null without one). {ok, head, files, nodeModules} | {ok:false, error}.
 */
export function mainManifest({ appRoot, git }) {
  const head = git(['rev-parse', 'HEAD'], appRoot);
  const listed = git(['ls-files', '-z'], appRoot);
  if (!head.ok || !listed.ok) return { ok: false, error: head.ok ? listed.error : head.error };
  const files = {};
  for (const rel of listed.stdout.split('\0').filter(Boolean)) {
    try { files[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(appRoot, rel))).digest('hex'); } catch { files[rel] = null; }
  }
  let nodeModules = null;
  try { nodeModules = fs.readdirSync(path.join(appRoot, 'node_modules')).sort(); } catch { nodeModules = null; }
  return { ok: true, head: head.stdout.trim(), files, nodeModules };
}

/** before -> after: {added, changed, removed} tracked paths, and whether the node_modules listing is unchanged. */
export function manifestDiff(before, after) {
  const added = Object.keys(after.files).filter((f) => !(f in before.files)).sort();
  const removed = Object.keys(before.files).filter((f) => !(f in after.files) || after.files[f] === null).sort();
  const changed = Object.keys(before.files).filter((f) => f in after.files && after.files[f] !== null && after.files[f] !== before.files[f]).sort();
  return { added, changed, removed, nodeModulesSame: JSON.stringify(before.nodeModules) === JSON.stringify(after.nodeModules) };
}

/** The no-op Task spec of `role`: a parent runs its stage (starting its children), every agent marks its result line. */
export function noopSpec({ role, script = SCRIPT }) {
  const node = (verb) => `node "${slash(script)}" ${verb} --as ${role}`;
  const report = '2. Then report worker_done exactly once, as your Orca worker preamble instructs: --outcome succeeded if the command exited 0, else --outcome failed.';
  const steps = CHILDREN[role]
    ? [`1. Run exactly: ${node('stage')}`,
      '   It starts more no-op agents and can take up to 3 minutes: give the command a timeout of at least 300 seconds (300000 ms) and wait for it to exit.',
      report]
    : [`1. Run exactly: ${node('mark')}`, report];
  return [
    `This is a no-op launch smoke (${SMOKE_SCHEMA}); you are its ${ROLES[role].title}. Do exactly these steps and nothing else:`,
    ...steps,
    'Do not read, edit, create or delete anything else, and start no other work. After worker_done, stay idle in this agent: never quit or exit it (the runtime releases your terminal; an agent that exits itself leaves Orca unable to prove its process stopped).',
  ].join('\n');
}

/**
 * Start `role` from the terminal `entry` with the runtime launcher that path uses. Its terminal and Dispatch are
 * recorded in the state directory the moment Orca names them (onCreated), the full receipt after attestation. The Kernel
 * is started with the workflow worktree spec (Orca creates the worktree); an op role on the workflow worktree.
 */
export function launchRole({ role, state, entry, orca, root = SKILL_ROOT, script = SCRIPT }) {
  const plan = planOf(state);
  const noop = plan.noop;
  const prompt = noopSpec({ role, script });
  const { title } = ROLES[role];
  const objective = `${SMOKE_SCHEMA} ${role}`;
  const record = (extra) => writeJson(agentFile(state, role), { ...(agentOf(state, role) ?? {}), role, creatorTerminal: entry, ...extra });
  const onCreated = (terminal, dispatchId) => record({ terminal, dispatchId });
  const route = { provider: noop.provider, model: noop.model, effort: noop.effort };
  let launched;
  if (role === 'worker') {
    launched = orca.startWorkerAgent({ route: { agent: noop.provider, model: noop.model, effort: noop.effort }, worktree: root, title, prompt, objective, entry, onCreated });
  } else if (role === 'critic') {
    // draw-critic's own placement, in the runtime repository (no op job owns it: the smoke removes it).
    const placed = orca.criticWorkspace({ repoRoot: root, context: null });
    if (!placed?.ok) {
      launched = { ok: false, step: 'placement', error: `criticWorkspace: ${placed?.error ?? 'no placement'}` };
    } else {
      record({ workspace: placed.dir, workspaceRepo: placed.repoRoot ?? null, workspaceOrcaId: placed.orcaId ?? null, workspaceBranch: placed.branch ?? null });
      launched = orca.launchCriticWorker({ critic: { provider: noop.provider, model: noop.model, effort: noop.effort }, dir: placed.dir, prompt, entry });
    }
  } else if (role === 'kernel') {
    // The workflow worktree exists before the Kernel starts (ensureWorkflowWorktree): an existing tree takes launch trust.
    launched = plan.workflow?.path
      ? orca.startAgent({ ...route, worktree: plan.workflow.path, title, prompt, objective, entry, onCreated })
      : { ok: false, step: 'worktree', error: 'the workflow worktree was never created' };
  } else if (ROLES[role].side) {
    const args = settle(() => orca.workflow.opArgs(orca.ctx, { workflowId: plan.workflow?.workflowId }));
    const params = Array.isArray(args) ? worktreeParamsOf(args) : {};
    launched = params.worktree
      ? orca.startAgent({ ...route, worktree: params.worktree, title, prompt, objective, entry, onCreated })
      : { ok: false, step: 'worktree', error: `opWorktreeArgs: ${args?.error ?? 'no --worktree for the workflow'}` };
  } else {
    launched = orca.startAgent({ ...route, worktree: root, title, prompt, objective, entry, onCreated });
  }
  return Promise.resolve(launched).then((r) => {
    record({ ok: r?.ok === true, terminal: r?.terminal ?? agentOf(state, role)?.terminal ?? null, dispatchId: r?.dispatchId ?? agentOf(state, role)?.dispatchId ?? null,
      runId: r?.runId ?? null, taskId: r?.taskId ?? null, effective: r?.effective ?? null,
      ...(r?.ok ? {} : { error: r?.error ?? 'no launch receipt', step: r?.step ?? null, errorCode: r?.errorCode ?? null }) });
    return r;
  });
}

/**
 * The state directory of the smoke run that launched `role` into this terminal: the run under `parent` whose
 * agents/<role>.json names ORCA_TERMINAL_HANDLE; with no handle in the environment, the one run whose `role` is
 * launched and not yet marked. A launch is recorded after attestation at the latest, so it waits up to `waitMs`.
 * {state} | {error}.
 */
export async function resolveState({ role, env = process.env, parent = stateParentOf(), waitMs = 60000, sleep = defaultSleep, now = Date.now }) {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  for (const deadline = now() + waitMs; ;) {
    let runs = [];
    try { runs = fs.readdirSync(parent).map((n) => path.join(parent, n)).filter((d) => planOf(d)); } catch { runs = []; }
    const launched = runs.filter((d) => agentOf(d, role));
    const mine = handle ? launched.filter((d) => agentOf(d, role).terminal === handle) : launched.filter((d) => !fs.existsSync(resultFile(d, role)));
    if (mine.length === 1) return { state: mine[0] };
    if (mine.length > 1) return { error: `${mine.length} smoke runs launched ${role}${handle ? ` into ${handle}` : ''}: ${mine.map(slash).join(', ')}` };
    if (now() >= deadline) return { error: `no smoke run under ${slash(parent)} launched ${role}${handle ? ` into terminal ${handle}` : ''}` };
    await sleep(500);
  }
}

/**
 * `mark`: the role's one result line. An op role first writes its owned file into the workflow worktree; the failing
 * op writes it too and then answers ok:false, so its agent reports failed.
 */
export function markResult({ role, state, now = Date.now }) {
  const r = ROLES[role] ?? {};
  let owned = null;
  if (r.side) {
    const wf = planOf(state)?.workflow;
    if (!wf?.path) return { ok: false, role, error: 'the workflow worktree is not recorded in the smoke plan' };
    owned = ownedFileOf(role, wf.workflowId, wf.feApp);
    const file = path.join(wf.path, owned);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, ownedTextOf(role, wf.workflowId));
  }
  fs.mkdirSync(dirs(state).results, { recursive: true });
  fs.writeFileSync(resultFile(state, role), `${role} ok ${new Date(now()).toISOString()}\n`);
  return r.fails ? { ok: false, role, owned, error: 'this op fails on purpose (the preserve-and-reset leg)' } : { ok: true, role, ...(owned ? { owned } : {}) };
}

/**
 * `stage`: run by a parent agent in its own terminal. It starts the parent's children, in parallel, with `entry` = that
 * terminal (ORCA_TERMINAL_HANDLE, which must be the terminal the launcher recorded for the role), then marks the parent's
 * result line. The Kernel's stage first waits for the workflow worktree to be recorded and asks the dispatcher whether
 * its children may run together. {ok, role, children, entry, error?}; also written to stages/<role>.json.
 */
export async function runStage({ role, state, orca, env = process.env, root = SKILL_ROOT, script = SCRIPT, waitMs = 60000, holdMs = 0, sleep = defaultSleep, now = Date.now }) {
  const children = CHILDREN[role];
  const done = (receipt) => { writeJson(stageFile(state, role), receipt); return receipt; };
  if (!children) return done({ ok: false, role, error: `${role} has no child to start` });
  let recorded = agentOf(state, role);
  for (const deadline = now() + waitMs; !recorded?.terminal && now() < deadline;) { await sleep(500); recorded = agentOf(state, role); }
  const own = env.ORCA_TERMINAL_HANDLE || null;
  const entry = own ?? recorded?.terminal ?? null;
  if (!entry) return done({ ok: false, role, error: 'no terminal: neither ORCA_TERMINAL_HANDLE nor a recorded launch names this agent' });
  if (own && recorded?.terminal && own !== recorded.terminal) {
    return done({ ok: false, role, entry, error: `ORCA_TERMINAL_HANDLE ${own} is not the terminal ${recorded.terminal} the launcher recorded for ${role}` });
  }
  const ops = children.filter((c) => ROLES[c].side);
  let concurrent = null;
  if (ops.length) {
    for (const deadline = now() + waitMs; !planOf(state)?.workflow?.path && now() < deadline;) await sleep(500);
    const wf = planOf(state)?.workflow;
    if (!wf?.path) return done({ ok: false, role, entry, error: 'the workflow worktree was never recorded (not in orca worktree list)' });
    const records = ops.map((c) => opRecordOf(c, wf.workflowId, wf.feApp));
    concurrent = records.slice(1).every((next, i) => settle(() => orca.workflow.canDispatchConcurrently(records.slice(0, i + 1), next)) === true);
    if (!concurrent) return done({ ok: false, role, entry, concurrent, error: `the dispatcher refuses ${ops.join(' and ')} together (they must run in parallel across sides)` });
  }
  const launched = await Promise.all(children.map((c) => launchRole({ role: c, state, entry, orca, root, script })));
  markResult({ role, state, now }); if (role === 'kernel') await holdStage({ state, role, holdMs, sleep, now });
  const failed = children.filter((c, i) => launched[i]?.ok !== true);
  return done({ ok: failed.length === 0, role, children, entry, ...(concurrent === null ? {} : { concurrent }),
    dispatchIds: Object.fromEntries(children.map((c, i) => [c, launched[i]?.dispatchId ?? null])),
    ...(failed.length ? { error: failed.map((c) => `${c}: ${launched[children.indexOf(c)]?.error ?? 'no launch receipt'}`).join('; ') } : {}) });
}

const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** One worker-show read reduced to what the smoke checks. */
function observe(show) {
  const d = show?.dispatch ?? show?.result?.dispatch ?? null;
  return { ok: show?.ok === true, state: show?.state ?? null, status: d?.status ?? null, depth: Number.isFinite(Number(d?.depth)) ? Number(d.depth) : null,
    creatorDispatchId: d?.creatorDispatchId ?? null, lastFailure: d?.lastFailure ?? null, runId: d?.runId ?? null, taskId: d?.taskId ?? d?.task_id ?? null };
}
// A valid worker_done settles the Dispatch (Orca's completion accounting): its status is the outcome the worker sent. A
// Dispatch the smoke itself stopped settles too, but its worker reads stopped: that one never reported.
const workerDoneOf = (o) => SETTLED_STATUS.has(String(o?.status)) && String(o?.state) !== 'stopped';
const settledOf = (o) => SETTLED_STATUS.has(String(o?.status)) || ENDED_STATE.has(String(o?.state));

/** The workflow's Orca worktree in `orca worktree list` (by its Orca id, else its path), or null. */
function listedWorkflow(orca, appRepo, wf) {
  const listed = settle(() => orca.worktreeList({ repo: `path:${slash(path.resolve(appRepo))}` }));
  const rows = listed?.worktrees ?? [];
  const key = (p) => (p ? slash(path.resolve(p)).toLowerCase() : null);
  const row = rows.find((w) => wf.orcaWorktreeId && w.id === wf.orcaWorktreeId) ?? rows.find((w) => wf.path && key(w.path) === key(wf.path)) ?? null;
  return { ok: listed?.ok === true, row, error: listed?.ok ? null : listed?.error ?? 'worktree list failed' };
}

/**
 * The workflow leg the smoke drives as the dispatcher and settler would: register the Kernel's worktree once Orca lists
 * it; checkpoint each green op (the gate base before and after); start the failing op once no be op runs; preserve and
 * reset it. One call per poll; every step is recorded in `wf` and runs once.
 */
async function driveWorkflow({ wf, state, orca, seen, entry, root, script }) {
  const plan = planOf(state);
  const spec = plan.workflow;
  const ctx = orca.ctx;
  if (!wf.registered) return;
  for (const role of ['op', 'opFe']) {
    if (role in wf.checkpoints || !GREEN_STATUS.has(String(seen[role]?.status))) continue;
    const base = await settleAsync(() => orca.workflow.gateBaseOf(ctx, spec.workflowId));
    const cp = await settleAsync(() => orca.workflow.checkpointOp(ctx, { workflowId: spec.workflowId, opId: role }));
    const after = await settleAsync(() => orca.workflow.gateBaseOf(ctx, spec.workflowId));
    wf.checkpoints[role] = cp?.sha ?? null;
    wf.gateBases[role] = { before: typeof base === 'string' ? base : base?.sha ?? null, after: typeof after === 'string' ? after : after?.sha ?? null };
    if (!cp?.sha) wf.problems.push(`checkpointOp ${role}: ${cp?.error ?? cp?.refusal ?? 'no sha'}`);
  }
  if (!wf.failLaunched && wf.checkpoints.op && wf.checkpoints.opFe) {
    const fail = opRecordOf('opFail', spec.workflowId, spec.feApp);
    // Same side is serial: the dispatcher refuses opFail beside a running be op, and admits it beside the fe op.
    wf.concurrency.beBeside = settle(() => orca.workflow.canDispatchConcurrently([opRecordOf('op', spec.workflowId, spec.feApp)], fail));
    wf.concurrency.feBeside = settle(() => orca.workflow.canDispatchConcurrently([opRecordOf('opFe', spec.workflowId, spec.feApp)], fail));
    wf.concurrency.sides = { op: settle(() => orca.workflow.sideOf(opRecordOf('op', spec.workflowId, spec.feApp))), opFe: settle(() => orca.workflow.sideOf(opRecordOf('opFe', spec.workflowId, spec.feApp))) };
    wf.failLaunched = true;
    const kernelTerminal = agentOf(state, 'kernel')?.terminal ?? null;
    if (kernelTerminal) await launchRole({ role: 'opFail', state, entry: kernelTerminal, orca, root, script });
    else wf.problems.push('opFail: the Kernel has no terminal to start it from');
  }
  if (wf.failLaunched && !wf.reset && SETTLED_STATUS.has(String(seen.opFail?.status))) {
    const lastCheckpoint = settle(() => orca.workflow.of(ctx, spec.workflowId))?.checkpoint ?? null;
    const r = await settleAsync(() => orca.workflow.preserveAndReset(ctx, { workflowId: spec.workflowId, opId: 'opFail' }));
    const file = ownedFileOf('opFail', spec.workflowId, spec.feApp);
    const head = orca.git(['rev-parse', 'HEAD'], wf.path);
    const status = orca.git(['status', '--porcelain', '--untracked-files=all'], wf.path);
    const kept = r?.preservedRef ? orca.git(['show', `${r.preservedRef}:${file}`], wf.path) : { ok: false };
    wf.reset = { preservedRef: r?.preservedRef ?? null, resetTo: r?.resetTo ?? null, lastCheckpoint, head: head.ok ? head.stdout.trim() : null,
      clean: status.ok && status.stdout.trim() === '', fileGone: !fs.existsSync(path.join(wf.path, file)),
      preservedHasFile: kept.ok && kept.stdout === ownedTextOf('opFail', spec.workflowId), ...(r?.ok === false ? { error: r.error ?? r.refusal ?? null } : {}) };
  }
}

/** The workflow leg's problems, from what driveWorkflow and the finish recorded. */
function workflowProblems(wf, spec) {
  const p = [...wf.problems];
  if (!wf.listed) p.push(`the workflow worktree ${spec.name} never appeared in orca worktree list${wf.listError ? ` (${wf.listError})` : ''}`);
  if (!wf.parallel) p.push('the be op and the fe op did not run in parallel in the workflow worktree');
  for (const role of ['op', 'opFe']) if (!wf.checkpoints[role]) p.push(`${role}: no checkpoint`);
  const first = Object.values(wf.gateBases)[0];
  if (first && first.before !== wf.baseHead) p.push(`the first op's gate base ${first.before} is not the merge-base with main ${wf.baseHead}`);
  for (const role of ['op', 'opFe']) {
    const g = wf.gateBases[role];
    if (g && wf.checkpoints[role] && g.after !== wf.checkpoints[role]) p.push(`${role}: the gate base after its checkpoint is ${g.after}, not ${wf.checkpoints[role]}`);
  }
  if (wf.concurrency.beBeside !== false) p.push('the dispatcher admits a be op beside a running be op (same side must be serial)');
  if (wf.concurrency.feBeside !== true) p.push('the dispatcher refuses a be op beside a running fe op (sides must run in parallel)');
  const r = wf.reset;
  if (!r) p.push('opFail was never preserved and reset');
  else {
    if (!r.preservedRef || !r.preservedHasFile) p.push(`opFail's work is not on its preserved ref (${r.preservedRef})`);
    if (!r.fileGone || !r.clean) p.push('the workflow worktree is not clean after the reset');
    if (!r.head || r.head !== r.resetTo || (r.lastCheckpoint && r.head !== r.lastCheckpoint)) p.push(`the reset left HEAD at ${r.head}, not the last checkpoint ${r.lastCheckpoint ?? r.resetTo}`);
  }
  const f = wf.finish;
  if (!f?.ok) {
    const why = f?.refusal && typeof f.refusal === 'object' ? `${f.refusal.step ?? '-'} ${f.refusal.code ?? ''}: ${f.refusal.detail ?? ''}`.trim() : f?.refusal ?? f?.error ?? 'not run';
    p.push(`finishWorkflow: ${why}`);
  }
  const m = wf.main;
  if (!m) p.push('main was not compared');
  else {
    const expected = ['op', 'opFe'].map((role) => ownedFileOf(role, wf.workflowId, wf.feApp)).sort();
    if (JSON.stringify(m.added) !== JSON.stringify(expected)) p.push(`main gained ${JSON.stringify(m.added)}, not exactly ${JSON.stringify(expected)}`);
    if (m.changed.length || m.removed.length) p.push(`main is not intact: changed ${JSON.stringify(m.changed)}, removed ${JSON.stringify(m.removed)}`);
    if (!m.nodeModulesSame) p.push("main's node_modules listing changed");
    if (!m.addedBytesOk) p.push("a green op's file on main does not hold the bytes it wrote");
    if (!m.ancestor) p.push(`main ${m.after} does not descend from ${m.before}`);
  }
  if (f?.ok && !wf.releasePending) p.push('the finish did not mark the workflow worktree release-pending');
  if (wf.removed?.listed !== false || wf.removed?.pathExists !== false) p.push('the host-side controller did not remove the workflow worktree after the finish');
  else if (wf.removed?.branchGone === false) p.push(`the host-side controller removed the worktree but kept ${wf.branch}`);
  return p;
}

/**
 * The smoke. `entry` the coordinator terminal; `orca` the client (defaultClient); `appRepo` the scratch app's main
 * checkout (also its Orca repository selector); `timeoutMs` bounds the wait for every agent to settle. Returns the
 * starci/launch-smoke@2 result; never throws.
 */
export async function runSmoke({ entry = process.env.ORCA_TERMINAL_HANDLE || null, orca, appRepo = null, root = SKILL_ROOT, script = SCRIPT, noop = noopAgent(),
  timeoutMs = 1200000, releaseTimeoutMs = 600000, pollMs = 5000, sleep = defaultSleep, now = Date.now, stateRoot = os.tmpdir(), workflowId = `smoke-${Date.now().toString(36)}` }) {
  const startedAt = now();
  const out = { schema: SMOKE_SCHEMA, ok: false, entry, noop: noop?.error ? null : { provider: noop.provider, model: noop.model, effort: noop.effort },
    paths: {}, agents: {}, workflow: null, cleanup: [], error: null };
  if (!entry) return { ...out, error: 'no entry terminal: run the smoke inside an Orca terminal (ORCA_TERMINAL_HANDLE) or pass --entry' };
  if (noop?.error) return { ...out, error: noop.error };
  if (!appRepo) return { ...out, error: 'no app repository: pass --app-repo <the main checkout of a scratch app registered in Orca>' };
  const feApp = feAppOf(appRepo);
  if (!feApp) return { ...out, error: `the app ${slash(appRepo)} declares no fe application in hfs.json (sides.fe.apps): the fe op has nowhere to write` };
  const spec = settle(() => orca.workflow.spec({ workflowId, appRepo }));
  if (!spec?.name) return { ...out, error: `workflowWorktreeSpec: ${spec?.error ?? 'no worktree spec'}` };
  // main's bytes before anything is created, then the workflow worktree, as start-workflow makes it before the Kernel.
  const before = mainManifest({ appRoot: appRepo, git: orca.git });
  const ensured = await settleAsync(() => orca.workflow.ensure(orca.ctx, { workflowId, appRepo }));
  const rec = ensured?.ok ? ensured.record : null;
  if (!rec?.path) return { ...out, error: `ensureWorkflowWorktree: ${ensured?.reason ?? ensured?.error ?? 'no worktree'}${ensured?.detail ? ` (${ensured.detail})` : ''}` };
  const wf = { workflowId, feApp, appRepo: slash(appRepo), name: spec.name, branch: rec.branch, listed: false, registered: true, path: slash(rec.path),
    orcaWorktreeId: rec.orcaWorktreeId, baseHead: null, parallel: false, checkpoints: {}, gateBases: {}, concurrency: {}, failLaunched: false, reset: null,
    finish: null, main: null, removed: null, problems: [] };
  out.workflow = wf;
  const found = listedWorkflow(orca, wf.appRepo, wf);
  wf.listed = Boolean(found.row);
  if (found.error) wf.listError = found.error;
  const head = orca.git(['rev-parse', 'HEAD'], wf.path);
  wf.baseHead = head.ok ? head.stdout.trim() : null;
  fs.mkdirSync(stateParentOf(stateRoot), { recursive: true });
  const state = fs.mkdtempSync(path.join(stateParentOf(stateRoot), 'run-'));
  writeJson(planFile(state), { schema: SMOKE_SCHEMA, root: slash(root), entry, noop: out.noop, appRepo: slash(appRepo),
    workflow: { workflowId, feApp, name: spec.name, branch: wf.branch, path: wf.path, orcaWorktreeId: wf.orcaWorktreeId } });
  if (!before.ok) wf.problems.push(`main manifest before: ${before.error}`);
  const seen = {};
  let cleaned = false;
  const cleanupAgents = () => {
    if (cleaned) return;
    cleaned = true;
    for (const role of CLEANUP_ORDER) {
      const a = agentOf(state, role);
      const unplace = () => settle(() => orca.removeCriticWorkspace({ dir: a.workspace, repoRoot: a.workspaceRepo ?? null, orcaId: a.workspaceOrcaId ?? null, branch: a.workspaceBranch ?? null }))?.ok === true;
      if (a?.workspace && !a?.dispatchId) out.cleanup.push({ role, workspaceRemoved: unplace() });
      if (!a?.dispatchId) continue;
      const o = observe(settle(() => orca.workerShow({ dispatch: a.dispatchId })));
      const settled = settledOf(o);
      const stop = settled ? null : settle(() => orca.workerStop({ dispatch: a.dispatchId }));
      // Orca's recovery for release_unknown is one more release under a fresh request id (the wrapper never reuses one).
      const first = settle(() => orca.workerRelease({ dispatch: a.dispatchId }));
      const release = first?.ok ? first : settle(() => orca.workerRelease({ dispatch: a.dispatchId }));
      // A worker that reported worker_done settled its Dispatch, and with it its own Task (worker-show status).
      const reported = SETTLED_STATUS.has(String(o.status));
      const task = reported || !a.taskId ? null : settle(() => orca.taskUpdate({ id: a.taskId, status: 'failed', ...(a.runId ? { run: a.runId } : {}), ...(a.creatorTerminal ? { from: a.creatorTerminal } : {}) }));
      const entryOut = { role, dispatchId: a.dispatchId, stopped: stop ? stop.ok === true : null, released: release?.ok === true, taskClosed: task ? task.ok === true : reported ? 'by-worker_done' : null,
        ...(release === first ? {} : { releaseRetried: true }), ...(release?.ok ? {} : { releaseState: release?.state ?? null, releaseError: release?.result?.lastError ?? release?.error ?? release?.outcome ?? null }) };
      if (a.workspace) entryOut.workspaceRemoved = unplace();
      out.cleanup.push(entryOut);
    }
  };
  try {
    for (const top of ['supervisor', 'kernel']) {
      const r = await launchRole({ role: top, state, entry, orca, root, script });
      if (!r?.ok) out.agents[top] = { launched: false, error: r?.error ?? 'no launch receipt' };
    }
    const deadline = now() + timeoutMs;
    // Wait until every role has settled, or can no longer appear (its parent settled, failed to launch, or its stage failed).
    for (;;) {
      let open = 0;
      for (const role of Object.keys(ROLES)) {
        const a = agentOf(state, role);
        if (a?.dispatchId) {
          seen[role] = observe(settle(() => orca.workerShow({ dispatch: a.dispatchId })));
          if (!settledOf(seen[role])) open += 1;
          continue;
        }
        // A top role is launched synchronously: no Dispatch now means it never started. A stage child can no longer
        // appear once its parent never started, its stage failed, or its parent settled; the smoke's own op (opFail)
        // once the workflow leg can no longer reach it.
        const parent = ROLES[role].parent;
        if (!parent) continue;
        if (ROLES[role].by === 'smoke') {
          const blocked = wf.failLaunched || !agentOf(state, parent)?.dispatchId || readJson(stageFile(state, parent))?.ok === false
            || ['op', 'opFe'].some((r) => (seen[r] && settledOf(seen[r]) && !GREEN_STATUS.has(String(seen[r].status))) || (r in wf.checkpoints && !wf.checkpoints[r]));
          if (!blocked) open += 1; else if (!wf.failLaunched) releaseStageHold(state, 'kernel');
          continue;
        }
        const parentAgent = agentOf(state, parent);
        const stage = readJson(stageFile(state, parent));
        const gone = !parentAgent?.dispatchId || stage?.ok === false || (seen[parent] && settledOf(seen[parent]));
        if (!gone) open += 1;
      }
      // Both green ops alive at once: they ran in parallel in the one worktree.
      if (['op', 'opFe'].every((r) => agentOf(state, r)?.dispatchId) && readJson(stageFile(state, 'kernel'))?.concurrent === true) wf.parallel = true;
      await driveWorkflow({ wf, state, orca, seen, entry, root, script }); if (wf.reset) releaseStageHold(state, 'kernel');
      if (wf.failLaunched && agentOf(state, 'opFail')?.dispatchId && !wf.reset) open += 1;
      if (!open) break;
      if (now() >= deadline) { out.error = `timed out after ${timeoutMs}ms waiting for every smoke agent to settle`; break; }
      await sleep(pollMs);
    }
    for (const role of Object.keys(ROLES)) {
      const a = agentOf(state, role);
      if (!a?.dispatchId) { out.agents[role] = { launched: false, expectedDepth: ROLES[role].depth, error: a?.error ?? out.agents[role]?.error ?? readJson(stageFile(state, ROLES[role].parent ?? ''))?.error ?? 'never started' }; continue; }
      const read = settle(() => orca.workerRead({ dispatch: a.dispatchId, limit: 20 }));
      const o = observe(settle(() => orca.workerShow({ dispatch: a.dispatchId })));
      seen[role] = o;
      const parent = ROLES[role].parent;
      const creatorExpected = parent ? agentOf(state, parent)?.dispatchId ?? null : null;
      const result = fs.existsSync(resultFile(state, role)) ? fs.readFileSync(resultFile(state, role), 'utf8').trim() : null;
      out.agents[role] = {
        launched: a.ok === true, dispatchId: a.dispatchId, terminal: a.terminal ?? null, runId: a.runId ?? o.runId, taskId: a.taskId ?? o.taskId,
        creatorTerminal: a.creatorTerminal ?? null, effective: a.effective ?? null, ...(a.workspace ? { workspace: slash(a.workspace) } : {}),
        depth: o.depth, expectedDepth: ROLES[role].depth, creatorDispatchId: o.creatorDispatchId, expectedCreatorDispatchId: creatorExpected,
        status: o.status, state: o.state, workerDone: workerDoneOf(o),
        result, read: { ok: read?.ok === true, source: read?.source ?? null, liveness: read?.status?.liveness ?? null, rows: read?.rows?.length ?? 0, ...(read?.ok ? {} : { error: read?.error ?? null }) },
        ...(a.ok ? {} : { error: a.error ?? null, step: a.step ?? null }),
      };
    }
    // Every agent is released before the finish, so the host-side controller can remove the worktree their terminals ran in.
    cleanupAgents();
    if (wf.registered) {
      wf.finish = await settleAsync(() => orca.workflow.finish(orca.ctx, { workflowId }));
      // The finish never removes the worktree: it marks it release-pending, and the host-side controller removes it once
      // its terminals are released (link check, Orca's worktree removal, git branch -d). Main is compared after that.
      const row = settle(() => orca.workflow.of(orca.ctx, workflowId));
      wf.releasePending = row?.releasePending === true;
      let gone = null;
      for (const until = now() + releaseTimeoutMs; wf.finish?.ok;) {
        const listed = listedWorkflow(orca, wf.appRepo, wf);
        gone = { listed: listed.ok ? Boolean(listed.row) : null, pathExists: wf.path ? fs.existsSync(wf.path) : null };
        if (gone.listed === false && gone.pathExists === false) break;
        if (now() >= until) break;
        await sleep(pollMs);
      }
      const branch = wf.branch ? orca.git(['branch', '--list', wf.branch], appRepo) : { ok: false };
      wf.removed = { ...(gone ?? { listed: null, pathExists: wf.path ? fs.existsSync(wf.path) : null }),
        branchGone: branch.ok ? branch.stdout.trim() === '' : null, registry: settle(() => orca.workflow.of(orca.ctx, workflowId)) ?? null };
      const after = mainManifest({ appRoot: appRepo, git: orca.git });
      if (before.ok && after.ok) {
        const diff = manifestDiff(before, after);
        const ancestor = orca.git(['merge-base', '--is-ancestor', before.head, after.head], appRepo);
        wf.main = { before: before.head, after: after.head, ancestor: ancestor.ok, ...diff,
          // The committed blob, not the checkout's bytes: a core.autocrlf checkout rewrites line ends on disk.
          addedBytesOk: ['op', 'opFe'].every((role) => after.files[ownedFileOf(role, workflowId, feApp)] != null
            && orca.git(['show', `${after.head}:${ownedFileOf(role, workflowId, feApp)}`], appRepo).stdout === ownedTextOf(role, workflowId)) };
      } else wf.problems.push(`main manifest after: ${after.error ?? before.error}`);
    }
  } catch (error) {
    out.error = String(error?.message ?? error);
  } finally {
    cleanupAgents();
    // A workflow that never finished, or a worktree the controller never removed, is still given back (link check,
    // Orca's worktree removal, the row closed).
    if (wf.registered && !(wf.removed?.listed === false && wf.removed?.pathExists === false)) wf.released = await settleAsync(() => orca.workflow.release(orca.ctx, workflowId));
    safeRemoveTree(state, { hold: artifactHoldReason });
  }
  for (const [name, roles] of Object.entries(PATHS)) {
    const problems = [];
    for (const role of roles) {
      const a = out.agents[role] ?? {};
      if (!a.launched) { problems.push(`${role}: not started (${a.error ?? 'unknown'})`); continue; }
      if (a.depth !== a.expectedDepth) problems.push(`${role}: depth ${a.depth} != ${a.expectedDepth}`);
      if (a.expectedCreatorDispatchId && a.creatorDispatchId !== a.expectedCreatorDispatchId) problems.push(`${role}: creator ${a.creatorDispatchId} != ${a.expectedCreatorDispatchId}`);
      if (!a.result) problems.push(`${role}: no result line`);
      if (!a.workerDone) problems.push(`${role}: no worker_done (status ${a.status}, state ${a.state})`);
      if (!a.read?.ok) problems.push(`${role}: worker-read failed`);
    }
    for (const role of roles) {
      const c = out.cleanup.find((x) => x.role === role);
      if (out.agents[role]?.dispatchId && !c?.released) problems.push(`${role}: not released`);
    }
    if (name === 'workflow-worktree') problems.push(...workflowProblems(wf, spec));
    out.paths[name] = { status: problems.length ? 'failed' : 'ok', depths: Object.fromEntries(roles.map((r) => [r, out.agents[r]?.depth ?? null])), ...(problems.length ? { problems } : {}) };
  }
  out.ok = !out.error && Object.values(out.paths).every((p) => p.status === 'ok');
  out.ms = now() - startedAt;
  return out;
}

const argOf = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? null : null; };

async function main(argv) {
  const verb = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  if (verb === 'mark' || verb === 'stage') {
    const role = argOf(argv, 'as');
    if (!ROLES[role]) { console.error(`usage: launch-smoke.mjs ${verb} --as <${Object.keys(ROLES).join('|')}>`); return 2; }
    const { state, error } = await resolveState({ role });
    if (!state) { console.log(JSON.stringify({ ok: false, role, error })); return 1; }
    const r = verb === 'mark' ? markResult({ role, state }) : await runStage({ role, state, orca: await defaultClient(), holdMs: 240000 });
    console.log(JSON.stringify(r));
    return r.ok ? 0 : 1;
  }
  if (verb) { console.error(`unknown verb ${verb}`); return 2; }
  const timeout = Number(argOf(argv, 'timeout-ms'));
  const result = await runSmoke({ entry: argOf(argv, 'entry') || process.env.ORCA_TERMINAL_HANDLE || null, orca: await defaultClient(), appRepo: argOf(argv, 'app-repo'),
    ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: timeout } : {}) });
  const text = JSON.stringify(result, null, 2);
  const file = argOf(argv, 'out');
  if (file) fs.writeFileSync(file, `${text}\n`);
  console.log(text);
  return result.ok ? 0 : result.entry ? 1 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e?.stack ?? e); process.exitCode = 1; });
}
