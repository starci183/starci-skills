// The private overdue-seat actuator. Dispatch lineage is a locator; a fresh host read attests custody.
import { entryDispatchOf } from '../agent/depth-preflight.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { stopAndRelease, workerClosureProven } from '../machine/worker-close.mjs';

/** Close only the observed worker through its existing owner; request acceptance never proves closure. */
export function replaceOverdueWorker({ terminal, agent } = {}, {
  dispatchOf = entryDispatchOf, show = workerShow, close = (dispatch, handle) => stopAndRelease(dispatch, { handle })
} = {}) {
  const base = { schema: 'starci/turn-replace@1', terminal: terminal ?? null, agent: agent ?? null };
  const refuse = (reason, fields = {}) => ({ ...base, ok: false, effectState: 'none', reason, ...fields });
  if (!terminal) return refuse('terminal-identity-missing');
  let dispatch, observed;
  try {
    dispatch = dispatchOf(terminal);
    if (!dispatch) return refuse('worker-identity-missing');
    observed = show({ dispatch });
  } catch (error) { return refuse('worker-identity-unavailable', { error: String(error?.message ?? error) }); }
  const handle = observed?.agentTerminalHandle ?? observed?.dispatch?.assigneeHandle
    ?? observed?.result?.worker?.agentTerminalHandle ?? null;
  if (observed?.ok !== true || observed.hostUnavailable || handle !== terminal)
    return refuse('worker-identity-unproven', { dispatch, observation: observed ?? null });
  let receipt;
  try { receipt = close(dispatch, terminal); }
  catch (error) { receipt = { ok: false, error: String(error?.message ?? error) }; }
  const ok = receipt?.dispatch === dispatch && workerClosureProven(receipt, terminal);
  return { ...base, dispatch, ok, effectState: ok ? 'closed' : 'unknown', recoveryRequired: !ok,
    closure: receipt ?? null, ...(ok ? {} : { reason: 'worker-closure-unproven' }) };
}
