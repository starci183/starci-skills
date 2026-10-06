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
    const dispositionNote = (message) => (message.disposition?.disposition ? `: ${message.disposition.disposition}` : '');
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (args.ack != null) {
      const key = String(args.ack).trim();
      const disposition = typeof args.disposition === 'string' ? args.disposition.trim() : '';
      if (!disposition) throw Object.assign(new Error('an ack says what was done: --disposition <text>'), { code: 'disposition-missing' });
      const acknowledged = ledger.transaction(() => {
        const row = db.prepare("SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, inbox_id DESC LIMIT 1")
          .get(workflowId, PEER_MESSAGE, key);
        if (!row) throw Object.assign(new Error(`no peer message ${key} in ${workflowId}'s inbox`), { code: 'peer-message-unknown' });
        const message = peerMessageOf(row);
        if (row.status !== 'pending') {
          if (row.status === 'applied' && message.disposition?.disposition === disposition)
            return { message, disposition: message.disposition.disposition, replayed: true };
          throw Object.assign(new Error(`peer message ${key} is already ${row.status}${dispositionNote(message)}`), { code: 'peer-message-not-pending' });
        }
        const now = Date.now();
        setInboxStatus(db, { inboxId: row.inbox_id, status: 'applied', disposition: { disposition, by: workflowId, at: now }, at: now });
        ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'peer-message-acked',
          payload: { key, from: message.from, kind: message.kind, disposition } });
        return { message, disposition, replayed: false };
      });
      const { message, replayed } = acknowledged;
      const out = { ok: true, workflowId, replayed, acked: { key, from: message.from, kind: message.kind, subject: message.subject, disposition: acknowledged.disposition },
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
      ...pending.map((m) => {
        const replyTo = m.replyTo ? ` (reply to ${m.replyTo})` : '';
        const refs = m.refs.length ? `\n    refs: ${m.refs.join(', ')}` : '';
        return `  ${m.key} from ${m.from} [${m.kind}] ${m.subject}${replyTo}\n    ${m.body}${refs}`;
      }),
      ...(sent.length ? [`sent (latest ${sent.length}):`] : []),
      ...sent.map((m) => `  ${m.key} to ${m.to} [${m.kind}] ${m.subject} — ${m.status}${dispositionNote(m)}`),
    ].join('\n'), args.json);
  },
};
