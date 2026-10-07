// The policy step of a job a refused launch returned to ready (modules/kernel/op-incident-policy.yaml row error-launch): which
// pool refused it how often of the bound, so `starci kernel status` can say what runs next and when it escalates.
import { rejectionAttemptsOf } from '../../job-rejections.mjs';
import { agentSwitchOf, policyStepOf } from '../../op-incident-policy.mjs';

/** {launchRefusals: {pool, count, of}, policy: <step line>} for a job with switch-step launch refusals, else {}. */
export function launchRefusalViewOf(db, row) {
  const refused = rejectionAttemptsOf(db, row);
  if (!refused.length) return {};
  const last = refused.at(-1);
  const count = refused.filter((entry) => entry.pool === last.pool).length;
  const of = agentSwitchOf().excludeAfter;
  const step = policyStepOf('error-launch', { attempt: Math.min(count, of), of, detail: `${last.pool}: ${last.detail}` });
  return { launchRefusals: { pool: last.pool, count, of }, policy: step.line };
}
