#!/usr/bin/env node
// telegram.mjs — tells the owner about an owner ask over a Telegram bot
// (docs/connectors.md). The one send point is the KERNEL's ask path:
// `api serve-ask` (scripts/kernel/serve-ask.mjs parkAsk) calls notifyAsk()
// when an ask is parked; only an approval ask is pushed, a credential ask waits
// under the bridge's /creds (serve-ask.mjs askClassOf). The message carries
// the workflow, the question and its numbered options, and ONE inline button "Generate URL" — never a link:
// no form is served until the owner asks for one (owner, 2026-09-24: "khi yêu
// cầu thì mới serve url"). Pressing the button reaches the command bridge
// (telegram-bridge.mjs), which serves the form on demand and edits this same
// message to carry the link (showAskLink). When the ask is answered or retired
// the message is DELETED (markAskClosed; a message Telegram refuses to delete,
// e.g. older than 48 h, is edited to say it was answered instead). The one
// other message is notifyAutoAccepted: an ask the runtime answered with its
// recommended option (config.yaml asks.autoAcceptRecommended) is told once,
// plainly, with no link. Nothing else is sent: no op progress, no incidents,
// no finish, and never from the supervisor.
//
//   node scripts/connectors/telegram.mjs notify --ledger <runtime.sqlite> --workflow <id> --dispatch <id> [--repo <path>]
//       (re-)send the notice of one open ask (deduped: an ask with an open notice is not sent again)
//   node scripts/connectors/telegram.mjs sweep          delete the notices of asks that closed, drop dead links
//   node scripts/connectors/telegram.mjs discover-chat   getUpdates -> chat ids (id, type, name only)
//   node scripts/connectors/telegram.mjs test            one test message to connectors.telegram.chatId
//
// Messages are plain text in config.yaml `language` (vi, else en). The link a
// served form gets is its nonce path on the public tunnel host
// (https://<hostname>/a-<nonce>, served by scripts/connectors/ask-gateway.mjs).
// A credential ask never gets a public link unless
// connectors.telegram.exposeCredentialAsks is true: the message says to answer
// it on the machine and carries only the localhost link. The store
// <state>/connectors/telegram-sent.json keeps, per ask, its short key (the
// button's callback_data `ask:<key>`, 16 hex chars, well under Telegram's 64
// bytes), its repo and ledger, every message id that shows it, and the URL the
// messages currently carry. A missing token or chatId is a no-op with one
// stderr line; nothing here ever throws into its caller. Ledgers are read
// read-only. The bot token comes from the env var botTokenEnv names (or
// connectors.secretsFile), is never printed, and is scrubbed from every error.
// STARCI_TELEGRAM_API_BASE replaces https://api.telegram.org for tests.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { configRoot, connectorEnv, connectorSecret, connectorsConfig } from '../../engine/config.mjs';
import { argsOf, askRepos, askState, ownerConfig, readJson, stateFile, withLedgerRead, writeJson } from './lib.mjs';
import { publicBase } from './tunnel.mjs';
import { clip } from '../lib/clip.mjs';
import { parseJson } from '../lib/json.mjs';

export const DEFAULT_API_BASE = 'https://api.telegram.org';
/** The longest text one sendMessage carries, under Telegram's 4096-character cap. */
export const TEXT_MAX = 3900;
const SENT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

const TEXT = {
  en: {
    ask: '[StarCi] A question for you',
    workflow: 'Workflow', question: 'Question', options: 'Options', link: 'Answer here', expires: 'Link expires',
    onDemand: 'The answer form is not open yet. When you want to answer, press "Generate URL": the link is made only then.',
    generate: 'Generate URL',
    credential: 'This question asks for secrets (keys, secret files), so it is NOT exposed. Answer it ON THE MACHINE by opening this localhost link there:',
    localOnly: 'No public tunnel is running, so this form opens only on the machine, at this localhost link:',
    serveFailed: 'The answer form could not be started just now. Press "Generate URL" again.',
    test: '[StarCi] Telegram connector test: this chat will receive owner questions.',
    answered: '[StarCi] Answered', retired: '[StarCi] No longer needs an answer', at: 'at',
  },
  vi: {
    ask: '[StarCi] Có câu hỏi cần thầy trả lời',
    workflow: 'Workflow', question: 'Câu hỏi', options: 'Lựa chọn', link: 'Trả lời tại', expires: 'Link hết hạn lúc',
    onDemand: 'Form trả lời chưa mở. Khi thầy muốn trả lời, bấm "Tạo link trả lời": lúc đó link mới được tạo.',
    generate: 'Tạo link trả lời',
    credential: 'Câu hỏi này cần nhập thông tin bí mật (key, file secret) nên KHÔNG đưa ra ngoài. Thầy trả lời TRÊN MÁY, mở link localhost này tại máy:',
    localOnly: 'Chưa có tunnel công khai đang chạy nên form chỉ mở được trên máy, tại link localhost này:',
    serveFailed: 'Chưa mở được form trả lời lúc này. Thầy bấm "Tạo link trả lời" lại nhé.',
    test: '[StarCi] Kiểm tra kết nối Telegram: chat này sẽ nhận câu hỏi của workflow.',
    answered: '[StarCi] Đã trả lời', retired: '[StarCi] Câu hỏi này không cần trả lời nữa', at: 'lúc',
  },
};
export const textFor = (language) => TEXT[language] ?? TEXT.en;

const parse = parseJson;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const optionLabel = (o) => (typeof o === 'string' ? o : o?.label ?? o?.id ?? '');
const when = (ms, language) => new Date(ms).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false });

/** Replace every occurrence of the secret (and anything shaped like a bot token) in `text`. */
export const redact = (text, secret) => {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('***');
  return out.replace(/bot\d+:[A-Za-z0-9_-]{20,}/g, 'bot***');
};

/* ------------------------------------------------------------ ask keys and buttons */

/** The store key of one ask (`<workflow>|<dispatch>`). */
export const askStoreKey = (workflowId, dispatchId) => `${workflowId}|${dispatchId}`;
/** The short key a "Generate URL" button carries: 16 hex chars of sha256(workflow|dispatch). */
export const askKeyOf = (workflowId, dispatchId) => crypto.createHash('sha256').update(askStoreKey(workflowId, dispatchId)).digest('hex').slice(0, 16);
export const ASK_CALLBACK = /^ask:([0-9a-f]{16})$/;
/** The one-button inline keyboard under an ask message. */
export const askButton = (language, key) => ({ inline_keyboard: [[{ text: textFor(language).generate, callback_data: `ask:${key}` }]] });

/* ------------------------------------------------------------ messages */

const workflowLine = (t, workflow) => `${t.workflow}: ${workflow.title ? `${workflow.title} (${workflow.id})` : workflow.id}`;

/** The link the owner gets for one served ask, and why. */
export function linkFor(ask, { base, exposeCredentialAsks }) {
  if (ask.credential && !exposeCredentialAsks) return { href: ask.url, public: false, reason: 'credential' };
  if (!base) return { href: ask.url, public: false, reason: 'no-tunnel' };
  const u = new URL(ask.url);
  return { href: `${base.replace(/\/+$/, '')}${u.pathname}${u.search}`, public: true, reason: null };
}

/**
 * The ask message: workflow, question, numbered options, then either the served form's link (with
 * its expiry) or, with no `link`, the line saying the form opens when the owner presses the button.
 * `note` adds one closing line (a failed serve).
 */
export function askMessage({ workflow, question, link = null, expiresAt = null, language, note = null }) {
  const t = textFor(language);
  const options = (question.options ?? []).map(optionLabel).filter(Boolean);
  const lines = [t.ask, workflowLine(t, workflow), '', `${t.question}:`, clip(String(question.text ?? '').trim(), 2500)];
  if (options.length) lines.push('', `${t.options}:`, ...options.map((o, i) => (/^\s*\d+[.)]\s/.test(o) ? clip(o.trim(), 300) : `${i + 1}. ${clip(o, 300)}`)));
  lines.push('');
  // A form that is not public carries its localhost link with the plain reason
  // it only opens on the machine (owner, 2026-09-23: credential asks stay on
  // localhost, never exposed; the message gives the localhost link and says to
  // answer it at the machine).
  if (!link) lines.push(t.onDemand);
  else if (link.reason === 'credential') lines.push(t.credential, link.href);
  else if (link.reason === 'no-tunnel') lines.push(t.localOnly, link.href);
  else lines.push(`${t.link}: ${link.href}`);
  if (link && expiresAt) lines.push(`${t.expires}: ${when(expiresAt, language)}`);
  if (note) lines.push('', note);
  return clip(lines.join('\n'), TEXT_MAX);
}
/**
 * The one plain message for an ask the runtime answered with its recommendation (config.yaml
 * asks.autoAcceptRecommended; serve-ask.mjs autoAcceptAsk): the pick and the question, no form link.
 */
export function autoAcceptedMessage({ workflow, question, label, language }) {
  const t = textFor(language);
  const text = clip(String(question?.text ?? '').trim(), 2500), pick = clip(String(label ?? '').trim(), 300);
  const line = language === 'vi'
    ? `Đã tự chọn phương án đề xuất: ${pick} — câu hỏi: ${text}. Thầy muốn đổi thì trả lời lại kernel / supervisor.`
    : `Auto-picked the recommended option: ${pick} — question: ${text}. To change it, answer the kernel / supervisor again.`;
  return clip([line, '', workflowLine(t, workflow)].join('\n'), TEXT_MAX);
}
/** The text a message is edited to when Telegram refuses to delete it (answered / retired). */
export function closedMessage({ reason, by = null, title, question, language, now = Date.now() }) {
  const t = textFor(language);
  const stamp = new Date(now).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const head = `${reason === 'retired' ? t.retired : t.answered} (${t.at} ${stamp}${by ? `, ${by}` : ''})`;
  return [head, `${t.workflow}: ${title}`, '', String(question?.text ?? '')].join('\n').slice(0, TEXT_MAX);
}
/* ------------------------------------------------------------ Bot API */

const endpoint = (apiBase, token, method) => `${apiBase.replace(/\/+$/, '')}/bot${token}/${method}`;

/**
 * One Bot API call with polite retries: 429 waits `retry_after` (capped at 60 s), 5xx and network
 * errors back off 1 s, 2 s, 4 s; any other 4xx fails at once. Returns {ok, status, result, error}
 * with the token scrubbed from the error.
 */
export async function botCall({ token, method, payload, apiBase = DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = sleep, attempts = 4 }) {
  const body = JSON.stringify(payload);
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(endpoint(apiBase, token, method), { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(15000) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok !== false) return { ok: true, status: res.status, result: json?.result ?? null };
      last = { ok: false, status: res.status, error: redact(json?.description ?? `HTTP ${res.status}`, token) };
      if (res.status === 429) { await sleepImpl(Math.min(Number(json?.parameters?.retry_after ?? 1), 60) * 1000); continue; }
      if (res.status < 500) return last;
    } catch (error) {
      last = { ok: false, status: null, error: redact(error?.cause?.message ?? error?.message ?? error, token) };
    }
    if (attempt < attempts) await sleepImpl(1000 * 2 ** (attempt - 1));
  }
  return last;
}

export const sendMessage = ({ token, chatId, text, markup = null, ...rest }) =>
  botCall({ token, method: 'sendMessage', payload: { chat_id: chatId, text, link_preview_options: { is_disabled: true }, ...(markup ? { reply_markup: markup } : {}) }, ...rest })
    .then((r) => (r.ok ? { ...r, messageId: r.result?.message_id ?? null } : r));

/** getUpdates -> the chats that messaged the bot: id, type and name only (never message text). */
export async function discoverChats({ token, apiBase = DEFAULT_API_BASE, fetchImpl = fetch }) {
  const r = await botCall({ token, method: 'getUpdates', payload: { allowed_updates: ['message', 'channel_post', 'my_chat_member'] }, apiBase, fetchImpl, attempts: 1 });
  if (!r.ok) return r;
  const chats = new Map();
  for (const update of r.result ?? []) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
    if (!chat?.id || chats.has(chat.id)) continue;
    chats.set(chat.id, { id: chat.id, type: chat.type ?? null, name: chat.title ?? ([chat.first_name, chat.last_name].filter(Boolean).join(' ') || null), username: chat.username ?? null });
  }
  return { ok: true, chats: [...chats.values()] };
}

const GONE = /not found|message can't be edited|message to edit not found/i;

/**
 * Remove one ask message from the chat: deleteMessage, else (Telegram refuses to delete a message
 * older than 48 h) edit it to `fallbackText` with no button. 'deleted' | 'gone' | 'edited' | 'failed'.
 */
export async function removeAskMessage({ token, chatId, messageId, fallbackText, apiBase = DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = sleep }) {
  const call = (method, payload) => botCall({ token, method, payload, apiBase, fetchImpl, sleepImpl, attempts: 2 });
  const deleted = await call('deleteMessage', { chat_id: chatId, message_id: messageId });
  if (deleted.ok) return 'deleted';
  if (/message to delete not found/i.test(deleted.error ?? '')) return 'gone';
  const edited = await call('editMessageText', { chat_id: chatId, message_id: messageId, text: fallbackText, link_preview_options: { is_disabled: true } });
  if (edited.ok || /message is not modified/i.test(edited.error ?? '')) return 'edited';
  return GONE.test(edited.error ?? '') ? 'gone' : 'failed';
}

/* ------------------------------------------------------------ settings */

/**
 * What a notification needs from config + environment: {ready, token, chatId, language, telegram,
 * base, warning}. `ready` is false with a one-line `warning` when Telegram is wanted (enabled, or a
 * token is present) but the token or chatId is missing; false with no warning when it is simply off.
 */
export function telegramSettings({ config = ownerConfig(), env = process.env, root = configRoot } = {}) {
  if (!config) return { ready: false, warning: 'telegram: config.yaml cannot be read; not notifying' };
  let connectors;
  try { connectors = connectorsConfig(config, env, root); } catch (error) { return { ready: false, warning: `telegram: ${error.message}` }; }
  const telegram = connectors.telegram;
  const token = connectorSecret(telegram.botTokenEnv, connectorEnv(config, env, root));
  const base = connectors.cloudflare.mode === 'named' ? connectors.cloudflare.publicBase
    : connectors.cloudflare.mode === 'quick' ? publicBase(env) : null;
  const common = { telegram, language: config.language, base, chatId: telegram.chatId };
  if (telegram.enabled && token && telegram.chatId) return { ready: true, token, ...common };
  if (!telegram.enabled && !token) return { ready: false, ...common };
  const missing = [!token && `the bot token (${telegram.botTokenEnv})`, !telegram.chatId && 'connectors.telegram.chatId', !telegram.enabled && 'connectors.telegram.enabled: true'].filter(Boolean);
  return { ready: false, ...common, warning: `telegram: not notifying — missing ${missing.join(', ')}` };
}

/* ------------------------------------------------------------ the sent store */

// One writer at a time for the store: two asks may be parked at once.
async function withLock(file, fn, { waitMs = 10000 } = {}) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const end = Date.now() + waitMs;
  let fd = null;
  while (fd === null) {
    try { fd = fs.openSync(lock, 'wx'); } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 60000) fs.rmSync(lock, { force: true }); } catch { /* gone */ }
      if (Date.now() > end) return { ok: false, skipped: 'dedupe store is locked' };
      await sleep(100);
    }
  }
  try { return await fn(); } finally { try { fs.closeSync(fd); fs.rmSync(lock, { force: true }); } catch { /* best effort */ } }
}

export const sentFile = (env = process.env) => stateFile('telegram-sent.json', env);
const loadStore = (file) => {
  const store = readJson(file, null) ?? {};
  store.schema = 'starci/telegram-sent@2';
  store.events ??= {}; store.asks ??= {}; store.keys ??= {};
  return store;
};
/** The message ids that show one ask (a pre-button entry kept one `messageId`). */
export const messageIdsOf = (entry) => [...new Set([
  ...(Array.isArray(entry?.messageIds) ? entry.messageIds : []), ...(Number.isInteger(entry?.messageId) ? [entry.messageId] : []),
].filter(Number.isInteger))];
/** Read the store (no lock): a snapshot for lookups. */
export const readSentStore = (env = process.env) => loadStore(sentFile(env));
/** Change the store under its lock; `fn(store)` mutates it and returns the result. */
export const updateSentStore = (fn, { env = process.env } = {}) => {
  const file = sentFile(env);
  return withLock(file, async () => { const store = loadStore(file); const out = await fn(store); writeJson(file, store); return out; });
};
/** The ask a button key names ({askKey, key, repo, ledgerFile, workflowId, dispatchId, ...}), or null. */
export const askEntryByKey = (key, env = process.env) => {
  const store = readSentStore(env), askKey = store.keys[key];
  const entry = askKey ? store.asks[askKey] : null;
  return entry ? { ...entry, askKey } : null;
};
/**
 * Record that `messageId` shows one ask (a /asks listing, a re-sent notice) and, when `url` is not
 * undefined, the link the ask's messages now carry. A closed entry starts over.
 */
export const recordAskMessage = ({ workflowId, dispatchId, repo = null, ledgerFile = null, messageId = null, url }, { env = process.env, now = Date.now() } = {}) =>
  updateSentStore((store) => {
    const askKey = askStoreKey(workflowId, dispatchId), key = askKeyOf(workflowId, dispatchId);
    const prior = store.asks[askKey];
    const entry = prior && !prior.closed ? prior : { key, workflowId, dispatchId, messageIds: [], url: null, at: now };
    entry.key = key; entry.workflowId = workflowId; entry.dispatchId = dispatchId;
    entry.repo = repo ?? entry.repo ?? null; entry.ledgerFile = ledgerFile ?? entry.ledgerFile ?? (entry.repo ? ledgerFileFor(entry.repo) : null);
    entry.messageIds = messageIdsOf(entry); delete entry.messageId;
    if (Number.isInteger(messageId) && !entry.messageIds.includes(messageId)) entry.messageIds.push(messageId);
    if (url !== undefined) entry.url = url;
    store.asks[askKey] = entry; store.keys[key] = askKey;
    return { ...entry, askKey };
  }, { env });

/* ------------------------------------------------------------ the ask from the ledger */

const readAsk = (ledgerFile, workflowId, dispatchId, now) => {
  const handle = inspectLedger({ file: ledgerFile });
  try { return askState(handle.db, workflowId, dispatchId, { now }); } finally { try { handle.close(); } catch { /* closed */ } }
};
const guarded = (env, apiBase, fetchImpl) => (env.STARCI_CONNECTORS_OFF === '1' ? 'STARCI_CONNECTORS_OFF'
  // A spec run (node --test sets NODE_TEST_CONTEXT, which spawned children such as a serve-ask under
  // test inherit) never reaches the real Bot API, whatever the owner config says.
  : env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch ? 'test context' : null);

/**
 * Tell the owner about one parked ask: ONE message with the workflow, the question, its numbered
 * options and the "Generate URL" button, no link. Deduped per ask: an ask whose notice is still in
 * the chat is not sent again ({skipped:'already notified', key, messageId}). Never throws: every
 * failure is one stderr line (through `warn`) and a {ok:false} result. `ledgerFile` is the
 * workflow's runtime.sqlite, read read-only; everything external is injectable. `push:false` (a
 * credential ask, serve-ask.mjs askClassOf) sends nothing: {ok, listed:true, key} once Telegram is
 * ready and the ask open, and the owner finds it under the bridge's /creds.
 */
export async function notifyAsk({ ledgerFile, repo = null, workflowId, dispatchId, push = true }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    const off = guarded(env, apiBase, fetchImpl);
    if (off) return { ok: true, skipped: off };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) { if (settings.warning) warn(settings.warning); return { ok: true, skipped: settings.warning ?? 'telegram off' }; }
    let view;
    try { view = readAsk(ledgerFile, workflowId, dispatchId, now); } catch (error) { warn(`telegram: ask not sent: ledger unreadable (${error.message})`); return { ok: false, error: 'ledger unreadable' }; }
    if (!view) return { ok: true, skipped: 'no ask report' };
    if (view.closed) return { ok: true, skipped: `already ${view.closed}` };
    if (!push) return { ok: true, listed: true, key: askKeyOf(workflowId, dispatchId) };
    const file = sentFile(env);
    return await withLock(file, async () => {
      const store = loadStore(file);
      for (const [key, at] of Object.entries(store.events)) if (now - at > SENT_KEEP_MS) delete store.events[key];
      for (const [askKey, ask] of Object.entries(store.asks)) {
        if (now - (ask?.at ?? 0) > SENT_KEEP_MS && !messageIdsOf(ask).length) { delete store.asks[askKey]; if (ask?.key) delete store.keys[ask.key]; }
      }
      const askKey = askStoreKey(workflowId, dispatchId), key = askKeyOf(workflowId, dispatchId);
      const entry = store.asks[askKey];
      if (entry?.key && !entry.closed && messageIdsOf(entry).length) return { ok: true, skipped: 'already notified', key, messageId: messageIdsOf(entry).at(-1) };
      const text = askMessage({ workflow: { id: workflowId, title: view.title }, question: view.question, language: settings.language });
      const sent = await sendMessage({ token: settings.token, apiBase, fetchImpl, sleepImpl, chatId: settings.chatId, text, markup: askButton(settings.language, key) });
      if (!sent.ok) { warn(`telegram: ask not sent: ${sent.error}`); return { ok: false, status: sent.status, error: sent.error }; }
      // A pre-button message of this ask (it carried a link) goes with the rest when the ask closes.
      const legacy = entry && !entry.closed ? messageIdsOf(entry) : [];
      store.asks[askKey] = { key, repo, ledgerFile, workflowId, dispatchId, messageIds: [...legacy, sent.messageId], url: null, at: now };
      store.keys[key] = askKey;
      writeJson(file, store);
      return { ok: true, sent: 1, key, messageId: sent.messageId };
    });
  } catch (error) {
    const line = `telegram: ask notification failed: ${redact(error?.message ?? error)}`;
    try { warn(line); } catch { /* nothing left to do */ }
    return { ok: false, error: line };
  }
}

/**
 * Take one ask off the chat once it no longer waits: answered (serve-ask on submit, auto-accept) or
 * retired (api retire-ask, a superseding ask). Every message that shows it is DELETED (owner,
 * 2026-09-24: "trả lời xong xóa"); one Telegram refuses to delete is edited to say it was answered,
 * with the question kept and no link or button. Never throws; an ask with no message (or Telegram
 * off) is a no-op. Returns {ok, reason, deleted:[ids], edited:[ids], failed:[ids]}; a failed one
 * stays in the store for the bridge's sweep to retry.
 */
export async function markAskClosed({ ledgerFile, workflowId, dispatchId, reason = 'answered', by = null }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(), settings: given = null,
} = {}) {
  try {
    const off = guarded(env, apiBase, fetchImpl);
    if (off) return { ok: true, skipped: off };
    const settings = given ?? telegramSettings({ config, env, root });
    if (!settings.ready) return { ok: true, skipped: 'telegram off' };
    const file = sentFile(env);
    return await withLock(file, async () => {
      const store = loadStore(file);
      const askKey = askStoreKey(workflowId, dispatchId), sent = store.asks[askKey];
      const ids = messageIdsOf(sent);
      if (!sent || (!ids.length && !sent.closed)) return { ok: true, skipped: 'no message sent for this ask' };
      if (!ids.length) return { ok: true, skipped: `already ${sent.closed}` };
      let question = { text: '' }, title = workflowId;
      try {
        const view = readAsk(ledgerFile ?? sent.ledgerFile, workflowId, dispatchId, now);
        if (view) { question = view.question; title = view.title ?? workflowId; }
      } catch { /* the fallback edit still says the ask closed */ }
      const closedAs = sent.closed ?? reason;
      const fallbackText = closedMessage({ reason: closedAs, by, title, question, language: settings.language, now });
      const out = { deleted: [], edited: [], failed: [] };
      for (const messageId of ids) {
        const how = await removeAskMessage({ token: settings.token, chatId: settings.chatId, messageId, fallbackText, apiBase, fetchImpl, sleepImpl });
        out[how === 'edited' ? 'edited' : how === 'failed' ? 'failed' : 'deleted'].push(messageId);
      }
      if (out.failed.length) warn(`telegram: ${out.failed.length} message(s) of ask ${dispatchId} could not be removed; the bridge sweep retries`);
      store.asks[askKey] = { ...sent, messageIds: out.failed, messageId: undefined, url: null, closed: closedAs, closedAt: now,
        deleted: [...(sent.deleted ?? []), ...out.deleted], edited: [...(sent.edited ?? []), ...out.edited] };
      writeJson(file, store);
      return { ok: out.failed.length === 0, reason: closedAs, ...out };
    });
  } catch (error) {
    try { warn(`telegram: ask close failed: ${redact(error?.message ?? error)}`); } catch { /* nothing left */ }
    return { ok: false, error: 'close failed' };
  }
}

/**
 * The bridge's reconciler (also `telegram.mjs sweep`): every ask message in the store whose ask
 * has closed in its ledger is removed (markAskClosed) — which also clears asks a serve-ask started
 * before this runtime answered, and messages a failed delete left — and a message still showing a
 * link to a form that is no longer served goes back to the "Generate URL" notice. `repos()` locates
 * the ledger of an entry recorded before entries named their repo. Never throws.
 */
export async function sweepAskMessages({ repos = () => [] } = {}, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(), settings: given = null,
} = {}) {
  const result = { closed: [], unlinked: [] };
  try {
    const off = guarded(env, apiBase, fetchImpl);
    if (off) return { ...result, skipped: off };
    const settings = given ?? telegramSettings({ config, env, root });
    if (!settings.ready) return { ...result, skipped: 'telegram off' };
    const deps = { env, fetchImpl, apiBase, warn, sleepImpl, now, settings };
    let listed = null;
    const locate = (workflowId) => {
      listed ??= (() => { try { return repos(); } catch { return []; } })();
      const repo = listed.find((r) => withLedgerRead(r, (db) => Boolean(db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId)), false));
      return repo ? ledgerFileFor(repo) : null;
    };
    for (const [askKey, entry] of Object.entries(readSentStore(env).asks)) {
      const ids = messageIdsOf(entry);
      if (!ids.length) continue;
      const [workflowId, dispatchId] = entry.workflowId ? [entry.workflowId, entry.dispatchId] : askKey.split('|');
      const ledgerFile = entry.ledgerFile ?? (entry.repo ? ledgerFileFor(entry.repo) : locate(workflowId));
      let view = null;
      try { view = ledgerFile && fs.existsSync(ledgerFile) ? readAsk(ledgerFile, workflowId, dispatchId, now) : null; } catch { view = null; }
      if (!view) continue;
      if (view.closed || entry.closed) {
        const r = await markAskClosed({ ledgerFile, workflowId, dispatchId, reason: (view.closed ?? entry.closed) === 'answered' ? 'answered' : 'retired' }, deps);
        result.closed.push({ workflowId, dispatchId, ...r });
        continue;
      }
      if (entry.key && entry.url && entry.url !== view.serving?.url) {
        // The form those messages link to is gone (expired, or its process died): back to the notice.
        const text = askMessage({ workflow: { id: workflowId, title: view.title }, question: view.question, language: settings.language });
        for (const messageId of ids) {
          await botCall({ token: settings.token, apiBase, fetchImpl, sleepImpl, method: 'editMessageText', attempts: 2,
            payload: { chat_id: settings.chatId, message_id: messageId, text, link_preview_options: { is_disabled: true }, reply_markup: askButton(settings.language, entry.key) } });
        }
        await recordAskMessage({ workflowId, dispatchId, url: null }, { env, now });
        result.unlinked.push({ workflowId, dispatchId, messageIds: ids });
      }
    }
  } catch (error) {
    try { warn(`telegram: sweep failed: ${redact(error?.message ?? error)}`); } catch { /* nothing left */ }
    result.error = 'sweep failed';
  }
  return result;
}

/**
 * Tell the owner the runtime answered one ask with its recommended option: ONE plain message, deduped
 * per ask (`ask-auto-accepted|<workflow>|<dispatch>`), no form link. Never throws; the same guards as
 * notifyAsk (STARCI_CONNECTORS_OFF, a spec run never reaches the real Bot API, Telegram off = no-op).
 */
export async function notifyAutoAccepted({ ledgerFile, workflowId, dispatchId, label }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    const off = guarded(env, apiBase, fetchImpl);
    if (off) return { ok: true, skipped: off };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) { if (settings.warning) warn(settings.warning); return { ok: true, skipped: settings.warning ?? 'telegram off' }; }
    const file = sentFile(env);
    return await withLock(file, async () => {
      const store = loadStore(file);
      const key = `ask-auto-accepted|${workflowId}|${dispatchId}`;
      if (store.events[key]) return { ok: true, skipped: 'already sent', key };
      let question = { text: '' }, title = null;
      try {
        const handle = inspectLedger({ file: ledgerFile });
        try {
          const report = handle.db.prepare("SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' ORDER BY report_id DESC LIMIT 1").get(workflowId, dispatchId);
          const rj = parse(report?.report_json, {}) ?? {};
          question = rj.question ?? { text: rj.summary ?? '' };
          title = handle.db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? null;
        } finally { try { handle.close(); } catch { /* closed */ } }
      } catch { /* the message still names the pick */ }
      const text = autoAcceptedMessage({ workflow: { id: workflowId, title }, question, label, language: settings.language });
      const sent = await sendMessage({ token: settings.token, apiBase, fetchImpl, sleepImpl, chatId: settings.chatId, text });
      if (!sent.ok) { warn(`telegram: auto-accept message not sent: ${sent.error}`); return { ok: false, status: sent.status, error: sent.error }; }
      store.events[key] = now;
      writeJson(file, store);
      return { ok: true, sent: 1, key, messageId: sent.messageId };
    });
  } catch (error) {
    const line = `telegram: auto-accept notification failed: ${redact(error?.message ?? error)}`;
    try { warn(line); } catch { /* nothing left to do */ }
    return { ok: false, error: line };
  }
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0] ?? (args['discover-chat'] ? 'discover-chat' : null);
  const out = (value) => console.log(JSON.stringify(value));
  const apiBase = process.env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE;
  if (verb === 'notify') {
    if (!args.ledger || !args.workflow || !args.dispatch) { out({ ok: false, error: 'notify needs --ledger <file> --workflow <id> --dispatch <id> [--repo <path>]' }); process.exit(2); }
    out(await notifyAsk({ ledgerFile: args.ledger, repo: typeof args.repo === 'string' ? args.repo : null, workflowId: args.workflow, dispatchId: args.dispatch })); return;
  }
  const config = ownerConfig();
  if (!config) { out({ ok: false, error: 'config.yaml cannot be read' }); process.exit(2); }
  let connectors;
  try { connectors = connectorsConfig(config); } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
  if (verb === 'sweep') { out(await sweepAskMessages({ repos: () => askRepos(connectors) })); return; }
  const telegram = connectors.telegram;
  const token = connectorSecret(telegram.botTokenEnv, connectorEnv(config));
  if (verb === 'discover-chat') {
    if (!token) { out({ ok: false, error: `no bot token: set ${telegram.botTokenEnv} (env or connectors.secretsFile)` }); process.exit(2); }
    out(await discoverChats({ token, apiBase })); return;
  }
  if (verb === 'test') {
    if (!token || !telegram.chatId) { out({ ok: false, error: `test needs ${telegram.botTokenEnv} and connectors.telegram.chatId` }); process.exit(2); }
    const result = await sendMessage({ token, chatId: telegram.chatId, text: textFor(config.language).test, apiBase });
    out(result); if (!result.ok) process.exitCode = 1; return;
  }
  console.error('usage: telegram.mjs notify --ledger <file> --workflow <id> --dispatch <id> [--repo <path>] | sweep | discover-chat | test');
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
