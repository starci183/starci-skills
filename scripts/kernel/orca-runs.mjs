// orca-runs.mjs — keep a workflow's Orca Run bound to the Kernel terminal that
// runs it now. (An op's Task is never closed by the runtime: the op's own worker_done
// settles it with its Dispatch, orca-deep-map REPLACE #9.)
//
// A workflow has one Orca Run, created by its first operation with the Kernel
// terminal as coordinator (cli.mjs ensureWorkflowRun). A Kernel restart
// replaces the terminal but not the Run: the Run id is durable on the kernel
// job, and Orca's coordinator_handle still names the old terminal. Orca then
// refuses every Task the new Kernel files or updates. After the
// 2026-09-24 reboot all eight Kernels were rejected at the Task's creation with an
// empty error (inc-5c0ff394e676): the Run existed, its coordinator was the
// pre-reboot terminal. bindWorkflowRun reads run-show and, when the coordinator
// is not the current Kernel terminal, re-binds it with one run-use; a Run Orca
// no longer knows (run_not_found) is reported missing so the caller creates a
// new one. One re-bind per Kernel replacement: once bound, run-show matches
// and nothing is issued again (a repeated run-use invalidates live Dispatches).
import { runShow } from '../api/orca/run-show.mjs';
import { runUse } from '../api/orca/run-use.mjs';

/**
 * Make `runId` coordinated by `kernelHandle`. Returns
 * {ok, runId, action: 'bound'|'rebound'|'missing'|'failed', previousCoordinator, error?, hostUnavailable?}.
 * 'bound': already the coordinator (or run-show names none, which proves no mismatch);
 * 'rebound': run-use moved it; 'missing': run_not_found, create a new Run; 'failed': leave it as is.
 */
export function bindWorkflowRun({ runId, kernelHandle }, { show = runShow, use = runUse } = {}) {
  if (!runId || !kernelHandle) return { ok: false, runId: runId ?? null, action: 'failed', previousCoordinator: null, error: 'bindWorkflowRun needs a run id and the kernel terminal' };
  let shown;
  try { shown = show({ id: runId }); } catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  if (!shown?.ok) {
    if (shown?.missing) return { ok: false, runId, action: 'missing', previousCoordinator: null, error: shown.error ?? 'run_not_found' };
    return { ok: false, runId, action: 'failed', previousCoordinator: null, hostUnavailable: shown?.hostUnavailable === true,
      error: `run-show ${runId}: ${shown?.error || 'no answer'}` };
  }
  const previousCoordinator = shown.coordinator ?? null;
  if (!previousCoordinator || previousCoordinator === kernelHandle) return { ok: true, runId, action: 'bound', previousCoordinator };
  let used;
  try { used = use({ id: runId, from: kernelHandle }); } catch (error) { used = { ok: false, error: String(error?.message ?? error) }; }
  if (!used?.ok) {
    if (used?.errorCode === 'run_not_found') return { ok: false, runId, action: 'missing', previousCoordinator, error: used.error };
    return { ok: false, runId, action: 'failed', previousCoordinator, hostUnavailable: used?.hostUnavailable === true,
      error: `run-use ${runId} --from ${kernelHandle}: ${used?.error || 'refused'}` };
  }
  return { ok: true, runId, action: 'rebound', previousCoordinator };
}

/** Whether a refused launch says the terminal it was sent from is not the coordinator Orca has bound to the Run. */
export const isRunFence = (launched) => launched?.ok === false && launched.step === 'worker-start' && /consumer_fenced/i.test(String(launched.error ?? ''));

/**
 * The reaction to a Run fence: a fence proves the binding is wrong even where run-show names no coordinator (bindWorkflowRun reads that as bound).
 * One run-use from the Kernel terminal unless run-show proves it is already the coordinator (then the fence is another fault and nothing is issued).
 * Returns {rebound, action: 'rebound'|'already-bound'|'failed', previousCoordinator, error?}.
 */
export function rebindAfterFence({ runId, kernelHandle }, { show = runShow, use = runUse } = {}) {
  if (!runId || !kernelHandle) return { rebound: false, action: 'failed', previousCoordinator: null, error: 'no run or no kernel terminal' };
  let shown;
  try { shown = show({ id: runId }); } catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  if (!shown?.ok) return { rebound: false, action: 'failed', previousCoordinator: null, error: `run-show ${runId}: ${shown?.error || 'no answer'}` };
  const previousCoordinator = shown.coordinator ?? null;
  if (previousCoordinator === kernelHandle) return { rebound: false, action: 'already-bound', previousCoordinator };
  let used;
  try { used = use({ id: runId, from: kernelHandle }); } catch (error) { used = { ok: false, error: String(error?.message ?? error) }; }
  return used?.ok ? { rebound: true, action: 'rebound', previousCoordinator }
    : { rebound: false, action: 'failed', previousCoordinator, error: `run-use ${runId} --from ${kernelHandle}: ${used?.error || 'refused'}` };
}
