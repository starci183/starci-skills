// Recovery retains the original launch fence until exact worker and provider custody are closed.
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { clearSignal } from '../../engine/db/ledger.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { stopAndRelease, workerClosureProven } from '../machine/worker-close.mjs';
import { observeAgentAdmission, releaseAgentAdmission } from '../agent/admission.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { shortHash } from '../lib/hash.mjs';
import { workflowStartAuthority } from './workflow-startup.mjs';
import { kernelLaunchNoEffect } from './workflow-launch-no-effect.mjs';
import { settledLaunchTerminal, unobservedLaunchTerminal } from './workflow-launch-settled.mjs';

/** Close the caller-owned Dispatch through the existing terminal/process-tree proof owner. */
export function releaseWorkflowWorker(dispatchId, handle = null, { env = process.env, close = stopAndRelease } = {}) {
  let released;
  try { released = close(dispatchId, { handle, env }); }
  catch (error) { released = { ok: false, error: String(error?.message ?? error) }; }
  const proven = workerClosureProven(released, handle);
  return { ...released, handle, dispatch: dispatchId, ok: proven,
    ...(proven ? {} : { error: released?.release?.error ?? released?.stop?.error ?? released?.error ?? 'worker terminal or process exit is unproven' }) };
}

/**
 * Undo a started Kernel launch whose publication failed, for any cause: the exact Dispatch is stopped and released with terminal and process proof,
 * and only a proven closure unbinds the terminal's guard. The returned receipt (ok false = closure unproven) rides on the start failure.
 */
export function rollbackUnpublishedKernel({ dispatchId, handle, unbind }, { release = releaseWorkflowWorker } = {}) {
  const cleanup = release(dispatchId, handle);
  if (cleanup.ok) { try { unbind(handle); } catch { /* pruned by age later */ } }
  return cleanup;
}

const filled = (value) => typeof value === 'string' && value !== '';

/** The admission released under the event `eventOf` builds; a throwing build or release is a refused one carrying its message. */
function releasing(releaseAdmission, admission, eventOf, env) {
  try { return releaseAdmission(admission, eventOf(), { env }); }
  catch (error) { return { ok: false, error: String(error?.message ?? error) }; }
}

/** An owned launch whose Orca start never named a terminal or Dispatch: the receipt alone is custody. */
const isUnboundLaunch = (owned, value, receipt) => owned && !value.terminal && !value.dispatch && receipt?.role === 'kernel'
  && !receipt.handle && filled(receipt.id) && Number.isInteger(receipt.fence);

/** An owned launch whose Dispatch, terminal and receipt all name the same worker. */
const isBoundLaunch = (owned, value, terminal, receipt) => owned && filled(value.dispatch) && filled(terminal)
  && receipt?.role === 'kernel' && receipt.handle === terminal && filled(receipt.id) && Number.isInteger(receipt.fence) && filled(receipt.attemptId);

/** Whether `signal` is the held `launch-unknown` signal of this workflow's own Kernel launch. */
const ownsLaunch = (signal, workflowId, value) => signal?.scope === 'kernel' && signal.key === workflowId && signal.workflow_id === workflowId
  && typeof signal.token === 'string' && signal.token && value?.state === 'launch-unknown';

/** An owned launch with a Dispatch but no bound terminal: Orca's own report of the Dispatch settles it. */
const isUnadopted = (owned, value, receipt) => owned && value.dispatch && !value.terminal && receipt?.handle;

/** An owned launch whose signal names a Dispatch, no terminal, and whose receipt names no handle either: Orca's record of that exact Dispatch is the only custody evidence. */
const isUnreceipted = (owned, value, receipt) => owned && filled(value.dispatch) && !value.terminal && receipt?.role === 'kernel' && !receipt.handle
  && filled(receipt.id) && Number.isInteger(receipt.fence) && filled(receipt.attemptId);

/**
 * Opens ONE Supervisor Decision Item for a held launch whose Dispatch Orca knows (idempotent per signal token and reason), naming the Dispatch, the terminal
 * Orca reports and the evidence of the refusal, so a held launch always has an owner. Never throws; returns the item or null.
 */
export function escalateHeldLaunch(ledger, { workflowId, signal, reason, evidence }, { machine = withMachine, env = process.env } = {}) {
  try {
    const generation = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId)?.generation ?? 0;
    const payload = { workflowId, reservation: signal.token, reason, ...evidence };
    return machine((m) => m.openSupDecision({
      keyParts: { kind: 'kernel-launch-held', entity: shortHash(JSON.stringify([ledger.ledgerId, workflowId])), signature: shortHash(JSON.stringify([signal.token, reason])), head: String(generation) },
      kind: 'runtime-defect', decider: 'supervisor', openedBy: 'kernel-start', ledgerId: ledger.ledgerId, workflowId, entityType: 'kernel', entityId: workflowId,
      summary: `A Kernel launch is held (${reason}): Dispatch ${evidence.dispatch ?? '?'} names terminal ${evidence.terminal ?? 'none'}; verify its worker and close it, then the start proceeds.`,
      evidence: payload, payload: { ledgerFile: ledger.file, generation, ...payload } }), { env });
  } catch { return null; }
}

/** Reconcile only the original held launch; incomplete identity, closure or release retains its signal and capacity. */
export function recoverWorkflowLaunch(ledger, { workflowId, signal, env = process.env },
  { close = stopAndRelease, releaseAdmission = releaseAgentAdmission, observeAdmission = observeAgentAdmission, now = Date.now, noEffect = kernelLaunchNoEffect, settled = settledLaunchTerminal,
    unobserved = unobservedLaunchTerminal, escalate = escalateHeldLaunch } = {}) {
  const value = parseJsonOr(signal?.value_json), admission = value?.admission, receipt = admission?.receipt;
  const held = (reason, extra = {}) => ({ ok: false, reason, effectState: 'unknown', signal, ...extra });
  const owned = ownsLaunch(signal, workflowId, value);
  const authority = () => workflowStartAuthority({
    workflow: ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId),
    goal: ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId)
  });
  const current = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const expected = authority();
  if (isUnboundLaunch(owned, value, receipt)) {
    // No terminal and no Dispatch exist to close: only recorded Orca refusal evidence releases the attempt.
    if (!expected.ok || canonicalJSON(current()) !== canonicalJSON(signal)) return held('kernel-launch-recovery-authority-lost');
    const proof = noEffect(ledger, { workflowId, signal, value });
    if (!proof.ok) return held(proof.reason, proof);
    const budget = releasing(releaseAdmission, admission, () => ({ kind: 'failed-before-launch', confirmed: true }), env);
    if (budget?.ok !== true) return held('kernel-launch-capacity-retained', { budget, evidence: proof.evidence });
    return clearReconciled({ ledger, workflowId, signal, authority, current, expected, held, now }, { budget, evidence: proof.evidence },
      { dispatch: null, terminal: null });
  }
  // A Dispatch without a bound terminal (the start failed before Orca's answer named one) is reconciled from Orca's own report of it.
  const adopted = isUnadopted(owned, value, receipt) ? settled({ dispatch: value.dispatch, receipt }) : null;
  if (adopted?.ok === false) return held(adopted.reason, adopted);
  if (isUnreceipted(owned, value, receipt)) return recoverUnreceipted({ ledger, workflowId, signal, value, admission, env },
    { close, releaseAdmission, observeAdmission, now, unobserved, escalate, held, authority, current, expected });
  const terminal = adopted?.handle ?? value?.terminal;
  if (!isBoundLaunch(owned, value, terminal, receipt)) return held('kernel-launch-custody-incomplete');
  if (!expected.ok || canonicalJSON(current()) !== canonicalJSON(signal))
    return held('kernel-launch-recovery-authority-lost');
  const closure = releaseWorkflowWorker(value.dispatch, terminal, { env, close });
  if (!closure.ok) return held('kernel-launch-closure-unverified', { closure });
  const budget = releasing(releaseAdmission, admission, () => ({ kind: 'closed', confirmed: true, handle: terminal,
    terminalProof: closure.closed.proof, processVerdict: closure.processes.verdict }), env);
  if (budget?.ok !== true) return held('kernel-launch-capacity-retained', { closure, budget });
  return clearReconciled({ ledger, workflowId, signal, authority, current, expected, held, now }, { closure, budget, evidence: adopted?.evidence },
    { dispatch: value.dispatch, terminal });
}

/** Clear the held signal and record the reconciliation only while the same accepted goal and signal still own the ledger. */
function clearReconciled({ ledger, workflowId, signal, authority, current, expected, held, now }, { closure = null, budget, evidence = null }, identity) {
  return ledger.transaction(() => {
    const actual = authority();
    if (!actual.ok || canonicalJSON(actual) !== canonicalJSON(expected)
        || canonicalJSON(current()) !== canonicalJSON(signal))
      return held('kernel-launch-recovery-authority-lost', { closure, budget });
    if (!clearSignal(ledger.db, { scope: 'kernel', key: workflowId, token: signal.token }))
      return held('kernel-launch-recovery-authority-lost', { closure, budget });
    const receipt = parseJsonOr(signal.value_json)?.admission?.receipt;
    ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: actual.generation,
      kind: 'kernel-launch-reconciled', createdAt: now(),
      payload: { reservation: signal.token, holderPid: signal.holder_pid, ...identity, admission: receipt, closure, budget, ...(evidence ? { evidence } : {}) } });
    return { ok: true, effectState: 'none', signal, closure, budget, ...(evidence ? { evidence } : {}) };
  });
}

/**
 * A held launch that names a Dispatch but neither a terminal nor a receipt handle (Orca's answer named no terminal): the Dispatch id is identity-bound to this launch
 * (this start created it and the signed signal stores it), so the terminal Orca reports for THAT Dispatch is adopted, only while the signal is unchanged and the start
 * authority holds, and only when no turn ever started. The terminal is bound to the original reservation, the worker is stopped and released with the closure proof, the
 * original reservation is released and the signal cleared in one guarded transaction. Every refusal keeps custody and opens one Supervisor item.
 */
function recoverUnreceipted({ ledger, workflowId, signal, value, admission, env }, { close, releaseAdmission, observeAdmission, now, unobserved, escalate, held, authority, current, expected }) {
  const refuse = (reason, extra = {}) => {
    const item = escalate(ledger, { workflowId, signal, reason, evidence: { dispatch: value.dispatch, terminal: extra.terminal ?? null, ...extra } }, { env });
    return held(reason, { ...extra, ...(item ? { supervisorItem: item } : {}) });
  };
  if (!expected.ok || canonicalJSON(current()) !== canonicalJSON(signal)) return held('kernel-launch-recovery-authority-lost');
  const seen = unobserved({ dispatch: value.dispatch });
  if (seen.ok !== true) return refuse(seen.reason, seen);
  const terminal = seen.handle;
  const bound = observeAdmission(admission, { state: 'unknown', handle: terminal }, { env });
  if (bound?.ok !== true) return refuse('kernel-launch-handle-unbound', { terminal, evidence: seen.evidence, budget: bound });
  const closure = releaseWorkflowWorker(value.dispatch, terminal, { env, close });
  if (!closure.ok) return refuse('kernel-launch-closure-unverified', { terminal, evidence: seen.evidence, closure });
  const budget = releasing(releaseAdmission, admission, () => ({ kind: 'closed', confirmed: true, handle: terminal,
    terminalProof: closure.closed.proof, processVerdict: closure.processes.verdict }), env);
  if (budget?.ok !== true) return refuse('kernel-launch-capacity-retained', { terminal, evidence: seen.evidence, closure, budget });
  return clearReconciled({ ledger, workflowId, signal, authority, current, expected, held: (reason, extra) => refuse(reason, { terminal, ...extra }), now },
    { closure, budget, evidence: seen.evidence }, { dispatch: value.dispatch, terminal });
}
