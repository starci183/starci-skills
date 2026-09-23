#!/usr/bin/env node
// telegram.mjs — tells the owner about an owner ask over a Telegram bot
// (docs/connectors.md). The one send point is the KERNEL's ask path:
// scripts/kernel/serve-ask.mjs calls notifyEvent() the moment the form binds
// (which is what `api serve-ask` launches). Nothing else is sent: no op
// progress, no incidents, no finish, and never from the supervisor.
//
//   node scripts/connectors/telegram.mjs notify --ledger <runtime.sqlite> --workflow <id> --dispatch <id>
//       re-send the ask message of one served ask (deduped like the automatic send)
//   node scripts/connectors/telegram.mjs discover-chat   getUpdates -> chat ids (id, type, name only)
//   node scripts/connectors/telegram.mjs test            one test message to connectors.telegram.chatId
//
// The message is plain text in config.yaml `language` (vi, else en): the
// workflow, the question, its numbered options and the link — the form's
// nonce path on the public tunnel host (https://<hostname>/a-<nonce>, served by
// scripts/connectors/ask-gateway.mjs). One message per ask-serving event
// (deduped in <state>/connectors/telegram-sent.json); a re-served ask sends
// its new link and the earlier message is edited to point at it. A credential
// ask gets no public link unless connectors.telegram.exposeCredentialAsks is
// true: the message says to answer it on the machine and carries only the
// localhost link. A missing token or chatId is a no-op with one stderr line;
// nothing here ever throws into serve-ask. The ledger is read read-only. The
// bot token comes from the env var botTokenEnv names (or
// connectors.secretsFile), is never printed, and is scrubbed from every error.
// STARCI_TELEGRAM_API_BASE replaces https://api.telegram.org for tests.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger } from '../../engine/ledger-db.mjs';
import { configRoot, connectorEnv, connectorSecret, connectorsConfig } from '../../engine/config.mjs';
import { argsOf, isCredentialAsk, ownerConfig, readJson, stateFile, writeJson } from './lib.mjs';
import { publicBase } from './tunnel.mjs';

export const DEFAULT_API_BASE = 'https://api.telegram.org';
const MAX_TEXT = 3900;          // under the 4096-character sendMessage cap
const SENT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

const TEXT = {
  en: {
    ask: '[StarCi] A question for you', reserve: '[StarCi] New link (replaces the earlier one)',
    workflow: 'Workflow', question: 'Question', options: 'Options', link: 'Answer here', expires: 'Link expires',
    credential: 'This question asks for secrets (keys, secret files), so its form is not published; answer it on the machine, or set connectors.telegram.exposeCredentialAsks: true to answer it remotely.',
    localOnly: 'No public tunnel is running, so this form is open only on the machine.',
    replaced: 'This link was replaced by a new one (see the newer message).',
    test: '[StarCi] Telegram connector test: this chat will receive owner questions.',
    answered: '[StarCi] Answered', retired: '[StarCi] No longer needs an answer', at: 'at',
  },
  vi: {
    ask: '[StarCi] Có câu hỏi cần thầy trả lời', reserve: '[StarCi] Link mới (thay link cũ)',
    workflow: 'Workflow', question: 'Câu hỏi', options: 'Lựa chọn', link: 'Trả lời tại', expires: 'Link hết hạn lúc',
    credential: 'Câu hỏi này cần nhập thông tin bí mật (key, file secret) nên form không được đưa ra ngoài; trả lời trên máy, hoặc bật connectors.telegram.exposeCredentialAsks: true để trả lời từ xa.',
    localOnly: 'Chưa có tunnel công khai đang chạy nên form chỉ mở được trên máy.',
    replaced: 'Link này đã được thay bằng link mới (xem tin nhắn mới hơn).',
    test: '[StarCi] Kiểm tra kết nối Telegram: chat này sẽ nhận câu hỏi của workflow.',
    answered: '[StarCi] Đã trả lời', retired: '[StarCi] Câu hỏi này không cần trả lời nữa', at: 'lúc',
  },
};
export const textFor = (language) => TEXT[language] ?? TEXT.en;

const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const optionLabel = (o) => (typeof o === 'string' ? o : o?.label ?? o?.id ?? '');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const when = (ms, language) => new Date(ms).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false });

/** Replace every occurrence of the secret (and anything shaped like a bot token) in `text`. */
export const redact = (text, secret) => {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('***');
  return out.replace(/bot\d+:[A-Za-z0-9_-]{20,}/g, 'bot***');
};

/* ------------------------------------------------------------ messages */

const workflowLine = (t, workflow) => `${t.workflow}: ${workflow.title ? `${workflow.title} (${workflow.id})` : workflow.id}`;

/** The link the owner gets for one ask, and why. */
export function linkFor(ask, { base, exposeCredentialAsks }) {
  if (ask.credential && !exposeCredentialAsks) return { href: ask.url, public: false, reason: 'credential' };
  if (!base) return { href: ask.url, public: false, reason: 'no-tunnel' };
  const u = new URL(ask.url);
  return { href: `${base.replace(/\/+$/, '')}${u.pathname}${u.search}`, public: true, reason: null };
}

/** The ask message: workflow, question, numbered options, the link; `reserve` marks a replacement link. */
export function askMessage({ workflow, question, link, expiresAt = null, reserve = false, language }) {
  const t = textFor(language);
  const options = (question.options ?? []).map(optionLabel).filter(Boolean);
  const lines = [reserve ? t.reserve : t.ask, workflowLine(t, workflow), '', `${t.question}:`, clip(String(question.text ?? '').trim(), 2500)];
  if (options.length) lines.push('', `${t.options}:`, ...options.map((o, i) => (/^\s*\d+[.)]\s/.test(o) ? clip(o.trim(), 300) : `${i + 1}. ${clip(o, 300)}`)));
  lines.push('');
  // A 127.0.0.1 link is useless to an owner reading Telegram away from the
  // machine (the owner asked why localhost links were sent), so a link that is
  // not public is never put in the message - only why it is missing.
  if (link.reason === 'credential') lines.push(t.credential);
  else if (link.reason === 'no-tunnel') lines.push(t.localOnly);
  else lines.push(`${t.link}: ${link.href}`);
  if (expiresAt) lines.push(`${t.expires}: ${when(expiresAt, language)}`);
  return clip(lines.join('\n'), MAX_TEXT);
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

export const sendMessage = ({ token, chatId, text, ...rest }) =>
  botCall({ token, method: 'sendMessage', payload: { chat_id: chatId, text, link_preview_options: { is_disabled: true } }, ...rest })
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

/* ------------------------------------------------------------ the ask from the ledger */

/**
 * The message one served ask calls for: {key, text, askKey, url, previous} or {skip}. Read-only on
 * `db`. The key is the ask-serving event, so each serve (and each re-serve) is sent exactly once;
 * `sent.asks` holds the dispatch's earlier message, which a re-serve replaces.
 */
export function askNotification(db, { workflowId, dispatchId }, { base, exposeCredentialAsks = false, language, sent = { events: {}, asks: {} }, now = Date.now() }) {
  const row = db.prepare(`SELECT event_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind='ask-serving'
    AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, dispatchId);
  if (!row) return { skip: 'no ask-serving event' };
  const answered = db.prepare(`SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`).get(workflowId, dispatchId);
  if (answered) return { skip: 'already answered' };
  const payload = parse(row.payload_json, {}) ?? {};
  if (!payload.url) return { skip: 'ask-serving carries no url' };
  const expiresAt = Number.isFinite(payload.ttlMs) ? row.created_at + payload.ttlMs : null;
  if (expiresAt && expiresAt <= now) return { skip: 'form already expired' };
  const report = db.prepare(`SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' ORDER BY report_id DESC LIMIT 1`).get(workflowId, dispatchId);
  const rj = parse(report?.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const workflow = { id: workflowId, title: db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? null };
  const link = linkFor({ url: payload.url, credential: isCredentialAsk(payload.fields) }, { base, exposeCredentialAsks });
  const askKey = `${workflowId}|${dispatchId}`, earlier = sent.asks?.[askKey] ?? null;
  const reserve = Boolean(earlier && earlier.url !== payload.url);
  return {
    key: `ask-serving|${row.event_id}`, askKey, url: payload.url, previous: reserve ? earlier : null,
    text: askMessage({ workflow, question, link, expiresAt, reserve, language }),
  };
}

// One writer at a time for the dedupe store: two forms may bind at once.
async function withLock(file, fn, { waitMs = 5000 } = {}) {
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

/**
 * Tell the owner about one served ask. Never throws: every failure is one stderr line (through `warn`)
 * and a {ok:false} result. `ledgerFile` is the workflow's runtime.sqlite, read read-only; everything
 * external is injectable (config, env, root, fetchImpl, apiBase, warn, sleepImpl, now).
 */
/**
 * Close the owner's Telegram message for one ask once it no longer waits:
 * answered (serve-ask, on submit) or retired (api retire-ask). The owner asked
 * that an answered question stop looking open in the chat, so the sent
 * message is edited in place to say so, with the question kept and the link
 * removed. Never throws; a message never sent (or Telegram off) is a no-op.
 */
export async function markAskClosed({ ledgerFile, workflowId, dispatchId, reason = 'answered', by = null }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    if (env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch) return { ok: true, skipped: 'test context' };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) return { ok: true, skipped: 'telegram off' };
    const file = sentFile(env);
    return await withLock(file, async () => {
      const store = readJson(file, null) ?? { schema: 'starci/telegram-sent@1', events: {}, asks: {} };
      store.asks ??= {};
      const askKey = `${workflowId}|${dispatchId}`, sent = store.asks[askKey];
      if (!sent?.messageId) return { ok: true, skipped: 'no message sent for this ask' };
      if (sent.closed) return { ok: true, skipped: `already ${sent.closed}` };
      let question = '', title = workflowId;
      try {
        const handle = inspectLedger({ file: ledgerFile });
        try {
          const report = handle.db.prepare("SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' ORDER BY report_id DESC LIMIT 1").get(workflowId, dispatchId);
          const rj = parse(report?.report_json, {}) ?? {};
          question = String(rj.question?.text ?? rj.summary ?? '');
          title = handle.db.prepare('SELECT title FROM workflows WHERE workflow_id=?').get(workflowId)?.title ?? workflowId;
        } finally { try { handle.close(); } catch { /* closed */ } }
      } catch { /* the edit still says the ask closed */ }
      const t = textFor(settings.language);
      const stamp = new Date(now).toLocaleTimeString(settings.language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const head = `${reason === 'retired' ? t.retired : t.answered} (${t.at} ${stamp}${by ? `, ${by}` : ''})`;
      const text = [head, `${t.workflow}: ${title}`, '', question].join('\n').slice(0, MAX_TEXT);
      const edited = await botCall({ token: settings.token, apiBase, fetchImpl, sleepImpl, method: 'editMessageText', attempts: 2,
        payload: { chat_id: settings.chatId, message_id: sent.messageId, text, link_preview_options: { is_disabled: true } } });
      if (!edited.ok) { warn(`telegram: ask message not updated: ${edited.error}`); return { ok: false, error: edited.error }; }
      store.asks[askKey] = { ...sent, closed: reason, closedAt: now };
      writeJson(file, store);
      return { ok: true, edited: sent.messageId, reason };
    });
  } catch (error) {
    try { warn(`telegram: ask close failed: ${redact(error?.message ?? error)}`); } catch { /* nothing left */ }
    return { ok: false, error: 'close failed' };
  }
}

export async function notifyAsk({ ledgerFile, workflowId, dispatchId }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    // A spec run (node --test sets NODE_TEST_CONTEXT, which spawned children such as a serve-ask under
    // test inherit) never reaches the real Bot API, whatever the owner config says.
    if (env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch) return { ok: true, skipped: 'test context' };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) { if (settings.warning) warn(settings.warning); return { ok: true, skipped: settings.warning ?? 'telegram off' }; }
    const file = sentFile(env);
    return await withLock(file, async () => {
      const store = readJson(file, null) ?? { schema: 'starci/telegram-sent@1', events: {}, asks: {} };
      store.events ??= {}; store.asks ??= {};
      for (const [key, at] of Object.entries(store.events)) if (now - at > SENT_KEEP_MS) delete store.events[key];
      for (const [key, ask] of Object.entries(store.asks)) if (now - (ask?.at ?? 0) > SENT_KEEP_MS) delete store.asks[key];
      let handle;
      try { handle = inspectLedger({ file: ledgerFile }); } catch (error) { warn(`telegram: ask not sent: ledger unreadable (${error.message})`); return { ok: false, error: 'ledger unreadable' }; }
      let note;
      try { note = askNotification(handle.db, { workflowId, dispatchId }, { base: settings.base, exposeCredentialAsks: settings.telegram.exposeCredentialAsks, language: settings.language, sent: store, now }); }
      finally { try { handle.close(); } catch { /* closed */ } }
      if (note.skip) return { ok: true, skipped: note.skip };
      if (store.events[note.key]) return { ok: true, skipped: 'already sent', key: note.key };
      const call = { token: settings.token, apiBase, fetchImpl, sleepImpl };
      const sent = await sendMessage({ ...call, chatId: settings.chatId, text: note.text });
      if (!sent.ok) { warn(`telegram: ask not sent: ${sent.error}`); return { ok: false, status: sent.status, error: sent.error }; }
      store.events[note.key] = now;
      if (note.previous?.messageId) {
        // The earlier message's link is dead: point it at the new message, best effort.
        await botCall({ ...call, method: 'editMessageText', attempts: 1,
          payload: { chat_id: settings.chatId, message_id: note.previous.messageId, text: textFor(settings.language).replaced } });
      }
      store.asks[note.askKey] = { url: note.url, messageId: sent.messageId, at: now };
      writeJson(file, store);
      return { ok: true, sent: 1, key: note.key, reserve: Boolean(note.previous), messageId: sent.messageId };
    });
  } catch (error) {
    const line = `telegram: ask notification failed: ${redact(error?.message ?? error)}`;
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
    if (!args.ledger || !args.workflow || !args.dispatch) { out({ ok: false, error: 'notify needs --ledger <file> --workflow <id> --dispatch <id>' }); process.exit(2); }
    out(await notifyAsk({ ledgerFile: args.ledger, workflowId: args.workflow, dispatchId: args.dispatch })); return;
  }
  const config = ownerConfig();
  if (!config) { out({ ok: false, error: 'config.yaml cannot be read' }); process.exit(2); }
  let connectors;
  try { connectors = connectorsConfig(config); } catch (error) { out({ ok: false, error: error.message }); process.exit(2); }
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
  console.error('usage: telegram.mjs notify --ledger <file> --workflow <id> --dispatch <id> | discover-chat | test');
  process.exit(2);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
