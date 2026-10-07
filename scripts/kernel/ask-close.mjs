// ask-close.mjs - takes the Telegram messages of closed asks off the owner's chat and records each removal.
import { markAskClosed } from '../connectors/telegram.mjs';
import { eachInOrder } from '../lib/in-order.mjs';

/**
 * Take the Telegram messages of closed asks off the owner's chat (telegram.mjs markAskClosed: delete,
 * else edit to "answered"), and record each removal as `ask-message-closed` {dispatchId, reason,
 * deleted, edited, failed}. Never throws; `close` is injectable for specs.
 */
export async function closeAskMessages(ledger, { ledgerFile, workflowId, dispatchIds, reason = 'answered', by = null, close = markAskClosed }) {
  const out = [];
  await eachInOrder(dispatchIds ?? [], async (dispatchId) => {
    const r = await Promise.resolve(close({ ledgerFile, workflowId, dispatchId, reason, by })).catch(() => null);
    if (r && (r.deleted?.length || r.edited?.length)) {
      try {
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-message-closed',
          payload: { dispatchId, reason, deleted: r.deleted ?? [], edited: r.edited ?? [], failed: r.failed ?? [] } });
      } catch { /* the chat is already clean; the record is best effort */ }
    }
    out.push({ dispatchId, ...(r ?? { ok: false }) });
  });
  return out;
}
