// Op launch authority: scoped persisted owner constraints plus the already-qualified route.
import { spawnAgent } from '../../../agent/lib.mjs';
import { taskSpecOf } from '../../../machine/task-spec.mjs';
import { biasForRole } from '../../../lib/owner-routing-bias.mjs';
import { ownerReserveGrant, ownerBiasTrust } from '../../../agent/admission.mjs';
import { latestGoal, goalJsonOf } from './rows.mjs';
import { isRunFence, rebindAfterFence } from '../../orca-runs.mjs';

/**
 * The op launch. A launch the host refuses consumer_fenced at worker-start (the Kernel terminal is not the coordinator Orca has bound to the workflow Run) is the
 * runtime's to repair, never the agent's: the Run is re-bound to the Kernel terminal once and the launch retried once; a second fence is rejected as before.
 */
export function spawnOperationAgent(input, { rebind = rebindAfterFence, launch = launchOperationAgent } = {}) {
  const first = launch(input);
  if (!isRunFence(first)) return first;
  const fix = rebind({ runId: input.run, kernelHandle: input.from });
  if (!fix.rebound) return { ...first, runRebind: fix };
  recordRunRebound(input, fix);
  return { ...launch(input), runRebind: fix };
}

// The re-bind is a ledger fact: the digest and a later reader see why a launch was repeated.
function recordRunRebound({ ledger, job, jobId, run, from }, fix) {
  ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'run-rebound',
    payload: { runId: run, kernelTerminal: from, previousCoordinator: fix.previousCoordinator, by: jobId, reason: 'consumer_fenced at worker-start' } }));
}

function launchOperationAgent({ ledger, job, op, model, launchModel, payload, jobId, prompt, packetFile, ...launch }) {
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
    biasTrusted: ownerBiasTrust(ownerGoalRow), tier: payload.pick?.tier ?? null, history: {},
    difficulty: launchModel.difficulty ?? payload.difficulty,
    allowGroup: [{ provider: model.provider, model: modelId, pool: model.target, effort,
      eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } }] });
}
