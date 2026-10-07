// Every member of a job's tier chain refused or excluded for it: the runtime opens the declared escalation itself (modules/kernel/op-incident-policy.yaml
// row error-launch, next supervisor), once per (job, cause), holding only that job, with the per-member refusals as its evidence.
import { openSupervisorGate } from '../../autopilot-budget.mjs';
import { INCIDENT_CODES } from '../../op-incident-policy.mjs';

const CAUSE = INCIDENT_CODES.escalateSupervisor.code;

const exhaustedMembers = (decision, lineage) => {
  const chain = Array.isArray(decision?.chain) ? decision.chain : [];
  const rejected = Array.isArray(decision?.rejected) ? decision.rejected : [];
  if (!decision?.error || !(lineage?.exclude ?? []).length || !chain.length || rejected.length < chain.length) return null;
  return rejected.map((row) => ({ member: row.target, reasons: row.reasons ?? [row.reason] }));
};

const alreadyRaised = (db, workflowId, jobId) => db.prepare(`SELECT 1 FROM events WHERE workflow_id=? AND kind='incident-raised'
  AND json_extract(payload_json,'$.evidence.cause')=? AND json_extract(payload_json,'$.evidence.jobId')=? LIMIT 1`).get(workflowId, CAUSE, jobId) != null;

/** The supervisor-gate id opened for a job whose every tier member is spent, or null (still has a member, or already raised). */
export function escalateExhaustedMembers(ledger, { job, decision, lineage }) {
  const members = exhaustedMembers(decision, lineage);
  if (!members || alreadyRaised(ledger.db, job.workflow_id, job.job_id)) return null;
  let incidentId = null;
  ledger.transaction(() => {
    incidentId = openSupervisorGate(ledger, { workflowId: job.workflow_id, opId: job.op_id ?? null, holds: [job.job_id],
      detail: `every agent of the tier chain is spent for ${job.job_id} (${members.map((m) => m.member).join(', ')}): the Supervisor restores one of them or decides the retry, then resolves --by supervisor`,
      evidence: { cause: CAUSE, jobId: job.job_id, lineage: lineage.pools ?? {}, members } });
  });
  return incidentId;
}
