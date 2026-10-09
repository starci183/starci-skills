// The runtime Critic of `starci kernel status`: the Critic runs the settler owes the decision legs still open (scripts/kernel/settle/critic-run.mjs),
// shown beside the settle frontier with who judged, the model, the time, the tokens and the verdict, so the run is visible like the work of an op.
// It is information, never a choice: the runtime owns the run and, when the Critic cannot judge, retries it bounded and then tells the Supervisor.
import { parseJson } from '../../../lib/json.mjs';
import { RUNTIME_CRITIC_EVENT } from '../../settle/critic-run.mjs';
import { settlerSettings } from '../../settle/job-settle-verify.mjs';
import { CRITIC_USAGE_EVENT } from '../../critic-run-usage.mjs';

/** The newest runtime Critic run of each open job of the workflow: [{jobId, op, critic, outcome, pass, code, try, at}]. */
export function runtimeCriticsOf(db, workflowId) {
  const rows = db.prepare(`SELECT e.entity_id, e.created_at, e.payload_json FROM events e JOIN jobs j ON j.job_id=e.entity_id
    WHERE e.workflow_id=? AND e.kind=? AND j.status IN ('running','answering','reported') ORDER BY e.seq`).all(workflowId, RUNTIME_CRITIC_EVENT);
  const maxAttempts = settlerSettings().tail.maxAttempts;
  const tokensOf = new Map(db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=?').all(workflowId, CRITIC_USAGE_EVENT)
    .map((row) => parseJson(row.payload_json, {}) ?? {}).map((usage) => [usage.dispatchId, usage.tokens ?? null]));
  const keyOf = (critic) => critic?.dispatchId ?? critic?.taskId ?? null;
  const latest = new Map();
  for (const row of rows) {
    const body = parseJson(row.payload_json, {}) ?? {};
    const critic = { ...body.critic, tokens: tokensOf.get(keyOf(body.critic)) ?? null };
    latest.set(row.entity_id, { jobId: row.entity_id, op: body.op ?? null, critic, maker: body.maker ?? null, outcome: body.outcome ?? null,
      pass: body.pass ?? null, code: body.code ?? null, try: body.try ?? 1, maxAttempts, at: Number(row.created_at) });
  }
  return [...latest.values()];
}

/** The status line of one run. */
export function runtimeCriticLine(run) {
  let verdict = `hold ${run.code ?? 'CRITIC_UNAVAILABLE'}, try ${run.try} of ${run.maxAttempts} (then a Supervisor item)`;
  if (run.outcome === 'verdict') verdict = run.pass ? 'verdict pass' : 'verdict fail (the op\'s error-work)';
  const critic = run.critic;
  return `  runtime-critic: ${run.jobId} (${run.op ?? '-'}) judged by ${critic.provider ?? '?'}/${critic.model ?? '?'} of the maker ${run.maker ?? '?'}, ${critic.durationMs ?? '?'}ms, tokens ${critic.tokens ?? 'unmeasured'}, ${verdict} - the runtime's run, nothing is asked of the Kernel`;
}
