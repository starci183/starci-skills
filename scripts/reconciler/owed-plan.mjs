// scripts/reconciler/owed-plan.mjs — the OWED classes of the Supervisor that are no Decision Item of their own (modules/supervisor/supervise.yaml
// mission.classes): a wait the Kernel's status lists past its critical bound (retry-cap, undispatched) and a frontier left orphaned past the
// Supervisor grace. The Workflow controller opens ONE Decision Item for the Supervisor per such item, so `starci supervisor status` lists it with the
// typed choices of modules/supervisor/supervisor-menu.yaml and `starci supervisor decide` answers it; nothing about it is read-only prose any more.
// Which stuck kind becomes which Decision Item kind is `supervisorOwed` in modules/reconciler/workflow.yaml.
import { clipLine } from '../lib/clip.mjs';

const minutes = (ms) => Math.round(ms / 60_000);

/** The stuck[] waits of the status that outlived their critical bound and that the table names: [{item, id, ageMs, diKind}]. Pure. */
export function overdueOwedWaits({ stuck = [], now, table = {}, stuckSla = {} }) {
  const overdue = [];
  for (const item of stuck) {
    const diKind = table[item.kind];
    const sla = stuckSla[item.kind];
    const ageMs = Number.isFinite(Number(item.since)) ? now - Number(item.since) : Number(item.ageMs);
    const id = item.incidentId ?? item.jobId ?? String(item.key ?? '').split(':').slice(3).join(':');
    if (diKind && sla && id && ageMs >= sla.criticalMs) overdue.push({ item, id, ageMs, diKind });
  }
  return overdue;
}

/** One Supervisor Decision Item per overdue wait (retry-cap -> retry-decision, queued-ready -> ready-undispatched). */
function planOverdueWaits(p) {
  const { workflowId, ledgerId, status, now, s } = p;
  for (const { item, id, ageMs, diKind } of overdueOwedWaits({ stuck: status?.stuck, now, table: s.supervisorOwed, stuckSla: s.stuckSla })) {
    const detail = item.detail ? `: ${clipLine(item.detail, 200)}` : '';
    p.di({ kind: diKind, subject: `${item.kind}-${id}`, decider: 'supervisor', ledger: 'supervisor', entity: { type: 'stuck', id: `${workflowId}:${item.kind}:${id}` },
      summary: `${item.kind} ${id} stands ${minutes(ageMs)}m (critical bound ${minutes(s.stuckSla[item.kind].criticalMs)}m)${detail}: rule on the next step`,
      evidence: [`status stuck[] ${item.key ?? item.kind}`, item.cause ? `cause ${item.cause}` : null, `ledger ${ledgerId} workflow ${workflowId}`, p.topLine],
      refs: { ledgerId, stuck: item.kind, subject: id } });
  }
}

/** The Supervisor Decision Item of a frontier that stays orphaned past the Supervisor grace: the Kernel named no next step. */
function planOrphanedOwed(p) {
  if (!p.orphaned) return;
  const { workflowId, ledgerId, now, s } = p;
  const since = p.openClock('ORPHANED_FRONTIER')?.enteredAt;
  if (!Number.isFinite(since) || now - since < s.supervisorGraceMs) return;
  p.di({ kind: 'orphaned-frontier', subject: 'frontier-owed', decider: 'supervisor', ledger: 'supervisor', entity: { type: 'workflow', id: workflowId },
    summary: `orphaned-frontier ${minutes(now - since)}m: the Kernel named no next step (grace ${minutes(s.supervisorGraceMs)}m); rule on the next leg or revise`,
    evidence: [p.frontier?.reason ? `frontier: ${clipLine(p.frontier.reason, 240)}` : null, `ledger ${ledgerId} workflow ${workflowId}`, p.topLine],
    refs: { ledgerId, stuck: 'orphaned-frontier', subject: workflowId } });
}

/** The plan section of the Workflow controller for the owed classes without a Decision Item of their own. */
export function planSupervisorOwed(p) {
  planOverdueWaits(p);
  planOrphanedOwed(p);
}
