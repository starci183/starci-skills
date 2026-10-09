// The existing CLI gate consumers share its private placement/evidence owners.
import { judgeJobLoop, judgeJobProofs } from '../gate-settle.mjs';
import { judgeCriticVerdict } from '../critic-settle.mjs';
import { observationContextOf, mechanismObservations } from '../mechanism-observation.mjs';
import { latestContractOf } from '../../machine/contract-version.mjs';
import { parseJson } from '../../lib/json.mjs';
import { jobPayloadOf } from '../verbs/shared/rows.mjs';
import { reboundBindingOf, reboundMapOf } from '../../machine/placement-rebound.mjs';
import { runtimeCriticRunOf } from './critic-run.mjs';

/** Bind the native consumers to the CLI's existing private context and placement
 * functions. The proof consumer stays synchronous for the workflow-lock recheck. */
export function mechanismGates({ skillRoot, settleJobContext, settleJobFiles, jobPlacements, opGateBasesOf }) {
// The op loop a code-writing op's settle owes (scripts/kernel/gate-settle.mjs over knowledge/op-gate.yaml): the runtime re-reads
// the op's attached gate JSON and READ digest itself and resolves the touched kinds with the app's own starci app explain. Read-only
// here - starci kernel settle records the judgment. Applicable operations require their recorded target baseline and complete current READ.
async function settleOpGate(db, jobId, repo) {
  const s = settleJobContext(db, jobId, { requiresReport: true });
  if (!s) return null;
  const { roots, files } = settleJobFiles(db, s.job, repo, s.filed, { jobId: s.job.job_id });
  // A workflow-worktree op is gated against a checkpoint its side has not moved since (op-gate-base-mismatch otherwise).
  const gateBases = opGateBasesOf({ db, env: process.env }, { workflowId: s.job.workflow_id, opId: s.job.job_id });
  const context = parseJson(latestContractOf(db, s.job.job_id)?.context_json);
  const recorded = context?.packet?.context?.gate_binding;
  const binding = reboundBindingOf(recorded, reboundMapOf(db, s.filed.attemptId), jobPlacements(db, s.job, repo));
  const judgment = await judgeJobLoop({ op: s.op, files, roots: roots.length ? roots : [repo], gateBases, binding,
    mode: context?.packet?.context?.selected_op?.mode ?? (typeof jobPayloadOf(s.job).params?.mode === 'string' ? jobPayloadOf(s.job).params.mode : null) });
  return judgment ? { ...judgment, jobId: s.job.job_id, attemptId: s.filed.attemptId, status: s.job.status } : null;
}
// The mechanism proofs an op owes at settle (scripts/kernel/gate-settle.mjs judgeJobProofs over knowledge/op-gate.yaml opProofs):
// the test world, the unit kit, the document gate, the READ of a deciding op, the lint of a security or interface op, the review
// gate and defect classes, the release proof. Current admitted legs require their native check_runs output; attachments retain the manual review and READ identity obligations. Read-only here - starci kernel settle
// records the judgment. Null when the selected op mode owes no mechanism proof.
function settleOpProofs(db, jobId, repo) {
  const s = settleJobContext(db, jobId, { requiresReport: true });
  if (!s) return null;
  const { files } = settleJobFiles(db, s.job, repo, s.filed, { jobId: s.job.job_id });
  let context;
  try { context = observationContextOf(db, s.job, { repo, skillRoot }); }
  catch (error) { return { op: s.op, attemptId: s.filed.attemptId, proof: null, proofs: [], judged: { status: 'unavailable', code: 'op-gate-tool-failed', detail: error.message, findings: [] } }; }
  const mode = context?.selected?.mode ?? (typeof jobPayloadOf(s.job).params?.mode === 'string' ? jobPayloadOf(s.job).params.mode : null);
  const judgment = judgeJobProofs({ op: s.op, files, mode, context, observations: context ? mechanismObservations(db, context) : null });
  return judgment ? { ...judgment, jobId: s.job.job_id, attemptId: s.filed.attemptId, status: s.job.status } : null;
}
// The independent Critic's verdict a decision leg owes at settle (scripts/kernel/critic-settle.mjs over modules/kernel/critic.yaml coverage):
// null when the op owes none, else the judgment of the attached verdict against the op's records now.
function settleCriticVerdict(db, jobId, repo) {
  const s = settleJobContext(db, jobId, { requiresReport: true });
  if (!s) return null;
  const { roots, files } = settleJobFiles(db, s.job, repo, s.filed, { jobId: s.job.job_id });
  const owned = (jobPayloadOf(s.job).owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && !p.includes(':'));
  const runtime = runtimeCriticRunOf(db, s.job.job_id)?.document ?? null;
  const teaches = String(latestContractOf(db, s.job.job_id)?.markdown ?? '').includes('decision-critic');
  const judged = judgeCriticVerdict({ op: s.op, files, roots: [...new Set([...roots, repo].filter(Boolean))], owned, runtime, teaches });
  return judged ? { op: s.op, judged, jobId: s.job.job_id, attemptId: s.filed.attemptId, status: s.job.status } : null;
}
  return { settleOpGate, settleOpProofs, settleCriticVerdict };
}
