#!/usr/bin/env node
// launch-smoke.mjs — the pre-workflow launch smoke (starci/launch-smoke@1): proves on the live Orca host that every
// nesting path the runtime uses starts its agents through orchestration worker-start, at the depth Orca reports.
//
//   supervisor-worker  entry (0) -> [Supervisor] (1) -> [Worker] (2)
//                      the [Worker] is started by scripts/supervisor/workers.mjs startWorkerAgent from the
//                      Supervisor's own terminal, in the Run that terminal creates and coordinates.
//   op-critic          entry (0) -> [Kernel] (1) -> [Op] (2) -> draw critic (3)
//                      the [Op] is started the api dispatch way (scripts/agent/lib.mjs startAgent: run-create --from
//                      <kernel terminal>, task-create --run --from, worker-start --task --run --from); the critic by
//                      scripts/work/draw-critic.mjs launchCriticWorker on its criticWorkspace placement, from the Op's
//                      terminal.
//
// Every agent is a no-op on the cheapest model modules/models/runtimes.yaml pins (priced by modules/models/prices.yaml):
// a leaf writes one line to its result file (`mark`) and reports worker_done; a parent first runs its `stage` (which
// starts its one child from the parent's own terminal, the way the runtime does) and then does the same. The smoke reads
// each worker back (worker-read), checks the depth and the creator Dispatch worker-show reports, then - always, in a
// finally, deepest first - stops a worker that has not settled, releases every worker, closes a Task its worker did not
// settle, and removes the critic's placement and its own state directory. It prints one JSON result.
//
//   node scripts/kernel/launch-smoke.mjs [--entry <terminal>] [--timeout-ms <n>] [--out <file>]
//     the smoke; the entry is the terminal it runs in (ORCA_TERMINAL_HANDLE) - the owner's chat or a plain shell,
//     never an agent. Exit 0 when every path is ok, 1 otherwise, 2 with no entry terminal.
//   node scripts/kernel/launch-smoke.mjs stage --as <role>   (a parent agent runs it in its terminal)
//   node scripts/kernel/launch-smoke.mjs mark --as <role>    (every agent runs it: its result line)
// An agent's command names only its role: the smoke's state directory (under <os temp>/starci-launch-smoke/) is found
// by the agent's own terminal, ORCA_TERMINAL_HANDLE (resolveState). A random path in a spec is one an agent can mistype
// (the first live run: a Kernel dropped one character of it and its stage never ran).
//
// It is step `launch-smoke` of the pre-workflow readiness (docs/releasing.md "Pre-workflow readiness", docs/host-contract.md); it starts real agents, so it
// is run by hand once per runtime release, never by a check or a spec (tests/launch-smoke.spec.mjs fakes the client).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeProfile } from '../../engine/config.mjs';
import { loadPrices, priceOf } from '../lib/llm-usage.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';

export const SMOKE_SCHEMA = 'starci/launch-smoke@1';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(SKILL_ROOT, 'scripts', 'kernel', 'launch-smoke.mjs');
const slash = (p) => String(p).replaceAll('\\', '/');

/** Each role: its depth under the entry, its parent role, its title. */
export const ROLES = Object.freeze({
  supervisor: { depth: 1, parent: null, title: '[Supervisor] launch smoke' },
  worker: { depth: 2, parent: 'supervisor', title: '[Worker] launch smoke' },
  kernel: { depth: 1, parent: null, title: '[Kernel] launch smoke' },
  op: { depth: 2, parent: 'kernel', title: '[Op] launch smoke' },
  critic: { depth: 3, parent: 'op', title: '[Critic] launch smoke' },
});
export const PATHS = Object.freeze({ 'supervisor-worker': ['supervisor', 'worker'], 'op-critic': ['kernel', 'op', 'critic'] });
const CHILD = Object.freeze(Object.fromEntries(Object.entries(ROLES).filter(([, r]) => r.parent).map(([role, r]) => [r.parent, role])));
// Deepest first: a child is settled and released while its creator's terminal still exists.
const CLEANUP_ORDER = Object.freeze(['critic', 'op', 'worker', 'kernel', 'supervisor']);
// worker-show: a Dispatch that will do nothing more.
const SETTLED_STATUS = new Set(['completed', 'succeeded', 'failed', 'cancelled']);
const ENDED_STATE = new Set(['done', 'completed', 'succeeded', 'failed', 'stopped', 'released', 'exited']);
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

/** The Orca client: the runtime's own launchers and the scripts/api/orca wrappers, each replaceable (specs). */
export async function defaultClient() {
  const [lib, workers, critic, show, read, stop, release, update, inbox] = await Promise.all([
    import('../agent/lib.mjs'), import('../supervisor/workers.mjs'), import('../work/draw-critic.mjs'),
    import('../api/orca/worker-show.mjs'), import('../api/orca/worker-read.mjs'), import('../api/orca/worker-stop.mjs'),
    import('../api/orca/worker-release.mjs'), import('../api/orca/task-update.mjs'), import('../api/orca/orch-inbox.mjs')]);
  return {
    startAgent: lib.startAgent, startWorkerAgent: workers.startWorkerAgent,
    criticWorkspace: critic.criticWorkspace, removeCriticWorkspace: critic.removeCriticWorkspace, launchCriticWorker: critic.launchCriticWorker,
    workerShow: show.workerShow, workerRead: read.workerRead, workerStop: stop.workerStop, workerRelease: release.workerRelease,
    taskUpdate: update.taskUpdate, inbox: inbox.orchInbox,
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
export const planOf = (state) => readJson(path.join(state, 'plan.json'));
export const agentOf = (state, role) => readJson(agentFile(state, role));
const settle = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

/** The no-op Task spec of `role`: a parent runs its stage (starting its child), every agent marks its result line. */
export function noopSpec({ role, script = SCRIPT }) {
  const node = (verb) => `node "${slash(script)}" ${verb} --as ${role}`;
  const steps = CHILD[role]
    ? [`1. Run exactly: ${node('stage')}`,
      '   It starts one more no-op agent and can take up to 3 minutes: give the command a timeout of at least 300 seconds (300000 ms) and wait for it to exit.',
      '2. Then report worker_done exactly once, as your Orca worker preamble instructs: --outcome succeeded if the command exited 0, else --outcome failed.']
    : [`1. Run exactly: ${node('mark')}`,
      '2. Then report worker_done exactly once, as your Orca worker preamble instructs: --outcome succeeded if the command exited 0, else --outcome failed.'];
  return [
    `This is a no-op launch smoke (${SMOKE_SCHEMA}); you are its ${ROLES[role].title}. Do exactly these steps and nothing else:`,
    ...steps,
    'Do not read, edit, create or delete anything else, and start no other work. After worker_done, stop and idle.',
  ].join('\n');
}

/**
 * Start `role` from the terminal `entry` with the runtime launcher that path uses. Its terminal and Dispatch are
 * recorded in the state directory the moment Orca names them (onCreated), the full receipt after attestation.
 */
export function launchRole({ role, state, entry, orca, root = SKILL_ROOT, script = SCRIPT }) {
  const plan = planOf(state);
  const noop = plan.noop;
  const prompt = noopSpec({ role, script });
  const { title } = ROLES[role];
  const objective = `${SMOKE_SCHEMA} ${role}`;
  const record = (extra) => writeJson(agentFile(state, role), { ...(agentOf(state, role) ?? {}), role, creatorTerminal: entry, ...extra });
  const onCreated = (terminal, dispatchId) => record({ terminal, dispatchId });
  let launched;
  if (role === 'worker') {
    launched = orca.startWorkerAgent({ route: { agent: noop.provider, model: noop.model, effort: noop.effort }, worktree: root, title, prompt, objective, entry, onCreated });
  } else if (role === 'critic') {
    // draw-critic's own placement, in the runtime repository (no op job owns it: the smoke removes it).
    const placed = orca.criticWorkspace({ repoRoot: root, context: null });
    if (!placed?.ok) {
      launched = { ok: false, step: 'placement', error: `criticWorkspace: ${placed?.error ?? 'no placement'}` };
    } else {
      record({ workspace: placed.dir, workspaceRepo: placed.repoRoot ?? null });
      launched = orca.launchCriticWorker({ critic: { provider: noop.provider, model: noop.model, effort: noop.effort }, dir: placed.dir, prompt, entry });
    }
  } else {
    launched = orca.startAgent({ provider: noop.provider, model: noop.model, effort: noop.effort, worktree: root, title, prompt, objective, entry, onCreated });
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

/** `mark`: the role's one result line. */
export function markResult({ role, state, now = Date.now }) {
  fs.mkdirSync(dirs(state).results, { recursive: true });
  fs.writeFileSync(resultFile(state, role), `${role} ok ${new Date(now()).toISOString()}\n`);
  return { ok: true, role };
}

/**
 * `stage`: run by a parent agent in its own terminal. It starts the parent's child with `entry` = that terminal
 * (ORCA_TERMINAL_HANDLE, which must be the terminal the launcher recorded for the role), then marks the parent's
 * result line. {ok, role, child, entry, error?}; also written to stages/<role>.json.
 */
export async function runStage({ role, state, orca, env = process.env, root = SKILL_ROOT, script = SCRIPT, waitMs = 60000, sleep = defaultSleep, now = Date.now }) {
  const child = CHILD[role];
  const done = (receipt) => { writeJson(stageFile(state, role), receipt); return receipt; };
  if (!child) return done({ ok: false, role, error: `${role} has no child to start` });
  let recorded = agentOf(state, role);
  for (const deadline = now() + waitMs; !recorded?.terminal && now() < deadline;) { await sleep(500); recorded = agentOf(state, role); }
  const own = env.ORCA_TERMINAL_HANDLE || null;
  const entry = own ?? recorded?.terminal ?? null;
  if (!entry) return done({ ok: false, role, error: 'no terminal: neither ORCA_TERMINAL_HANDLE nor a recorded launch names this agent' });
  if (own && recorded?.terminal && own !== recorded.terminal) {
    return done({ ok: false, role, entry, error: `ORCA_TERMINAL_HANDLE ${own} is not the terminal ${recorded.terminal} the launcher recorded for ${role}` });
  }
  const launched = await launchRole({ role: child, state, entry, orca, root, script });
  markResult({ role, state, now });
  return done({ ok: launched?.ok === true, role, child, entry, dispatchId: launched?.dispatchId ?? null,
    ...(launched?.ok ? {} : { error: launched?.error ?? 'no launch receipt', step: launched?.step ?? null }) });
}

const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const payloadOf = (m) => { try { return typeof m?.payload === 'string' ? JSON.parse(m.payload) : m?.payload ?? null; } catch { return null; } };

/** One worker-show read reduced to what the smoke checks. */
function observe(show) {
  const d = show?.dispatch ?? show?.result?.dispatch ?? null;
  return { ok: show?.ok === true, state: show?.state ?? null, status: d?.status ?? null, depth: Number.isFinite(Number(d?.depth)) ? Number(d.depth) : null,
    creatorDispatchId: d?.creatorDispatchId ?? null, lastFailure: d?.lastFailure ?? null, runId: d?.runId ?? null, taskId: d?.taskId ?? d?.task_id ?? null };
}
const settledOf = (o) => SETTLED_STATUS.has(String(o?.status)) || ENDED_STATE.has(String(o?.state));

/**
 * The smoke. `entry` the coordinator terminal; `orca` the client (defaultClient); `timeoutMs` bounds the wait for
 * every agent to settle. Returns the starci/launch-smoke@1 result; never throws.
 */
export async function runSmoke({ entry = process.env.ORCA_TERMINAL_HANDLE || null, orca, root = SKILL_ROOT, script = SCRIPT, noop = noopAgent(),
  timeoutMs = 1200000, pollMs = 5000, sleep = defaultSleep, now = Date.now, stateRoot = os.tmpdir() }) {
  const startedAt = now();
  const out = { schema: SMOKE_SCHEMA, ok: false, entry, noop: noop?.error ? null : { provider: noop.provider, model: noop.model, effort: noop.effort },
    paths: {}, agents: {}, cleanup: [], error: null };
  if (!entry) return { ...out, error: 'no entry terminal: run the smoke inside an Orca terminal (ORCA_TERMINAL_HANDLE) or pass --entry' };
  if (noop?.error) return { ...out, error: noop.error };
  fs.mkdirSync(stateParentOf(stateRoot), { recursive: true });
  const state = fs.mkdtempSync(path.join(stateParentOf(stateRoot), 'run-'));
  writeJson(path.join(state, 'plan.json'), { schema: SMOKE_SCHEMA, root: slash(root), entry, noop: out.noop });
  const seen = {};
  const doneMessages = new Set();
  try {
    for (const top of ['supervisor', 'kernel']) {
      const r = await launchRole({ role: top, state, entry, orca, root, script });
      if (!r?.ok) out.agents[top] = { launched: false, error: r?.error ?? 'no launch receipt' };
    }
    const deadline = now() + timeoutMs;
    // Wait until every role has settled, or can no longer appear (its parent settled, failed to launch, or its stage failed).
    for (;;) {
      const inbox = settle(() => orca.inbox({ limit: 200 }));
      for (const m of inbox?.messages ?? []) if (m?.type === 'worker_done') { const id = payloadOf(m)?.dispatchId; if (id) doneMessages.add(id); }
      let open = 0;
      for (const role of Object.keys(ROLES)) {
        const a = agentOf(state, role);
        if (a?.dispatchId) {
          seen[role] = observe(settle(() => orca.workerShow({ dispatch: a.dispatchId })));
          if (!settledOf(seen[role]) && !doneMessages.has(a.dispatchId)) open += 1;
          continue;
        }
        // A top role is launched synchronously: no Dispatch now means it never started. A child can no longer appear
        // once its parent never started, its stage failed, or its parent settled.
        const parent = ROLES[role].parent;
        if (!parent) continue;
        const parentAgent = agentOf(state, parent);
        const stage = readJson(stageFile(state, parent));
        const gone = !parentAgent?.dispatchId || stage?.ok === false || (seen[parent] && settledOf(seen[parent]));
        if (!gone) open += 1;
      }
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
        status: o.status, state: o.state, workerDone: doneMessages.has(a.dispatchId) || o.status === 'completed' || o.status === 'succeeded',
        result, read: { ok: read?.ok === true, source: read?.source ?? null, liveness: read?.status?.liveness ?? null, rows: read?.rows?.length ?? 0, ...(read?.ok ? {} : { error: read?.error ?? null }) },
        ...(a.ok ? {} : { error: a.error ?? null, step: a.step ?? null }),
      };
    }
  } catch (error) {
    out.error = String(error?.message ?? error);
  } finally {
    for (const role of CLEANUP_ORDER) {
      const a = agentOf(state, role);
      const unplace = () => settle(() => orca.removeCriticWorkspace({ dir: a.workspace, repoRoot: a.workspaceRepo ?? null }))?.ok === true;
      if (a?.workspace && !a?.dispatchId) out.cleanup.push({ role, workspaceRemoved: unplace() });
      if (!a?.dispatchId) continue;
      const before = observe(settle(() => orca.workerShow({ dispatch: a.dispatchId })));
      const settled = settledOf(before) || doneMessages.has(a.dispatchId);
      const stop = settled ? null : settle(() => orca.workerStop({ dispatch: a.dispatchId }));
      const release = settle(() => orca.workerRelease({ dispatch: a.dispatchId }));
      const completed = before.status === 'completed' || before.status === 'succeeded';
      const task = completed || !a.taskId ? null : settle(() => orca.taskUpdate({ id: a.taskId, status: 'failed', ...(a.runId ? { run: a.runId } : {}), ...(a.creatorTerminal ? { from: a.creatorTerminal } : {}) }));
      const entryOut = { role, dispatchId: a.dispatchId, stopped: stop ? stop.ok === true : null, released: release?.ok === true, taskClosed: task ? task.ok === true : completed ? 'by-worker_done' : null,
        ...(release?.ok ? {} : { releaseError: release?.error ?? release?.outcome ?? null }) };
      if (a.workspace) entryOut.workspaceRemoved = unplace();
      out.cleanup.push(entryOut);
    }
    safeRemoveTree(state);
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
    const r = verb === 'mark' ? markResult({ role, state }) : await runStage({ role, state, orca: await defaultClient() });
    console.log(JSON.stringify(r));
    return r.ok ? 0 : 1;
  }
  if (verb) { console.error(`unknown verb ${verb}`); return 2; }
  const timeout = Number(argOf(argv, 'timeout-ms'));
  const result = await runSmoke({ entry: argOf(argv, 'entry') || process.env.ORCA_TERMINAL_HANDLE || null, orca: await defaultClient(),
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
