// api-lib/asks.mjs — the ask writes shared by the ask verbs and `api archive` (split out of
// cli.mjs, lane slim-api).
import { ledgerFileFor } from '../../../../engine/db/ledger.mjs';
import { closeAskMessages } from '../../ask-server.mjs';
import { getWorkflow } from './rows.mjs';

// The open owner asks of a workflow: every ask dispatch no ask-answered/ask-superseded event closed,
// oldest report first (`api archive` retires each before the phase moves).
export const openAskDispatchesOf = (db, workflowId) => db.prepare(`SELECT r.dispatch_id FROM reports r
   WHERE r.workflow_id=? AND r.outcome='ask' AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id
     AND e.kind IN ('ask-answered','ask-superseded') AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
   GROUP BY r.dispatch_id ORDER BY MIN(r.report_id)`).all(workflowId).map((row) => row.dispatch_id);

// `retire-ask --workflow <id> --dispatch <id> --reason <text>`: close an ask the
// owner should no longer answer. A StarCi Next brand ask asked the owner to
// rule on 0.4.13 contrast values that grammar 0.5.0 then fixed; with no way to
// retire it the workflow read awaiting-owner on a stale question
// (inc-6886d1399989). The ask is recorded ask-superseded with by:null and the
// reason, the same terminal kind serve-ask writes for a replaced ask.
export async function retireAsk(ledger, { workflowId, dispatchId, reason, repo }) {
  const db = ledger.db;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const report = db.prepare("SELECT a.op_id FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.dispatch_id=? AND r.outcome='ask' LIMIT 1").get(workflowId, dispatchId);
  if (!report) throw Object.assign(new Error(`dispatch ${dispatchId} filed no ask report in ${workflowId}`), { code: 'ask-unknown' });
  const why = String(reason ?? '').trim();
  if (!why) throw Object.assign(new Error('retire-ask needs --reason <text>: a retired ask keeps why the owner no longer answers it'), { code: 'retire-needs-reason' });
  const closed = db.prepare("SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, dispatchId);
  if (closed) return { ok: true, workflowId, dispatchId, retired: false, already: closed.kind };
  ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-superseded',
    payload: { dispatchId, by: null, opId: report.op_id ?? null, retired: true, reason: why } });
  // The ask's Telegram messages leave the owner's chat (deleted; edited to
  // "no longer needs an answer" only where Telegram refuses the delete).
  const [telegram] = await closeAskMessages(ledger, { ledgerFile: ledgerFileFor(repo), workflowId, dispatchIds: [dispatchId], reason: 'retired' });
  return { ok: true, workflowId, dispatchId, retired: true, reason: why,
    ...(telegram?.deleted?.length ? { telegramDeleted: telegram.deleted } : {}), ...(telegram?.edited?.length ? { telegramEdited: telegram.edited } : {}) };
}
