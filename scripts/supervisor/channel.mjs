#!/usr/bin/env node
// channel.mjs — the supervisor's side of the Telegram command bridge
// (scripts/connectors/telegram-bridge.mjs, docs/connectors.md "Command bridge").
// The owner chats with the bot; the bridge files each message in this
// supervisor's inbox; the supervisor reads it here and answers through the bot.
//
//   node scripts/supervisor/channel.mjs register --id <id> --label <text> [--repos <csv>] [--force]
//       id 'main' is the [Supervisor] kernel's channel: it registers only from an Orca terminal
//       (ORCA_TERMINAL_HANDLE, recorded as the channel's terminal) and, while the supervisor seat names a
//       terminal, only from that one (--force overrides); an external chat session relays through tell.mjs
//   node scripts/supervisor/channel.mjs heartbeat --id <id>
//       both also make sure the bridge runs (ensureTelegramBridge)
//   node scripts/supervisor/channel.mjs inbox --id <id> [--json] [--peek]
//       prints the unread messages and marks them read (--peek leaves them unread)
//   node scripts/supervisor/channel.mjs reply --id <id> (--text <t> | --text-file <f>) [--to <inboxMessageId>]
//       sends "[<label>] <text>" to the owner's chat, as a reply to that inbox message's
//       Telegram message; split into parts over 3900 characters. A message that came from the owner's desktop
//       chat (from: 'desktop', scripts/supervisor/tell.mjs) is answered locally: the reply is only recorded.
//       Every reply is recorded in <state>/supervisors/<id>.outbox.jsonl (tell.mjs --read shows it).
//   node scripts/supervisor/channel.mjs wait --id <id> [--timeout-ms <n>]
//       blocks until an unread message exists, prints one line per unread message
//       ("TELEGRAM <inboxId>: <first 200 chars>") and exits 0; exits 124 on timeout.
//       Run it under a Monitor so the supervisor wakes the moment the owner writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argsOf } from '../connectors/lib.mjs';
import { botCall, DEFAULT_API_BASE, redact, telegramSettings } from '../connectors/telegram.mjs';
import {
  appendOutbox, ensureTelegramBridge, getSupervisor, heartbeatSupervisor, inboxFile, readInbox, registerSupervisor, supervisorsDir, takeInbox, validSupervisorId,
} from '../connectors/telegram-bridge.mjs';
import { SUPERVISOR_ID, seatOf, withSupervisorRead } from './home.mjs';

export const MAX_PART = 3900;
export const WAIT_TIMEOUT_EXIT = 124;

/** Split `text` into parts of at most `max` characters, preferring line breaks. */
export function splitText(text, max = MAX_PART) {
  const parts = [];
  let rest = String(text ?? '');
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
    if (cut < max / 2) cut = max;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest.trim() || !parts.length) parts.push(rest);
  return parts;
}

/**
 * Send one supervisor's answer to the owner: every part prefixed "[<label>]" (numbered when split),
 * the first a reply to the Telegram message of inbox item `to` (which is marked read). Never throws.
 */
export async function replyToOwner({ id, text, to = null }, {
  env = process.env, settings = null, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl,
} = {}) {
  const s = settings ?? telegramSettings({ env });
  try {
    if (!validSupervisorId(id)) return { ok: false, error: 'invalid supervisor id' };
    const origin = to ? readInbox(id, env).find((entry) => entry.id === to) : null;
    if (origin?.from === 'desktop') {
      // The owner's desktop chat relays through tell.mjs: its answer is recorded, never sent to Telegram.
      if (!String(text ?? '').trim()) return { ok: false, error: 'empty reply' };
      appendOutbox(id, { to, text, via: 'desktop' }, { env });
      takeInbox(id, { env, ids: [to] });
      return { ok: true, via: 'desktop', parts: 0, replyTo: null };
    }
    if (!s?.ready) return { ok: false, error: s?.warning ?? 'telegram is off (connectors.telegram)' };
    if (env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch) return { ok: false, error: 'test context: refusing the real Bot API' };
    if (!String(text ?? '').trim()) return { ok: false, error: 'empty reply' };
    const sup = getSupervisor(id, env);
    const label = sup?.label || id;
    let replyTo = null;
    if (to) {
      const item = readInbox(id, env).find((entry) => entry.id === to);
      if (!item) return { ok: false, error: `no inbox message ${to}` };
      replyTo = item.messageId ?? null;
    }
    const prefix = `[${label}]`;
    const parts = splitText(text, Math.max(500, MAX_PART - prefix.length - 12));
    const sent = [];
    for (let i = 0; i < parts.length; i += 1) {
      const head = parts.length > 1 ? `${prefix} (${i + 1}/${parts.length})` : prefix;
      const payload = { chat_id: s.chatId, text: `${head} ${parts[i]}`, link_preview_options: { is_disabled: true } };
      if (i === 0 && replyTo) payload.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
      const r = await botCall({ token: s.token, method: 'sendMessage', payload, apiBase, fetchImpl, ...(sleepImpl ? { sleepImpl } : {}) });
      if (!r.ok) return { ok: false, status: r.status, error: redact(r.error, s.token), sent };
      sent.push(r.result?.message_id ?? null);
    }
    if (to) takeInbox(id, { env, ids: [to] });
    appendOutbox(id, { to, text, via: 'telegram' }, { env });
    return { ok: true, via: 'telegram', parts: parts.length, messageIds: sent, replyTo };
  } catch (error) {
    return { ok: false, error: redact(error?.message ?? error, s?.token) };
  }
}

/**
 * Why a registration of `id` from `terminal` is refused, or null. The owner's channel 'main' belongs to the
 * [Supervisor] kernel (scripts/supervisor/start-supervisor.mjs): only an Orca terminal may take it, and while
 * the supervisor seat names a terminal only that one does. `seatTerminal` defaults to the recorded seat.
 */
export function registrationRefusal({ id, terminal, force = false, seatTerminal = undefined, env = process.env }) {
  if (id !== SUPERVISOR_ID || force) return null;
  if (!terminal) return `channel '${SUPERVISOR_ID}' belongs to the [Supervisor] kernel: register it from its Orca terminal (an external chat relays with scripts/supervisor/tell.mjs)`;
  const seat = seatTerminal !== undefined ? seatTerminal : withSupervisorRead((db) => seatOf(db)?.value?.terminal ?? null, null, { env });
  if (seat && seat !== terminal) return `channel '${SUPERVISOR_ID}' belongs to the [Supervisor] seat ${seat}, not ${terminal} (--force overrides)`;
  return null;
}

export const waitLine = (item) => `TELEGRAM ${item.id}: ${String(item.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)}`;

/**
 * Resolve with the unread inbox items of `id` as soon as there is at least one (they stay unread),
 * or with null after `timeoutMs`. Watches the supervisors directory, with an interval fallback.
 */
export function waitForInbox(id, { env = process.env, timeoutMs = Infinity, intervalMs = 1000 } = {}) {
  return new Promise((resolve) => {
    let done = false, watcher = null, timer = null, deadline = null;
    const finish = (value) => {
      if (done) return;
      done = true;
      try { watcher?.close(); } catch { /* closed */ }
      clearInterval(timer); clearTimeout(deadline);
      resolve(value);
    };
    const check = () => {
      if (done) return;
      const unread = readInbox(id, env).filter((item) => !item.read);
      if (unread.length) finish(unread);
    };
    const dir = supervisorsDir(env), name = path.basename(inboxFile(id, env));
    try {
      fs.mkdirSync(dir, { recursive: true });
      watcher = fs.watch(dir, (event, file) => { if (!file || String(file).startsWith(name)) check(); });
      watcher.on('error', () => { try { watcher.close(); } catch { /* closed */ } watcher = null; });
    } catch { watcher = null; }
    timer = setInterval(check, intervalMs);
    if (Number.isFinite(timeoutMs) && timeoutMs >= 0) deadline = setTimeout(() => finish(null), timeoutMs);
    check();
  });
}

const format = (items) => items.map((item) => `[${item.at}] ${item.id}${item.from ? ` (from: ${item.from})` : ''}\n${item.text}`).join('\n\n');

async function main() {
  const args = argsOf(process.argv.slice(2));
  const verb = args._[0];
  const out = (value) => console.log(JSON.stringify(value));
  const fail = (error, code = 2) => { console.error(JSON.stringify({ ok: false, error })); process.exitCode = code; };
  const id = typeof args.id === 'string' ? args.id : null;
  if (!verb || !['register', 'heartbeat', 'inbox', 'reply', 'wait'].includes(verb)) {
    console.error('usage: channel.mjs register --id <id> --label <text> [--repos <csv>] | heartbeat --id <id> | inbox --id <id> [--json] [--peek]\n'
      + '       | reply --id <id> (--text <t> | --text-file <f>) [--to <inboxMessageId>] | wait --id <id> [--timeout-ms <n>]');
    process.exitCode = 2; return;
  }
  if (!validSupervisorId(id)) return fail('--id <id> is required: letters, digits, dot, dash or underscore, at most 60');
  if (verb === 'register') {
    if (typeof args.label !== 'string' || !args.label.trim()) return fail('register needs --label <text>');
    const repos = typeof args.repos === 'string' ? args.repos.split(',').map((r) => r.trim()).filter(Boolean) : [];
    const terminal = process.env.ORCA_TERMINAL_HANDLE || null;
    const refused = registrationRefusal({ id, terminal, force: args.force === true });
    if (refused) return fail(refused, 1);
    const record = registerSupervisor({ id, label: args.label, repos, terminal });
    out({ ok: true, supervisor: record, bridge: ensureTelegramBridge() }); return;
  }
  if (verb === 'heartbeat') {
    const record = heartbeatSupervisor(id);
    if (!record) return fail(`supervisor ${id} is not registered: run channel.mjs register first`, 1);
    out({ ok: true, id, heartbeatAt: record.heartbeatAt, unread: readInbox(id).filter((item) => !item.read).length, bridge: ensureTelegramBridge() }); return;
  }
  if (verb === 'inbox') {
    const items = takeInbox(id, { peek: args.peek === true });
    if (args.json === true) out({ ok: true, id, peek: args.peek === true, messages: items });
    else console.log(items.length ? format(items) : `no unread Telegram messages for ${id}`);
    return;
  }
  if (verb === 'reply') {
    let text = typeof args.text === 'string' ? args.text : null;
    if (typeof args['text-file'] === 'string') {
      try { text = fs.readFileSync(args['text-file'], 'utf8'); } catch (error) { return fail(`cannot read --text-file: ${error.code ?? error.message}`); }
    }
    if (!text || !text.trim()) return fail('reply needs --text <t> or --text-file <f>');
    const r = await replyToOwner({ id, text, to: typeof args.to === 'string' ? args.to : null });
    out(r); if (!r.ok) process.exitCode = 1; return;
  }
  if (verb === 'wait') {
    const timeoutMs = args['timeout-ms'] !== undefined ? Number(args['timeout-ms']) : Infinity;
    const items = await waitForInbox(id, { timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : Infinity });
    if (!items) { process.exitCode = WAIT_TIMEOUT_EXIT; return; }
    console.log(items.map(waitLine).join('\n'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
