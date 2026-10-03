// worker-close.mjs - the ONE way the runtime lets a finished (or failed, or stuck) managed worker go, so that nothing of it is left running.
//
// Why (owner rule, 2026-10-02 23:35: "a finished worker is closed COMPLETELY"): `worker-release` alone was believed to end the agent (live smoke E1 proved
// it for claude, codex and devin). A cursor worker released that way kept its cursor-agent process alive and burned about 11,200 CPU seconds until
// the owner closed the terminal and stopped the PID by hand. So every release now goes through here, in this order:
//   1. worker-show: the worker's terminal handle, and a snapshot of the processes that belong to that terminal (below), taken while it is alive;
//   2. worker-stop, only when the caller has positive proof the Dispatch is not settled (`stopFirst`);
//   3. worker-release (repeated once with `retryRelease`: Orca's own recovery for release_unknown);
//   4. terminal close of the worker's terminal, proven (close-verify closeAndVerify);
//   5. a bounded verify (allocation.workerClose.verifyMs) that no process of the snapshot remains. A survivor is stopped ONLY when it is
//      proven to belong to that terminal; the stop is re-verified; a survivor that stays raises the host-hygiene finding
//      `worker-process-survived`. The finding NEVER changes the worker's outcome: `ok` stays the release receipt's, a worker that sent
//      worker_done and succeeded stays succeeded.
//
// What "belongs to the terminal" means: Orca exports ORCA_TERMINAL_HANDLE into the shell it creates for a terminal and every process started
// under it inherits it, so the processes carrying the handle, and every descendant of them in the process table, are the terminal's shell tree.
// Nothing is ever matched by name (the owner's ChatGPT desktop app runs codex.exe on this host: it carries no such handle and is never touched).
//
// Verify cannot run (Orca unreachable, the process table or the environments unreadable, no process carries the handle): nothing is killed and
// the answer is `unverifiable`, left for the sweep. A caller inside the terminal it would close (a worker filing its own report) does not close
// or verify it, and spawns nothing: the close stays PENDING in the runtime state the host-side controller owns (the Supervisor job without a proven
// terminalClosed, the `worker-terminal-unclosed` event) and the next sweep tick calls closeWorker in-process. Dispatcher and coordinator terminals
// are not workers: they never come through here. closeWorker is the only export a caller needs; the CLI exposes it as a catalog verb.
import { allocationMs } from '../../engine/config.mjs';
import { killTree } from '../api/process/kill-tree.mjs';
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

/** The members still alive in `table` (same pid and, when both are known, the same creation time: a reused pid is another process). Pure. */
export const survivorsOf = (members, table) => members.filter((m) => (table ?? []).some((p) => p.pid === m.pid && (m.created == null || p.created == null || m.created === p.created)));

/** The survivors no other survivor is the parent of: stopping the tree of each stops them all. Pure. */
const rootsOf = (survivors) => survivors.filter((s) => !survivors.some((o) => o.pid === s.ppid));

const members = (list) => list.map((m) => ({ pid: m.pid, name: m.name ?? null }));

/** The exact worker terminal and its captured process tree have ended, independently of release bookkeeping. Pure. */
export const workerExitProven = (receipt, handle) => Boolean(handle)
  && receipt?.handle === handle && receipt.closed?.ok === true
  && ['gone', 'disconnected'].includes(receipt.closed.proof)
  && ['none', 'stopped'].includes(receipt.processes?.verdict);

/** The worker's release succeeded and its exact terminal and process tree have ended. Pure. */
export const workerClosureProven = (receipt, handle) => receipt?.ok === true && workerExitProven(receipt, handle);

/** Wait for every process of `tree` to end: {gone, table, left[]} or {unreadable}. */
function waitGone(tree, { read, sleep, ms, pollMs }) {
  let table = null, left = tree;
  for (let waited = 0; ; waited += pollMs) {
    table = read();
    if (!table) return { unreadable: true };
    left = survivorsOf(tree, table);
    if (!left.length) return { gone: true, table, left: [] };
    if (waited >= ms) return { gone: false, table, left };
    sleep(pollMs);
  }
}

/**
 * Close worker `dispatch` completely. Seams (deps): show, stop, release, close, tableOf, envOf, kill, sleep, log.
 * Returns the release receipt ({ok, outcome, state, ...}) plus {handle, closed, processes, hygiene, stop?, retryRelease?}.
 * processes.verdict: 'none' (nothing of the terminal remains), 'stopped' (a proven survivor was stopped), 'survived' (one stays: hygiene is set),
 * 'unverifiable' (nothing was killed) or 'not-checked' (no terminal of its own to check).
 */
export function closeWorker({ dispatch, handle = null, stopFirst = false, retryRelease = false, env = process.env, deps = {} } = {}) {
  const show = deps.show ?? workerShow, stop = deps.stop ?? workerStop, release = deps.release ?? workerRelease;
  const close = deps.close ?? closeAndVerify, kill = deps.kill ?? killTree, sleep = deps.sleep ?? sleepSync;
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

  // 1. the terminal's process tree, while its shell is alive
  let tree = null, treeWhy = null;
  // A stubbed Orca (a spec's fake, STARCI_ORCA_COMMAND) has no real process tree: the host's processes prove nothing about its terminals.
  const stubbed = !deps.tableOf && !deps.envOf && Boolean(readEnv('STARCI_ORCA_COMMAND'));
  if (!terminal) treeWhy = 'the worker has no terminal of its own';
  else if (stubbed) treeWhy = 'Orca is stubbed: its terminals have no real process tree to prove';
  else if (own) treeWhy = 'the caller runs inside this terminal: it is not closed or verified from here';
  else {
    const table = tableOf(), envRows = envOf();
    if (!table || !envRows) treeWhy = 'the process table or the process environments could not be read';
    else {
      tree = terminalTree(terminal, { table, envRows }).members;
      if (!tree.length) { tree = null; treeWhy = 'no process carries the terminal handle: its tree cannot be proven'; }
    }
  }

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
  let processes;
  if (!terminal || own) processes = { verdict: 'not-checked', reason: treeWhy };
  else if (!tree) processes = { verdict: 'unverifiable', reason: treeWhy };
  else {
    const first = waitGone(tree, { read: tableOf, sleep, ms: verifyMs, pollMs });
    if (first.unreadable) processes = { verdict: 'unverifiable', reason: 'the process table could not be read while verifying' };
    else if (first.gone) processes = { verdict: 'none', members: members(tree) };
    else {
      // a survivor proven to belong to the terminal (it is in the snapshot of that terminal's tree, same pid and creation time): stop its tree
      const targets = rootsOf(first.left), stoppedPids = [];
      for (const t of targets) { const k = kill(t.pid); if (k?.ok) stoppedPids.push(t.pid); }
      const second = waitGone(first.left, { read: tableOf, sleep, ms: stopVerifyMs, pollMs });
      if (second.unreadable) processes = { verdict: 'unverifiable', reason: 'the process table could not be read after the stop', stopped: stoppedPids };
      else if (second.gone) processes = { verdict: 'stopped', members: members(tree), stopped: stoppedPids };
      else processes = { verdict: 'survived', members: members(tree), stopped: stoppedPids, survivors: members(second.left) };
    }
  }
  const hygiene = processes.verdict === 'survived'
    ? { code: 'worker-process-survived', dispatch, handle: terminal, survivors: processes.survivors, stopped: processes.stopped }
    : null;
  if (hygiene || processes.verdict === 'stopped') {
    try {
      (deps.log ?? supLog)({ kind: 'gc.collect', level: hygiene ? 'warn' : 'info',
        msg: hygiene ? `worker-process-survived: ${hygiene.survivors.map((s) => s.pid).join(',')} of terminal ${terminal} outlived release and close (dispatch ${dispatch})`
          : `a process of terminal ${terminal} outlived release and close and was stopped: ${processes.stopped.join(',')} (dispatch ${dispatch})`,
        data: { class: 'worker-close', action: 'worker-process', target: terminal, dispatch, verdict: processes.verdict, ...(hygiene ? { code: 'worker-process-survived' } : {}) } });
    } catch { /* the log is best effort; the finding is in the result */ }
  }
  let providerBudget = null;
  if (workerClosureProven({ ...last, handle: terminal, closed, processes }, terminal)) {
    try {
      const result = (deps.releaseBudget ?? releaseProviderBudgetByHandle)(terminal,
        { kind: 'closed', confirmed: true, handle: terminal, source: 'worker-close', terminalProof: closed.proof ?? null, processVerdict: processes.verdict }, { env: { ...process.env, ...env } });
      if (!result.ok || result.released > 0) providerBudget = result;
    } catch (error) { providerBudget = { ok: false, reason: 'store-unavailable', error: String(error?.message ?? error) }; }
  }
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
