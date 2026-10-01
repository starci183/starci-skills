// api notify: split from api.mjs; output and validation remain stable.
import path from 'node:path';
import { getWorkflow, csvList } from './shared/rows.mjs';
import { PEER_MESSAGE, peerMessageOf, peerRefusalOf, peerWaitMessageArrived, peerWorkflowsOf, pendingPeerMessagesOf, releaseTypedWaits, writePeerMessage } from './shared/peers.mjs';
const PEER_MESSAGE_KINDS = ['request', 'heads-up', 'handoff', 'reply', 'follow-up'];

export default {
  verb: 'notify',
  required: ['workflow', 'to', 'kind', 'subject', 'body'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit }) {
    const db = ledger.db, workflowId = args.workflow;
    const self = getWorkflow(db, workflowId);
    if (!self) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (self.phase === 'finished') {
      throw Object.assign(new Error(`workflow ${workflowId} is finished; a finished workflow sends no peer message`), { code: 'workflow-finished' });
    }
    const kind = String(args.kind).trim();
    if (!PEER_MESSAGE_KINDS.includes(kind)) {
      throw Object.assign(new Error(`--kind must be ${PEER_MESSAGE_KINDS.join('|')}, got '${kind}'`), { code: 'peer-kind-invalid' });
    }
    const subject = String(args.subject).trim(), body = String(args.body).trim();
    if (!subject || !body) throw Object.assign(new Error('notify needs a non-empty --subject and --body'), { code: 'peer-message-empty' });
    const replyTo = args['reply-to'] ? String(args['reply-to']).trim() : null;
    let original = null;
    if (replyTo) {
      const row = db.prepare('SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY inbox_id DESC LIMIT 1').get(workflowId, PEER_MESSAGE, replyTo);
      if (!row) throw Object.assign(new Error(`--reply-to ${replyTo} names no peer message ${workflowId} received`), { code: 'reply-to-unknown' });
      original = peerMessageOf(row);
    } else if (kind === 'reply') {
      throw Object.assign(new Error('a reply names the message it answers with --reply-to <key>'), { code: 'reply-to-missing' });
    }
    const wanted = String(args.to).trim();
    const targets = wanted === 'peers' ? peerWorkflowsOf(db, self).map((wf) => wf.workflow_id) : csvList(wanted);
    for (const to of new Set(targets)) {
      const refusal = peerRefusalOf(db, self, to);
      if (refusal) throw Object.assign(new Error(refusal.detail), { code: refusal.code });
    }
    if (original && !targets.includes(original.from)) {
      throw Object.assign(new Error(`--reply-to ${replyTo} came from ${original.from}; a reply goes back to its sender`), { code: 'reply-to-mismatch' });
    }
    const refs = csvList(args.refs);
    const sent = [];
    ledger.transaction(() => {
      const now = Date.now();
      for (const to of [...new Set(targets)]) {
        // A Kernel re-sending after a crash sends the same message, not a second one.
        const same = pendingPeerMessagesOf(db, to).find((m) => m.from === workflowId && m.kind === kind && m.subject === subject
          && m.body === body && (m.replyTo ?? null) === replyTo);
        if (same) { sent.push({ to, key: same.key, kind, subject, deduped: true }); continue; }
        sent.push(writePeerMessage(ledger, { from: self, to, kind, subject, body, replyTo, refs, now }));
      }
    });
    // A target waiting on this workflow (peer-wait) is woken now, and its --until-message waits resolve.
    for (const message of sent.filter((m) => !m.deduped)) {
      const arrived = peerWaitMessageArrived(ledger, { waiter: message.to, peer: workflowId, key: message.key, kind, subject });
      if (arrived) message.peerWait = arrived;
    }
    // A typed --until-message wait of a target (gate-conditions.mjs) may hold now; its release wakes the
    // target unless the peer-wait wake above already did.
    for (const message of sent.filter((m) => !m.deduped)) {
      const released = releaseTypedWaits(ledger, { repo: path.resolve(args.repo ?? process.cwd()), workflowId: message.to, wake: !message.peerWait, self: workflowId }).resolved;
      if (released.length) message.autoResolved = released.map(({ incidentId, evidence, wake }) => ({ incidentId, evidence, ...(wake ? { wake } : {}) }));
    }
    const out = { ok: true, workflowId, kind, subject, replyTo, sent };
    emit(out, `notify ${workflowId} [${kind}] ${subject} -> ${sent.map((m) => `${m.to} (${m.key}${m.deduped ? ', already pending' : ''})`).join(', ') || 'no running peer'}`, args.json);
  },
};
