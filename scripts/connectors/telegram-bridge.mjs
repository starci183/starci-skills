#!/usr/bin/env node
// telegram-bridge.mjs — the owner commands a supervisor by chatting with the
// Telegram bot (docs/connectors.md "Command bridge"). Several supervisor chats
// may be registered at once; Telegram buttons pick which one the owner talks to.
//
//   node scripts/connectors/telegram-bridge.mjs start    launch detached (idempotent; no-op when telegram is off)
//   node scripts/connectors/telegram-bridge.mjs run      run in the foreground
//   node scripts/connectors/telegram-bridge.mjs status | stop
//
// One bridge per host (claimManager('telegram-bridge'), state record
// <state>/telegram-bridge.json {pid, startedAt, offset}). It long-polls
// getUpdates (message + callback_query) and persists the update offset BEFORE
// handling an update, so a restart never delivers the same message twice.
//
// Hard auth: an update is accepted only when its chat id AND its sender id both
// equal connectors.telegram.chatId (the owner's private chat). Anything else is
// dropped and logged by numeric id only; message text is never logged.
//
// Commands (English only): /start and /choose show one button per registered
// supervisor (🟢 online / ⚪ offline); /status sends the progress report
// (scripts/supervisor/progress-report.mjs) from the bridge itself; /asks lists
// every open owner ask across the connector repos, one message each with its
// own "Generate URL" button; /help. Any
// other text goes to the chat's routed supervisor: appended to
// <state>/supervisors/<id>.inbox.jsonl and acknowledged as a reply. A message
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
// Registry: <state>/supervisors/<id>.json {id, label, repos, registeredAt,
// heartbeatAt}; a supervisor is online while its heartbeat is younger than
// ONLINE_MS (STARCI_SUPERVISOR_ONLINE_MS overrides it). Logs go to
// <state>/telegram-bridge.log. STARCI_TELEGRAM_API_BASE replaces the Bot API
// host for tests. The token is never printed and is scrubbed from every error.
import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configRoot, connectorsConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { argsOf, askRepos, askState, claimManager, lockHolder, notifiedRepos, openAskList, ownerConfig, pidAlive, readJson, recordAlive, sourceRootOf, spawnDetached, stateFile, withLedgerRead, writeJson } from './lib.mjs';
import {
  ASK_CALLBACK, askButton, askEntryByKey, askKeyOf, askMessage, botCall, DEFAULT_API_BASE, linkFor, recordAskMessage, redact,
  removeAskMessage, sweepAskMessages, telegramSettings, textFor,
} from './telegram.mjs';
import { ensureAskConnectors, publicBase } from './tunnel.mjs';
import { collectProgress, progressMessages, reportRepos } from '../supervisor/progress-report.mjs';

export const SERVE_ASK_FILE = fileURLToPath(new URL('../kernel/serve-ask.mjs', import.meta.url));

export const BRIDGE_NAME = 'telegram-bridge';
export const BRIDGE_FILE = fileURLToPath(import.meta.url);
export const ONLINE_MS = 30 * 60 * 1000;
export const POLL_TIMEOUT_S = 50;
export const ALLOWED_UPDATES = ['message', 'callback_query'];
const MAX_TEXT = 3900;
const MAX_PENDING = 20;
const LOG_CAP = 5 * 1024 * 1024;
const ID = /^[A-Za-z0-9._-]{1,60}$/;   // 'sup:' + id stays within callback_data's 64 bytes

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
    askClosed: 'This question no longer needs an answer.',
    askGenerating: 'Opening the answer form…',
    unknown: 'Unknown command.',
    help: [
      'Commands:',
      '/choose — pick the supervisor to talk to',
      '/status — the progress report',
      '/asks — every open question, each with a Generate URL button',
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
    askClosed: 'Câu hỏi này không cần trả lời nữa.',
    askGenerating: 'Đang mở form trả lời…',
    unknown: 'Lệnh không có.',
    help: [
      'Các lệnh:',
      '/choose — chọn supervisor để nói chuyện',
      '/status — báo cáo tiến độ',
      '/asks — các câu hỏi đang chờ, mỗi câu có nút tạo link trả lời',
      '/help — danh sách lệnh',
      'Tin nhắn thường sẽ được chuyển cho supervisor thầy đang chọn.',
    ].join('\n'),
  },
};
export const bridgeText = (language) => TEXT[language] ?? TEXT.en;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const numericId = (v) => (Number.isSafeInteger(Number(v)) && String(v).trim() !== '' ? String(Number(v)) : '?');

/* ------------------------------------------------------------ state files */

export const bridgeStateFile = (env = process.env) => stateFile('telegram-bridge.json', env);
export const bridgeState = (env = process.env) => readJson(bridgeStateFile(env));
export const bridgeLogFile = (env = process.env) => stateFile('telegram-bridge.log', env);
export const routeFile = (env = process.env) => stateFile('telegram-route.json', env);
export const supervisorsDir = (env = process.env) => stateFile('supervisors', env);
export const validSupervisorId = (id) => typeof id === 'string' && ID.test(id);
const needId = (id) => { if (!validSupervisorId(id)) throw Error(`supervisor id must match ${ID} (got ${JSON.stringify(String(id ?? ''))})`); return id; };
export const supervisorFile = (id, env = process.env) => path.join(supervisorsDir(env), `${needId(id)}.json`);
export const inboxFile = (id, env = process.env) => path.join(supervisorsDir(env), `${needId(id)}.inbox.jsonl`);

/** A live bridge: telegram-bridge.json names a live process of this boot, or a bridge holds the lock. */
export const bridgeAlive = (env = process.env) => {
  const state = bridgeState(env);
  return recordAlive(state) ? state : lockHolder(BRIDGE_NAME, env);
};

/** Run `fn` holding `<file>.lock` (exclusive create); a lock older than 30 s is stale. Synchronous. */
export function withFileLock(file, fn, { waitMs = 5000 } = {}) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const end = Date.now() + waitMs;
  let fd = null;
  while (fd === null) {
    try { fd = fs.openSync(lock, 'wx'); } catch (error) {
      if (!['EEXIST', 'EPERM', 'EBUSY', 'EACCES'].includes(error?.code)) throw error;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30000) fs.rmSync(lock, { force: true }); } catch { /* gone */ }
      if (Date.now() > end) throw Error(`${path.basename(file)} is locked`);
      sleepSync(15);
    }
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch { /* closed */ } try { fs.rmSync(lock, { force: true }); } catch { /* best effort */ } }
}

// Replace a file's content through a temp file; a rename that Windows refuses while a reader holds
// the file is retried, then falls back to an in-place write.
const replaceFile = (file, text) => {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { fs.renameSync(tmp, file); return; } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error?.code)) { try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ } throw error; }
      sleepSync(25);
    }
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
  try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
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

/** Register (or re-register) one supervisor; its heartbeat is now. */
export function registerSupervisor({ id, label, repos = [], terminal = null, session = null }, { env = process.env, now = Date.now() } = {}) {
  const file = supervisorFile(id, env);
  const at = new Date(now).toISOString();
  const record = {
    schema: 'starci/supervisor-channel@1', id, label: String(label ?? '').trim() || id,
    repos: [].concat(repos ?? []).map(String).map((r) => r.trim()).filter(Boolean), registeredAt: at, heartbeatAt: at,
    // The Orca terminal that registered (ORCA_TERMINAL_HANDLE): the [Supervisor] kernel's seat for id 'main'.
    ...(terminal ? { terminal } : {}),
    // The chat session that registered with no terminal (supervisor.mode chat): the one that drains id 'main'.
    ...(!terminal && session ? { session: String(session) } : {}),
  };
  writeJson(file, record);
  return record;
}

/** Refresh one registered supervisor's heartbeat; null when it is not registered. */
export function heartbeatSupervisor(id, { env = process.env, now = Date.now() } = {}) {
  const file = supervisorFile(id, env);
  const record = readJson(file);
  if (!record || record.id !== id) return null;
  record.heartbeatAt = new Date(now).toISOString();
  writeJson(file, record);
  return record;
}

export function getSupervisor(id, env = process.env) {
  if (!validSupervisorId(id)) return null;
  const record = readJson(supervisorFile(id, env));
  return record && record.id === id ? record : null;
}

/** Every registered supervisor, online ones first, then by label. */
export function listSupervisors({ env = process.env, now = Date.now(), onlineMs } = {}) {
  let names = [];
  try { names = fs.readdirSync(supervisorsDir(env)); } catch { return []; }
  return names
    .filter((name) => name.endsWith('.json') && validSupervisorId(name.slice(0, -5)))
    .map((name) => getSupervisor(name.slice(0, -5), env))
    .filter(Boolean)
    .map((sup) => ({ ...sup, online: supervisorOnline(sup, { now, env, onlineMs }) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || String(a.label).localeCompare(String(b.label)) || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------ inbox */

const parseLines = (text) => String(text ?? '').split(/\r?\n/).filter(Boolean).flatMap((line) => {
  try { const item = JSON.parse(line); return item && typeof item === 'object' ? [item] : []; } catch { return []; }
});

export const readInbox = (id, env = process.env) => {
  try { return parseLines(fs.readFileSync(inboxFile(id, env), 'utf8')); } catch { return []; }
};

/**
 * Append one message to a supervisor's inbox: {id, at, chatId, messageId, text, read:false, from?}. `from` names a
 * non-Telegram source: 'desktop' (scripts/supervisor/tell.mjs - the reply stays local), 'stall-alert', 'land-gate'.
 */
export function appendInbox(id, { chatId, messageId, text, from = null, at = new Date().toISOString() }, { env = process.env } = {}) {
  const file = inboxFile(id, env);
  const item = { id: crypto.randomUUID(), at, chatId, messageId: messageId ?? null, text: String(text ?? ''), read: false, ...(from ? { from } : {}) };
  withFileLock(file, () => fs.appendFileSync(file, `${JSON.stringify(item)}\n`, { mode: 0o600 }));
  return item;
}

/* ------------------------------------------------------------ outbox (the supervisor's replies, all of them) */

export const outboxFile = (id, env = process.env) => path.join(supervisorsDir(env), `${needId(id)}.outbox.jsonl`);
/** Record one reply: {id, at, to, text, via:'telegram'|'desktop'|'none', ok}. The newest 1000 are kept. */
export function appendOutbox(id, { to = null, text, via, ok = true, error = null, at = new Date().toISOString() }, { env = process.env } = {}) {
  const file = outboxFile(id, env);
  const entry = { id: crypto.randomUUID(), at, to, via, ok, text: String(text ?? ''), ...(error ? { error: String(error).slice(0, 300) } : {}) };
  withFileLock(file, () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
    try {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
      if (lines.length > 1200) replaceFile(file, `${lines.slice(-1000).join('\n')}\n`);
    } catch { /* trimming is best effort */ }
  });
  return entry;
}
export const readOutbox = (id, env = process.env) => {
  try { return parseLines(fs.readFileSync(outboxFile(id, env), 'utf8')); } catch { return []; }
};

/**
 * The unread inbox items of one supervisor; unless `peek`, they (or only those named in `ids`) are
 * marked read in the same locked pass, so two readers never both take one message.
 */
export function takeInbox(id, { env = process.env, peek = false, ids = null, now = Date.now() } = {}) {
  const file = inboxFile(id, env);
  const run = () => {
    const items = readInbox(id, env);
    const wanted = ids ? new Set(ids) : null;
    const unread = items.filter((item) => !item.read && (!wanted || wanted.has(item.id)));
    if (peek || !unread.length) return unread;
    const readAt = new Date(now).toISOString();
    const taken = new Set(unread.map((item) => item.id));
    const kept = items.map((item) => (taken.has(item.id) ? { ...item, read: true, readAt } : item));
    // Read messages are history: keep the newest 500 of them.
    const readOnes = kept.filter((item) => item.read);
    const drop = new Set(readOnes.slice(0, Math.max(0, readOnes.length - 500)).map((item) => item.id));
    replaceFile(file, kept.filter((item) => !drop.has(item.id)).map((item) => `${JSON.stringify(item)}\n`).join(''));
    return unread;
  };
  if (peek) return run();
  if (!fs.existsSync(file)) return [];
  return withFileLock(file, run);
}

/* ------------------------------------------------------------ routes */

const readRoutes = (env) => {
  const doc = readJson(routeFile(env), null);
  return doc && typeof doc === 'object' && doc.chats && typeof doc.chats === 'object' ? doc : { schema: 'starci/telegram-route@1', chats: {} };
};
const writeRoutes = (env, doc) => writeJson(routeFile(env), doc);
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

// The repositories whose open asks /asks lists: the connector repos plus every repo a notice named.
const defaultAskRepos = (env) => {
  try { return askRepos(connectorsConfig(ownerConfig() ?? undefined, env), { env, extra: notifiedRepos(env) }); } catch { return []; }
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
  repos = () => defaultAskRepos(env), spawnServe = defaultSpawnServe(env), serveTtlMs = null,
  ensureConnectors = () => ensureAskConnectors({ env: { ...process.env, ...env } }), publicBaseOf = () => publicBase(env),
  serveWaitMs = 30000, tunnelWaitMs = 20000, waitStepMs = 250, sweepEveryMs = 60000,
} = {}) {
  let current = null;
  const say = (line) => { try { log(redact(line, current?.token)); } catch { /* logging never breaks the bridge */ } };
  const call = (method, payload) => botCall({ token: current.token, method, payload, apiBase, fetchImpl, sleepImpl, attempts: 3 });
  const t = () => bridgeText(current?.language);
  const send = async (text, { replyTo = null, markup = null, html = false } = {}) => {
    const payload = { chat_id: current.chatId, text: String(text).slice(0, MAX_TEXT), link_preview_options: { is_disabled: true } };
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
      await new Promise((resolve) => setTimeout(resolve, waitStepMs));
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

  /** The "Generate URL" button: serve the ask's form on demand and put its link in the message. */
  const onAskButton = async (query, key) => {
    const messageId = query.message?.message_id ?? null;
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

  /** /asks: every open ask of the repos, one message each with its own button (a live form's link shown). */
  const onAsks = async () => {
    let listed = [];
    try { listed = repos(); } catch { listed = []; }
    const asks = listed.flatMap((repo) => withLedgerRead(repo, (db) => openAskList(db, { now: now() }).map((ask) => ({ ...ask, repo })), []));
    if (!asks.length) return send(t().asksNone);
    await send(t().asksHead(asks.length));
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

  let lastSweep = -Infinity;
  const sweep = async () => {
    if (!(sweepEveryMs >= 0) || now() - lastSweep < sweepEveryMs) return null;
    lastSweep = now();
    const r = await sweepAskMessages({ repos }, { env, apiBase, fetchImpl, sleepImpl, now: now(), settings: current, warn: say });
    if (r.closed?.length || r.unlinked?.length) say(`sweep: ${r.closed.length} closed ask(s) cleared, ${r.unlinked.length} dead link(s) removed`);
    return r;
  };

  const onMessage = async (message) => {
    const text = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : null;
    if (text == null || !text.trim()) return send(t().textOnly, { replyTo: message.message_id });
    const command = /^\/([A-Za-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/.exec(text.trim());
    if (!command) return onText(message, text);
    const name = command[1].toLowerCase();
    say(`command /${name}`);
    if (name === 'start' || name === 'choose') return chooser();
    if (name === 'status') return onStatus();
    if (name === 'asks') return onAsks();
    if (name === 'help') return send(t().help);
    return send(`${t().unknown}\n\n${t().help}`);
  };

  const onCallback = async (query) => {
    const data = String(query.data ?? '');
    const ask = ASK_CALLBACK.exec(data);
    if (ask) return onAskButton(query, ask[1]);
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

  const saveOffset = (offset) => {
    const state = bridgeState(env) ?? {};
    writeJson(bridgeStateFile(env), { ...state, schema: 'starci/telegram-bridge@1', offset, updatedAt: new Date(now()).toISOString() });
  };

  /** One getUpdates round: {ok, count} | {stop} | {conflict} | {error, status, retryAfter}. */
  const pollOnce = async () => {
    current = settings();
    if (!current?.ready) return { stop: current?.warning ?? 'telegram off' };
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

  /** Poll until told to stop; backs off on errors; exits when another bridge owns the updates. */
  const run = async ({ signal = null, ownPid = process.pid, maxRounds = Infinity } = {}) => {
    let backoff = 1000;
    for (let round = 0; round < maxRounds && !signal?.aborted; round += 1) {
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

/* ------------------------------------------------------------ ensure (supervisor channel, resume-all) */

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

const fileLog = (env, echo) => (line) => {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  try {
    const file = bridgeLogFile(env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_CAP) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, text);
  } catch { /* logging is best effort */ }
  if (echo) process.stderr.write(text);
};

async function runMain() {
  const env = process.env;
  const log = fileLog(env, process.stderr.isTTY === true);
  // A spec run (node --test sets NODE_TEST_CONTEXT, which spawned children inherit) never polls the real bot.
  if (env.NODE_TEST_CONTEXT && !env.STARCI_TELEGRAM_API_BASE) { console.log(JSON.stringify({ ok: true, skipped: 'test context' })); return; }
  const first = telegramSettings({ env });
  if (!first.ready) { console.log(JSON.stringify({ ok: true, skipped: first.warning ?? 'telegram off' })); return; }
  const claim = claimManager(BRIDGE_NAME, { current: bridgeState(env), env });
  if (!claim.ok) { console.log(JSON.stringify({ ok: false, already: true, pid: claim.holder?.pid ?? null })); process.exitCode = 1; return; }
  process.on('exit', claim.release);
  const prior = bridgeState(env) ?? {};
  writeJson(bridgeStateFile(env), { schema: 'starci/telegram-bridge@1', pid: process.pid, startedAt: new Date().toISOString(), offset: Number.isSafeInteger(prior.offset) ? prior.offset : null, updatedAt: new Date().toISOString() });
  const controller = new AbortController();
  const stop = () => { controller.abort(); claim.release(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  console.log(JSON.stringify({ ok: true, pid: process.pid, log: bridgeLogFile(env) }));
  log(`bridge ${process.pid} started`);
  const bridge = createBridge({ env, log, settings: () => telegramSettings({ env }) });
  let result;
  try { result = await bridge.run({ signal: controller.signal }); } catch (error) { result = { stopped: `crashed: ${redact(error?.message ?? error, first.token)}` }; }
  log(`bridge ${process.pid} stopped: ${result.stopped}`);
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
