// Read-only joins of a native dispatch and its accepted goal grant; no prompt text grants authority.
import { canonicalJSON } from '../canonical-json.mjs';
import { sha256 } from '../digest.mjs';
import { byCodeUnit } from '../by-code-unit.mjs';
import { pathKey } from '../../scripts/lib/path-key.mjs';

const denied = reason => ({ ok: false, reason });
const parse = text => { try { return JSON.parse(text); } catch { return null; } };

/**
 * Verify a provider-plan grant against the exact live job, latest attempt, filed admission and
 * current owner-approved goal. The native caller-binding owner supplies `caller`; argv does not.
 * This verifies retained conversation acceptance, not cryptographic human identity.
 */
export function provisionGoalGrant(db, { caller, operationId, planSha, ledgerId, repoRoot, worktree }) {
  const guard = caller?.guard;
  if (!guard || caller.seat || guard.schema !== 'starci/op-guard@1' || guard.role !== 'op'
    || caller.classification?.role !== 'op' || caller.classification.jobId !== guard.jobId
    || caller.classification.workflowId !== guard.workflowId
    || guard.workflowId === 'supervisor' || guard.terminal !== caller.terminal
    || !guard.jobId || !guard.op || !guard.ledgerRepo || !guard.workflowWorktree
    || pathKey(guard.ledgerRepo) !== pathKey(repoRoot) || pathKey(guard.workflowWorktree) !== pathKey(worktree)
    || (caller.ledgerId !== undefined && caller.ledgerId !== ledgerId)
    || (caller.workflowId !== undefined && caller.workflowId !== guard.workflowId))
    return denied('provision-native-caller-unverified');
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(guard.jobId);
  const attempt = db.prepare('SELECT * FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(guard.jobId);
  const attemptId = attempt?.attempt_id;
  if (!Number.isSafeInteger(attemptId) || attemptId < 1
    || (caller.attemptId !== undefined && Number(caller.attemptId) !== attemptId)
    || (caller.dispatchId !== undefined && caller.dispatchId !== attempt.dispatch_id)) return denied('provision-native-attempt-unverified');
  if (!job || job.kind !== 'op' || job.status !== 'running' || job.workflow_id !== guard.workflowId || job.op_id !== guard.op
    || !attempt || attempt.job_id !== guard.jobId || attempt.workflow_id !== guard.workflowId
    || attempt.op_id !== guard.op || !attempt.dispatch_id || attempt.terminal_handle !== caller.terminal
    || attempt.managed !== 1 || attempt.started_at === null || attempt.attested_at === null
    || attempt.reported_at !== null || attempt.settled_at !== null || attempt.released_at !== null || attempt.end_state !== null
    || !attempt.worktree_path || pathKey(attempt.worktree_path) !== pathKey(worktree))
    return denied('provision-native-attempt-stale');
  const workflow = db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(guard.workflowId);
  const goal = db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(guard.workflowId);
  const unit = db.prepare('SELECT * FROM work_units WHERE workflow_id=? AND unit_id=?').get(guard.workflowId, job.unit_id);
  const goalJson = parse(goal?.json), payload = parse(job.payload_json);
  if (workflow?.phase !== 'running' || workflow.archived_at !== null || !goal || goal.approved_by !== 'owner'
    || !goal.markdown?.trim() || !goal.goal_identity || workflow.goal_identity !== goal.goal_identity || !goalJson || goalJson.provisional === true
    || !unit || unit.goal_revision !== goal.revision || unit.current_job_id !== job.job_id
    || payload?.goal_binding?.revision !== goal.revision || payload?.goal_binding?.identity !== goal.goal_identity)
    return denied('provision-goal-grant-stale');
  const contract = db.prepare('SELECT * FROM contracts WHERE attempt_id=?').get(attemptId);
  const context = parse(contract?.context_json), packet = context?.packet;
  if (contract?.workflow_id !== guard.workflowId || contract.job_id !== job.job_id || !contract.markdown?.trim()
    || packet?.op !== guard.op || packet.context?.workflow?.id !== guard.workflowId
    || packet.context?.workflow?.goal_revision !== goal.revision || packet.context?.workflow?.goal_identity !== goal.goal_identity
    || context.contract?.schema !== 'starci/contract-version@1' || context.contract?.op !== guard.op
    || !/^[a-f0-9]{64}$/u.test(context.contract?.digest ?? '') || !context.worktree || pathKey(context.worktree) !== pathKey(worktree)
    || !job.lease_token || context.lease?.token !== job.lease_token || !context.lease?.fencing || typeof context.lease.fencing !== 'object' || Array.isArray(context.lease.fencing))
    return denied('provision-filed-contract-unverified');
  const leases = db.prepare('SELECT resource_key,generation,token,expires_at FROM leases WHERE job_id=?').all(job.job_id);
  const fencing = context.lease.fencing;
  if (Object.keys(fencing).length !== leases.length || leases.some(lease => fencing[lease.resource_key] !== job.generation
    || lease.generation !== job.generation || lease.token !== job.lease_token || lease.expires_at <= Date.now()))
    return denied('provision-filed-contract-unverified');
  const grants = goalJson.provisionGrants, approval = goalJson.provisionGrantsApproval;
  if (!Array.isArray(grants) || new Set(grants.map(grant => grant?.operation)).size !== grants.length || grants.some(grant => !grant || Object.keys(grant).sort(byCodeUnit).join(',') !== 'digest,op,operation'
    || typeof grant.op !== 'string' || typeof grant.operation !== 'string' || !/^[a-f0-9]{64}$/u.test(grant.digest ?? '')))
    return denied('provision-goal-grant-unsupported');
  if (approval?.source !== 'owner-goal-entry' || approval.digest !== sha256(canonicalJSON(grants))
    || approval.assurance !== 'conversation-context-not-authenticated') return denied('provision-goal-grant-unaccepted');
  if (goal.revision === 0 ? goal.approval_ref !== approval.digest
    : goal.approval_ref !== goalJson.revision?.approvalToken || !/^rev-[a-f0-9]{64}$/u.test(goal.approval_ref ?? ''))
    return denied('provision-goal-grant-unaccepted');
  const matches = grants.filter(grant => grant.op === guard.op && grant.operation === operationId && grant.digest === planSha);
  if (matches.length !== 1) return denied('provision-goal-grant-missing');
  return { ok: true, kind: 'owner-goal', workflow: guard.workflowId, goalRevision: goal.revision,
    goalIdentity: goal.goal_identity, op: guard.op, job: job.job_id, attempt: attemptId,
    dispatch: attempt.dispatch_id, operation: operationId, digest: planSha, assurance: approval.assurance };
}
