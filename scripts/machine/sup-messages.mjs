// sup-messages.mjs — a supervisor channel's inbox and outbox: machine.sqlite sup_messages rows (direction in, to_ref
// <id>; direction out, from_ref <id>). The Telegram bridge (scripts/supervisor/telegram-bridge.mjs), the desktop tell,
// the Supervisor channel and a kernel proposal (scripts/kernel/verbs/kernel-proposal.mjs) file and read messages here.
import crypto from 'node:crypto';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';

const ID = /^[A-Za-z0-9._-]{1,60}$/;   // 'sup:' + id stays within Telegram callback_data's 64 bytes
/** Whether `id` is a valid supervisor channel id. */
export const validSupervisorId = (id) => typeof id === 'string' && ID.test(id);
/** `id` when valid; throws otherwise. */
export const needSupervisorId = (id) => { if (!validSupervisorId(id)) throw new Error(`supervisor id must match ${ID} (got ${JSON.stringify(String(id ?? ''))})`); return id; };

// The newest rows a read returns (the history before them stays in the table).
const READ_LIMIT = 1000;
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const msOf = (at) => { const ms = typeof at === 'number' ? at : Date.parse(at ?? ''); return Number.isFinite(ms) ? ms : Date.now(); };
const idText = (v) => (v == null || v === '' ? null : String(v));
const idValue = (v) => (v == null ? null : /^-?\d{1,15}$/.test(v) ? Number(v) : v);
const inboxItem = (row) => ({ id: row.msg_id, at: iso(row.at), chatId: row.chat_id ?? null, messageId: idValue(row.message_id), text: row.text, read: row.read_at != null,
  ...(row.read_at != null ? { readAt: iso(row.read_at) } : {}), ...(row.from_ref ? { from: row.from_ref } : {}) });
const outboxItem = (row) => ({ id: row.msg_id, at: iso(row.at), to: row.to_ref ?? null, via: row.via ?? null, ok: row.ok !== 0, text: row.text });
const newest = (m, direction, refColumn, id) => m.db.prepare(`SELECT * FROM (SELECT rowid AS rid, * FROM sup_messages WHERE direction=? AND ${refColumn}=? ORDER BY rowid DESC LIMIT ?) ORDER BY rid`)
  .all(direction, id, READ_LIMIT);

/** One supervisor's inbox, oldest first: [{id, at, chatId, messageId, text, read, readAt?, from?}]. */
export const readInbox = (id, env = process.env) => readMachine((m) => newest(m, 'in', 'to_ref', needSupervisorId(id)).map(inboxItem), [], { env });

/**
 * File one message in a supervisor's inbox: {id, at, chatId, messageId, text, read:false, from?}. `from` names a
 * non-Telegram source: 'desktop' (scripts/supervisor/tell.mjs - the reply stays local), 'stall-alert', 'land-gate',
 * 'kernel:<wf>'; such a message is channel 'tell', a Telegram one channel 'telegram'.
 */
export function appendInbox(id, { chatId, messageId, text, from = null, at = new Date().toISOString() }, { env = process.env } = {}) {
  needSupervisorId(id);
  const msgId = crypto.randomUUID(), atMs = msOf(at);
  withMachine((m) => m.recordSupMessage({ msgId, direction: 'in', channel: from ? 'tell' : 'telegram', chatId: idText(chatId), messageId: idText(messageId),
    from: from ?? null, to: id, text: String(text ?? ''), at: atMs }), { env });
  return { id: msgId, at: iso(atMs), chatId: chatId ?? null, messageId: messageId ?? null, text: String(text ?? ''), read: false, ...(from ? { from } : {}) };
}

/** Record one reply: {id, at, to, text, via:'telegram'|'desktop'|'local'|'none', ok}. */
export function appendOutbox(id, { to = null, text, via, ok = true, at = new Date().toISOString() }, { env = process.env } = {}) {
  needSupervisorId(id);
  const msgId = crypto.randomUUID(), atMs = msOf(at);
  withMachine((m) => m.recordSupMessage({ msgId, direction: 'out', channel: via === 'telegram' ? 'telegram' : 'tell', from: id, to: to ?? null, via: via ?? null,
    text: String(text ?? ''), ok: ok !== false, at: atMs }), { env });
  return { id: msgId, at: iso(atMs), to, via, ok: ok !== false, text: String(text ?? '') };
}
/** One supervisor's replies, oldest first. */
export const readOutbox = (id, env = process.env) => readMachine((m) => newest(m, 'out', 'from_ref', needSupervisorId(id)).map(outboxItem), [], { env });

/**
 * The unread inbox items of one supervisor; unless `peek`, they (or only those named in `ids`) are
 * marked read in the same transaction, so two readers never both take one message.
 */
export function takeInbox(id, { env = process.env, peek = false, ids = null, now = Date.now() } = {}) {
  needSupervisorId(id);
  const wanted = ids ? new Set(ids) : null;
  const unreadOf = (m) => m.db.prepare("SELECT * FROM sup_messages WHERE direction='in' AND to_ref=? AND read_at IS NULL ORDER BY rowid").all(id)
    .filter((row) => !wanted || wanted.has(row.msg_id));
  if (peek) return readMachine((m) => unreadOf(m).map(inboxItem), [], { env });
  return withMachine((m) => m.transaction(() => {
    const rows = unreadOf(m);
    for (const row of rows) m.update('sup_messages', { read_at: now }, { msg_id: row.msg_id, read_at: null });
    return rows.map(inboxItem);
  }), { env });
}

