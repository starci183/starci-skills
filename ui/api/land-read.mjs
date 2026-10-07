import path from 'node:path';
import { many, parse } from './query.mjs';

const withoutTrailingSeparators = value => {
  let end = value.length;
  while (end > 0 && (value[end - 1] === '/' || value[end - 1] === '\\')) end -= 1;
  return value.slice(0, end);
};
const repoKey = value => {
  if (typeof value !== 'string' || !value) return null;
  const normalized = withoutTrailingSeparators(path.normalize(value));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};
const sameRepo = (a, b) => repoKey(a) != null && repoKey(a) === repoKey(b);
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(value) ? value : null;
const paths = value => Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;

/** A recorded checkpoint effect exists independently of verdict and workflow finish/land. */
export function workflowCheckpoint(db, attempt) {
  if (attempt?.dispatched_at == null) return null;
  const workflow = attempt.workflow_id;
  const dispatches = many(db, 'SELECT attempt_id,dispatched_at FROM op_attempts WHERE workflow_id=? AND job_id=? AND dispatched_at IS NOT NULL ORDER BY dispatched_at DESC',
    workflow, attempt.job_id);
  const nextDispatchAt = dispatches.findLast(row => row.dispatched_at > attempt.dispatched_at)?.dispatched_at ?? null;
  const candidates = many(db, "SELECT * FROM events WHERE workflow_id=? AND kind='workflow-checkpoint' AND entity_type='job' AND entity_id=? AND occurred_at>=? AND (? IS NULL OR occurred_at<=?) ORDER BY occurred_at DESC,seq DESC",
    workflow, attempt.job_id, attempt.dispatched_at, attempt.settled_at ?? null, attempt.settled_at ?? null).flatMap(event => {
    if (attempt.settled_at == null && nextDispatchAt != null && event.occurred_at >= nextDispatchAt) return [];
    const receipt = parse(event.payload_json);
    if (!sha(receipt?.sha) || receipt.kind != null && receipt.kind !== event.kind) return [];
    if (event.attempt_id != null && event.attempt_id !== attempt.attempt_id ||
      receipt.attemptId != null && receipt.attemptId !== attempt.attempt_id ||
      receipt.dispatchId != null && receipt.dispatchId !== attempt.dispatch_id ||
      receipt.workflowId != null && receipt.workflowId !== workflow ||
      receipt.jobId != null && receipt.jobId !== attempt.job_id) return [];
    if (event.attempt_id == null && receipt.attemptId == null && receipt.dispatchId == null) {
      const eligible = dispatches.filter(row => row.dispatched_at <= event.occurred_at);
      if (eligible[0]?.attempt_id !== attempt.attempt_id || eligible[1]?.dispatched_at === eligible[0]?.dispatched_at) return [];
    }
    return [{ sha: receipt.sha, at: event.occurred_at, committed: typeof receipt.committed === 'boolean' ? receipt.committed : null,
      scope: paths(receipt.scope), files: paths(receipt.files) }];
  });
  return candidates.length === 1 ? candidates[0] : null;
}

/** A workflow receipt may be shown beside an attempt; association needs recorded head equality. */
export function workflowLand(db, attempt) {
  const workflow = attempt.workflow_id, repo = attempt.repo_root;
  if (!repoKey(repo)) return null;
  const checkpoint = workflowCheckpoint(db, attempt);
  const association = head => head && (head === checkpoint?.sha || head === sha(attempt.head_sha)) ? 'head-match' : 'unproven';
  const events = many(db, "SELECT * FROM events WHERE workflow_id=? AND entity_type='workflow' AND entity_id=? AND kind='workflow-landed' ORDER BY occurred_at DESC,seq DESC", workflow, workflow);
  for (const event of events) {
    const receipt = parse(event.payload_json);
    const head = sha(receipt?.head);
    if (!head || !sameRepo(receipt?.repoRoot, repo)) continue;
    const steps = Array.isArray(receipt.steps) ? receipt.steps : [];
    const push = steps.find(step => step?.step === 'push' && step.ok === true);
    return { scope: 'workflow', workflow, repo: receipt.repoRoot, branch: null, source: 'workflow-landed', result: 'landed',
      mergedSha: head, reason: null, output: null, at: event.occurred_at, steps,
      pushed: typeof push?.pushed === 'boolean' ? push.pushed : null, checkpoint, attemptAssociation: association(head) };
  }
  return null;
}
