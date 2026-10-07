// Recovery retains the original launch fence until exact worker and provider custody are closed.
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { clearSignal } from '../../engine/db/ledger.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { stopAndRelease, workerClosureProven } from '../machine/worker-close.mjs';
import { releaseAgentAdmission } from '../agent/admission.mjs';
import { workflowStartAuthority } from './workflow-startup.mjs';
import { kernelLaunchNoEffect } from './workflow-launch-no-effect.mjs';

/** Close the caller-owned Dispatch through the existing terminal/process-tree proof owner. */
export function releaseWorkflowWorker(dispatchId, handle = null, { env = process.env, close = stopAndRelease } = {}) {
  let released;
  try { released = close(dispatchId, { handle, env }); }
  catch (error) { released = { ok: false, error: String(error?.message ?? error) }; }
  const proven = workerClosureProven(released, handle);
  return { ...released, handle, dispatch: dispatchId, ok: proven,
    ...(proven ? {} : { error: released?.release?.error ?? released?.stop?.error ?? released?.error ?? 'worker terminal or process exit is unproven' }) };
}

/** Reconcile only the original held launch; incomplete identity, closure or release retains its signal and capacity. */
export function recoverWorkflowLaunch(ledger, { workflowId, signal, env = process.env },
  { close = stopAndRelease, releaseAdmission = releaseAgentAdmission, now = Date.now, noEffect = kernelLaunchNoEffect } = {}) {
  const value = parseJsonOr(signal?.value_json), admission = value?.admission, receipt = admission?.receipt;
  const held = (reason, extra = {}) => ({ ok: false, reason, effectState: 'unknown', signal, ...extra });
  const owned = signal?.scope === 'kernel' && signal.key === workflowId && signal.workflow_id === workflowId
    && typeof signal.token === 'string' && signal.token && value?.state === 'launch-unknown';
  const authority = () => workflowStartAuthority({
    workflow: ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId),
    goal: ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId)
  });
  const current = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const expected = authority();
  if (owned && !value.terminal && !value.dispatch && receipt?.role === 'kernel' && !receipt.handle
      && typeof receipt.id === 'string' && receipt.id && Number.isInteger(receipt.fence)) {
    // No terminal and no Dispatch exist to close: only recorded Orca refusal evidence releases the attempt.
    if (!expected.ok || canonicalJSON(current()) !== canonicalJSON(signal)) return held('kernel-launch-recovery-authority-lost');
    const proof = noEffect(ledger, { workflowId, signal, value });
    if (!proof.ok) return held(proof.reason, proof);
    let budget;
    try { budget = releaseAdmission(admission, { kind: 'failed-before-launch', confirmed: true }, { env }); }
    catch (error) { budget = { ok: false, error: String(error?.message ?? error) }; }
    if (budget?.ok !== true) return held('kernel-launch-capacity-retained', { budget, evidence: proof.evidence });
    return clearReconciled({ ledger, workflowId, signal, authority, current, expected, held, now }, { budget, evidence: proof.evidence },
      { dispatch: null, terminal: null });
  }
  if (!owned
      || typeof value.dispatch !== 'string' || !value.dispatch || typeof value.terminal !== 'string' || !value.terminal
      || receipt?.role !== 'kernel' || receipt.handle !== value.terminal
      || typeof receipt.id !== 'string' || !receipt.id || !Number.isInteger(receipt.fence)
      || typeof receipt.attemptId !== 'string' || !receipt.attemptId)
    return held('kernel-launch-custody-incomplete');
  if (!expected.ok || canonicalJSON(current()) !== canonicalJSON(signal))
    return held('kernel-launch-recovery-authority-lost');
  const closure = releaseWorkflowWorker(value.dispatch, value.terminal, { env, close });
  if (!closure.ok) return held('kernel-launch-closure-unverified', { closure });
  let budget;
  try {
    budget = releaseAdmission(admission, { kind: 'closed', confirmed: true, handle: value.terminal,
      terminalProof: closure.closed.proof, processVerdict: closure.processes.verdict }, { env });
  } catch (error) { budget = { ok: false, error: String(error?.message ?? error) }; }
  if (budget?.ok !== true) return held('kernel-launch-capacity-retained', { closure, budget });
  return clearReconciled({ ledger, workflowId, signal, authority, current, expected, held, now }, { closure, budget },
    { dispatch: value.dispatch, terminal: value.terminal });
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
