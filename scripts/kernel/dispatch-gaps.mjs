// A typed upstream product refusal remains actionable throughout dispatch backoff.
import { skillRoot } from '../../engine/runtime-root.mjs';
import { jobPayloadOf, ownedPathsOf } from './verbs/shared/rows.mjs';
import { memoOf } from './dispatch-refusal-memo.mjs';
import { workflowWorktreeOf } from '../machine/workflow-tree.mjs';
import { resolveGrammarContext, grammarMissingDetail } from './grammar-context.mjs';

/** One repair choice per waiting job whose typed cause still names a settled upstream product. */
export function dispatchGapsOf({ db, workflowId, repo, queued }) {
  return queued.filter((item) => item.queuedBecause === 'ready').flatMap((item) => {
    const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(item.jobId);
    const memo = memoOf(jobPayloadOf(job));
    const cause = memo?.cause;
    if (cause?.cause !== 'record-gap') return [];
    const upstream = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND op_id=? AND status NOT IN ('cancelled','superseded') ORDER BY created_at DESC, job_id DESC LIMIT 1").get(workflowId, cause.op);
    if (upstream?.status !== 'succeeded') return [];
    const tree = workflowWorktreeOf({ env: process.env }, workflowId)?.path ?? null;
    const context = resolveGrammarContext({ skillRoot, repo, tree, inputs: 'component-source' });
    const missing = context.missing.filter((entry) => entry.role === 'family-css');
    if (!missing.length) return [];
    const reason = `${job.op_id} refused ${memo.code}: settled ${cause.op} must repair ${cause.field}: ${grammarMissingDetail(missing)}`;
    return [{ jobId: job.job_id, upstreamJob: upstream.job_id, op: cause.op, paths: ownedPathsOf(jobPayloadOf(upstream)).join(','),
      reason, since: memo.firstAt, field: cause.field }];
  });
}
