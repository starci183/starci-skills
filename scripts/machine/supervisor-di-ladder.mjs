// supervisor-di-ladder.mjs — the last step of every hold chain (modules/kernel/op-incident-policy.yaml `ladder`): a Supervisor Decision Item
// nobody resolved is escalated one level per step interval past its due time until it reaches the owner level, where the Workers controller's
// urgent notice (scripts/reconciler/controllers/workers.mjs overdueUrgent) tells the owner once per DI with what was tried.
// A claimed item is the Supervisor working on it and is left alone.
import { boundValue, incidentPolicy } from '../kernel/op-incident-policy.mjs';

/** The ladder numbers from the table: {stepMs, ownerAfter}. */
export const ladderOf = () => {
  const { ladder } = incidentPolicy();
  return { stepMs: boundValue(ladder.stepMs), ownerAfter: boundValue(ladder.ownerAfter) };
};

/** Whether `di` (a Supervisor DI) is escalated one more level now: open or escalated, past due + level x step, below the owner level. Pure. */
export const ladderDue = (di, { now, stepMs, ownerAfter }) => ['open', 'escalated'].includes(di.status) && Number.isFinite(di.dueAt)
  && (di.escalations ?? 0) < ownerAfter && now >= di.dueAt + (di.escalations ?? 0) * stepMs;

/** Escalate every due Supervisor DI one level on the writer `m` (machine.sqlite); returns the escalated ids. */
export function escalateSupervisorDis(m, dis, { now, ...numbers }) {
  const due = dis.filter((di) => ladderDue(di, { now, ...numbers }));
  for (const di of due) {
    m.setSupDecision(di.id, { status: 'escalated', by: 'reconciler/ladder' });
    m.supEvent({ entityType: 'sup-decision', entityId: di.id, kind: 'sup-decision-ladder', payload: { level: (di.escalations ?? 0) + 1, ownerAfter: numbers.ownerAfter }, at: now });
  }
  return due.map((di) => di.id);
}
