// job-rejections.mjs — the launch refusals one job row has met, counted per pool. A launch the host or the provider refused
// before the op accepted its contract spends no try and returns the same row to ready (cli.mjs rejectDispatch), so the retry
// lineage never sees it; this module reads them from the job's own dispatch-rejected events so route can move the job off a
// pool that keeps refusing (modules/kernel/op-incident-policy.yaml agentSwitch). Ledger reads only.
import { agentSwitchOf, INCIDENT_CODES } from './op-incident-policy.mjs';
import { parseJsonOr } from '../lib/json.mjs';

/** One lineage-shaped attempt per switch-step refusal of the job: {jobId, attempt, pool, cause, attributable, detail}. */
export function rejectionAttemptsOf(db, job) {
  const { switchSteps } = agentSwitchOf();
  const code = INCIDENT_CODES.agentSwitch.code;
  const rows = db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='dispatch-rejected' ORDER BY seq").all(job.job_id);
  return rows.map((row) => parseJsonOr(row.payload_json, {}))
    .filter((payload) => payload.effectState === 'none' && payload.model && switchSteps.includes(payload.step))
    .map((payload) => {
      const error = payload.error ? ' (' + String(payload.error).slice(0, 80) + ')' : '';
      return { jobId: job.job_id, attempt: job.attempt ?? job.try_no ?? null, pool: payload.model, cause: code, attributable: true, detail: `launch refused at ${payload.step}${error}` };
    });
}
