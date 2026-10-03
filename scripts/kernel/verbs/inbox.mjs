// starci kernel inbox: split from cli.mjs; output and validation remain stable.
import { getWorkflow } from './shared/rows.mjs';
import { setInboxStatus } from '../../../engine/db/ledger.mjs';
import { PEER_MESSAGE, peerMessageOf, peerMessageRows, pendingPeerMessagesOf } from './shared/peer-waits.mjs';
const PEER_SENT_LIMIT = 20;

export default {
  verb: 'inbox',
  required: (args) => ['workflow', ...(args.ack != null ? ['disposition'] : [])],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (args.ack != null) {
      const key = String(args.ack).trim();
      const disposition = typeof args.disposition === 'string' ? args.disposition.trim() : '';
      if (!disposition) throw Object.assign(new Error('an ack says what was done: --disposition <text>'), { code: 'disposition-missing' });
      const row = db.prepare("SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, inbox_id DESC LIMIT 1")
        .get(workflowId, PEER_MESSAGE, key);
      if (!row) throw Object.assign(new Error(`no peer message ${key} in ${workflowId}'s inbox`), { code: 'peer-message-unknown' });
      const message = peerMessageOf(row);
      if (row.status !== 'pending') {
        throw Object.assign(new Error(`peer message ${key} is already ${row.status}${message.disposition?.disposition ? `: ${message.disposition.disposition}` : ''}`), { code: 'peer-message-not-pending' });
      }
      ledger.transaction(() => {
        const now = Date.now();
        if (db.prepare('SELECT status FROM inbox WHERE inbox_id=?').get(row.inbox_id)?.status === 'pending')
          setInboxStatus(db, { inboxId: row.inbox_id, status: 'applied', disposition: { disposition, by: workflowId, at: now }, at: now });
        ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'peer-message-acked',
          payload: { key, from: message.from, kind: message.kind, disposition } });
      });
      const out = { ok: true, workflowId, acked: { key, from: message.from, kind: message.kind, subject: message.subject, disposition },
        pending: pendingPeerMessagesOf(db, workflowId).length };
      emit(out, `acked ${key} from ${message.from} [${message.kind}] ${message.subject}: ${disposition} (${out.pending} still pending)`, args.json);
      return;
    }
    const pending = pendingPeerMessagesOf(db, workflowId)
      .map(({ key, from, fromTitle, kind, subject, body, replyTo, refs, at }) => ({ key, from, fromTitle, kind, subject, body, replyTo, refs, at }));
    const sent = peerMessageRows(db).map(peerMessageOf).filter((m) => m.from === workflowId).slice(-PEER_SENT_LIMIT).reverse()
      .map(({ key, to, kind, subject, replyTo, at, status, disposition, appliedAt }) => ({ key, to, kind, subject, replyTo, at, status, disposition, appliedAt }));
    const out = { ok: true, workflowId, pending, sent };
    emit(out, [
      `inbox ${workflowId}: ${pending.length} pending peer message(s)`,
      ...pending.map((m) => `  ${m.key} from ${m.from} [${m.kind}] ${m.subject}${m.replyTo ? ` (reply to ${m.replyTo})` : ''}\n    ${m.body}${m.refs.length ? `\n    refs: ${m.refs.join(', ')}` : ''}`),
      ...(sent.length ? [`sent (latest ${sent.length}):`] : []),
      ...sent.map((m) => `  ${m.key} to ${m.to} [${m.kind}] ${m.subject} — ${m.status}${m.disposition?.disposition ? `: ${m.disposition.disposition}` : ''}`),
    ].join('\n'), args.json);
  },
};
