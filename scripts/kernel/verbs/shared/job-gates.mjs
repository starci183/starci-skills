// job-gates.mjs — the admission gates `api route` and `api dispatch` hold a queued job to before a route decision
// or a launch is spent: the settle-first / live-worker / op-identity prelude (queuedJobOp), then the owner-gate and
// peer-wait incident refusals and the workflow's op-slot ceiling (refuseOwnerGate, refusePeerWait, opSlotsOrRefuse).
// The cli.mjs internals they need (observeOperationWorker, ownerGateOf, openOwnerGates, opSlotAdmission) arrive
// through the verb's `internals`; each refusal keeps the verb's own wording through `verb`, `opKey` (the op field
// name of the refusal object) and `suffix` (its trailing clause, dispatch's '; job stays queued').
import { jobPayloadOf, operationTerminalHandleOf } from './rows.mjs';
import { refuseSettleBacklog } from '../../kernel-authority.mjs';
import { openPeerWaits, PEER_WAIT } from './peer-waits.mjs';

/**
 * The settle-first + live-worker + op-identity prelude: refuses while filed reports wait unconsumed
 * (refuseSettleBacklog), throws job-live-worker when the job's exact worker is still live and writable (`liveHint`
 * names what reconcile replaces: 'rerouting', 'dispatching a duplicate'), and job-no-op when the job carries no op.
 * Returns { payload, op }.
 */
export function queuedJobOp(ledger, { job, verb, liveHint, internals }) {
  refuseSettleBacklog(ledger.db, job.workflow_id, verb);
  const priorWorker = operationTerminalHandleOf(job) ? internals.observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${job.job_id} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of ${liveHint}`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity`), { code: 'job-no-op' });
  return { payload, op };
}

/** A gate's refusal: emit `{ ok:false, ...out }` in the verb's wording and exit 1 (the job stays queued). */
const refuseGate = (emit, args, out, text) => { emit(out, text, args.json); process.exit(1); };

/**
 * The owner-gate refusal: an open owner-gate incident naming the job refuses the verb - no pool can run a step only
 * the owner drives. `opKey`/`suffix` are the verb's refusal wording; `internals` supplies ownerGateOf/openOwnerGates.
 */
export function refuseOwnerGate(ledger, { job, op, opKey, verb, suffix, emit, args, internals }) {
  const heldBy = internals.ownerGateOf(internals.openOwnerGates(ledger.db, job.workflow_id), job);
  if (!heldBy) return;
  refuseGate(emit, args, { ok: false, jobId: job.job_id, [opKey]: op, reason: heldBy.kind ?? 'owner-gate', incident: heldBy.incidentId },
    `${verb} REFUSED for ${job.job_id} (${op}): ${heldBy.kind ?? 'owner-gate'} — incident ${heldBy.incidentId} holds it until the Kernel resolves it${suffix}`);
}

/**
 * The peer-wait refusal: an open peer-wait naming the job refuses it until the peer lands what the wait holds on.
 * Runs after the owner gate (route) or after the deferred-cause check (dispatch) - the callers keep their order.
 */
export function refusePeerWait(ledger, { job, op, opKey, verb, suffix, emit, args, internals }) {
  const peerHeldBy = internals.ownerGateOf(openPeerWaits(ledger.db, job.workflow_id), job);
  if (!peerHeldBy) return;
  refuseGate(emit, args, { ok: false, jobId: job.job_id, [opKey]: op, reason: PEER_WAIT, incident: peerHeldBy.incidentId, peer: peerHeldBy.peer },
    `${verb} REFUSED for ${job.job_id} (${op}): peer-wait — incident ${peerHeldBy.incidentId} holds it until peer ${peerHeldBy.peer} lands what it waits on and the wait is resolved${suffix}`);
}

/**
 * The workflow op-slot ceiling (engine/admission.mjs): at or above it the job refuses as max-ops, never spending a
 * route decision or a launch. `internals` supplies opSlotAdmission. Returns the admission when a slot is free.
 */
export function opSlotsOrRefuse(ledger, { job, op, opKey, verb, suffix, emit, args, internals }) {
  const slots = internals.opSlotAdmission(ledger.db, job.workflow_id, { excludeJobId: job.job_id });
  if (!slots.ok) {
    refuseGate(emit, args, { ok: false, jobId: job.job_id, [opKey]: op, reason: 'max-ops', slots },
      `${verb} REFUSED for ${job.job_id} (${op}): max-ops — ${slots.running} operation(s) already hold a slot at ceiling ${slots.ceiling} (${slots.ceilingSource})${suffix}`);
  }
  return slots;
}
