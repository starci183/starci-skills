// plan-prerequisites.mjs - the legs whose records work.author proves against, checked by `starci kernel dispatch`. work.author
// authors implementation and uat records that prove requirement, design and interface records (modules/goal/legality.yaml
// workAuthorAfter); dispatched before those legs settled green it finds nothing to prove against and ends blocked on a missing
// input the Kernel then holds for hours. The plan law already orders the legs (route/plan-edges.mjs); this is the dispatch-side
// refusal: a plan ancestor of work.author in that list with no succeeded job in the workflow is an unmet prerequisite, typed
// WORK_AUTHOR_PREREQUISITE_UNSETTLED, naming the leg and the state of its newest job.
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { planAncestorsOf } from '../route/plan-edges.mjs';
import { goalJsonOf, latestGoal } from './verbs/shared/rows.mjs';

export const WORK_AUTHOR_PREREQUISITE_UNSETTLED = 'WORK_AUTHOR_PREREQUISITE_UNSETTLED';
const AUTHOR_OP = 'work.author';

/** The workflow's legs that must have a succeeded job before work.author runs: its plan ancestors named by workAuthorAfter. */
export function authorPrerequisiteLegs(goalJson) {
  const named = readModuleJson('modules', 'goal', 'legality.yaml').workAuthorAfter ?? [];
  const ancestors = new Set(planAncestorsOf(goalJson ?? {}).get(AUTHOR_OP) ?? []);
  return named.filter((leg) => ancestors.has(leg));
}

/** [{kind, code, op, state, jobId}] for each prerequisite leg of `op` without a succeeded job; empty for any op but work.author. */
export function unsettledPlanPrerequisites(db, { workflowId, op }) {
  if (op !== AUTHOR_OP) return [];
  const rows = db.prepare('SELECT job_id, op_id, status FROM jobs WHERE workflow_id=? ORDER BY created_at, rowid').all(workflowId);
  return authorPrerequisiteLegs(goalJsonOf(latestGoal(db, workflowId)))
    .filter((leg) => !rows.some((row) => row.op_id === leg && row.status === 'succeeded'))
    .map((leg) => {
      const newest = rows.filter((row) => row.op_id === leg).at(-1) ?? null;
      return { kind: 'plan-prerequisite-unsettled', code: WORK_AUTHOR_PREREQUISITE_UNSETTLED, op: leg, state: newest?.status ?? 'no-job', jobId: newest?.job_id ?? null };
    });
}

/** The line a refused Kernel acts on for one unsettled prerequisite leg. */
export const planPrerequisiteLine = (item) => (item.jobId
  ? `${WORK_AUTHOR_PREREQUISITE_UNSETTLED}: the plan leg ${item.op} has not settled green (job ${item.jobId} is ${item.state}); work.author proves against its records, so settle that leg first and dispatch this job after it`
  : `${WORK_AUTHOR_PREREQUISITE_UNSETTLED}: the plan leg ${item.op} has no job; work.author proves against its records, so enqueue and settle ${item.op} first and dispatch this job after it`);
