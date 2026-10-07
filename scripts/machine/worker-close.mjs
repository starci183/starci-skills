// worker-close.mjs - the existing managed-worker release and measured process-closure owner.
//
// Why (owner rule, 2026-10-02 23:35: "a finished worker is closed COMPLETELY"): `worker-release` alone was believed to end the agent (live smoke E1 proved
// it for claude, codex and devin). A cursor worker released that way kept its cursor-agent process alive and burned about 11,200 CPU seconds until
// the owner closed the terminal and stopped the PID by hand. So every release now goes through here, in this order:
//   1. worker-show: the worker's terminal handle, and a snapshot of the processes that belong to that terminal (below), taken while it is alive;
//   2. worker-stop, only when the caller has positive proof the Dispatch is not settled (`stopFirst`);
//   3. worker-release (repeated once with `retryRelease`: Orca's own recovery for release_unknown);
//   4. terminal close of the worker's terminal, proven (close-verify closeAndVerify);
//   5. capture each measured process object's native birth, executable and terminal environment before release. Verify that those objects
//      ended, or stop them individually through that exact identity on one native handle; then repeat the terminal census. A survivor raises
//      `worker-process-survived`. The finding NEVER changes the worker's outcome: `ok` stays the release receipt's, a worker that sent
//      worker_done and succeeded stays succeeded.
//
// What "belongs to the terminal" means: Orca exports ORCA_TERMINAL_HANDLE into the shell it creates for a terminal and every process started
// under it normally inherits it. The handle-tagged processes and their measured descendants are candidates, not custody proof by PID alone.
// Every candidate must independently carry that handle at native identity capture. Missing birth, executable or environment refuses forced
// termination. The receipt covers captured process objects and the later census, not every possible descendant or an unobserved process tree.
// Nothing is ever matched by name (the owner's ChatGPT desktop app runs codex.exe on this host: it carries no such handle and is never touched).
//
// Verify cannot run (Orca unreachable, the process table or the environments unreadable, no process carries the handle): nothing is killed and
// the answer is `unverifiable`, left for the sweep. A caller inside the terminal it would close (a worker filing its own report) does not close
// or verify it, and spawns nothing: the close stays PENDING in the runtime state the host-side controller owns (the Supervisor job without a proven
// terminalClosed, the `worker-terminal-unclosed` event) and the next sweep tick calls closeWorker in-process. Dispatcher and coordinator terminals
// are not workers: they never come through here. closeWorker is the only export a caller needs; the CLI exposes it as a catalog verb.
import { allocationMs } from '../../engine/config.mjs';
import { captureProcessIdentity } from '../api/process/capture-process-identity.mjs';
import { stopOwnedProcess } from '../api/process/stop-owned-process.mjs';
import { OWNED_PROCESS_SCHEMA } from '../lib/process-identity.mjs';
import { processEnv } from '../api/process/process-env.mjs';
import { processList } from '../api/process/process-list.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { readEnv } from '../lib/env.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { closeAndVerify } from './close-verify.mjs';
import { supLog } from './sup-log.mjs';
import { releaseProviderBudgetByHandle } from './provider-budget-release.mjs';

const HANDLE_ENV = 'ORCA_TERMINAL_HANDLE';

/** The processes of terminal `handle`: those carrying the handle plus every descendant of them. Pure. {shells, members[{pid, ppid, name, created}]}. */
export function terminalTree(handle, { table, envRows }) {
  const tagged = new Set((envRows ?? []).filter((r) => r.values?.[HANDLE_ENV] === handle).map((r) => r.pid));
  const byPid = new Map((table ?? []).map((p) => [p.pid, p]));
  const shells = [...tagged].filter((pid) => !tagged.has(byPid.get(pid)?.ppid));
  const members = new Set(tagged);
  for (let grew = true; grew;) {
    grew = false;
    for (const p of table ?? []) if (!members.has(p.pid) && members.has(p.ppid) && p.pid !== p.ppid) { members.add(p.pid); grew = true; }
  }
  return { shells, members: [...members].map((pid) => byPid.get(pid) ?? { pid, ppid: null, name: null, created: null }) };
}

/** Members with the same known pid and creation time. Missing creation never acts as a wildcard. Pure. */
const createdKnown = value => Number.isSafeInteger(value) && value > 0;
export const survivorsOf = (members, table) => members.filter((m) => createdKnown(m.created)
  && (table ?? []).some((p) => p.pid === m.pid && createdKnown(p.created) && m.created === p.created));

const members = (list) => list.map((m) => ({ pid: m.pid, name: m.name ?? null, created: m.created, identity: m.identity ?? null }));
const bornAt = identity => {
  try { return Number((BigInt(identity.birth) - 116444736000000000n) / 10000n); } catch { return null; }
};
const exactIdentity = (a, b) => Boolean(a && b) && a.pid === b.pid && a.birth === b.birth
  && typeof a.exe === 'string' && typeof b.exe === 'string' && a.exe.toLowerCase() === b.exe.toLowerCase();
const capturedIdentity = (receipt, row) => receipt?.schema === OWNED_PROCESS_SCHEMA && receipt.ok === true
  && receipt.outcome === 'captured' && receipt.proof === 'process-handle-live' && receipt.pid === row.pid
  && receipt.identity?.pid === row.pid && bornAt(receipt.identity) === row.created
  && typeof row.exe === 'string' && row.exe.length > 0
  && typeof receipt.identity.exe === 'string' && receipt.identity.exe.toLowerCase() === row.exe.toLowerCase();
const stoppedIdentity = (receipt, identity) => receipt?.schema === OWNED_PROCESS_SCHEMA && receipt.ok === true
  && ['stopped', 'gone'].includes(receipt.outcome) && receipt.proof === 'process-handle-signaled'
  && receipt.pid === identity.pid && exactIdentity(receipt.identity, identity);

/** The exact worker terminal and its measured captured objects have ended, independently of release bookkeeping. Pure. */
export const workerExitProven = (receipt, handle) => Boolean(handle)
  && receipt?.handle === handle && receipt.closed?.ok === true
  && ['gone', 'disconnected'].includes(receipt.closed.proof)
  && ['none', 'stopped'].includes(receipt.processes?.verdict);

/** Release succeeded and the exact terminal plus measured captured objects have ended. Pure. */
export const workerClosureProven = (receipt, handle) => receipt?.ok === true && workerExitProven(receipt, handle);

/** Wait for every process of `tree` to end: {gone, table, left[]} or {unreadable}. */
function processCensusProblem(tree, table) {
  for (const row of table.filter((process) => tree.some((member) => member.pid === process.pid))) {
    if (!createdKnown(row.created) || typeof row.exe !== 'string' || !row.exe
        || tree.some((member) => member.pid === row.pid && member.created === row.created && member.identity.exe.toLowerCase() !== row.exe.toLowerCase()))
      return 'post-closure process identity is unreadable or contradictory';
  }
  return null;
}

function waitGone(tree, { read, environments, terminal, sleep, ms, pollMs }) {
  let table = null, left = tree;
  for (let waited = 0; ; waited += pollMs) {
    let envRows;
    try { table = read(); envRows = environments(); }
    catch { return { unreadable: true, reason: 'post-closure process census failed' }; }
    if (!Array.isArray(table) || !Array.isArray(envRows)) return { unreadable: true, reason: 'post-closure terminal census is unreadable' };
    const processProblem = processCensusProblem(tree, table);
    if (processProblem) return { unreadable: true, reason: processProblem };
    const census = terminalTree(terminal, { table, envRows }).members;
    if (census.some(row => !tree.some(m => m.pid === row.pid && m.created === row.created)))
      return { unreadable: true, reason: 'post-closure census contains an uncaptured terminal process', census: members(census) };
    left = survivorsOf(tree, table);
    if (!left.length) return { gone: true, table, left: [], census: members(census) };
    if (waited >= ms) return { gone: false, table, left, census: members(census) };
    sleep(pollMs);
  }
}

function captureWorkerTree({ terminal, own, deps, tableOf, envOf, capture, attempt }) {
  let tree = null, treeWhy = null;
  const stubbed = !deps.tableOf && !deps.envOf && Boolean(readEnv('STARCI_ORCA_COMMAND'));
  if (!terminal) treeWhy = 'the worker has no terminal of its own';
  else if (stubbed) treeWhy = 'Orca is stubbed: its terminals have no real process tree to prove';
  else if (own) treeWhy = 'the caller runs inside this terminal: it is not closed or verified from here';
  else {
    let table, envRows;
    try { table = tableOf(); envRows = envOf(); } catch { table = null; envRows = null; }
    if (!Array.isArray(table) || !Array.isArray(envRows)) treeWhy = 'the process table or the process environments could not be read';
    else {
      tree = terminalTree(terminal, { table, envRows }).members;
      if (!tree.length) { tree = null; treeWhy = 'no process carries the terminal handle: its tree cannot be proven'; }
      else {
        const captured = [];
        for (const row of tree) {
          if (!createdKnown(row.created) || typeof row.exe !== 'string' || !row.exe) {
            treeWhy = 'a measured process has no known birth or executable'; break;
          }
          const receipt = attempt(() => capture(row.pid, { ownership: { key: HANDLE_ENV, value: terminal } }));
          if (!capturedIdentity(receipt, row)) { treeWhy = 'native process identity or terminal custody is unverified'; break; }
          captured.push({ ...row, identity: receipt.identity });
        }
        tree = treeWhy ? null : captured;
      }
    }
  }
  return { tree, treeWhy };
}

function verifyStoppedWorkers(first, { stopProcess, stopVerifyMs, waitArgs, tree, attempt }) {
  const stoppedPids = [], stopReceipts = [];
  for (const object of first.left) {
    const receipt = attempt(() => stopProcess(object.identity, { waitMs: stopVerifyMs }));
    stopReceipts.push(receipt);
    if (stoppedIdentity(receipt, object.identity)) stoppedPids.push(object.pid);
  }
  const second = waitGone(tree, { ...waitArgs, ms: stopVerifyMs });
  const proof = { members: members(tree), stopped: stoppedPids, stopReceipts, census: second.census ?? null };
  if (second.unreadable) return { verdict: 'unverifiable', reason: second.reason ?? 'the process table could not be read after the stop', ...proof };
  if (stoppedPids.length !== first.left.length) return { verdict: 'unverifiable', reason: 'an exact native process stop was refused or unverified', ...proof, survivors: members(second.left) };
  if (second.gone) return { verdict: 'stopped', ...proof };
  return { verdict: 'survived', ...proof, survivors: members(second.left) };
}

function verifyWorkerProcesses({ terminal, own, tree, treeWhy, tableOf, envOf, sleep, verifyMs, stopVerifyMs, pollMs, stopProcess, attempt }) {
  if (!terminal || own) return { verdict: 'not-checked', reason: treeWhy };
  if (!tree) return { verdict: 'unverifiable', reason: treeWhy };
  const waitArgs = { read: tableOf, environments: envOf, terminal, sleep, pollMs };
  const first = waitGone(tree, { ...waitArgs, ms: verifyMs });
  if (first.unreadable) return { verdict: 'unverifiable', reason: first.reason ?? 'the process table could not be read while verifying', census: first.census ?? null };
  if (first.gone) return { verdict: 'none', members: members(tree), census: first.census };
  return verifyStoppedWorkers(first, { stopProcess, stopVerifyMs, waitArgs, tree, attempt });
}

function logWorkerHygiene({ hygiene, processes, terminal, dispatch, deps }) {
  if (!hygiene && processes.verdict !== 'stopped') return;
  try {
    (deps.log ?? supLog)({ kind: 'gc.collect', level: hygiene ? 'warn' : 'info',
      msg: hygiene ? `worker-process-survived: ${hygiene.survivors.map((s) => s.pid).join(',')} of terminal ${terminal} outlived release and close (dispatch ${dispatch})`
        : `a process of terminal ${terminal} outlived release and close and was stopped: ${processes.stopped.join(',')} (dispatch ${dispatch})`,
      data: { class: 'worker-close', action: 'worker-process', target: terminal, dispatch, verdict: processes.verdict, ...(hygiene ? { code: 'worker-process-survived' } : {}) } });
  } catch { /* the log is best effort; the finding is in the result */ }
}

function releaseClosedWorkerBudget(last, terminal, closed, processes, { env, deps }) {
  if (!workerClosureProven({ ...last, handle: terminal, closed, processes }, terminal)) return null;
  try {
    const result = (deps.releaseBudget ?? releaseProviderBudgetByHandle)(terminal,
      { kind: 'closed', confirmed: true, handle: terminal, source: 'worker-close', terminalProof: closed.proof ?? null, processVerdict: processes.verdict }, { env: { ...process.env, ...env } });
    return !result.ok || result.released > 0 ? result : null;
  } catch (error) { return { ok: false, reason: 'store-unavailable', error: String(error?.message ?? error) }; }
}

/**
 * Release worker `dispatch`, close its terminal and verify its captured process objects.
 * Seams (deps): show, stop, release, close, tableOf, envOf, capture, stopProcess, sleep, log.
 * Returns the release receipt ({ok, outcome, state, ...}) plus {handle, closed, processes, hygiene, stop?, retryRelease?}.
 * processes.verdict: 'none' (captured objects ended and the terminal census is empty), 'stopped' (exact native stops plus the census prove closure),
 * 'survived' (a captured object stays: hygiene is set), 'unverifiable' (closure remains unknown) or 'not-checked'.
 */
export function closeWorker({ dispatch, handle = null, stopFirst = false, retryRelease = false, env = process.env, deps = {} } = {}) {
  const show = deps.show ?? workerShow, stop = deps.stop ?? workerStop, release = deps.release ?? workerRelease;
  const close = deps.close ?? closeAndVerify, sleep = deps.sleep ?? sleepSync;
  const capture = deps.capture ?? captureProcessIdentity, stopProcess = deps.stopProcess ?? stopOwnedProcess;
  const tableOf = deps.tableOf ?? (() => processList({ cmdMax: 200 }));
  const envOf = deps.envOf ?? (() => processEnv({ names: [HANDLE_ENV] }));
  const verifyMs = deps.verifyMs ?? allocationMs('workerClose.verifyMs'), pollMs = deps.pollMs ?? allocationMs('workerClose.pollMs');
  const stopVerifyMs = deps.stopVerifyMs ?? allocationMs('workerClose.stopVerifyMs');
  const unknown = (error) => ({ ok: false, outcome: 'unknown', error: String(error?.message ?? error) });
  const attempt = (fn) => { try { return fn(); } catch (error) { return unknown(error); } };

  let shown = null;
  try { shown = show({ dispatch }); } catch { shown = null; }
  const terminal = handle ?? shown?.result?.worker?.agentTerminalHandle ?? null;
  const own = Boolean(terminal) && env[HANDLE_ENV] === terminal;
  const { tree, treeWhy } = captureWorkerTree({ terminal, own, deps, tableOf, envOf, capture, attempt });

  // 2 and 3. stop only on the caller's proof, then release
  const stopped = stopFirst ? attempt(() => stop({ dispatch })) : null;
  let released = attempt(() => release({ dispatch }));
  let retry = null;
  if (retryRelease && released?.ok !== true) { retry = attempt(() => release({ dispatch })); }
  const last = retry ?? released;

  // 4. close the terminal and prove it
  let closed = null;
  if (terminal && !own) closed = attempt(() => close(terminal));

  // 5. verify the processes
  const processes = verifyWorkerProcesses({ terminal, own, tree, treeWhy, tableOf, envOf, sleep, verifyMs, stopVerifyMs, pollMs, stopProcess, attempt });
  processes.scope = 'captured-process-objects-and-terminal-census';
  const hygiene = processes.verdict === 'survived'
    ? { code: 'worker-process-survived', dispatch, handle: terminal, survivors: processes.survivors, stopped: processes.stopped }
    : null;
  logWorkerHygiene({ hygiene, processes, terminal, dispatch, deps });
  const providerBudget = releaseClosedWorkerBudget(last, terminal, closed, processes, { env, deps });
  return { ...last, ok: last?.ok === true, handle: terminal, closed, processes, hygiene, ...(providerBudget ? { providerBudget } : {}), ...(stopped ? { stop: stopped } : {}), ...(retry ? { retryRelease: retry } : {}) };
}


const isOwnTerminal = (handle, env = process.env) => Boolean(handle) && env[HANDLE_ENV] === handle;

/** Fence and release worker `dispatch` through closeWorker (worker-stop first on the caller's proof, then release, close, verify). {dispatch, ok, stop, release, ...}. */
export function stopAndRelease(dispatch, { handle = null, env = process.env, deps = {} } = {}) {
  const r = closeWorker({ dispatch, handle, stopFirst: true, env, deps });
  return { dispatch, ok: r.ok, stop: { ok: r.stop?.ok === true, error: r.stop?.error ?? null }, release: { ok: r.ok, error: r.error ?? null },
    handle: r.handle, closed: r.closed, processes: r.processes, hygiene: r.hygiene };
}

/**
 * Release worker `dispatch` from a caller that may be running inside its terminal `handle` (a worker filing its own report): inline stopAndRelease for
 * another worker. For the caller's own terminal nothing is done here and nothing is spawned: {ok: false, pending: true}, the close stays pending in the
 * runtime state and the host-side sweep closes it in-process on its next tick (a closed terminal would end this very process).
 */
export function releaseSelfSafe(dispatch, handle, { owner = 'runtime', env = process.env, inline = stopAndRelease } = {}) {
  if (!dispatch) return null;
  if (!isOwnTerminal(handle, env)) return { ...inline(dispatch), handle, owner };
  return { dispatch, handle, ok: false, pending: true, reason: 'the caller runs inside the worker terminal', owner };
}
