// orca-runs.mjs — keep a workflow's Orca Run bound to the Kernel terminal that
// runs it now, and find the operation Tasks nothing holds any more.
//
// A workflow has one Orca Run, created by its first operation with the Kernel
// terminal as coordinator (api.mjs ensureWorkflowRun). A Kernel restart
// replaces the terminal but not the Run: the Run id is durable on the kernel
// job, and Orca's coordinator_handle still names the old terminal. Orca then
// refuses every task-create/task-update the new Kernel issues. After the
// 2026-09-24 reboot all eight Kernels were rejected at task-create with an
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

// Orca Task statuses that are closed; everything else (pending, ready,
// dispatched, blocked) is an open row in the sidebar.
export const CLOSED_TASK_STATUSES = new Set(['completed', 'failed']);
// A Task StarCi created: an operation Task is titled `<op> #<attempt>` and
// displayed `[Op] <op>` (api.mjs createOperationTask).
const STARCI_TASK_TITLE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*\s+#\d+$/i;
export const isStarciTask = (task) => /^\[Op\]\s/.test(String(task?.display_name ?? task?.displayName ?? ''))
  || STARCI_TASK_TITLE.test(String(task?.task_title ?? task?.taskTitle ?? ''));

/**
 * Which open Tasks of one workflow Run to close: every open StarCi Task whose id
 * no live job holds (`heldTaskIds`: the tasks of running/answering/leased jobs).
 * Returns {close: [task], keep: [{task, reason}]}. A Task StarCi did not create is kept.
 */
export function staleTasks(tasks, { heldTaskIds = new Set() } = {}) {
  const close = [], keep = [];
  for (const task of tasks ?? []) {
    if (CLOSED_TASK_STATUSES.has(task?.status)) continue;
    if (heldTaskIds.has(task?.id)) keep.push({ task, reason: 'held-by-live-job' });
    else if (!isStarciTask(task)) keep.push({ task, reason: 'not-starci' });
    else close.push(task);
  }
  return { close, keep };
}
