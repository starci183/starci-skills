// scripts/reconciler/supervisor-mirror.mjs — the loop between a product ledger and the Supervisor, whose menu is built from machine.sqlite only
// (scripts/supervisor/supervisor-menu-sources.mjs). Every Decision Item of a product ledger whose decider is the Supervisor (the Kernel's menu-escape, a host
// controller's seat-unrecoverable, a runtime-defect, ...) is owned by nobody until the Workflow controller opens the Supervisor's twin, keyed
// `escalated:<ledger>:<id>` like the SLA ladder's escalation (scripts/machine/decisions.mjs escalateOne), the key the Supervisor's menu routes (modules/supervisor/supervisor-menu.yaml).
// The loop closes in the same place:
//   - an item whose twin the Supervisor answered is closed in the product ledger (resolved by supervisor, verb supervisor-<choice>);
//   - a Kernel escape answered without a ruling (record-defect, none-fits) tells the Kernel, as a supervisor-ruling Decision Item, what became of the item
//     it escaped, so no Kernel waits on an answer that will not come;
//   - an item whose subject has ended (the job it names has settled) is closed by the runtime with that reason instead of being mirrored.
import { listDecisions } from '../machine/decisions.mjs';
import { DRAFT_ITEM_KIND, draftEpisode } from '../kernel/draft-hold.mjs';

const SUPERVISOR_LEDGER_NAME = 'supervisor';
const LIVE = new Set(['open', 'claimed']);
const SETTLED_JOB = new Set(['succeeded', 'cancelled']);
const JOB_ID = /op-[\w.]+-[0-9a-f]{6,}/;
const ESCAPE_KIND = 'menu-escape';

/** The key of the Supervisor's twin of a product-ledger item. */
const twinKey = (ledgerName, id) => `escalated:${ledgerName}:${id}`;

/** The live Decision Items of a workflow that the Supervisor decides. */
const supervisorItems = (db, { workflowId, now }) => listDecisions(db, { workflowId, decider: 'supervisor', now }).filter((di) => LIVE.has(di.status));

/** The job an item names: its entity, or the job id inside the Kernel item id of an escape key (`menu-escape:<workflow>:shape-refused:<job>`). */
function jobOf(di) {
  if (di.entity?.type === 'job') return di.entity.id;
  if (di.jobId) return di.jobId;
  return di.kind === ESCAPE_KIND ? JOB_ID.exec(String(di.idempotencyKey ?? ''))?.[0] ?? null : null;
}

/** Why a live item no longer needs the Supervisor, or null: the job it names has settled. */
function staleReasonOf(db, di) {
  if (di.kind === DRAFT_ITEM_KIND && !draftEpisode(db, di.workflowId)) return 'the draft is gone from the seat input and the seat is woken again';
  const job = jobOf(di);
  const row = job ? db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job) : null;
  return row && SETTLED_JOB.has(row.status) ? `the job ${job} it names has ${row.status}` : null;
}

/** The answered twins of machine.sqlite: Map key -> {choice, reason, by, at}. The choice leads the recorded rationale (`<choice>: <reason>`, scripts/supervisor/decide.mjs). */
export function twinAnswersOf(sup) {
  if (!sup) return new Map();
  const rows = sup.prepare(`SELECT i.idempotency_key AS key, i.resolved_by AS by, i.resolved_at AS at,
    (SELECT d.rationale FROM sup_decisions d WHERE d.di_id=i.di_id ORDER BY d.decided_at DESC LIMIT 1) AS rationale
    FROM sup_decision_items i WHERE i.idempotency_key LIKE 'escalated:%' AND i.status='resolved'`).all();
  return new Map(rows.map((row) => {
    const text = String(row.rationale ?? '');
    const cut = text.indexOf(': ');
    return [row.key, { choice: cut > 0 ? text.slice(0, cut) : 'answered', reason: cut > 0 ? text.slice(cut + 2) : text, by: row.by, at: row.at }];
  }));
}

const NOTICE = {
  'record-defect': (id, why) => `[supervisor] The Supervisor recorded your escape ${id} as a runtime defect for Debug and will not rule on it (${why}). The item is closed and no answer will follow: do not retry it and do not work around it; answer the rest of your menu and yield.`,
  'none-fits': (id, why) => `[supervisor] The Supervisor found no option for your escape ${id} either (${why}) and handed it to the owner. The item is closed here; the owner's answer reaches you as a Decision Item. Nothing waits on you: answer the rest of your menu and yield.`,
};

function noticeOf({ di, answer, ledgerId, workflowId }) {
  const text = NOTICE[answer.choice];
  if (di.kind !== ESCAPE_KIND || !text) return null;
  return { schema: 'starci/decision-item@1', kind: 'supervisor-ruling', decider: 'kernel', ledger: ledgerId, productLedger: ledgerId, workflowId, entity: { type: 'workflow', id: workflowId },
    idempotencyKey: `escape-closed:${di.id}`, summary: text(di.id, answer.reason).slice(0, 500), by: 'supervisor', openedBy: 'reconciler/mirror' };
}

/** The Supervisor-store twin spec of one live item. */
const twinOf = (di, { ledgerId, ledgerName, workflowId }) => ({
  schema: 'starci/decision-item@1', kind: di.kind, decider: 'supervisor', ledger: SUPERVISOR_LEDGER_NAME, idempotencyKey: twinKey(ledgerName, di.id),
  workflowId, productLedger: ledgerName, entity: di.entity, summary: `Kernel DI ${di.id} (${di.kind}) in ${workflowId}: ${di.summary}`,
  evidence: [{ ref: `decision:${ledgerName}/${workflowId}/${di.id}` }, ...(di.evidence ?? []).slice(0, 10)], options: di.options ?? [], allowedVerbs: di.allowedVerbs ?? [],
  refs: { ledgerId, workflowId, decision: di.id }, openedBy: 'reconciler/mirror', item: `di|${ledgerName}|${di.id}`, ...(di.severity ? { severity: di.severity } : {}),
});

/**
 * What the Workflow controller does with the Supervisor-decided items of one workflow, pure over the product ledger handle `db` and the answered twins:
 * {twins: [spec of the Supervisor's twin of each live, unanswered, unsettled item], closures: [{id, by, verb, note}], notices: [Kernel Decision Item specs]}.
 * `ledgerName` is the name the machine registry resolves (the repository folder), `ledgerId` its id.
 */
export function mirrorPlan(db, { ledgerId, ledgerName, workflowId, now, answers = new Map() }) {
  const out = { twins: [], closures: [], notices: [] };
  for (const di of supervisorItems(db, { workflowId, now })) {
    const answer = answers.get(twinKey(ledgerName, di.id));
    const stale = answer ? null : staleReasonOf(db, di);
    if (answer) {
      out.closures.push({ id: di.id, by: 'supervisor', verb: `supervisor-${answer.choice}`, note: `${answer.choice}: ${answer.reason}`.slice(0, 400) });
      const notice = noticeOf({ di, answer, ledgerId, workflowId });
      if (notice) out.notices.push(notice);
    } else if (stale) out.closures.push({ id: di.id, by: 'runtime', verb: 'supervisor-item-stale', note: stale });
    else out.twins.push(twinOf(di, { ledgerId, ledgerName, workflowId }));
  }
  return out;
}
