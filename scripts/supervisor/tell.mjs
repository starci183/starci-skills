#!/usr/bin/env node
// tell.mjs — the owner's desktop chat session relays to the one [Supervisor] (docs/supervisor.md "Chat").
// The desktop session never supervises: it only writes to the Supervisor's inbox and reads its replies.
//
//   node scripts/supervisor/tell.mjs "<text>" [--wait] [--timeout-ms <n>] [--json]
//       files the text in the Supervisor's inbox (channel 'main', from: desktop); the Supervisor's watchdog wakes
//       it with an [inbox] tag. --wait blocks until the Supervisor answers this message (default 15 min).
//   node scripts/supervisor/tell.mjs --read [--since <ISO time | 30m | 2h>] [--limit <n>] [--json]
//       the Supervisor's recent replies (Telegram and desktop), oldest first, each with the message it answers.
//
// A desktop message's answer is recorded only (never sent to Telegram); a Telegram message's answer goes to
// Telegram and is recorded too. Owner approvals for owner-only actions never travel this way: they come from
// the verified owner Telegram chat or from the Supervisor's own Orca terminal.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendInbox, getSupervisor, readInbox, readOutbox, supervisorOnline } from '../connectors/telegram-bridge.mjs';
import { SUPERVISOR_ID } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const DEFAULT_WAIT_MS = 15 * 60_000;

/** File `text` for the Supervisor. Returns {ok, id, online}. */
export function tell(text, { env = process.env, now = new Date() } = {}) {
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, error: 'nothing to tell: pass the text as the first argument' };
  const item = appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'desktop', text: body, at: now.toISOString() }, { env });
  const sup = getSupervisor(SUPERVISOR_ID, env);
  return { ok: true, id: item.id, online: sup ? supervisorOnline(sup, { env }) : false, registered: Boolean(sup) };
}

/** `--since` as epoch ms: an ISO time, or a relative age like 30m / 2h / 1d. */
export function sinceMs(value, now = Date.now()) {
  if (!value) return now - 24 * 3600_000;
  const rel = /^(\d+)\s*([mhd])$/i.exec(String(value).trim());
  if (rel) return now - Number(rel[1]) * { m: 60_000, h: 3600_000, d: 86_400_000 }[rel[2].toLowerCase()];
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : now - 24 * 3600_000;
}

/** The replies since `since` (ms), oldest first, each with the text of the message it answers. */
export function replies({ since = 0, limit = 20, env = process.env } = {}) {
  const inbox = new Map(readInbox(SUPERVISOR_ID, env).map((m) => [m.id, m]));
  return readOutbox(SUPERVISOR_ID, env).filter((r) => Date.parse(r.at) >= since).slice(-limit)
    .map((r) => ({ ...r, question: r.to ? inbox.get(r.to)?.text ?? null : null, questionFrom: r.to ? inbox.get(r.to)?.from ?? 'telegram' : null }));
}

/** Resolve with the reply to inbox message `id`, or null after `timeoutMs`. */
export async function waitReply(id, { timeoutMs = DEFAULT_WAIT_MS, intervalMs = 2000, env = process.env } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const hit = readOutbox(SUPERVISOR_ID, env).find((r) => r.to === id);
    if (hit) return hit;
    if (Date.now() >= end) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const show = (r) => `[${r.at}] via ${r.via}${r.question ? `\n  > ${String(r.question).replace(/\s+/g, ' ').slice(0, 160)}` : ''}\n${r.text}`;

async function main() {
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = has('json');
  if (has('help') || !argv.length) { console.log('use: tell.mjs "<text>" [--wait] [--timeout-ms <n>] | tell.mjs --read [--since <ISO|30m|2h>] [--limit <n>]  [--json]'); return; }
  if (has('read')) {
    const list = replies({ since: sinceMs(value('since')), limit: Number(value('limit')) || 20 });
    console.log(asJson ? JSON.stringify(list) : list.length ? list.map(show).join('\n\n') : 'no replies in that window');
    return;
  }
  const valued = new Set(['--timeout-ms', '--since', '--limit']);
  const text = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1])).join(' ');
  const r = tell(text);
  if (!r.ok) { console.error(r.error); process.exitCode = 2; return; }
  if (!has('wait')) {
    console.log(asJson ? JSON.stringify(r) : `sent ${r.id} to the Supervisor${r.online ? '' : ' (it is offline: it reads the inbox when it is back)'}`);
    return;
  }
  const reply = await waitReply(r.id, { timeoutMs: Number(value('timeout-ms')) || DEFAULT_WAIT_MS });
  if (asJson) console.log(JSON.stringify({ ...r, reply }));
  else console.log(reply ? show(reply) : `sent ${r.id}; no reply yet (tell.mjs --read later)`);
  if (!reply) process.exitCode = 124;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main();
