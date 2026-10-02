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
