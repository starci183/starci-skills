// preserved-ref.mjs - where a failed or blocked attempt's work lives in a workflow worktree. Ops never commit, so the
// snapshot settle keeps (scripts/kernel/workflow-checkpoint.mjs preserveAndReset) is the only form that work has; a
// continuation applies it to its owned paths (contract change resume-from-preserved-ref). Ledger read only.
import { parseJson } from '../lib/json.mjs';

/**
 * The preserved ref of a job that settled failed or blocked in a workflow worktree: refs/heads/preserved/<wf>/<job>, the
 * snapshot of its owned paths the runtime kept at its settle (workflow-checkpoint.mjs preserveAndReset, event
 * workflow-op-preserved). Null when it left no work. Ops never commit: this is the only form a failed attempt's work has.
 */
export function preservedRefOf(db, jobId) {
  const row = db.prepare("SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='workflow-op-preserved' ORDER BY seq DESC LIMIT 1").get(jobId);
  const ref = parseJson(row?.payload_json ?? '', {})?.preservedRef;
  return typeof ref === 'string' && ref.startsWith('refs/heads/preserved/') ? ref : null;
}

