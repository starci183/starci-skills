// retry-move.mjs — the typed move that runs a job again: `starci kernel enqueue --retry-of <job>` with the job's own write set,
// records, cut, repository and params. The projection of `starci kernel status` attaches it to every next action that is a retry
// of a known job, so the runtime (scripts/reconciler/mechanical-moves.mjs) and the Kernel's menu (scripts/kernel/kernel-menu.mjs)
// execute one definition.
import { jobPayloadOf } from './verbs/shared/rows.mjs';

export const csv = (list) => (Array.isArray(list) ? list.map(String).filter(Boolean).join(',') : '');

/** The enqueue arguments that retry `row` (a jobs row), or null when the job has no write set to repeat. */
export function retryMoveOf(row, { op = row?.op_id ?? null, retryOf = row?.job_id ?? null } = {}) {
  if (!row || !op || !retryOf) return null;
  const payload = jobPayloadOf(row);
  const paths = csv(payload.owned_paths);
  if (!paths) return null;
  const records = csv(payload.records);
  const cut = payload.cut && typeof payload.cut === 'object' ? payload.cut : null;
  const params = payload.params && Object.keys(payload.params).length ? JSON.stringify(payload.params) : null;
  const args = { workflow: row.workflow_id, op, paths, 'retry-of': retryOf };
  if (records) args.records = records;
  if (cut?.id && cut.ordinal != null && cut.total != null) Object.assign(args, { 'cut-id': String(cut.id), 'cut-ordinal': String(cut.ordinal), 'cut-total': String(cut.total) });
  if (payload.repository) args.repository = String(payload.repository);
  if (params) args.params = params;
  if (typeof payload.displayWhat === 'string' && payload.displayWhat) args.what = payload.displayWhat.slice(0, 60);
  return { verb: 'enqueue', args };
}
