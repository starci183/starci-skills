// route-failure.mjs — the next step of a failed or blocked job whose settle recorded none (`starci kernel reconcile --route-failure`,
// the Job controller's step for the `failed-no-step` hold of modules/kernel/op-incident-policy.yaml).
//
// settle routes a failed attempt through enqueueNextStep as it settles; a blocked attempt, or a job that settled before that
// route existed, was left with nothing after it. This runs the same route for it now. A gap blocker whose curing leg has
// not run yet, or landed after the blocked attempt read its records, is not a gap in the record: the op runs again behind
// that leg (a retry that spends no try of the gap route). Anything else takes the route table of modules/models/kinds.yaml.
import { jobResult, recordJobResult } from '../../../../engine/db/ledger.mjs';
import { readModuleJson } from '../../../../engine/runtime-root.mjs';
import { filedReportOf, unsteppedFailures, upstreamPlanOf } from '../../terminal-step.mjs';
import { independentChecksOf } from './check-evidence.mjs';
import { jobOpOf } from './rows.mjs';
import { UPSTREAM_ROUTE } from '../../upstream-retry.mjs';
import { CHECKER_UNAVAILABLE } from '../../critic-hold.mjs';
import { REJUDGE_REFUSED_EVENT, REJUDGE_ROUTE, admitRejudge } from '../../settle/rejudge.mjs';
import { workflowWorktreeOf } from '../../../machine/workflow-tree.mjs';



/** The workflow's jobs rows as the failure projections read them. */
const workflowJobsOf = (db, workflowId) => db.prepare("SELECT job_id, workflow_id, unit_id, op_id, status, try_no, retry_of, resume_of, created_at FROM jobs WHERE workflow_id=? AND kind='op'").all(workflowId);

const recordStep = (ledger, job, shape, step) => {
  recordJobResult(ledger.db, { jobId: job.job_id, result: { ...jobResult(ledger.db, job.job_id), nextStep: step } });
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: jobOpOf(job), shape, ...step } });
  return step;
};

/** The op runs again behind the leg that cures its blocker: one follow-on try, `after` that leg's newest job. */
function retryBehind({ ledger, job, internals }, shape, plan) {
  const routed = { route: UPSTREAM_ROUTE, from: job.job_id, firing: 1, limit: 1 };
  const retry = internals.enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [plan.after], reason: UPSTREAM_ROUTE, of: job.job_id, routed });
  const jobs = [retry.jobId].filter(Boolean);
  const reason = `${jobOpOf(job)} was blocked (${shape.blocker}) before ${plan.on} ${plan.mode === 'landed' ? 'landed' : 'finished'}: it runs again behind ${plan.after}`;
  if (!retry.enqueued && retry.reason !== 'retry-exists') return recordStep(ledger, job, shape, { kind: 'none', route: UPSTREAM_ROUTE, jobs: [], reason: `${reason}, but the retry was refused: ${retry.reason}` });
  return recordStep(ledger, job, shape, { kind: 'retry', route: UPSTREAM_ROUTE, counted: false, upstream: plan.on, mode: plan.mode, jobs, reason });
}

/** The route-table shape of the job's newest attempt: the report outcome, the failure class, and the blocker kind of a blocked report. */
function shapeOf({ db, job, internals }, report) {
  const attempt = db.prepare('SELECT verdict, report_outcome FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(job.job_id);
  const claimOverruled = attempt?.verdict === 'fail' && attempt?.report_outcome === 'done';
  const checks = independentChecksOf(db, { jobId: job.job_id })?.checks ?? [];
  const failure = report && !claimOverruled ? internals.failureClassOf(db, job, report.envelope, checks) : null;
  const base = internals.failureShapeOf({ reportFiled: Boolean(report), reportOutcome: report?.outcome ?? null, claimOverruled, failureClass: failure?.class ?? null, op: jobOpOf(job) });
  return { shape: report?.blocker ? { ...base, blocker: report.blocker } : base, failure };
}

/**
 * Routes one failed job that nothing follows. Returns {routed:false, reason} when the job owes no step,
 * {routed:false, wait} while the leg that cures its blocker has not started, else {routed:true, step}.
 */
export function routeFailure({ ledger, job, repo, internals }) {
  const db = ledger.db;
  if (job.status !== 'failed' || !unsteppedFailures(db, [job], workflowJobsOf(db, job.workflow_id)).length) return { routed: false, reason: 'owes-no-step' };
  const report = filedReportOf(db, job.job_id);
  const ctx = { db, ledger, job, repo, internals };
  const { shape, failure } = shapeOf(ctx, report);
  // A blocker the runtime owes (a Critic that could not judge) with the finished product preserved: the runtime judges it as the lineage's next attempt, with no op tokens.
  if (report?.blocker === CHECKER_UNAVAILABLE && job.status === 'failed') {
    const rejudged = admitRejudge(ledger, job, { internals, workflowTree: workflowWorktreeOf({ env: process.env }, job.workflow_id), repo });
    if (!rejudged.ok) ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: REJUDGE_REFUSED_EVENT, payload: { code: rejudged.code, detail: rejudged.detail ?? null } });
    if (rejudged.ok) return { routed: true, step: recordStep(ledger, job, shape, { kind: 'rejudge', route: REJUDGE_ROUTE, counted: false, jobs: [rejudged.jobId], digest: rejudged.digest, reason: `the blocker is a Critic that could not judge and the finished product is preserved (${rejudged.ref}): the runtime restored it and judges it with its own Critic as ${rejudged.jobId}; no op attempt is made` }) };
  }
  const plan = report?.blocker ? upstreamPlanOf(db, job, report.blocker, readModuleJson('modules', 'models', 'kinds.yaml')) : null;
  if (plan?.action === 'wait') return { routed: false, wait: plan };
  if (plan?.action === 'retry') return { routed: true, step: retryBehind(ctx, shape, plan) };
  return { routed: true, step: internals.enqueueNextStep(ledger, job, { shape, envelope: report?.envelope ?? null, repo, failure }) };
}
