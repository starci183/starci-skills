// A held Kernel launch that names a Dispatch but never bound a terminal is reconciled only from Orca's own typed answer:
// the Dispatch is settled, the terminal it names is the one the admission receipt holds, and that terminal is gone or disconnected.
import { workerShow } from '../api/orca/worker-show.mjs';
import { terminalState } from '../machine/close-verify.mjs';

const SETTLED = new Set(['failed', 'stopped', 'released']);
const CLOSED_TERMINAL = new Set(['gone', 'disconnected']);

/** The Dispatch states Orca reported: the worker state and, when present, the Dispatch's own status. */
const statesOf = (shown) => ({ worker: shown.state ?? null, dispatch: shown.result?.dispatch?.status ?? null });

const readDispatch = (show, dispatch) => {
  try { return show({ dispatch }); } catch (error) { return { ok: false, hostUnavailable: true, error: String(error?.message ?? error) }; }
};

/**
 * The terminal of settled Dispatch `dispatch` as {ok:true, handle, evidence} when Orca positively reports the Dispatch ended
 * and names the receipt's terminal, and that terminal is gone or disconnected; else {ok:false, reason, ...} naming what is missing.
 * Reads only; the caller closes the terminal and proves its processes.
 */
export function settledLaunchTerminal({ dispatch, receipt }, { show = workerShow, terminalOf = terminalState } = {}) {
  const shown = readDispatch(show, dispatch);
  if (shown?.hostUnavailable === true || shown?.ok !== true)
    return { ok: false, reason: 'kernel-launch-host-unavailable', dispatch, error: shown?.error ?? 'worker-show did not answer' };
  const states = statesOf(shown);
  if (!SETTLED.has(states.worker) || (states.dispatch !== null && !SETTLED.has(states.dispatch)))
    return { ok: false, reason: 'kernel-launch-dispatch-unsettled', dispatch, states };
  const handle = shown.result?.worker?.agentTerminalHandle ?? null;
  const terminal = handle && handle === receipt.handle ? terminalOf(handle) : null;
  if (!CLOSED_TERMINAL.has(terminal))
    return { ok: false, reason: 'kernel-launch-terminal-unproven', dispatch, terminal: handle, receiptTerminal: receipt.handle, terminalState: terminal };
  return { ok: true, handle, evidence: { dispatch, states, terminalState: terminal } };
}

// Orca's own states for a worker whose first turn it never saw begin: the start is unknown, not running.
const UNOBSERVED_WORKER = new Set(['start_unknown', 'outcome_unknown', 'unknown']);

/**
 * The terminal Orca reports for Dispatch `dispatch` when the launch that created it never bound one and no turn ever started
 * (held launch-unknown signal, receipt without a handle): {ok:true, handle, evidence} when Orca answers for that exact Dispatch,
 * names its terminal, and reports the worker's start as unknown/unobserved (or the Dispatch settled) with no heartbeat; else
 * {ok:false, reason, ...}: host-unavailable (no answer), dispatch-mismatch, terminal-unnamed, or worker-live (a turn is or may be running:
 * the seat is alive and is bound, never closed). Reads only; the caller stops, releases and proves the closure.
 */
export function unobservedLaunchTerminal({ dispatch }, { show = workerShow } = {}) {
  const shown = readDispatch(show, dispatch);
  if (shown?.hostUnavailable === true || shown?.ok !== true)
    return { ok: false, reason: 'kernel-launch-host-unavailable', dispatch, error: shown?.error ?? 'worker-show did not answer' };
  const states = statesOf(shown), stage = shown.result?.worker?.stage ?? null;
  const answered = shown.result?.dispatch?.id ?? null;
  if (answered !== null && answered !== dispatch) return { ok: false, reason: 'kernel-launch-dispatch-mismatch', dispatch, answered };
  const handle = shown.result?.worker?.agentTerminalHandle ?? shown.result?.dispatch?.assigneeHandle ?? null;
  if (!handle) return { ok: false, reason: 'kernel-launch-terminal-unnamed', dispatch, states, stage };
  const dispatchOk = states.dispatch === null || states.dispatch === 'pending' || SETTLED.has(states.dispatch);
  const quiet = (UNOBSERVED_WORKER.has(states.worker) || SETTLED.has(states.worker)) && dispatchOk && shown.result?.dispatch?.lastHeartbeatAt == null;
  if (!quiet) return { ok: false, reason: 'kernel-launch-worker-live', dispatch, terminal: handle, states, stage, heartbeat: shown.result?.dispatch?.lastHeartbeatAt ?? null };
  return { ok: true, handle, evidence: { dispatch, states, stage, terminal: handle, source: 'worker-show' } };
}
