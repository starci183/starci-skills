#!/usr/bin/env node
// telegram-bridge.mjs — the owner commands a supervisor by chatting with the
// Telegram bot (docs/connectors.md "Command bridge"). Several supervisor chats
// may be registered at once; Telegram buttons pick which one the owner talks to.
//
//   node scripts/connectors/telegram-bridge.mjs start    launch detached (idempotent; no-op when telegram is off)
//   node scripts/connectors/telegram-bridge.mjs run      run in the foreground
//   node scripts/connectors/telegram-bridge.mjs status | stop
//
// One bridge per host (claimManager('telegram-bridge'): a machine.sqlite host
// lock; its record is the connectors row 'telegram-bridge' {pid, startedAt},
// the update offset in its cursor_json). It long-polls
// getUpdates (message + callback_query) and persists the update offset BEFORE
// handling an update, so a restart never delivers the same message twice.
// Between poll rounds it reloads itself when the runtime changes
// (scripts/lib/self-reload.mjs, as the watchdogs do): the replacement takes the
// lock over and resumes from the persisted offset.
//
// Hard auth: an update is accepted only when its chat id AND its sender id both
// equal connectors.telegram.chatId (the owner's private chat). Anything else is
// dropped and logged by numeric id only; message text is never logged.
//
// Commands (English only): /start and /choose show one button per registered
// supervisor (🟢 online / ⚪ offline); /status sends the progress report
// (scripts/supervisor/progress-report.mjs) from the bridge itself; /asks lists
// every open approval ask across the ask repos (the connector repos, config
// supervisor.repos and every repo a notice named), one message each with its
// own "Generate URL" button; /creds lists every open credential ask in ONE
// message with one button each (serve-ask.mjs askClassOf: the two kinds never
// share a list or a message); /help. Any
// other text goes to the chat's routed supervisor: filed in machine.sqlite
// sup_messages (direction in, to_ref <id>) and acknowledged as a reply. A message
// with no route auto-routes when exactly one supervisor is registered, else it
// is held and delivered once the owner picks one. Replies follow config.yaml
// `language` (vi, else en). The supervisor side is scripts/supervisor/channel.mjs.
//
// Owner asks on demand (owner, 2026-09-24: "khi yêu cầu thì mới serve url"):
// a kernel's `api serve-ask` only sends the question with a "Generate URL"
// button (callback_data `ask:<16 hex>`, telegram.mjs askKeyOf). Pressing it
// here answers the callback, launches scripts/kernel/serve-ask.mjs for that ask
// detached (--on-demand telegram; it hides its children's windows) unless its
// form already serves, waits for the form to bind (its ask-serving event), makes
// sure the gateway and tunnel run (tunnel.mjs ensureAskConnectors), and edits
// the pressed message to carry the link: https://<host>/a-<nonce>, or for a
// credential ask the localhost link with "answer on the machine". A closed ask's
// button removes its message instead. Every poll round (at most once a minute)
// the bridge sweeps the store (telegram.mjs sweepAskMessages): the messages of
// asks that closed are deleted and a link whose form ended is taken back off.
//
// Draw review by reply (owner ruling 2026-09-27): a reply to a draw-review notice (its album, one image, or its
// text; telegram.mjs drawReviewEntryByMessage) is the owner's answer, recorded as a verified owner answer by
// serve-ask.mjs answerDrawReviewByReply: "ok" / "duyệt" accepts, anything else is feedback (a note per line, or a
// note on the replied image) and the drawing is redrawn (scripts/work/draw-feedback.mjs).
//
// Registry: the connectors row 'supervisor-channel:<id>' (config_json {id, label,
// repos, registeredAt, heartbeatAt, terminal?, session?}); a supervisor is online
// while its heartbeat is younger than ONLINE_MS (STARCI_SUPERVISOR_ONLINE_MS
// overrides it). The chat routes are the connectors row 'telegram-route'
// (cursor_json {chats}). The supervisors' replies are sup_messages (direction
// out, from_ref <id>). Logs go to machine_logs (actor connector, kind
// telegram-bridge.log). STARCI_TELEGRAM_API_BASE replaces the Bot API
// host for tests. The token is never printed and is scrubbed from every error.
import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configRoot, connectorsConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { readMachine, withMachine } from '../../engine/machine-db.mjs';
import {
  argsOf, askRepos, askState, claimManager, claimOrTakeOver, connectorLog, connectorState, connectorStates, lockHolder, notifiedRepos, openAskList, ownerConfig, pidAlive,
  recordAlive, sourceRootOf, spawnDetached, withLedgerRead, writeConnectorState,
} from './lib.mjs';
import {
  ASK_CALLBACK, askButton, askEntryByKey, askKeyOf, askMessage, botCall, DEFAULT_API_BASE, drawReviewEntryByMessage, linkFor, recordAskMessage, redact,
  removeAskMessage, sweepAskMessages, telegramSettings, TEXT_MAX, textFor,
} from './telegram.mjs';
import { ensureAskConnectors, publicBase } from './tunnel.mjs';
import { collectProgress, progressMessages, reportRepos } from '../supervisor/progress-report.mjs';
import { answerDrawReviewByReply, askClassOf } from '../kernel/serve-ask.mjs';
import { createReloadWatch, reexecSelf, RELOAD_ENV } from '../lib/self-reload.mjs';
import { clipLine } from '../lib/clip.mjs';
import { sleep } from '../lib/sleep.mjs';

export const SERVE_ASK_FILE = fileURLToPath(new URL('../kernel/serve-ask.mjs', import.meta.url));

export const BRIDGE_NAME = 'telegram-bridge';
export const BRIDGE_FILE = fileURLToPath(import.meta.url);
export const ONLINE_MS = 30 * 60 * 1000;
export const POLL_TIMEOUT_S = 50;
export const ALLOWED_UPDATES = ['message', 'callback_query'];
const MAX_PENDING = 20;
const ID = /^[A-Za-z0-9._-]{1,60}$/;   // 'sup:' + id stays within callback_data's 64 bytes
// A /creds button: like ASK_CALLBACK, but the ask opens in a new message and the list stays.
export const CRED_CALLBACK = /^cred:([0-9a-f]{16})$/;

const TEXT = {
  en: {
    chooser: 'Choose the supervisor to talk to:',
    none: 'No supervisor is registered yet.',
    held: 'Your message is held and goes to the supervisor you pick.',
    heldNone: 'No supervisor is registered yet. Your message is held and goes to the first one you pick (/choose).',
    talking: (label) => `Now talking to ${label}.`,
    forwarded: (label) => `📥 Forwarded to ${label}.`,
    offline: '(supervisor offline — it will pick this up when it is back)',
    gone: 'That supervisor is no longer registered. /choose another one.',
    textOnly: 'Only text messages are forwarded to a supervisor.',
    statusFailed: 'The progress report could not be built right now.',
    asksNone: 'No question is waiting for you.',
    asksHead: (n) => `${n} open question(s). Press "Generate URL" under the one you want to answer:`,
    credsHint: (n) => `${n} credential ask(s) wait for values: /creds`,
    credsNone: 'No credential ask is waiting.',
    credsHead: (n) => `🔑 ${n} credential ask(s) wait for values. They never hold the main line; only live proof (UAT) waits on them. Press one to open its form:`,
    askClosed: 'This question no longer needs an answer.',
    askGenerating: 'Opening the answer form…',
    unknown: 'Unknown command.',
    help: [
      'Commands:',
      '/choose — pick the supervisor to talk to',
      '/status — the progress report',
      '/asks — the decisions waiting on you, each with a Generate URL button',
      '/creds — the credential asks (keys, secrets) in one list; they never hold the main line',
      '/help — this list',
      'Any other text goes to the supervisor you picked.',
    ].join('\n'),
  },
  vi: {
    chooser: 'Chọn supervisor để nói chuyện:',
    none: 'Chưa có supervisor nào đăng ký.',
    held: 'Tin nhắn của thầy được giữ lại và sẽ chuyển cho supervisor thầy chọn.',
    heldNone: 'Chưa có supervisor nào đăng ký. Tin nhắn của thầy được giữ lại và sẽ chuyển cho supervisor đầu tiên thầy chọn (/choose).',
    talking: (label) => `Đang nói chuyện với ${label}.`,
    forwarded: (label) => `📥 Đã chuyển cho ${label}.`,
    offline: '(supervisor đang offline — sẽ xử lý khi quay lại)',
    gone: 'Supervisor này không còn đăng ký. Thầy /choose supervisor khác nhé.',
    textOnly: 'Chỉ tin nhắn chữ mới được chuyển cho supervisor.',
    statusFailed: 'Chưa dựng được báo cáo tiến độ lúc này.',
    asksNone: 'Không có câu hỏi nào đang chờ thầy.',
    asksHead: (n) => `${n} câu hỏi đang chờ thầy. Thầy bấm "Tạo link trả lời" dưới câu muốn trả lời:`,
    credsHint: (n) => `${n} yêu cầu thông tin bí mật (credential) đang chờ: /creds`,
    credsNone: 'Không có yêu cầu credential nào đang chờ.',
    credsHead: (n) => `🔑 ${n} yêu cầu thông tin bí mật (credential) đang chờ thầy. Không chặn việc chính, chỉ phần chạy thử thật (UAT) chờ. Thầy bấm nút tương ứng để mở form:`,
    askClosed: 'Câu hỏi này không cần trả lời nữa.',
    askGenerating: 'Đang mở form trả lời…',
    unknown: 'Lệnh không có.',
    help: [
      'Các lệnh:',
      '/choose — chọn supervisor để nói chuyện',
      '/status — báo cáo tiến độ',
      '/asks — các quyết định đang chờ thầy, mỗi câu có nút tạo link trả lời',
      '/creds — các yêu cầu credential (key, secret) gộp một danh sách; không chặn việc chính',
      '/help — danh sách lệnh',
      'Tin nhắn thường sẽ được chuyển cho supervisor thầy đang chọn.',
    ].join('\n'),
  },
};
export const bridgeText = (language) => TEXT[language] ?? TEXT.en;

const numericId = (v) => (Number.isSafeInteger(Number(v)) && String(v).trim() !== '' ? String(Number(v)) : '?');

/* ------------------------------------------------------------ state (machine.sqlite) */

/** The bridge's connectors row: {pid, startedAt, offset, ...}, or null. The update offset is the row's cursor. */
export const bridgeState = (env = process.env) => {
  const record = connectorState(BRIDGE_NAME, env);
  return record ? { ...record, offset: Number.isSafeInteger(record.cursor?.offset) ? record.cursor.offset : null } : null;
};
const ROUTE_ROW = 'telegram-route';
const CHANNEL_PREFIX = 'supervisor-channel:';
export const validSupervisorId = (id) => typeof id === 'string' && ID.test(id);
const needId = (id) => { if (!validSupervisorId(id)) throw Error(`supervisor id must match ${ID} (got ${JSON.stringify(String(id ?? ''))})`); return id; };
const channelRow = (id) => `${CHANNEL_PREFIX}${needId(id)}`;

/** A live bridge: its connectors row names a live process of this boot, or a bridge holds the lock. */
export const bridgeAlive = (env = process.env) => {
  const state = bridgeState(env);
  return recordAlive(state) ? state : lockHolder(BRIDGE_NAME, env);
};

/* ------------------------------------------------------------ supervisor registry */

const onlineWindow = (env, onlineMs) => {
  if (Number.isFinite(onlineMs) && onlineMs > 0) return onlineMs;
  const fromEnv = Number(env.STARCI_SUPERVISOR_ONLINE_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : ONLINE_MS;
};
/** Whether a registered supervisor's heartbeat is recent enough to call it online. */
export const supervisorOnline = (sup, { now = Date.now(), env = process.env, onlineMs } = {}) => {
  const beat = Date.parse(sup?.heartbeatAt ?? '');
  return Number.isFinite(beat) && now - beat <= onlineWindow(env, onlineMs);
};

const writeChannel = (record, env) => writeConnectorState(channelRow(record.id), { kind: 'supervisor-channel', state: 'registered', config: record }, env);

/** Register (or re-register) one supervisor; its heartbeat is now. */
export function registerSupervisor({ id, label, repos = [], terminal = null, session = null }, { env = process.env, now = Date.now() } = {}) {
  needId(id);
  const at = new Date(now).toISOString();
  const record = {
    schema: 'starci/supervisor-channel@1', id, label: String(label ?? '').trim() || id,
    repos: [].concat(repos ?? []).map(String).map((r) => r.trim()).filter(Boolean), registeredAt: at, heartbeatAt: at,
    // The Orca terminal that registered (ORCA_TERMINAL_HANDLE): the [Supervisor] kernel's seat for id 'main'.
    ...(terminal ? { terminal } : {}),
    // The chat session that registered with no terminal (supervisor.mode chat): the one that drains id 'main'.
    ...(!terminal && session ? { session: String(session) } : {}),
  };
  writeChannel(record, env);
  return record;
}

export function getSupervisor(id, env = process.env) {
  if (!validSupervisorId(id)) return null;
  const record = readMachine((m) => m.connectorOf(channelRow(id))?.config ?? null, null, { env });
  return record && record.id === id ? record : null;
}

/** Refresh one registered supervisor's heartbeat; null when it is not registered. */
export function heartbeatSupervisor(id, { env = process.env, now = Date.now() } = {}) {
  const record = getSupervisor(id, env);
  if (!record) return null;
  record.heartbeatAt = new Date(now).toISOString();
  writeChannel(record, env);
  return record;
}

/** Every registered supervisor, online ones first, then by label. */
export function listSupervisors({ env = process.env, now = Date.now(), onlineMs } = {}) {
  return connectorStates(CHANNEL_PREFIX, env)
    .map((row) => getSupervisor(row.name.slice(CHANNEL_PREFIX.length), env))
    .filter(Boolean)
    .map((sup) => ({ ...sup, online: supervisorOnline(sup, { now, env, onlineMs }) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || String(a.label).localeCompare(String(b.label)) || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------ inbox and outbox (machine.sqlite sup_messages) */

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
export const readInbox = (id, env = process.env) => readMachine((m) => newest(m, 'in', 'to_ref', needId(id)).map(inboxItem), [], { env });

/**
 * File one message in a supervisor's inbox: {id, at, chatId, messageId, text, read:false, from?}. `from` names a
 * non-Telegram source: 'desktop' (scripts/supervisor/tell.mjs - the reply stays local), 'stall-alert', 'land-gate',
 * 'kernel:<wf>'; such a message is channel 'tell', a Telegram one channel 'telegram'.
 */
export function appendInbox(id, { chatId, messageId, text, from = null, at = new Date().toISOString() }, { env = process.env } = {}) {
  needId(id);
  const msgId = crypto.randomUUID(), atMs = msOf(at);
  withMachine((m) => m.recordSupMessage({ msgId, direction: 'in', channel: from ? 'tell' : 'telegram', chatId: idText(chatId), messageId: idText(messageId),
    from: from ?? null, to: id, text: String(text ?? ''), at: atMs }), { env });
  return { id: msgId, at: iso(atMs), chatId: chatId ?? null, messageId: messageId ?? null, text: String(text ?? ''), read: false, ...(from ? { from } : {}) };
}

/** Record one reply: {id, at, to, text, via:'telegram'|'desktop'|'local'|'none', ok}. */
export function appendOutbox(id, { to = null, text, via, ok = true, at = new Date().toISOString() }, { env = process.env } = {}) {
  needId(id);
  const msgId = crypto.randomUUID(), atMs = msOf(at);
  withMachine((m) => m.recordSupMessage({ msgId, direction: 'out', channel: via === 'telegram' ? 'telegram' : 'tell', from: id, to: to ?? null, via: via ?? null,
    text: String(text ?? ''), ok: ok !== false, at: atMs }), { env });
  return { id: msgId, at: iso(atMs), to, via, ok: ok !== false, text: String(text ?? '') };
}
/** One supervisor's replies, oldest first. */
export const readOutbox = (id, env = process.env) => readMachine((m) => newest(m, 'out', 'from_ref', needId(id)).map(outboxItem), [], { env });

/**
 * The unread inbox items of one supervisor; unless `peek`, they (or only those named in `ids`) are
 * marked read in the same transaction, so two readers never both take one message.
 */
export function takeInbox(id, { env = process.env, peek = false, ids = null, now = Date.now() } = {}) {
  needId(id);
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

/* ------------------------------------------------------------ routes */

const readRoutes = (env) => {
  const doc = connectorState(ROUTE_ROW, env)?.cursor;
  return doc && typeof doc === 'object' && doc.chats && typeof doc.chats === 'object' ? doc : { schema: 'starci/telegram-route@1', chats: {} };
};
const writeRoutes = (env, doc) => writeConnectorState(ROUTE_ROW, { kind: 'telegram-route', cursor: doc }, env);
export const chatRoute = (chatId, env = process.env) => readRoutes(env).chats[String(chatId)] ?? null;

/* ------------------------------------------------------------ Bot API */

/** One long-poll getUpdates call: {ok, result} or {ok:false, status, error, retryAfter} (token scrubbed). */
export async function getUpdates({ token, offset = null, timeoutS = POLL_TIMEOUT_S, apiBase = DEFAULT_API_BASE, fetchImpl = fetch }) {
  const payload = { timeout: timeoutS, allowed_updates: ALLOWED_UPDATES };
  if (Number.isSafeInteger(offset)) payload.offset = offset;
  try {
    const res = await fetchImpl(`${apiBase.replace(/\/+$/, '')}/bot${token}/getUpdates`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout((timeoutS + 15) * 1000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok !== false) return { ok: true, status: res.status, result: Array.isArray(json?.result) ? json.result : [] };
    return { ok: false, status: res.status, error: redact(json?.description ?? `HTTP ${res.status}`, token), retryAfter: Number(json?.parameters?.retry_after) || null };
  } catch (error) {
    return { ok: false, status: null, error: redact(error?.cause?.message ?? error?.message ?? error, token) };
  }
}

/* ------------------------------------------------------------ the bridge */

const defaultStatusMessages = (config, env) => {
  const source = sourceRootOf(env);
  const repos = reportRepos([], config).map((repo) => path.resolve(source, repo));
  return progressMessages(collectProgress(repos, { config }));
};

// The repositories whose open asks /asks and /creds list: the connector repos, every product repo
// config.yaml supervisor.repos names (the workflows the supervisor runs) and every repo a notice named.
export const bridgeAskRepos = ({ env = process.env, config = ownerConfig() ?? undefined } = {}) => {
  try {
    const source = sourceRootOf(env);
    const supervised = reportRepos([], config).map((repo) => path.resolve(source, repo));
    return askRepos(connectorsConfig(config, env), { env, extra: [...supervised, ...notifiedRepos(env)] });
  } catch { return []; }
};
const defaultSpawnServe = (env) => ({ repo, workflowId, dispatchId, ttlMs = null }) => spawnDetached(SERVE_ASK_FILE,
  ['--repo', repo, '--workflow', workflowId, '--dispatch', dispatchId, '--on-demand', 'telegram', ...(ttlMs ? ['--ttl', String(ttlMs)] : [])],
  { env: { ...process.env, ...env } });
const readAskState = (ledgerFile, workflowId, dispatchId, now) => {
  try {
    if (!ledgerFile || !fs.existsSync(ledgerFile)) return null;
    const handle = inspectLedger({ file: ledgerFile });
    try { return askState(handle.db, workflowId, dispatchId, { now }); } finally { try { handle.close(); } catch { /* closed */ } }
  } catch { return null; }
};

/**
 * The bridge over one state directory. Every seam is injectable for the specs: `settings()` (what
 * telegramSettings returns), the Bot API host and fetch, the clock, the log sink, the online window,
 * the /status builder, and for owner asks the repos /asks reads, the serve-ask launcher, the
 * connector starter, the public base, the waits and the sweep interval (0 sweeps every round).
 * `pollOnce()` runs one getUpdates round; `handleUpdate()` one update.
 */
export function createBridge({
  env = process.env, settings = () => telegramSettings({ env }), apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  fetchImpl = fetch, sleepImpl = sleep, now = Date.now, log = () => {}, onlineMs, timeoutS = POLL_TIMEOUT_S,
  statusMessages = () => defaultStatusMessages(ownerConfig(), env),
  // The [Supervisor] kernel's block (scripts/supervisor/status-block.mjs): OWED trend, workers, land queue, pushes.
  supervisorStatus = async (language) => (await import('../supervisor/status-block.mjs')).supervisorStatusMessage({ language, env }),
  repos = () => bridgeAskRepos({ env }), spawnServe = defaultSpawnServe(env), serveTtlMs = null,
  ensureConnectors = () => ensureAskConnectors({ env: { ...process.env, ...env } }), publicBaseOf = () => publicBase(env),
  serveWaitMs = 30000, tunnelWaitMs = 20000, waitStepMs = 250, sweepEveryMs = 60000,
  answerDraw = (args) => answerDrawReviewByReply(args),
} = {}) {
  let current = null;
  const say = (line) => { try { log(redact(line, current?.token)); } catch { /* logging never breaks the bridge */ } };
  const call = (method, payload) => botCall({ token: current.token, method, payload, apiBase, fetchImpl, sleepImpl, attempts: 3 });
  const t = () => bridgeText(current?.language);
  const send = async (text, { replyTo = null, markup = null, html = false } = {}) => {
    const payload = { chat_id: current.chatId, text: String(text).slice(0, TEXT_MAX), link_preview_options: { is_disabled: true } };
    if (replyTo) payload.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
    if (markup) payload.reply_markup = markup;
    if (html) payload.parse_mode = 'HTML';
    const sent = await call('sendMessage', payload);
    if (!sent.ok) say(`sendMessage failed: ${sent.error}`);
    return sent;
  };
  const sups = () => listSupervisors({ env, now: now(), onlineMs });
  const labelOf = (sup) => sup.label || sup.id;

  const chooser = async ({ note = null } = {}) => {
    const all = sups();
    if (!all.length) return send(note === 'held' ? t().heldNone : t().none);
    const routed = chatRoute(current.chatId, env)?.supervisorId ?? null;
    const inline_keyboard = all.map((sup) => [{ text: `${sup.online ? '🟢' : '⚪'} ${labelOf(sup)}${sup.id === routed ? ' ✓' : ''}`.slice(0, 64), callback_data: `sup:${sup.id}` }]);
    return send(note === 'held' ? `${t().held}\n${t().chooser}` : t().chooser, { markup: { inline_keyboard } });
  };

  const deliver = async (sup, { messageId, text, at }) => {
    const item = appendInbox(sup.id, { chatId: current.chatId, messageId, text, at }, { env });
    say(`delivered message ${numericId(messageId)} to supervisor ${sup.id} as ${item.id}`);
    const online = supervisorOnline(sup, { now: now(), env, onlineMs });
    await send(online ? t().forwarded(labelOf(sup)) : `${t().forwarded(labelOf(sup))}\n${t().offline}`, { replyTo: messageId });
    return item;
  };

  const setRoute = (supervisorId) => {
    const doc = readRoutes(env), key = String(current.chatId), prior = doc.chats[key] ?? {};
    const pending = prior.pending ?? [];
    doc.chats[key] = { supervisorId, at: new Date(now()).toISOString(), pending: [] };
    writeRoutes(env, doc);
    return pending;
  };

  const onText = async (message, text) => {
    const route = chatRoute(current.chatId, env);
    let sup = route?.supervisorId ? getSupervisor(route.supervisorId, env) : null;
    if (!sup) {
      const all = sups();
      if (all.length === 1) { sup = all[0]; setRoute(sup.id); say(`auto-routed chat ${numericId(current.chatId)} to the only supervisor ${sup.id}`); }
    }
    const entry = { messageId: message.message_id ?? null, text, at: new Date((Number(message.date) || now() / 1000) * 1000).toISOString() };
    if (sup) return deliver(sup, entry);
    const doc = readRoutes(env), key = String(current.chatId);
    doc.chats[key] = { supervisorId: null, at: doc.chats[key]?.at ?? null, pending: [...(doc.chats[key]?.pending ?? []), entry].slice(-MAX_PENDING) };
    writeRoutes(env, doc);
    say(`held message ${numericId(entry.messageId)} until a supervisor is chosen`);
    return chooser({ note: 'held' });
  };

  const onStatus = async () => {
    let messages;
    try { messages = statusMessages(); } catch (error) { say(`status report failed: ${error?.message ?? error}`); return send(t().statusFailed); }
    for (const text of [].concat(messages ?? []).filter(Boolean)) {
      const sent = await send(text, { html: true });
      if (!sent.ok) return sent;
    }
    let block = null;
    try { block = await supervisorStatus(current.language); } catch (error) { say(`supervisor status block failed: ${error?.message ?? error}`); }
    if (block) { const sent = await send(block, { html: true }); if (!sent.ok) return sent; }
    return { ok: true };
  };

  /* ---------------------------------------------------------- owner asks on demand */

  // Real waits, not sleepImpl: the specs stub sleepImpl to return at once, and a wait for a form
  // to bind must still take wall-clock time.
  const waitFor = async (probe, ms) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = probe();
      if (value) return value;
      if (Date.now() >= end) return null;
      await sleep(waitStepMs);
    }
  };
  const askLink = (serving) => {
    const expose = current.telegram?.exposeCredentialAsks === true;
    return { expose, needsTunnel: !serving.credential || expose };
  };
  const askText = (state, { serving = null, base = null, note = null } = {}) => {
    const workflow = { id: state.workflowId, title: state.title };
    if (!serving) return askMessage({ workflow, question: state.question, language: current.language, note });
    const { expose } = askLink(serving);
    const link = linkFor({ url: serving.url, credential: serving.credential }, { base, exposeCredentialAsks: expose });
    return askMessage({ workflow, question: state.question, link, expiresAt: serving.expiresAt, language: current.language, note });
  };
  // Where one ask lives: the store entry its button key names, else a scan of the repos' open asks.
  const targetOf = (key) => {
    const entry = askEntryByKey(key, env);
    if (entry?.workflowId && (entry.ledgerFile || entry.repo)) {
      const ledgerFile = entry.ledgerFile ?? ledgerFileFor(entry.repo);
      return { workflowId: entry.workflowId, dispatchId: entry.dispatchId, ledgerFile, repo: entry.repo ?? path.dirname(path.dirname(ledgerFile)) };
    }
    let listed = [];
    try { listed = repos(); } catch { listed = []; }
    for (const repo of listed) {
      const hit = withLedgerRead(repo, (db) => openAskList(db, { now: now() }).find((a) => askKeyOf(a.workflowId, a.dispatchId) === key) ?? null, null);
      if (hit) return { workflowId: hit.workflowId, dispatchId: hit.dispatchId, repo, ledgerFile: ledgerFileFor(repo) };
    }
    return null;
  };
  const stateOf = (target) => readAskState(target?.ledgerFile, target?.workflowId, target?.dispatchId, now());
  const removeMessage = (messageId) => removeAskMessage({ token: current.token, chatId: current.chatId, messageId, fallbackText: t().askClosed, apiBase, fetchImpl, sleepImpl });

  /** Edit the pressed message to `text` (the button kept); a message that cannot be edited is sent anew. */
  const showAsk = async (messageId, key, text) => {
    const markup = askButton(current.language, key);
    if (messageId) {
      const edited = await call('editMessageText', { chat_id: current.chatId, message_id: messageId, text, link_preview_options: { is_disabled: true }, reply_markup: markup });
      if (edited.ok || /message is not modified/i.test(edited.error ?? '')) return messageId;
    }
    const sent = await send(text, { markup });
    return sent.ok ? sent.result?.message_id ?? null : null;
  };

  /**
   * The "Generate URL" button: serve the ask's form on demand and put its link in the message. A /creds
   * button (`fresh`) shows the ask in a new message and leaves the list alone.
   */
  const onAskButton = async (query, key, { fresh = false } = {}) => {
    const messageId = fresh ? null : query.message?.message_id ?? null;
    const target = targetOf(key);
    const state = target ? stateOf(target) : null;
    if (!state || state.closed) {
      await call('answerCallbackQuery', { callback_query_id: query.id, text: t().askClosed });
      if (messageId) await removeMessage(messageId);
      say(`ask button ${key}: no open ask${state?.closed ? ` (${state.closed})` : ''}; message removed`);
      return { closed: state?.closed ?? 'unknown' };
    }
    await call('answerCallbackQuery', { callback_query_id: query.id, text: t().askGenerating });
    let serving = state.serving;
    if (!serving) {
      let pid = null;
      try { pid = spawnServe({ repo: target.repo, workflowId: target.workflowId, dispatchId: target.dispatchId, ttlMs: serveTtlMs }); } catch (error) { say(`ask ${key}: serve-ask did not launch: ${error?.message ?? error}`); }
      say(`ask ${key}: serve-ask launched on demand (pid ${pid ?? '-'})`);
      let latest = null;
      serving = pid ? await waitFor(() => { latest = stateOf(target); return latest?.closed ? latest : latest?.serving ?? null; }, serveWaitMs) : null;
      if (serving?.closed) { if (messageId) await removeMessage(messageId); return { closed: serving.closed }; }
      if (!serving) {
        await showAsk(messageId, key, askText(state, { note: textFor(current.language).serveFailed }));
        say(`ask ${key}: the form did not bind within ${serveWaitMs} ms`);
        return { served: false };
      }
    }
    let base = null;
    if (askLink(serving).needsTunnel) {
      let ensured = null;
      try { ensured = ensureConnectors(); } catch (error) { ensured = { ok: false, error: String(error?.message ?? error) }; }
      if (ensured?.ok === false) say(`ask ${key}: connectors not started: ${ensured.error}`);
      base = publicBaseOf() ?? await waitFor(() => publicBaseOf(), tunnelWaitMs);
    }
    const shown = await showAsk(messageId, key, askText(state, { serving, base }));
    await recordAskMessage({ workflowId: target.workflowId, dispatchId: target.dispatchId, repo: target.repo, ledgerFile: target.ledgerFile, messageId: shown, url: serving.url }, { env, now: now() });
    const link = linkFor({ url: serving.url, credential: serving.credential }, { base, exposeCredentialAsks: askLink(serving).expose });
    say(`ask ${key} served on demand: ${link.public ? 'public link' : link.reason}`);
    return { served: true, public: link.public, reason: link.reason, messageId: shown };
  };

  /** Every open ask of the repos, each tagged with its repo and its class (serve-ask.mjs askClassOf). */
  const openAsks = () => {
    let listed = [];
    try { listed = repos(); } catch { listed = []; }
    return listed.flatMap((repo) => withLedgerRead(repo, (db) => openAskList(db, { now: now() })
      .map((ask) => ({ ...ask, repo, askClass: askClassOf({ opId: ask.opId, question: ask.question }) })), []));
  };

  /** /asks: every open approval ask, one message each with its own button (a live form's link shown). */
  const onAsks = async () => {
    const open = openAsks();
    const asks = open.filter((ask) => ask.askClass === 'approval'), creds = open.length - asks.length;
    const hint = creds ? `\n${t().credsHint(creds)}` : '';
    if (!asks.length) return send(`${t().asksNone}${hint}`);
    await send(`${t().asksHead(asks.length)}${hint}`);
    const base = asks.some((a) => a.serving) ? publicBaseOf() : null;
    for (const ask of asks) {
      const key = askKeyOf(ask.workflowId, ask.dispatchId);
      const sent = await send(askText(ask, { serving: ask.serving, base }), { markup: askButton(current.language, key) });
      if (!sent.ok) continue;
      await recordAskMessage({ workflowId: ask.workflowId, dispatchId: ask.dispatchId, repo: ask.repo, ledgerFile: ledgerFileFor(ask.repo),
        messageId: sent.result?.message_id ?? null, url: ask.serving?.url ?? undefined }, { env, now: now() });
    }
    say(`listed ${asks.length} open ask(s)`);
    return { ok: true, count: asks.length };
  };

  /** /creds: every open credential ask in ONE message, one button each (the ask opens in a new message). */
  const onCreds = async () => {
    const creds = openAsks().filter((ask) => ask.askClass === 'credential');
    if (!creds.length) return send(t().credsNone);
    const lines = creds.map((ask, i) => `${i + 1}. ${ask.title ?? ask.workflowId}: ${clipLine(ask.question?.text, 220)}`);
    const inline_keyboard = creds.map((ask, i) => [{ text: `🔑 ${i + 1}. ${clipLine(ask.title ?? ask.workflowId, 48)}`, callback_data: `cred:${askKeyOf(ask.workflowId, ask.dispatchId)}` }]);
    const sent = await send([t().credsHead(creds.length), '', ...lines].join('\n'), { markup: { inline_keyboard } });
    // A button carries only a key; the store names where its ask lives.
    for (const ask of creds) await recordAskMessage({ workflowId: ask.workflowId, dispatchId: ask.dispatchId, repo: ask.repo, ledgerFile: ledgerFileFor(ask.repo) }, { env, now: now() });
    say(`listed ${creds.length} credential ask(s)`);
    return { ok: sent.ok, count: creds.length };
  };

  let lastSweep = -Infinity;
  const sweep = async () => {
    if (!(sweepEveryMs >= 0) || now() - lastSweep < sweepEveryMs) return null;
    lastSweep = now();
    const r = await sweepAskMessages({ repos }, { env, apiBase, fetchImpl, sleepImpl, now: now(), settings: current, warn: say });
    if (r.closed?.length || r.unlinked?.length) say(`sweep: ${r.closed.length} closed ask(s) cleared, ${r.unlinked.length} dead link(s) removed`);
    return r;
  };

  /**
   * The owner's reply to a draw-review notice (its album, one image, or its text): the ask's answer, recorded as a
   * verified owner answer (serve-ask.mjs answerDrawReviewByReply; the update already passed `authorized`). "ok" /
   * "duyệt" accepts; anything else is feedback and the drawing is redrawn. Never the runtime's own accept.
   */
  const onDrawReply = async (message, text) => {
    const replyTo = message.reply_to_message?.message_id;
    const entry = Number.isInteger(replyTo) ? drawReviewEntryByMessage(replyTo, env) : null;
    if (!entry) return null;
    const r = await answerDraw({ repo: entry.repo ?? (entry.ledgerFile ? path.dirname(path.dirname(entry.ledgerFile)) : null), ledgerFile: entry.ledgerFile ?? null,
      workflowId: entry.workflowId, dispatchId: entry.dispatchId, text, partPath: entry.partPath,
      telegram: { chatId: current.chatId, messageId: message.message_id ?? null, replyTo } });
    say(`draw review ${entry.key}: owner reply ${r?.ok ? r.decision : `not recorded (${r?.why ?? 'error'})`}`);
    const vi = current.language === 'vi';
    const ack = !r?.ok ? (vi ? `Chưa ghi nhận được: ${r?.why ?? 'lỗi'}.` : `Not recorded: ${r?.why ?? 'error'}.`)
      : r.decision === 'accept' ? (vi ? `Đã ghi nhận: thầy duyệt hình${r.golden ? ' và đặt làm hình chuẩn' : ''}.` : `Recorded: you accepted the drawing${r.golden ? ' as the golden reference' : ''}.`)
        : (vi ? 'Đã ghi nhận góp ý của thầy: hình sẽ được vẽ lại theo từng ghi chú.' : 'Recorded your feedback: the drawing will be redrawn to address every note.');
    await send(ack, { replyTo: message.message_id });
    return r ?? { ok: false };
  };

  const onMessage = async (message) => {
    const text = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : null;
    if (text == null || !text.trim()) return send(t().textOnly, { replyTo: message.message_id });
    if (message.reply_to_message && !text.trim().startsWith('/')) {
      const drawn = await onDrawReply(message, text);
      if (drawn) return drawn;
    }
    const command = /^\/([A-Za-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/.exec(text.trim());
    if (!command) return onText(message, text);
    const name = command[1].toLowerCase();
    say(`command /${name}`);
    if (name === 'start' || name === 'choose') return chooser();
    if (name === 'status') return onStatus();
    if (name === 'asks') return onAsks();
    if (name === 'creds') return onCreds();
    if (name === 'help') return send(t().help);
    return send(`${t().unknown}\n\n${t().help}`);
  };

  const onCallback = async (query) => {
    const data = String(query.data ?? '');
    const ask = ASK_CALLBACK.exec(data);
    if (ask) return onAskButton(query, ask[1]);
    const cred = CRED_CALLBACK.exec(data);
    if (cred) return onAskButton(query, cred[1], { fresh: true });
    const sup = data.startsWith('sup:') ? getSupervisor(data.slice(4), env) : null;
    if (!sup) {
      await call('answerCallbackQuery', { callback_query_id: query.id, text: data.startsWith('sup:') ? t().gone : undefined });
      return null;
    }
    await call('answerCallbackQuery', { callback_query_id: query.id });
    const pending = setRoute(sup.id);
    say(`chat ${numericId(current.chatId)} now routes to supervisor ${sup.id}`);
    const text = t().talking(labelOf(sup));
    const edited = query.message?.message_id
      ? await call('editMessageText', { chat_id: current.chatId, message_id: query.message.message_id, text })
      : { ok: false };
    if (!edited.ok) await send(text);
    for (const entry of pending) await deliver(sup, entry);
    return sup;
  };

  const authorized = (chatId, fromId) => chatId != null && fromId != null
    && String(chatId) === String(current.chatId) && String(fromId) === String(current.chatId);

  /** Handle one update under `settings`; never throws. */
  const handleUpdate = async (update) => {
    try {
      if (!current) current = settings();
      if (!current?.ready) return { ignored: 'telegram off' };
      if (update?.message) {
        const m = update.message;
        if (!authorized(m.chat?.id, m.from?.id)) { say(`dropped update ${numericId(update.update_id)} from chat ${numericId(m.chat?.id)} user ${numericId(m.from?.id)}`); return { dropped: true }; }
        await onMessage(m);
        return { handled: 'message' };
      }
      if (update?.callback_query) {
        const q = update.callback_query;
        if (!authorized(q.message?.chat?.id, q.from?.id)) { say(`dropped callback ${numericId(update.update_id)} from chat ${numericId(q.message?.chat?.id)} user ${numericId(q.from?.id)}`); return { dropped: true }; }
        await onCallback(q);
        return { handled: 'callback' };
      }
      return { ignored: true };
    } catch (error) {
      say(`update ${numericId(update?.update_id)} failed: ${error?.message ?? error}`);
      return { error: true };
    }
  };

  const saveOffset = (offset) => writeConnectorState(BRIDGE_NAME, { kind: 'telegram-bridge', cursor: { offset, at: new Date(now()).toISOString() } }, env);

  // MB-11: config.yaml read while it is being rewritten is not "telegram off": the last good settings carry on (the
  // bridge stopped 4 times for 1-6 min on exactly that), and a real change of settings is picked up on the next read.
  let lastGood = null, unreadableSince = null;
  /** One getUpdates round: {ok, count} | {stop} | {conflict} | {error, status, retryAfter}. */
  const pollOnce = async () => {
    const fresh = settings();
    if (!fresh?.ready && lastGood && /cannot be read/i.test(String(fresh?.warning ?? ''))) {
      if (unreadableSince == null) { unreadableSince = now(); say(`${fresh.warning}; keeping the last good settings`); }
      current = lastGood;
    } else {
      if (unreadableSince != null) { say('config.yaml readable again'); unreadableSince = null; }
      current = fresh;
    }
    if (!current?.ready) return { stop: current?.warning ?? 'telegram off' };
    lastGood = current;
    const offset = Number.isSafeInteger(bridgeState(env)?.offset) ? bridgeState(env).offset : null;
    const r = await getUpdates({ token: current.token, offset, timeoutS, apiBase, fetchImpl });
    if (!r.ok) {
      say(`getUpdates failed (${r.status ?? 'network'}): ${r.error}`);
      if (r.status === 409) return { conflict: true, error: r.error };
      if ([401, 403, 404].includes(r.status)) return { stop: `the Bot API refused the token (${r.status})` };
      return { error: r.error, status: r.status, retryAfter: r.retryAfter };
    }
    let next = offset, count = 0;
    for (const update of r.result) {
      if (!Number.isSafeInteger(update?.update_id)) continue;
      if (next != null && update.update_id < next) continue;
      next = update.update_id + 1;
      saveOffset(next);   // before handling: a crash mid-update never redelivers it
      await handleUpdate(update);
      count += 1;
    }
    // Asks that closed leave the chat, and links to forms that ended are taken back off.
    try { await sweep(); } catch (error) { say(`sweep failed: ${error?.message ?? error}`); }
    return { ok: true, count };
  };

  /**
   * Poll until told to stop; backs off on errors; exits when another bridge owns the updates. Before every round
   * after the first, `reload()` may hand the bridge to a replacement (its pid): the loop then returns.
   */
  const run = async ({ signal = null, ownPid = process.pid, maxRounds = Infinity, reload = null } = {}) => {
    let backoff = 1000;
    for (let round = 0; round < maxRounds && !signal?.aborted; round += 1) {
      const replacement = round > 0 && reload ? await reload() : null;
      if (replacement) { say(`stopping: replacement ${replacement} took the bridge over`); return { stopped: 'reloaded', reloaded: replacement }; }
      let r;
      try { r = await pollOnce(); } catch (error) { say(`poll round failed: ${error?.message ?? error}`); r = { error: 'poll round failed' }; }
      if (r.stop) { say(`stopping: ${r.stop}`); return { stopped: r.stop }; }
      if (r.conflict) {
        const holder = lockHolder(BRIDGE_NAME, env);
        if (holder && holder.pid !== ownPid) { say(`stopping: bridge ${holder.pid} owns the updates`); return { stopped: 'another bridge polls this bot' }; }
        await sleepImpl(30000); continue;
      }
      if (r.error) { await sleepImpl(r.retryAfter ? Math.min(r.retryAfter, 60) * 1000 : backoff); backoff = Math.min(backoff * 2, 60000); continue; }
      backoff = 1000;
    }
    return { stopped: signal?.aborted ? 'signal' : 'rounds' };
  };

  return { pollOnce, handleUpdate, run, settings: () => current };
}

/* ------------------------------------------------------------ ensure (supervisor channel) */

/**
 * Make sure one bridge runs on this host: a live bridge is left alone; telegram off (or a spec run
 * against the real Bot API, or STARCI_CONNECTORS_OFF=1) is a skip; otherwise `run` is launched
 * detached. `requireRegistered` (resume-all) also skips while no supervisor has ever registered, so
 * the bridge first starts from a supervisor's `channel.mjs register` and after that survives reboots.
 * Never throws: {ok, already|launched|skipped|wouldStart|error}.
 */
export function ensureTelegramBridge({ env = process.env, config = undefined, root = configRoot, spawn = spawnDetached, dryRun = false, requireRegistered = false } = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    const apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE;
    if (env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE) return { ok: true, skipped: 'test context' };
    const live = bridgeAlive(env);
    if (live) return { ok: true, already: true, pid: live.pid };
    if (requireRegistered && !listSupervisors({ env }).length) return { ok: true, skipped: 'no supervisor registered' };
    const settings = telegramSettings({ config: config === undefined ? ownerConfig() : config, env, root });
    if (!settings.ready) return { ok: true, skipped: settings.warning ?? 'telegram off' };
    if (dryRun) return { ok: true, wouldStart: true };
    return { ok: true, launched: spawn(BRIDGE_FILE, ['run'], { env }) };
  } catch (error) {
    return { ok: false, error: redact(error?.message ?? error) };
  }
}

/* ------------------------------------------------------------ CLI */

/**
 * MB-11: a new runtime HEAD reloads the bridge only when it changed a file under these (the bridge re-exec'd on every
 * land: 198 takeovers, 8-12 an hour). Its own files below reload it by mtime as before.
 */
export const BRIDGE_HEAD_PATHS = Object.freeze(['scripts/connectors/', 'scripts/lib/', 'scripts/supervisor/progress-report.mjs', 'scripts/kernel/serve-ask.mjs', 'engine/']);

/** What the bridge process runs: its own file and its direct imports. A change to one, or a new runtime HEAD, reloads it. */
export const bridgeReloadFiles = (root = configRoot) => [
  'scripts/connectors/telegram-bridge.mjs', 'scripts/connectors/telegram.mjs', 'scripts/connectors/lib.mjs', 'scripts/connectors/tunnel.mjs',
  'scripts/supervisor/progress-report.mjs', 'scripts/kernel/serve-ask.mjs', 'scripts/lib/self-reload.mjs', 'engine/config.mjs',
].map((rel) => path.join(root, ...rel.split('/')));

// The bridge log: machine_logs (actor connector, kind telegram-bridge.log); echoed to a terminal when there is one.
const bridgeLog = (env, echo) => (line) => {
  connectorLog(BRIDGE_NAME, line, { env });
  if (echo) process.stderr.write(`[${new Date().toISOString()}] ${line}\n`);
};

async function runMain() {
  const env = process.env;
  const log = bridgeLog(env, process.stderr.isTTY === true);
  // A spec run (node --test sets NODE_TEST_CONTEXT, which spawned children inherit) never polls the real bot.
  if (env.NODE_TEST_CONTEXT && !env.STARCI_TELEGRAM_API_BASE) { console.log(JSON.stringify({ ok: true, skipped: 'test context' })); return; }
  const first = telegramSettings({ env });
  if (!first.ready) { console.log(JSON.stringify({ ok: true, skipped: first.warning ?? 'telegram off' })); return; }
  // A replacement the running bridge spawned (self-reload) takes its lock over; nothing else may.
  const handoverFrom = env[RELOAD_ENV.handoverFrom] ?? null;
  const reloadedAt = Number(env[RELOAD_ENV.reloadedAt]) || null;
  delete env[RELOAD_ENV.handoverFrom];
  delete env[RELOAD_ENV.reloadedAt];
  const claim = handoverFrom ? claimOrTakeOver(BRIDGE_NAME, { from: handoverFrom, env }) : claimManager(BRIDGE_NAME, { current: bridgeState(env), env });
  if (!claim.ok) { console.log(JSON.stringify({ ok: false, already: true, pid: claim.holder?.pid ?? null })); process.exitCode = 1; return; }
  process.on('exit', claim.release);
  // The offset (the row's cursor) survives the restart: only the record of who runs is replaced.
  writeConnectorState(BRIDGE_NAME, { kind: 'telegram-bridge', state: 'running', pid: process.pid, config: { schema: 'starci/telegram-bridge@1', pid: process.pid, startedAt: new Date().toISOString() } }, env);
  const controller = new AbortController();
  const stop = () => { controller.abort(); claim.release(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  console.log(JSON.stringify({ ok: true, pid: process.pid, log: 'machine_logs actor connector kind telegram-bridge.log' }));
  log(`bridge ${process.pid} started${claim.takenOver ? ` (took over from ${handoverFrom})` : ''}`);
  const bridge = createBridge({ env, log, settings: () => telegramSettings({ env }) });
  const watch = createReloadWatch({ root: configRoot, files: bridgeReloadFiles(), lastReloadAt: reloadedAt, headPaths: BRIDGE_HEAD_PATHS });
  const reload = async () => {
    const check = watch.check();
    if (!check.reload) return null;
    watch.markAttempt();
    const handed = await reexecSelf({ script: BRIDGE_FILE, args: ['run'], lockName: BRIDGE_NAME, env, cwd: configRoot, actor: 'connector' });
    log(handed.ok ? `bridge ${process.pid} reloading (${check.reason})` : `bridge ${process.pid} reload failed: ${handed.error}`);
    return handed.ok ? handed.pid : null;
  };
  let result;
  try { result = await bridge.run({ signal: controller.signal, reload }); } catch (error) { result = { stopped: `crashed: ${redact(error?.message ?? error, first.token)}` }; }
  log(`bridge ${process.pid} stopped: ${result.stopped}`);
  if (result.reloaded) process.exit(0);   // the lock now names the replacement
  claim.release();
}

function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0] ?? 'status';
  const out = (value) => console.log(JSON.stringify(value));
  const state = bridgeState();
  if (verb === 'status') {
    const live = bridgeAlive();
    out({ ok: true, running: Boolean(live), pid: live?.pid ?? null, offset: state?.offset ?? null, supervisors: listSupervisors().map(({ id, label, online, heartbeatAt }) => ({ id, label, online, heartbeatAt })) });
    return;
  }
  if (verb === 'stop') {
    const live = bridgeAlive();
    if (live?.pid && pidAlive(live.pid)) { try { process.kill(live.pid); } catch { /* gone */ } }
    out({ ok: true, stopped: live?.pid ?? null }); return;
  }
  if (verb === 'start') { const r = ensureTelegramBridge(); out(r); if (!r.ok) process.exitCode = 1; return; }
  if (verb === 'run') return runMain();
  console.error('usage: telegram-bridge.mjs start|run|status|stop'); process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === BRIDGE_FILE) main();
