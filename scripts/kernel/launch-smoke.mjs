#!/usr/bin/env node
// launch-smoke.mjs — the pre-workflow launch smoke (starci/launch-smoke@2): proves on the live Orca host that every
// nesting path the runtime uses starts its agents through orchestration worker-start, at the depth Orca reports, and that
// one Kernel workflow runs in ONE workflow worktree (contract change workflow-worktree).
//
//   supervisor-worker  entry (0) -> [Supervisor] (1) -> [Worker] (2)
//                      the [Worker] is started by scripts/agent/start-worker.mjs startWorkerAgent from the
//                      Supervisor's own terminal, in the Run that terminal creates and coordinates.
//   op-critic          entry (0) -> [Kernel] (1) -> [Op] be (2) -> draw critic (3)
//                      the [Op] is started the starci kernel dispatch way (scripts/agent/lib.mjs startAgent: run-create --from
//                      <kernel terminal>, worker-start --spec --run --from); the critic by
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
//                      branch gone); only then main's checkout holds exactly the two green files more, every other file unchanged.
//
// Every agent is a no-op on a priced model meeting its role floor; the Critic uses the independent draw-loop route:
// a leaf writes its result line (`mark`; an op also writes its owned file in the workflow worktree) and reports
// worker_done; a parent first runs its `stage` (which starts its children from the parent's own terminal, the way the
// runtime does) and then does the same. The smoke reads each worker back (worker-read), checks the depth and the creator
// Dispatch worker-show reports, then - deepest first - stops a worker that has not settled, releases every worker, closes a
// Task its worker did not settle, removes the critic's placement, finishes the workflow and waits for the host-side
// controller to remove its worktree (when the workflow never finished, or the controller never removed it, it releases the
// worktree through releaseWorkflowWorktree) and removes its own state directory. It prints one JSON result.
//
//   starci release launch-smoke --app-repo <app main checkout> [--entry <terminal>] [--timeout-ms <n>] [--out <file>]
//     the smoke; the entry is the terminal it runs in (ORCA_TERMINAL_HANDLE) - the owner's chat or a plain shell,
//     never an agent. The app repository is a SCRATCH app registered in Orca: the finish fast-forwards and pushes its
//     main with the smoke's two files. The reconciler must run (its host-side controller removes the worktree). Exit 0
//     when every path is ok, 1 otherwise, 2 with no entry terminal.
//   starci release launch-smoke stage --as <role>   (a parent agent runs it in its terminal)
//   starci release launch-smoke mark --as <role>    (every agent runs it: its result line)
// An agent's command names only its role: the smoke's state directory (under <os temp>/starci-launch-smoke/) is found
// by the agent's own terminal, ORCA_TERMINAL_HANDLE (resolveState). A random path in a spec is one an agent can mistype
// (the first live run: a Kernel dropped one character of it and its stage never ran).
//
// It is step `launch-smoke` of the pre-workflow readiness (docs/releasing.md "Pre-workflow readiness", docs/host-contract.md); it starts real agents, so it
// is run by hand once per runtime release, never by a check or a spec (tests/kernel/launch-smoke.spec.mjs fakes the client).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopAgent, smokeCriticOf } from './launch-smoke-models.mjs';
export { noopAgent } from './launch-smoke-models.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs'; import { lsFiles } from '../api/git/ls-files.mjs'; import { statusQuery as gitStatus } from '../api/git/status-query.mjs'; import { show as gitShow } from '../api/git/show.mjs'; import { branchList } from '../api/git/branch-list.mjs'; import { isAncestor } from '../api/git/is-ancestor.mjs'; import { gitResultOf } from '../lib/git.mjs';
import { holdStage, releaseStageHold } from './launch-smoke-hold.mjs'; import { isMain } from '../lib/is-main.mjs';
import { readEnv } from '../lib/env.mjs'; import { byCodeUnit } from '../lib/list.mjs';
import { writeJsonFile } from '../api/fs/write-json-file.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
import { bestEffortCall, bestEffortCallAsync } from '../agent/best-effort-call.mjs';
import { SMOKE_SCHEMA, ROLES, PATHS, CHILDREN, CLEANUP_ORDER, SETTLED_STATUS, ENDED_STATE, GREEN_STATUS, slash, stateParentOf, dirs, readJson, agentFile, stageFile, resultFile, planFile, planOf, agentOf,
  ownedFileOf, feAppOf, ownedTextOf, opRecordOf } from './launch-smoke-state.mjs';
import { pathVerdict } from './launch-smoke-verdict.mjs';
import { eachInOrder, repeatInOrder } from '../lib/in-order.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
export { SMOKE_SCHEMA, ROLES, CHILDREN, stateParentOf, agentOf, ownedFileOf, feAppOf, ownedTextOf } from './launch-smoke-state.mjs';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(SKILL_ROOT, 'scripts', 'kernel', 'launch-smoke.mjs');

/**
 * The Orca client: the runtime's own launchers, the scripts/api/orca wrappers and the workflow-worktree runtime
 * (scripts/kernel/workflow-worktree.mjs, scripts/kernel/workflow-checkpoint.mjs), each replaceable (specs). `ctx` is
 * the context those two modules take; `git` runs one git command ({ok, stdout, error}).
 */
export async function defaultClient() {
  const [lib, startWorker, critic, show, read, stop, release, update, list, wt, cp, tree] = await Promise.all([
    import('../agent/lib.mjs'), import('../agent/start-worker.mjs'), import('../work/draw-critic.mjs'),
    import('../api/orca/worker-show.mjs'), import('../api/orca/worker-read.mjs'), import('../api/orca/worker-stop.mjs'),
    import('../machine/worker-close.mjs'), import('../api/orca/task-update.mjs'),
    import('../api/orca/worktree-list.mjs'), import('./workflow-worktree.mjs'), import('./workflow-checkpoint.mjs'), import('../machine/workflow-tree.mjs')]);
  return {
    startAgent: lib.startAgent, startWorkerAgent: startWorker.startWorkerAgent,
    criticWorkspace: critic.criticWorkspace, removeCriticWorkspace: critic.removeCriticWorkspace, launchCriticWorker: critic.launchCriticWorker,
    workerShow: show.workerShow, workerRead: read.workerRead, workerStop: stop.workerStop, workerRelease: release.closeWorker,
    taskUpdate: update.taskUpdate, worktreeList: list.worktreeList,
    // The context of parts A and B. The smoke's ops are no-op agents, so no review.verify op runs: the smoke attests that
    // step itself through part B's `verify` seam, and the result says so (workflow.finish.steps).
    ctx: { verify: () => ({ ok: true, jobId: null, detail: 'launch smoke: its ops are no-op agents, no review.verify op runs' }) },
    workflow: {
      spec: wt.workflowWorktreeSpec, ensure: wt.ensureWorkflowWorktree, of: tree.workflowWorktreeOf, opArgs: wt.opWorktreeArgs,
      sideOf: wt.sideOf, canDispatchConcurrently: wt.canDispatchConcurrently, release: wt.releaseWorkflowWorktree,
      checkpointOp: cp.checkpointOp, gateBaseOf: tree.gateBaseOf, preserveAndReset: cp.preserveAndReset, finish: cp.finishWorkflow,
    },
    git: (args, dir) => smokeGit(args, dir),
  };
}
const SMOKE_CALLS = { 'rev-parse': revParseQuery, 'ls-files': lsFiles, status: gitStatus, show: gitShow, branch: (rest, options) => branchList(rest.filter((a) => a !== '--list'), options) }; /* the smoke's git calls by verb: the git seam takes the whole argv */ const smokeGit = ([verb, ...rest], dir) => (verb === 'merge-base' && rest[0] === '--is-ancestor' ? { ok: isAncestor(dir, rest[1], rest[2]), stdout: '', error: '' } : gitResultOf(SMOKE_CALLS[verb](rest, { dir })));

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
  const added = Object.keys(after.files).filter((f) => !(f in before.files)).sort(byCodeUnit);
  const removed = Object.keys(before.files).filter((f) => !(f in after.files) || after.files[f] === null).sort(byCodeUnit);
  const changed = Object.keys(before.files).filter((f) => f in after.files && after.files[f] !== null && after.files[f] !== before.files[f]).sort(byCodeUnit);
  return { added, changed, removed, nodeModulesSame: JSON.stringify(before.nodeModules) === JSON.stringify(after.nodeModules) };
}

/** The no-op Task spec of `role`: a parent runs its stage (starting its children), every agent marks its result line. */
export function noopSpec({ role, script = SCRIPT }) {
  const command = (verb) => `starci release launch-smoke ${verb} --as ${role}`;
  const report = '2. Then report worker_done exactly once, as your Orca worker preamble instructs: --outcome succeeded if the command exited 0, else --outcome failed.';
  const steps = CHILDREN[role]
    ? [`1. Run exactly: ${command('stage')}`,
      '   It starts more no-op agents and can take up to 3 minutes: give the command a timeout of at least 300 seconds (300000 ms) and wait for it to exit.',
      report]
    : [`1. Run exactly: ${command('mark')}`, report];
  return [
    `This is a no-op launch smoke (${SMOKE_SCHEMA}); you are its ${ROLES[role].title}. Do exactly these steps and nothing else:`,
    ...steps,
    'Do not read, edit, create or delete anything else, and start no other work. After worker_done, stay idle in this agent: never quit or exit it (the runtime releases your terminal; an agent that exits itself leaves Orca unable to prove its process stopped).',
  ].join('\n');
}
/** The critic's launch on draw-critic's own placement, in the runtime repository (no op job owns it: the smoke removes it). */
function launchCritic({ orca, noop, root, prompt, entry, record }) {
  const selected = smokeCriticOf(noop);
  const placed = selected.critic ? orca.criticWorkspace({ repoRoot: root, context: null }) : { ok: false, error: selected.error };
  if (!placed?.ok) return { ok: false, step: 'placement', error: `criticWorkspace: ${placed?.error ?? 'no placement'}` };
  record({ workspace: placed.dir, workspaceRepo: placed.repoRoot ?? null, workspaceOrcaId: placed.orcaId ?? null, workspaceBranch: placed.branch ?? null });
  return orca.launchCriticWorker({ critic: selected.critic, dir: placed.dir, prompt, entry });
}
/**
 * Start `role` from the terminal `entry` with the runtime launcher that path uses. Its terminal and Dispatch are
 * recorded in the state directory the moment Orca names them (onCreated), the full receipt after attestation. The Kernel
 * is started with the workflow worktree spec (Orca creates the worktree); an op role on the workflow worktree.
 */
async function launchRole({ role, state, entry, orca, root = SKILL_ROOT, script = SCRIPT }) {
  const plan = planOf(state);
  const noop = plan.noop;
  const prompt = noopSpec({ role, script });
  const { title } = ROLES[role];
  const objective = `${SMOKE_SCHEMA} ${role}`;
  const record = (extra) => writeJsonFile(agentFile(state, role), { ...agentOf(state, role), role, creatorTerminal: entry, ...extra });
  const onCreated = (terminal, dispatchId) => record({ terminal, dispatchId });
  const route = { provider: noop.provider, model: noop.model, effort: noop.effort };
  const request = { smoke: state, role }; let launched; // request: the launch's ledger identity (calls.yaml replay: request)
  if (role === 'worker') {
    launched = orca.startWorkerAgent({ route: { agent: noop.provider, model: noop.model, effort: noop.effort }, worktree: root, title, prompt, objective, entry, request, onCreated });
  } else if (role === 'critic') {
    launched = launchCritic({ orca, noop, root, prompt, entry, record });
  } else if (role === 'kernel') {
    // The workflow worktree exists before the Kernel starts (ensureWorkflowWorktree): an existing tree takes launch trust.
    launched = plan.workflow?.path
      ? orca.startAgent({ ...route, worktree: plan.workflow.path, title, prompt, objective, entry, request, onCreated })
      : { ok: false, step: 'worktree', error: 'the workflow worktree was never created' };
  } else if (ROLES[role].side) {
    const args = bestEffortCall(() => orca.workflow.opArgs(orca.ctx, { workflowId: plan.workflow?.workflowId }));
    const params = Array.isArray(args) ? worktreeParamsOf(args) : {};
    launched = params.worktree
      ? orca.startAgent({ ...route, worktree: params.worktree, title, prompt, objective, entry, request, onCreated })
      : { ok: false, step: 'worktree', error: `opWorktreeArgs: ${args?.error ?? 'no --worktree for the workflow'}` };
  } else {
    launched = orca.startAgent({ ...route, worktree: root, title, prompt, objective, entry, request, onCreated });
  }
  const r = await launched;
  record({ ok: r?.ok === true, terminal: r?.terminal ?? agentOf(state, role)?.terminal ?? null, dispatchId: r?.dispatchId ?? agentOf(state, role)?.dispatchId ?? null,
    runId: r?.runId ?? null, taskId: r?.taskId ?? null, effective: r?.effective ?? null,
    ...(r?.ok ? undefined : { error: r?.error ?? 'no launch receipt', step: r?.step ?? null, errorCode: r?.errorCode ?? null }) });
  return r;
}
/** The state directories under `parent` whose run launched `role` into the terminal `handle` (with no handle: and has not marked it yet). */
const smokeRunsLaunching = ({ role, handle, parent }) => {
  let runs = [];
  try { runs = fs.readdirSync(parent).map((n) => path.join(parent, n)).filter((d) => planOf(d)); } catch { runs = []; }
  const launched = runs.filter((d) => agentOf(d, role));
  return handle ? launched.filter((d) => agentOf(d, role).terminal === handle) : launched.filter((d) => !fs.existsSync(resultFile(d, role)));
};
/** Sleeps between checks while `waiting()` holds and `now()` is before `deadline`; `refresh` runs after each sleep. */
const sleepWhile = (waiting, { deadline, now, sleep, refresh = null }) => repeatInOrder(async () => {
  if (!(waiting() && now() < deadline)) return true;
  await sleep(500);
  refresh?.();
  return undefined;
});
/**
 * The state directory of the smoke run that launched `role` into this terminal: the run under `parent` whose
 * agents/<role>.json names ORCA_TERMINAL_HANDLE; with no handle in the environment, the one run whose `role` is
 * launched and not yet marked. A launch is recorded after attestation at the latest, so it waits up to `waitMs`.
 * {state} | {error}.
 */
export async function resolveState({ role, env = process.env, parent = stateParentOf(), waitMs = 60000, sleep = defaultSleep, now = Date.now }) {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  const deadline = now() + waitMs;
  return repeatInOrder(async () => {
    const mine = smokeRunsLaunching({ role, handle, parent });
    if (mine.length === 1) return { state: mine[0] };
    if (mine.length > 1) return { error: `${mine.length} smoke runs launched ${role}${handle ? ' into ' + handle : ''}: ${mine.map(slash).join(', ')}` };
    if (now() >= deadline) return { error: `no smoke run under ${slash(parent)} launched ${role}${handle ? ' into terminal ' + handle : ''}` };
    await sleep(500);
    return undefined;
  });
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
  return r.fails ? { ok: false, role, owned, error: 'this op fails on purpose (the preserve-and-reset leg)' } : { ok: true, role, ...(owned ? { owned } : undefined) };
}
/** Whether the dispatcher admits this stage's op children concurrently (same-side serial, cross-side parallel). */
const concurrentOps = (ops, wf, orca) => ops.map((c) => opRecordOf(c, wf.workflowId, wf.feApp))
  .every((next, i, records) => i === 0 || bestEffortCall(() => orca.workflow.canDispatchConcurrently(records.slice(0, i), next)) === true);
/**
 * `stage`: run by a parent agent in its own terminal. It starts the parent's children, in parallel, with `entry` = that
 * terminal (ORCA_TERMINAL_HANDLE, which must be the terminal the launcher recorded for the role), then marks the parent's
 * result line. The Kernel's stage first waits for the workflow worktree to be recorded and asks the dispatcher whether
 * its children may run together. {ok, role, children, entry, error?}; also written to stages/<role>.json.
 */
export async function runStage({ role, state, orca, env = process.env, root = SKILL_ROOT, script = SCRIPT, waitMs = 60000, holdMs = 0, sleep = defaultSleep, now = Date.now }) {
  const children = CHILDREN[role];
  const done = (receipt) => { writeJsonFile(stageFile(state, role), receipt); return receipt; };
  if (!children) return done({ ok: false, role, error: `${role} has no child to start` });
  let recorded = agentOf(state, role);
  await sleepWhile(() => !recorded?.terminal, { deadline: now() + waitMs, now, sleep, refresh: () => { recorded = agentOf(state, role); } });
  const own = env.ORCA_TERMINAL_HANDLE || null;
  const entry = own ?? recorded?.terminal ?? null;
  if (!entry) return done({ ok: false, role, error: 'no terminal: neither ORCA_TERMINAL_HANDLE nor a recorded launch names this agent' });
  if (own && recorded?.terminal && own !== recorded.terminal) {
    return done({ ok: false, role, entry, error: `ORCA_TERMINAL_HANDLE ${own} is not the terminal ${recorded.terminal} the launcher recorded for ${role}` });
  }
  const ops = children.filter((c) => ROLES[c].side);
  let concurrent = null;
  if (ops.length) {
    await sleepWhile(() => !planOf(state)?.workflow?.path, { deadline: now() + waitMs, now, sleep });
    const wf = planOf(state)?.workflow;
    if (!wf?.path) return done({ ok: false, role, entry, error: 'the workflow worktree was never recorded (not in orca worktree list)' });
    concurrent = concurrentOps(ops, wf, orca);
    if (!concurrent) return done({ ok: false, role, entry, concurrent, error: `the dispatcher refuses ${ops.join(' and ')} together (they must run in parallel across sides)` });
  }
  const launched = await Promise.all(children.map((c) => launchRole({ role: c, state, entry, orca, root, script })));
  markResult({ role, state, now }); if (role === 'kernel') await holdStage({ state, role, holdMs, sleep, now });
  const failed = children.filter((c, i) => launched[i]?.ok !== true);
  return done({ ok: failed.length === 0, role, children, entry, ...(concurrent === null ? undefined : { concurrent }),
    dispatchIds: Object.fromEntries(children.map((c, i) => [c, launched[i]?.dispatchId ?? null])),
    ...(failed.length ? { error: failed.map((c) => `${c}: ${launched[children.indexOf(c)]?.error ?? 'no launch receipt'}`).join('; ') } : undefined) });
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
const dispatchSettledOf = (o) => SETTLED_STATUS.has(String(o?.status)) && String(o?.state) !== 'stopped';
const settledOf = (o) => SETTLED_STATUS.has(String(o?.status)) || ENDED_STATE.has(String(o?.state));
/** The workflow's Orca worktree in `orca worktree list` (by its Orca id, else its path), or null. */
function listedWorkflow(orca, appRepo, wf) {
  const listed = bestEffortCall(() => orca.worktreeList({ repo: `path:${slash(path.resolve(appRepo))}` }));
  const rows = listed?.worktrees ?? [];
  const key = (p) => (p ? slash(path.resolve(p)).toLowerCase() : null);
  const row = rows.find((w) => wf.orcaWorktreeId && w.id === wf.orcaWorktreeId) ?? rows.find((w) => wf.path && key(w.path) === key(wf.path)) ?? null;
  return { ok: listed?.ok === true, row, error: listed?.ok ? null : listed?.error ?? 'worktree list failed' };
}
/** Start the failing op from the Kernel's terminal once both green ops are checkpointed (one shot, via wf.failLaunched). */
async function launchFailOp({ wf, spec, state, orca, root, script }) {
  const fail = opRecordOf('opFail', spec.workflowId, spec.feApp);
  // Same side is serial: the dispatcher refuses opFail beside a running be op, and admits it beside the fe op.
  wf.concurrency.beBeside = bestEffortCall(() => orca.workflow.canDispatchConcurrently([opRecordOf('op', spec.workflowId, spec.feApp)], fail));
  wf.concurrency.feBeside = bestEffortCall(() => orca.workflow.canDispatchConcurrently([opRecordOf('opFe', spec.workflowId, spec.feApp)], fail));
  wf.concurrency.sides = { op: bestEffortCall(() => orca.workflow.sideOf(opRecordOf('op', spec.workflowId, spec.feApp))), opFe: bestEffortCall(() => orca.workflow.sideOf(opRecordOf('opFe', spec.workflowId, spec.feApp))) };
  wf.failLaunched = true;
  const kernelTerminal = agentOf(state, 'kernel')?.terminal ?? null;
  if (kernelTerminal) await launchRole({ role: 'opFail', state, entry: kernelTerminal, orca, root, script });
  else wf.problems.push('opFail: the Kernel has no terminal to start it from');
}
/** preserveAndReset the settled failing op and record every proof of the reset in `wf.reset`. */
async function resetFailOp({ wf, spec, orca }) {
  const lastCheckpoint = bestEffortCall(() => orca.workflow.of(orca.ctx, spec.workflowId))?.checkpoint ?? null;
  const r = await bestEffortCallAsync(() => orca.workflow.preserveAndReset(orca.ctx, { workflowId: spec.workflowId, opId: 'opFail' }));
  const file = ownedFileOf('opFail', spec.workflowId, spec.feApp);
  const head = orca.git(['rev-parse', 'HEAD'], wf.path);
  const status = orca.git(['status', '--porcelain', '--untracked-files=all'], wf.path);
  const kept = r?.preservedRef ? orca.git(['show', `${r.preservedRef}:${file}`, '--'], wf.path) : { ok: false };
  wf.reset = { preservedRef: r?.preservedRef ?? null, resetTo: r?.resetTo ?? null, lastCheckpoint, head: head.ok ? head.stdout.trim() : null,
    clean: status.ok && status.stdout.trim() === '', fileGone: !fs.existsSync(path.join(wf.path, file)),
    preservedHasFile: kept.ok && kept.stdout === ownedTextOf('opFail', spec.workflowId), ...(r?.ok === false ? { error: r.error ?? r.refusal ?? null } : undefined) };
}
/**
 * The workflow leg the smoke drives as the dispatcher and settler would: register the Kernel's worktree once Orca lists
 * it; checkpoint each green op (the gate base before and after); start the failing op once no be op runs; preserve and
 * reset it. One call per poll; every step is recorded in `wf` and runs once.
 */
async function driveWorkflow({ wf, state, orca, seen, entry, root, script }) {
  const spec = planOf(state).workflow;
  const ctx = orca.ctx;
  if (!wf.registered) return;
  await eachInOrder(['op', 'opFe'], async (role) => {
    if (role in wf.checkpoints || !GREEN_STATUS.has(String(seen[role]?.status))) return;
    const base = await bestEffortCallAsync(() => orca.workflow.gateBaseOf(ctx, spec.workflowId));
    const cp = await bestEffortCallAsync(() => orca.workflow.checkpointOp(ctx, { workflowId: spec.workflowId, opId: role }));
    const after = await bestEffortCallAsync(() => orca.workflow.gateBaseOf(ctx, spec.workflowId));
    wf.checkpoints[role] = cp?.sha ?? null;
    wf.gateBases[role] = { before: typeof base === 'string' ? base : base?.sha ?? null, after: typeof after === 'string' ? after : after?.sha ?? null };
    if (!cp?.sha) wf.problems.push(`checkpointOp ${role}: ${cp?.error ?? cp?.refusal ?? 'no sha'}`);
  });
  if (!wf.failLaunched && wf.checkpoints.op && wf.checkpoints.opFe) await launchFailOp({ wf, spec, state, orca, root, script });
  if (wf.failLaunched && !wf.reset && SETTLED_STATUS.has(String(seen.opFail?.status))) await resetFailOp({ wf, spec, orca });
}
/** The checks and the workflow worktree every smoke run starts from: {result} when it cannot start, else the context the run records. */
async function prepareSmoke({ out, entry, orca, appRepo, root, noop, workflowId, stateRoot }) {
  if (!entry) return { result: { ...out, error: 'no entry terminal: run the smoke inside an Orca terminal (ORCA_TERMINAL_HANDLE) or pass --entry' } };
  if (noop?.error) return { result: { ...out, error: noop.error } };
  if (!appRepo) return { result: { ...out, error: 'no app repository: pass --app-repo <the main checkout of a scratch app registered in Orca>' } };
  const feApp = feAppOf(appRepo);
  if (!feApp) return { result: { ...out, error: `the app ${slash(appRepo)} declares no fe application in hfs.json (sides.fe.apps): the fe op has nowhere to write` } };
  const spec = bestEffortCall(() => orca.workflow.spec({ workflowId, appRepo }));
  if (!spec?.name) return { result: { ...out, error: `workflowWorktreeSpec: ${spec?.error ?? 'no worktree spec'}` } };
  // main's bytes before anything is created, then the workflow worktree, as start-workflow makes it before the Kernel.
  const before = mainManifest({ appRoot: appRepo, git: orca.git });
  const ensured = await bestEffortCallAsync(() => orca.workflow.ensure(orca.ctx, { workflowId, appRepo }));
  const rec = ensured?.ok ? ensured.record : null;
  if (!rec?.path) return { result: { ...out, error: `ensureWorkflowWorktree: ${ensured?.reason ?? ensured?.error ?? 'no worktree'}${ensured?.detail ? ' (' + ensured.detail + ')' : ''}` } };
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
  writeJsonFile(planFile(state), { schema: SMOKE_SCHEMA, root: slash(root), entry, noop: out.noop, appRepo: slash(appRepo),
    workflow: { workflowId, feApp, name: spec.name, branch: wf.branch, path: wf.path, orcaWorktreeId: wf.orcaWorktreeId } });
  if (!before.ok) wf.problems.push(`main manifest before: ${before.error}`);
  return { result: null, spec, wf, before, state, feApp };
}
const unplace = (orca, a) => bestEffortCall(() => orca.removeCriticWorkspace({ dir: a.workspace, repoRoot: a.workspaceRepo ?? null, orcaId: a.workspaceOrcaId ?? null, branch: a.workspaceBranch ?? null }))?.ok === true;
/** Release one launched agent (stop, release, task close, critic workspace) and record it in out.cleanup. */
const releaseAttempt = ({ orca, out, role, a }) => {
  const o = observe(bestEffortCall(() => orca.workerShow({ dispatch: a.dispatchId })));
  const settled = settledOf(o);
  const stop = settled ? null : bestEffortCall(() => orca.workerStop({ dispatch: a.dispatchId }));
  // The one close path (scripts/machine/worker-close.mjs) repeats a refused release once itself and proves the terminal and its processes gone.
  const release = bestEffortCall(() => orca.workerRelease({ dispatch: a.dispatchId, retryRelease: true }));
  // A worker that reported worker_done settled its Dispatch, and with it its own Task (worker-show status).
  const reported = SETTLED_STATUS.has(String(o.status));
  const task = reported || !a.taskId ? null : bestEffortCall(() => orca.taskUpdate({ id: a.taskId, status: 'failed', ...(a.runId ? { run: a.runId } : undefined), ...(a.creatorTerminal ? { from: a.creatorTerminal } : undefined) }));
  let taskClosed = null;
  if (task) taskClosed = task.ok === true;
  else if (reported) taskClosed = 'by-worker_done';
  const entryOut = { role, dispatchId: a.dispatchId, stopped: stop ? stop.ok === true : null, released: release?.ok === true, taskClosed,
    ...(release?.retryRelease ? { releaseRetried: true } : undefined), ...(release?.ok ? undefined : { releaseState: release?.state ?? null, releaseError: release?.result?.lastError ?? release?.error ?? release?.outcome ?? null }) };
  if (a.workspace) entryOut.workspaceRemoved = unplace(orca, a);
  out.cleanup.push(entryOut);
};
/** The once-only release of every launched agent, deepest first (the returned function). */
const agentCleanup = ({ orca, out, state }) => {
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    for (const role of CLEANUP_ORDER) {
      const a = agentOf(state, role);
      if (a?.workspace && !a?.dispatchId) out.cleanup.push({ role, workspaceRemoved: unplace(orca, a) });
      if (!a?.dispatchId) continue;
      releaseAttempt({ orca, out, role, a });
    }
  };
};
/** One settled role's out.agents row (worker-read, worker-show, result line, launch receipt). */
const agentReport = (role, a, o, read, creatorExpected, result) => ({ launched: a.ok === true, dispatchId: a.dispatchId, terminal: a.terminal ?? null,
  runId: a.runId ?? o.runId, taskId: a.taskId ?? o.taskId, creatorTerminal: a.creatorTerminal ?? null, effective: a.effective ?? null,
  ...(a.workspace ? { workspace: slash(a.workspace) } : undefined), depth: o.depth, expectedDepth: ROLES[role].depth,
  creatorDispatchId: o.creatorDispatchId, expectedCreatorDispatchId: creatorExpected, status: o.status, state: o.state, workerDone: dispatchSettledOf(o),
  result, read: { ok: read?.ok === true, source: read?.source ?? null, liveness: read?.status?.liveness ?? null, rows: read?.rows?.length ?? 0, ...(read?.ok ? undefined : { error: read?.error ?? null }) },
  ...(a.ok ? undefined : { error: a.error ?? null, step: a.step ?? null }) });
/** The smoke's own op role stays open until the workflow leg can no longer reach it (the Kernel's stage hold is released then). */
const smokeRoleOpen = ({ state, parent, seen, wf }) => {
  const blocked = wf.failLaunched || !agentOf(state, parent)?.dispatchId || readJson(stageFile(state, parent))?.ok === false
    || ['op', 'opFe'].some((r) => (seen[r] && settledOf(seen[r]) && !GREEN_STATUS.has(String(seen[r].status))) || (r in wf.checkpoints && !wf.checkpoints[r]));
  if (blocked && !wf.failLaunched) releaseStageHold(state, 'kernel');
  return blocked ? 0 : 1;
};
/** 1 while `role` can still settle, 0 once it settled or can no longer appear (its parent never started, its stage failed or its parent settled). */
const roleOpen = ({ role, state, orca, seen, wf }) => {
  const a = agentOf(state, role);
  if (a?.dispatchId) {
    seen[role] = observe(bestEffortCall(() => orca.workerShow({ dispatch: a.dispatchId })));
    return settledOf(seen[role]) ? 0 : 1;
  }
  // A top role is launched synchronously: no Dispatch now means it never started. A stage child can no longer
  // appear once its parent never started, its stage failed, or its parent settled; the smoke's own op (opFail)
  // once the workflow leg can no longer reach it.
  const parent = ROLES[role].parent;
  if (!parent) return 0;
  if (ROLES[role].by === 'smoke') return smokeRoleOpen({ state, parent, seen, wf });
  const parentAgent = agentOf(state, parent);
  const stage = readJson(stageFile(state, parent));
  const gone = !parentAgent?.dispatchId || stage?.ok === false || (seen[parent] && settledOf(seen[parent]));
  return gone ? 0 : 1;
};
/** Polls until every role has settled or can no longer appear, driving the workflow leg once per poll; a timeout is recorded in out.error. */
const pollUntilSettled = ({ out, wf, state, orca, seen, entry, root, script, now, sleep, pollMs, timeoutMs }) => {
  const deadline = now() + timeoutMs;
  // Wait until every role has settled, or can no longer appear (its parent settled, failed to launch, or its stage failed).
  return repeatInOrder(async () => {
    let open = 0;
    for (const role of Object.keys(ROLES)) open += roleOpen({ role, state, orca, seen, wf });
    // Both green ops alive at once: they ran in parallel in the one worktree.
    if (['op', 'opFe'].every((r) => agentOf(state, r)?.dispatchId) && readJson(stageFile(state, 'kernel'))?.concurrent === true) wf.parallel = true;
    await driveWorkflow({ wf, state, orca, seen, entry, root, script }); if (wf.reset) releaseStageHold(state, 'kernel');
    if (wf.failLaunched && agentOf(state, 'opFail')?.dispatchId && !wf.reset) open += 1;
    if (!open) return true;
    if (now() >= deadline) { out.error = `timed out after ${timeoutMs}ms waiting for every smoke agent to settle`; return true; }
    await sleep(pollMs);
    return undefined;
  });
};
/** Reads every role back (worker-read, worker-show, result line) into out.agents. */
const collectAgents = ({ out, state, orca, seen }) => {
  for (const role of Object.keys(ROLES)) {
    const a = agentOf(state, role);
    if (!a?.dispatchId) { out.agents[role] = { launched: false, expectedDepth: ROLES[role].depth, error: a?.error ?? out.agents[role]?.error ?? readJson(stageFile(state, ROLES[role].parent ?? ''))?.error ?? 'never started' }; continue; }
    const read = bestEffortCall(() => orca.workerRead({ dispatch: a.dispatchId, limit: 20 }));
    const o = observe(bestEffortCall(() => orca.workerShow({ dispatch: a.dispatchId })));
    seen[role] = o;
    const parent = ROLES[role].parent;
    const creatorExpected = parent ? agentOf(state, parent)?.dispatchId ?? null : null;
    const result = fs.existsSync(resultFile(state, role)) ? fs.readFileSync(resultFile(state, role), 'utf8').trim() : null;
    out.agents[role] = agentReport(role, a, o, read, creatorExpected, result);
  }
};
/** The comparison of the app's main with its bytes before the run (wf.main). */
const compareMain = ({ wf, orca, before, appRepo, workflowId, feApp }) => {
  const after = mainManifest({ appRoot: appRepo, git: orca.git });
  if (before.ok && after.ok) {
    const diff = manifestDiff(before, after);
    const ancestor = orca.git(['merge-base', '--is-ancestor', before.head, after.head], appRepo);
    wf.main = { before: before.head, after: after.head, ancestor: ancestor.ok, ...diff,
      // The committed blob, not the checkout's bytes: a core.autocrlf checkout rewrites line ends on disk.
      addedBytesOk: ['op', 'opFe'].every((role) => after.files[ownedFileOf(role, workflowId, feApp)] != null
        && orca.git(['show', `${after.head}:${ownedFileOf(role, workflowId, feApp)}`, '--'], appRepo).stdout === ownedTextOf(role, workflowId)) };
  } else wf.problems.push(`main manifest after: ${after.error ?? before.error}`);
};
/** Polls the host-side removal of the workflow worktree after the finish; the last {listed, pathExists} or null. */
const awaitWorktreeRemoval = async ({ wf, orca, now, sleep, pollMs, releaseTimeoutMs }) => {
  let gone = null;
  const until = now() + releaseTimeoutMs;
  await repeatInOrder(async () => {
    if (!wf.finish?.ok) return true;
    const listed = listedWorkflow(orca, wf.appRepo, wf);
    gone = { listed: listed.ok ? Boolean(listed.row) : null, pathExists: wf.path ? fs.existsSync(wf.path) : null };
    if (gone.listed === false && gone.pathExists === false) return true;
    if (now() >= until) return true;
    await sleep(pollMs);
    return undefined;
  });
  return gone;
};
/** finishWorkflow, the wait for the host-side removal of the worktree, and the comparison of main. */
const finishLeg = async ({ wf, orca, workflowId, appRepo, feApp, before, now, sleep, pollMs, releaseTimeoutMs }) => {
  wf.finish = await bestEffortCallAsync(() => orca.workflow.finish(orca.ctx, { workflowId }));
  // The finish never removes the worktree: it marks it release-pending, and the host-side controller removes it once
  // its terminals are released (link check, Orca's worktree removal, git branch -d). Main is compared after that.
  const row = bestEffortCall(() => orca.workflow.of(orca.ctx, workflowId));
  wf.releasePending = row?.releasePending === true;
  const gone = await awaitWorktreeRemoval({ wf, orca, now, sleep, pollMs, releaseTimeoutMs });
  const branch = wf.branch ? orca.git(['branch', '--list', wf.branch], appRepo) : { ok: false };
  wf.removed = { ...(gone ?? { listed: null, pathExists: wf.path ? fs.existsSync(wf.path) : null }),
    branchGone: branch.ok ? branch.stdout.trim() === '' : null, registry: bestEffortCall(() => orca.workflow.of(orca.ctx, workflowId)) ?? null };
  compareMain({ wf, orca, before, appRepo, workflowId, feApp });
};
/**
 * The smoke. `entry` the coordinator terminal; `orca` the client (defaultClient); `appRepo` the scratch app's main
 * checkout (also its Orca repository selector); `timeoutMs` bounds the wait for every agent to settle. Returns the
 * starci/launch-smoke@2 result; never throws.
 */
export async function runSmoke({ entry = readEnv('ORCA_TERMINAL_HANDLE') || null, orca, appRepo = null, root = SKILL_ROOT, script = SCRIPT, noop = noopAgent(),
  timeoutMs = 1200000, releaseTimeoutMs = 600000, pollMs = 5000, sleep = defaultSleep, now = Date.now, stateRoot = tempRoot(), workflowId = `smoke-${Date.now().toString(36)}` }) {
  const startedAt = now();
  const out = { schema: SMOKE_SCHEMA, ok: false, entry, noop: noop?.error ? null : { provider: noop.provider, model: noop.model, effort: noop.effort },
    paths: {}, agents: {}, workflow: null, cleanup: [], error: null };
  const prepared = await prepareSmoke({ out, entry, orca, appRepo, root, noop, workflowId, stateRoot });
  if (prepared.result) return prepared.result;
  const { spec, wf, before, state, feApp } = prepared;
  const seen = {};
  const cleanupAgents = agentCleanup({ orca, out, state });
  try {
    await eachInOrder(['supervisor', 'kernel'], async (top) => {
      const r = await launchRole({ role: top, state, entry, orca, root, script });
      if (!r?.ok) out.agents[top] = { launched: false, error: r?.error ?? 'no launch receipt' };
    });
    await pollUntilSettled({ out, wf, state, orca, seen, entry, root, script, now, sleep, pollMs, timeoutMs });
    collectAgents({ out, state, orca, seen });
    // Every agent is released before the finish, so the host-side controller can remove the worktree their terminals ran in.
    cleanupAgents();
    if (wf.registered) await finishLeg({ wf, orca, workflowId, appRepo, feApp, before, now, sleep, pollMs, releaseTimeoutMs });
  } catch (error) {
    out.error = String(error?.message ?? error);
  } finally {
    cleanupAgents();
    // A workflow that never finished, or a worktree the controller never removed, is still given back (link check,
    // Orca's worktree removal, the row closed).
    if (wf.registered && !(wf.removed?.listed === false && wf.removed?.pathExists === false)) wf.released = await bestEffortCallAsync(() => orca.workflow.release(orca.ctx, workflowId));
    safeRemove(state, { hold: artifactHoldReason });
  }
  for (const [name, roles] of Object.entries(PATHS)) out.paths[name] = pathVerdict(name, roles, { out, wf, spec });
  out.ok = !out.error && Object.values(out.paths).every((p) => p.status === 'ok');
  out.ms = now() - startedAt;
  return out;
}
const argOf = (argv, name) => valueAfter(argv, `--${name}`);
/** `mark` / `stage` as a child agent's own terminal runs them. */
const runRoleVerb = async (argv, verb) => {
  const role = argOf(argv, 'as');
  if (!ROLES[role]) { console.error(`usage: starci release launch-smoke ${verb} --as <${Object.keys(ROLES).join('|')}>`); return 2; }
  const { state, error } = await resolveState({ role });
  if (!state) { console.log(JSON.stringify({ ok: false, role, error })); return 1; }
  const r = verb === 'mark' ? markResult({ role, state }) : await runStage({ role, state, orca: await defaultClient(), holdMs: 240000 });
  console.log(JSON.stringify(r));
  return r.ok ? 0 : 1;
};
async function main(argv) {
  const verb = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  if (verb === 'mark' || verb === 'stage') return runRoleVerb(argv, verb);
  if (verb) { console.error(`unknown verb ${verb}`); return 2; }
  const timeout = Number(argOf(argv, 'timeout-ms'));
  const result = await runSmoke({ entry: argOf(argv, 'entry') || readEnv('ORCA_TERMINAL_HANDLE') || null, orca: await defaultClient(), appRepo: argOf(argv, 'app-repo'),
    ...(Number.isFinite(timeout) && timeout > 0 ? { timeoutMs: timeout } : undefined) });
  const text = JSON.stringify(result, null, 2);
  const file = argOf(argv, 'out');
  if (file) fs.writeFileSync(file, `${text}\n`);
  console.log(text);
  if (result.ok) return 0;
  return result.entry ? 1 : 2;
}
if (isMain(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { console.error(e?.stack ?? e); process.exitCode = 1; }
}
