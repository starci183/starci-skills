#!/usr/bin/env node
// telegram.mjs — tells the owner about an owner ask over a Telegram bot
// (docs/connectors.md). The one send point is the KERNEL's ask path:
// `starci kernel serve-ask` (scripts/kernel/ask-server.mjs parkAsk) calls notifyAsk()
// when an ask is parked; only an approval ask is pushed, a credential ask waits
// under the bridge's /creds (serve-ask.mjs askClassOf). The message carries
// the workflow, the question and its numbered options, and ONE inline button "Generate URL" — never a link:
// no form is served until the owner asks for one (owner, 2026-09-24: "serve the
// url only when asked"). Pressing the button reaches the command bridge
// (telegram-bridge.mjs), which serves the form on demand and edits this same
// message to carry the link (showAskLink). When the ask is answered or retired
// the message is DELETED (markAskClosed; a message Telegram refuses to delete,
// e.g. older than 48 h, is edited to say it was answered instead). The one
// other message is notifyAutoAccepted: an ask the runtime answered with its
// recommended option (config.yaml asks.autoAcceptRecommended) is told once,
// plainly, with no link. A draw-review ask (interface.draw's ONE drawing per shape) also sends the drawn
// desktop and mobile images as an album captioned with the shape, the round and the notes it answers; the owner
// answers by replying (telegram-bridge.mjs, draw-feedback.mjs). Nothing else is sent: no op progress, no incidents,
// no finish, and never from the supervisor.
//
//   starci connect telegram notify --ledger <runtime.sqlite> --workflow <id> --dispatch <id> [--repo <path>]
//       (re-)send the notice of one open ask (deduped: an ask with an open notice is not sent again)
//   starci connect telegram sweep          delete the notices of asks that closed, drop dead links
//   starci connect telegram discover-chat   getUpdates -> chat ids (id, type, name only)
//   starci connect telegram test            one test message to connectors.telegram.chatId
//
// Messages are plain text in config.yaml `language` (vi, else en). The link a
// served form gets is its nonce path on the public tunnel host
// (https://<hostname>/a-<nonce>, served by scripts/connectors/ask-gateway.mjs).
// A credential ask never gets a public link unless
// connectors.telegram.exposeCredentialAsks is true: the message says to answer
// it on the machine and carries only the localhost link. The notice store is
// machine.sqlite `notifications`: one row per ask (kind 'ask', dedupe_key
// `ask:<workflow>|<dispatch>`) whose `ref` keeps its short key (the button's
// callback_data `ask:<key>`, 16 hex chars, well under Telegram's 64 bytes), its
// repo and ledger, every message id that shows it, and the URL the messages
// currently carry; one row per sent event (kind 'ack', dedupe_key the event
// key). Writers take the host lock 'telegram-sent' (lib.mjs withHostMutex) so two
// asks parked at once never both send. A missing token or chatId is a no-op with one
// stderr line; nothing here ever throws into its caller. Ledgers are read
// read-only. The bot token comes from the env var botTokenEnv names (or
// connectors.secretsFile), is never printed, and is scrubbed from every error.
// STARCI_TELEGRAM_API_BASE replaces https://api.telegram.org for tests.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import {sha256} from '../../engine/digest.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { configRoot, connectorEnv, connectorSecret, connectorsConfig } from '../../engine/config.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { argsOf, askRepos, askState, ownerConfig, withHostMutex, withLedgerRead } from './lib.mjs';
import { publicBase } from './tunnel.mjs';
import { clip } from '../lib/clip.mjs';
import { parseJson } from '../lib/json.mjs';
import { workflowNameOf } from '../lib/display-names.mjs';
import { translatedPattern, translator } from '../lib/i18n.mjs';
import { sleep } from '../lib/sleep.mjs';
import { attemptSend, botPolite, redact } from './telegram-polite.mjs';
import { isSpecRun, readEnv } from '../lib/env.mjs';

export const DEFAULT_API_BASE = 'https://api.telegram.org';
/** The longest text one sendMessage carries, under Telegram's 4096-character cap. */
export const TEXT_MAX = 3900;

// The English sources translate through the i18n catalog (modules/i18n/messages, scripts/lib/i18n.mjs).
export const textFor = (language) => {
  const tr = translator(language);
  return {
    ask: tr('[StarCi] A question for you'),
    workflow: tr('Workflow'), job: tr('Step'), question: tr('Question'), options: tr('Options'), link: tr('Answer here'), expires: tr('Link expires'),
    onDemand: tr('The answer form is not open yet. When you want to answer, press "Generate URL": the link is made only then.'),
    generate: tr('Generate URL'),
    credential: tr('This question asks for secrets (keys, secret files), so it is NOT exposed. Answer it ON THE MACHINE by opening this localhost link there:'),
    localOnly: tr('No public tunnel is running, so this form opens only on the machine, at this localhost link:'),
    serveFailed: tr('The answer form could not be started just now. Press "Generate URL" again.'),
    test: tr('[StarCi] Telegram connector test: this chat will receive owner questions.'),
    answered: tr('[StarCi] Answered'), retired: tr('[StarCi] No longer needs an answer'), at: tr('at'),
  };
};

const parse = parseJson;
const optionLabel = (o) => (typeof o === 'string' ? o : o?.label ?? o?.id ?? '');
const when = (ms, language) => new Date(ms).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false });

/* ------------------------------------------------------------ ask keys and buttons */

/** The store key of one ask (`<workflow>|<dispatch>`). */
const askStoreKey = (workflowId, dispatchId) => `${workflowId}|${dispatchId}`;
/** The short key a "Generate URL" button carries: 16 hex chars of sha256(workflow|dispatch). */
export const askKeyOf = (workflowId, dispatchId) => sha256(askStoreKey(workflowId, dispatchId)).slice(0, 16);
export const ASK_CALLBACK = /^ask:([0-9a-f]{16})$/;
/** The one-button inline keyboard under an ask message. */
export const askButton = (language, key) => ({ inline_keyboard: [[{ text: textFor(language).generate, callback_data: `ask:${key}` }]] });

/* ------------------------------------------------------------ messages */

// The workflow by its display name with the id after it, then the asking op job's name when known
// (`<op label> · <what> · <workflow name>`, scripts/lib/display-names.mjs).
const workflowLine = (t, workflow) => [`${t.workflow}: ${workflow.title && workflow.title !== workflow.id ? `${workflow.title} (${workflow.id})` : workflow.id}`,
  ...(workflow.job ? [`${t.job}: ${workflow.job}`] : [])].join('\n');

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
  const t = textFor(language), tr = translator(language);
  const text = clip(String(question?.text ?? '').trim(), 2500), pick = clip(String(label ?? '').trim(), 300);
  const line = tr('Auto-picked the recommended option: {pick} — question: {text}. To change it, answer the kernel / supervisor again.', { pick, text });
  return clip([line, '', workflowLine(t, workflow)].join('\n'), TEXT_MAX);
}
/** The text a message is edited to when Telegram refuses to delete it (answered / retired). */
function closedMessage({ reason, by = null, title, question, language, now = Date.now() }) {
  const t = textFor(language);
  const stamp = new Date(now).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const head = `${reason === 'retired' ? t.retired : t.answered} (${t.at} ${stamp}${by ? `, ${by}` : ''})`;
  return [head, `${t.workflow}: ${title}`, '', String(question?.text ?? '')].join('\n').slice(0, TEXT_MAX);
}
/* ------------------------------------------------------------ Bot API */

export const endpoint = (apiBase, token, method) => `${apiBase.replace(/\/+$/, '')}/bot${token}/${method}`;

/**
 * One Bot API call with polite retries (botPolite): a JSON POST to `method` under the 15 s read timeout.
 */
export function botCall({ token, method, payload, apiBase = DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = sleep, attempts = 4 }) {
  const body = JSON.stringify(payload);
  return botPolite({ token, sleepImpl, attempts }, () => fetchImpl(endpoint(apiBase, token, method), { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(15000) }));
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

// The store is machine.sqlite `notifications`, read into the in-memory shape the notices work on:
// {asks: {<workflow>|<dispatch>: entry}, keys: {<button key>: <workflow>|<dispatch>}, events: {<key>: at}}.
const SENT_LOCK = 'telegram-sent';
const ASK_PREFIX = 'ask:';
const EVENT_KIND = 'ack';
const emptyStore = () => ({ schema: 'starci/telegram-sent@3', events: {}, asks: {}, keys: {} });
function storeOf(m) {
  const store = emptyStore();
  for (const row of m.db.prepare("SELECT dedupe_key, kind, ref, sent_at FROM notifications WHERE channel='telegram' AND kind IN ('ask','ack') AND dedupe_key IS NOT NULL").all()) {
    if (row.kind === 'ask' && row.dedupe_key.startsWith(ASK_PREFIX)) {
      const entry = parse(row.ref, null);
      if (!entry || typeof entry !== 'object') continue;
      const askKey = row.dedupe_key.slice(ASK_PREFIX.length);
      store.asks[askKey] = entry;
      if (entry.key) store.keys[entry.key] = askKey;
    } else if (row.kind === EVENT_KIND) store.events[row.dedupe_key] = row.sent_at;
  }
  return store;
}
/** Write every ask entry and event of `store` that differs from `before`, in one transaction. `texts` names a notice's text. */
function saveStore(env, store, before, { texts = {} } = {}) {
  withMachine((m) => m.transaction(() => {
    for (const [askKey, entry] of Object.entries(store.asks)) {
      const ref = JSON.stringify(entry);
      if (before.asks[askKey] && JSON.stringify(before.asks[askKey]) === ref && !texts[askKey]) continue;
      const dedupeKey = `${ASK_PREFIX}${askKey}`;
      const text = texts[askKey] ?? m.db.prepare('SELECT text FROM notifications WHERE dedupe_key=?').get(dedupeKey)?.text ?? `ask ${askKey}`;
      m.upsert('notifications', { channel: 'telegram', kind: 'ask', text, sent_at: entry.at ?? m.now(), delivery: entry.closed ? `closed:${entry.closed}` : 'sent', ref, dedupe_key: dedupeKey }, ['dedupe_key']);
    }
    for (const [key, at] of Object.entries(store.events)) {
      if (before.events[key] != null) continue;
      m.upsert('notifications', { channel: 'telegram', kind: EVENT_KIND, text: texts[key] ?? key, sent_at: at, delivery: 'sent', dedupe_key: key }, ['dedupe_key']);
    }
  }), { env });
}
/** fn(store) under the host lock 'telegram-sent'; what it changed is written back. {ok:false, skipped} when the lock stays taken. */
const withStore = (env, fn) => withHostMutex(SENT_LOCK, async () => {
  const before = readMachine(storeOf, emptyStore(), { env });
  const store = structuredClone(before), texts = {};
  const out = await fn(store, texts);
  saveStore(env, store, before, { texts });
  return out;
}, { env });

/** The message ids that show one ask (a pre-button entry kept one `messageId`). */
const messageIdsOf = (entry) => [...new Set([
  ...(Array.isArray(entry?.messageIds) ? entry.messageIds : []), ...(Number.isInteger(entry?.messageId) ? [entry.messageId] : []),
].filter(Number.isInteger))];
/** Read the store (no lock): a snapshot for lookups. */
export const readSentStore = (env = process.env) => readMachine(storeOf, emptyStore(), { env });
/** Change the store under its lock; `fn(store)` mutates it and returns the result. */
const updateSentStore = (fn, { env = process.env } = {}) => withStore(env, (store) => fn(store));
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

/* ------------------------------------------------------------ the draw review on Telegram */

const DRAW_REVIEW_ASK = 'draw-review';
const CAPTION_MAX = 1000;
/** The line under a draw-review notice: how the owner answers by replying. */
export const drawReplyHint = (language) => translator(language)('Answer by REPLYING to this message (or to one image): "ok" / "approve" accepts (add "golden" to make it the reference); anything else is your feedback and the drawing is redrawn.');

/** The caption of a draw-review album: the shapes, the round and the notes this drawing answers. */
function drawAlbumCaption(question, language) {
  const tr = translator(language);
  const review = question.review ?? {};
  const shapes = [...new Set((review.parts ?? []).map((p) => p?.shape).filter(Boolean))];
  const round = Number.isInteger(review.round) ? review.round : 1;
  const answers = new RegExp(`${translatedPattern('Round {round}', 'round', '\\d+')};[^\\[]*(.*?)(?:\\.\\s|$)`).exec(String(question.text ?? ''))?.[1] ?? '';
  const head = tr('[StarCi] Please review: {record}', { record: review.record ?? '' });
  const lines = [head, `${tr('Shapes')}: ${shapes.join(', ') || '-'}`, tr('Round {round}', { round })];
  if (round > 1 && answers) lines.push(`${tr('Notes addressed')}: ${answers}`);
  // The evidence (owner ruling 2026-09-27): redline images ride in the album, rationale.json is named here.
  const why = Array.isArray(question.rationale) ? question.rationale : [];
  if (why.length) lines.push(`${tr('Rationale')}: ${why.map((r) => `${r.file} (${r.decisions} ${tr('decisions')})`).join(', ')}${(review.redlines ?? []).length ? `; ${tr('redline images attached')}` : ''}`);
  return clip(lines.join('\n'), CAPTION_MAX);
}

/**
 * Send the drawn parts of a draw-review question (question.assets, the desktop and mobile shape images) as one
 * album to the owner's verified chat. Returns {messageIds, partMessages: {<messageId>: <review part path>}} - a reply
 * to one image is a note on that image. Never throws.
 */
async function sendDrawAlbum({ question, repo, settings, apiBase, fetchImpl, sleepImpl, warn }) {
  try {
    const { botUpload } = await import('./telegram-media.mjs');
    const reviewDir = question.review.recordPath ? path.dirname(path.resolve(repo, question.review.recordPath)) : null;
    const images = (question.assets ?? []).map((a) => (typeof a === 'string' ? a : a?.path)).filter((p) => typeof p === 'string' && /\.png$/i.test(p))
      .map((rel) => path.resolve(repo, rel)).filter((abs) => fs.existsSync(abs)).slice(0, 10);
    if (!images.length) return null;
    const caption = drawAlbumCaption(question, settings.language);
    const call = { token: settings.token, apiBase, fetchImpl, sleepImpl };
    const r = images.length === 1
      ? await botUpload({ ...call, method: 'sendPhoto', fields: { chat_id: settings.chatId, caption }, files: [{ field: 'photo', file: images[0] }] })
      : await botUpload({ ...call, method: 'sendMediaGroup', fields: { chat_id: settings.chatId, media: images.map((f, i) => ({ type: 'photo', media: `attach://f${i}`, ...(i === 0 ? { caption } : {}) })) }, files: images.map((file, i) => ({ field: `f${i}`, file })) });
    if (!r?.ok) { warn(`telegram: draw album not sent: ${r?.error ?? 'unknown error'}`); return null; }
    const sent = Array.isArray(r.result) ? r.result : [r.result];
    const messageIds = sent.map((m) => m?.message_id).filter(Number.isInteger);
    const partMessages = {};
    sent.forEach((m, i) => {
      const part = reviewDir ? (question.review.parts ?? []).find((p) => p?.path && path.resolve(reviewDir, p.path).toLowerCase() === images[i].toLowerCase()) : null;
      // A reply to a part's redline image is a note on that part.
      const redline = !part && reviewDir ? (question.review.redlines ?? []).find((r) => r?.path && path.resolve(reviewDir, r.path).toLowerCase() === images[i].toLowerCase()) : null;
      if (part && Number.isInteger(m?.message_id)) partMessages[m.message_id] = part.path;
      else if (redline?.part && Number.isInteger(m?.message_id)) partMessages[m.message_id] = redline.part;
    });
    return { messageIds, partMessages };
  } catch (error) {
    warn(`telegram: draw album not sent: ${redact(error?.message ?? error)}`);
    return null;
  }
}

/** The open draw-review ask a message id shows ({...entry, askKey, partPath}), or null. */
export const drawReviewEntryByMessage = (messageId, env = process.env) => {
  if (!Number.isInteger(messageId)) return null;
  const store = readSentStore(env);
  for (const [askKey, entry] of Object.entries(store.asks)) {
    if (entry?.kind !== DRAW_REVIEW_ASK || entry.closed || !messageIdsOf(entry).includes(messageId)) continue;
    return { ...entry, askKey, partPath: entry.partMessages?.[messageId] ?? null };
  }
  return null;
};

/* ------------------------------------------------------------ the ask from the ledger */

const readAsk = (ledgerFile, workflowId, dispatchId, now) => {
  const handle = inspectLedger({ file: ledgerFile });
  try { return askState(handle.db, workflowId, dispatchId, { now }); } finally { try { handle.close(); } catch { /* closed */ } }
};
const guarded = (env, apiBase, fetchImpl) => (env.STARCI_CONNECTORS_OFF === '1' ? 'STARCI_CONNECTORS_OFF'
  // A spec run (node --test sets NODE_TEST_CONTEXT, which spawned children such as a serve-ask under
  // test inherit) never reaches the real Bot API, whatever the owner config says.
  : isSpecRun(env) && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch ? 'test context' : null);

/**
 * The resolved context of one owner-facing send: every option defaulted, Telegram checked (a guarded-off
 * environment, the settings ready). `skipped` names the reason nothing is sent; a not-ready warning is
 * surfaced once through `warn`.
 */
function sendContext(over = {}) {
  const env = over.env ?? process.env;
  const o = {
    config: ownerConfig(), env, root: configRoot, fetchImpl: fetch,
    apiBase: env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
    warn: (line) => process.stderr.write(`${line}\n`), sleepImpl: sleep, now: Date.now(),
    ...Object.fromEntries(Object.entries(over).filter(([, value]) => value !== undefined)),
  };
  const off = guarded(o.env, o.apiBase, o.fetchImpl);
  if (off) return { ...o, skipped: off };
  const settings = telegramSettings({ config: o.config, env: o.env, root: o.root });
  if (!settings.ready) {
    if (settings.warning) o.warn(settings.warning);
    return { ...o, skipped: settings.warning ?? 'telegram off' };
  }
  return { ...o, settings };
}

/**
 * Tell the owner about one parked ask: ONE message with the workflow, the question, its numbered
 * options and the "Generate URL" button, no link. Deduped per ask: an ask whose notice is still in
 * the chat is not sent again ({skipped:'already notified', key, messageId}). Never throws: every
 * failure is one stderr line (through `warn`) and a {ok:false} result. `ledgerFile` is the
 * workflow's runtime.sqlite, read read-only; everything external is injectable. `push:false` (a
 * credential ask, serve-ask.mjs askClassOf) sends nothing: {ok, listed:true, key} once Telegram is
 * ready and the ask open, and the owner finds it under the bridge's /creds.
 */
export async function notifyAsk({ ledgerFile, repo = null, workflowId, dispatchId, push = true }, options = {}) {
  const { env, fetchImpl, apiBase, warn, sleepImpl, now, settings, skipped } = sendContext(options);
  return attemptSend(warn, 'ask notification', async () => {
    if (skipped) return { ok: true, skipped };
    let view;
    try { view = readAsk(ledgerFile, workflowId, dispatchId, now); } catch (error) { warn(`telegram: ask not sent: ledger unreadable (${error.message})`); return { ok: false, error: 'ledger unreadable' }; }
    if (!view) return { ok: true, skipped: 'no ask report' };
    if (view.closed) return { ok: true, skipped: `already ${view.closed}` };
    if (!push) return { ok: true, listed: true, key: askKeyOf(workflowId, dispatchId) };
    return await withStore(env, async (store, texts) => {
      const askKey = askStoreKey(workflowId, dispatchId), key = askKeyOf(workflowId, dispatchId);
      const entry = store.asks[askKey];
      if (entry?.key && !entry.closed && messageIdsOf(entry).length) return { ok: true, skipped: 'already notified', key, messageId: messageIdsOf(entry).at(-1) };
      // A draw-review ask shows the owner the drawing itself: the desktop and mobile images as an album captioned with
      // the shape, the round and the notes it answers; a reply ("ok" or another accept word accepts, anything else is feedback) is
      // the owner's answer (telegram-bridge.mjs -> serve-ask.mjs answerDrawReviewByReply).
      const drawReview = view.question?.kind === DRAW_REVIEW_ASK && view.question?.review && repo;
      const album = drawReview ? await sendDrawAlbum({ question: view.question, repo, settings, apiBase, fetchImpl, sleepImpl, warn }) : null;
      const text = askMessage({ workflow: { id: workflowId, title: view.title, job: view.jobName ?? null }, question: view.question, language: settings.language, note: drawReview ? drawReplyHint(settings.language) : null });
      const sent = await sendMessage({ token: settings.token, apiBase, fetchImpl, sleepImpl, chatId: settings.chatId, text, markup: askButton(settings.language, key) });
      if (!sent.ok) { warn(`telegram: ask not sent: ${sent.error}`); return { ok: false, status: sent.status, error: sent.error }; }
      store.asks[askKey] = { key, repo, ledgerFile, workflowId, dispatchId, messageIds: [...(album?.messageIds ?? []), sent.messageId], url: null, at: now,
        ...(drawReview ? { kind: DRAW_REVIEW_ASK, partMessages: album?.partMessages ?? {} } : {}) };
      store.keys[key] = askKey;
      texts[askKey] = text;
      return { ok: true, sent: 1, key, messageId: sent.messageId };
    });
  });
}

/**
 * Take one ask off the chat once it no longer waits: answered (serve-ask on submit, auto-accept) or
 * retired (starci kernel retire-ask, a superseding ask). Every message that shows it is DELETED (owner,
 * 2026-09-24: "delete it once answered"); one Telegram refuses to delete is edited to say it was answered,
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
    return await withStore(env, async (store) => {
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
        const text = askMessage({ workflow: { id: workflowId, title: view.title, job: view.jobName ?? null }, question: view.question, language: settings.language });
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
export async function notifyAutoAccepted({ ledgerFile, workflowId, dispatchId, label }, options = {}) {
  const { env, fetchImpl, apiBase, warn, sleepImpl, now, settings, skipped } = sendContext(options);
  return attemptSend(warn, 'auto-accept notification', async () => {
    if (skipped) return { ok: true, skipped };
    return await withStore(env, async (store, texts) => {
      const key = `ask-auto-accepted|${workflowId}|${dispatchId}`;
      if (store.events[key]) return { ok: true, skipped: 'already sent', key };
      let question = { text: '' }, title = null;
      try {
        const handle = inspectLedger({ file: ledgerFile });
        try {
          const report = handle.db.prepare("SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' ORDER BY report_id DESC LIMIT 1").get(workflowId, dispatchId);
          const rj = parse(report?.report_json, {}) ?? {};
          question = rj.question ?? { text: rj.summary ?? '' };
          title = workflowNameOf(handle.db, workflowId);
        } finally { try { handle.close(); } catch { /* closed */ } }
      } catch { /* the message still names the pick */ }
      const text = autoAcceptedMessage({ workflow: { id: workflowId, title }, question, label, language: settings.language });
      const sent = await sendMessage({ token: settings.token, apiBase, fetchImpl, sleepImpl, chatId: settings.chatId, text });
      if (!sent.ok) { warn(`telegram: auto-accept message not sent: ${sent.error}`); return { ok: false, status: sent.status, error: sent.error }; }
      store.events[key] = now;
      texts[key] = text;
      return { ok: true, sent: 1, key, messageId: sent.messageId };
    });
  });
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0] ?? (args['discover-chat'] ? 'discover-chat' : null);
  const out = (value) => console.log(JSON.stringify(value));
  const apiBase = readEnv('STARCI_TELEGRAM_API_BASE') || DEFAULT_API_BASE;
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
  console.error('usage: starci connect telegram notify --ledger <file> --workflow <id> --dispatch <id> [--repo <path>] | sweep | discover-chat | test');
  process.exit(2);
}

if (isMain(import.meta.url)) main();

/**
 * The owner push. One message to the owner's Telegram chat: {ok, skipped?, messageId?, status?, error?}. `text` is a string or
 * language => string (connectors.telegram language). STARCI_CONNECTORS_OFF, a node --test process on the real Bot
 * API and an off telegram connector skip it (ok, with the reason).
 */
export async function ownerPush(text, { env = process.env, settings = null, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = undefined } = {}) {
  const s = settings ?? telegramSettings({ env });
  const skipped = env.STARCI_CONNECTORS_OFF === '1' ? 'STARCI_CONNECTORS_OFF'
    : isSpecRun(env) && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch ? 'test context: refusing the real Bot API'
    : !s?.ready ? (s?.warning ?? 'telegram is off (connectors.telegram)') : null;
  if (skipped) return { ok: true, skipped };
  try {
    const r = await sendMessage({ token: s.token, chatId: s.chatId, text: typeof text === 'function' ? text(s.language) : text, apiBase, fetchImpl, ...(sleepImpl ? { sleepImpl } : {}) });
    return r.ok ? { ok: true, messageId: r.messageId ?? null } : { ok: false, status: r.status ?? null, error: redact(r.error, s.token) };
  } catch (error) { return { ok: false, error: redact(error?.message ?? error, s.token) }; }
}
