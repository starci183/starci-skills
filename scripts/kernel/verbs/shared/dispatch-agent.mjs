// Op launch authority: scoped persisted owner constraints plus the already-qualified route.
import { spawnAgent } from '../../../agent/lib.mjs';
import { taskSpecOf } from '../../../machine/task-spec.mjs';
import { biasForRole } from '../../../lib/owner-routing-bias.mjs';
import { ownerReserveGrant } from '../../../agent/admission.mjs';
import { latestGoal, goalJsonOf } from './rows.mjs';

export function spawnOperationAgent({ ledger, job, op, model, launchModel, payload, jobId, prompt, packetFile, ...launch }) {
  const modelId = launchModel.modelId, effort = launchModel.effort ?? null;
  const ownerGoalRow = latestGoal(ledger.db, job.workflow_id);
  const ownerGoal = goalJsonOf(ownerGoalRow);
  const admissionScopeId = `${ledger.ledgerId ?? ledger.path}:${jobId}:attempt:${job.try_no ?? 0}`;
  const ownerBias = biasForRole(ownerGoal.routing_bias, 'op', admissionScopeId);

  // 3-6. The one agent launch (scripts/agent/lib.mjs spawnAgent): pre-trust, then worker-start --spec on the op's
  // worktree - Orca files the operation Task (the rendered packet prompt) in the workflow Run from the CURRENT kernel
  // terminal and starts its worker in one call, so a refused start leaves no orphan Task - then the agent terminal
  // (the start receipt, else worker-show), its [Op] title, and the attestation that the worker's EFFECTIVE agent/model
  // equal the route - a mismatch is a provider-side defect, rejected with the typed infra-provider incident. No
  // `--parent`: the Run's coordinator places the op under the Kernel (smoke 2026-10-01, launch.report.md). A packet
  // longer than the host's argv takes is written to the job's evidence directory and the spec points at it
  // (task-spec.mjs; inc-826e077777de). The start's ledger identity is the job and its lease token (calls.yaml
  // worker-start replay: request): a lost receipt replays this start, and a new lease is a new start.
  const spec = taskSpecOf({ prompt, file: packetFile, op, jobId, attempt: job.try_no }).spec;
  return spawnAgent({ ...launch, provider: model.provider, model: modelId, effort, spec, taskTitle: `${op} #${job.try_no}`,
    role: 'op', scopeId: admissionScopeId, kind: op, bias: ownerBias, ownerGrant: ownerReserveGrant(ownerGoalRow),
    difficulty: launchModel.difficulty ?? payload.difficulty,
    allowGroup: [{ provider: model.provider, model: modelId, pool: model.target, effort,
      eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } }] });
}
