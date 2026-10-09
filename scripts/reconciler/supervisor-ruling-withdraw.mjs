// scripts/reconciler/supervisor-ruling-withdraw.mjs — a standing Supervisor ruling that the runtime then contradicts is reconciled, never left to mislead the Kernel.
// The Supervisor ruled on a Kernel escape `shape-refused:<job>` ("do not run <job> again in the same shape"); the ruling is a fact on the Kernel's menu. When the
// dispatch guard no longer refuses that shape (the failure was routed behind a curing leg that landed, scripts/kernel/upstream-retry.mjs), the runtime dispatches the job, so the
// ruling would tell the Kernel the opposite of what happens. The runtime withdraws it: the ruling Decision Item is resolved by the runtime with the reason, the reason is
// journalled, and a Supervisor action record shows it on `starci supervisor actions` (the Supervisor may rule again on what then happens).
import { listDecisions } from '../machine/decisions.mjs';
import { failedShapesOf, jobRow, shapeOf } from '../kernel/kernel-authority.mjs';

const SHAPE_ESCAPE = /^menu-escape:[^:]+:shape-refused:(.+)$/;
const RUNNING_OR_AFTER = new Set(['queued', 'ready', 'leased', 'running', 'reported', 'succeeded']);

const jsonOf = (text) => { try { return JSON.parse(text); } catch { return {}; } };

/** The job a ruling's escape named, through the ruling's twin (`item`) in machine.sqlite and the twin's product item, or null. */
function escapedJobOf(db, sup, ruling) {
  const twin = ruling.item ? sup.prepare('SELECT payload_json FROM sup_decision_items WHERE di_id=?').get(ruling.item) : null;
  const origin = jsonOf(twin?.payload_json)?.refs?.decision;
  const row = origin ? db.prepare('SELECT idempotency_key FROM decision_items WHERE di_id=?').get(origin) : null;
  return SHAPE_ESCAPE.exec(String(row?.idempotency_key ?? ''))?.[1] ?? null;
}

/**
 * The open rulings of `workflowId` the runtime contradicts: [{id, job, reason}]. A ruling stands while its job's shape is refused by the dispatch guard
 * (or the job is gone); it is contradicted once the job is queued, running or settled and its shape is no longer the shape of a failed job.
 */
export function contradictedRulings(db, sup, { workflowId, now }) {
  if (!sup) return [];
  const open = listDecisions(db, { workflowId, decider: 'kernel', now }).filter((di) => di.kind === 'supervisor-ruling' && ['open', 'claimed'].includes(di.status));
  return open.flatMap((ruling) => {
    const job = escapedJobOf(db, sup, ruling);
    const row = job ? jobRow(db, job) : null;
    if (!row || !RUNNING_OR_AFTER.has(row.status)) return [];
    if (failedShapesOf(db, workflowId, row).has(shapeOf(row.op_id, row.payload))) return [];
    return [{ id: ruling.id, job, reason: `the dispatch guard no longer refuses the shape of ${job} (its failure was routed behind a curing leg that has landed), so the runtime runs it: the ruling "${String(ruling.summary).slice(0, 120)}" contradicts what happens` }];
  });
}
