#!/usr/bin/env node
// telegram-media.mjs — sends the owner what a design or UAT op produced, over
// the same Telegram bot as the ask notices (scripts/connectors/telegram.mjs,
// docs/connectors.md):
//
//   interface.draw / interface.asset settled pass
//       the drawn screens as an album (sendMediaGroup, <= 10 per album) with one
//       caption: what was drawn, how many screens / variants / states, the
//       report summary and that the owner reviews it at handover
//   uat.verify / uat.assisted.* / e2e.verify
//       every recorded video (sendVideo, <= 50 MB; bigger ones become a note
//       with the local path) captioned with the flow's steps and the verdict,
//       whatever the verdict; a pass with no video sends its screenshots as an
//       album instead
//
// The one send point is the KERNEL's settle: scripts/kernel/cli.mjs cmdSettle
// calls queueSettleMedia(), which launches this file detached (`settle` verb),
// so an upload never slows or fails the settle. The sender's stderr goes to
// machine_logs (actor connector, kind telegram-media.*). One send per workflow|job|attempt
// (deduped by a machine.sqlite notifications row, kind media). The ledger is read
// read-only, the bot token is never printed and is scrubbed from every error.
// STARCI_TELEGRAM_API_BASE replaces https://api.telegram.org for tests.
//
//   starci connect telegram-media settle --ledger <runtime.sqlite> --repo <repo>
//       --workflow <id> --job <id> --attempt <n> --op <op> --verdict pass|fail|blocked [--dispatch <id>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnNode } from '../api/node/spawn-node.mjs';
import { fileURLToPath } from 'node:url';
import { configRoot, connectorsConfig } from '../../engine/config.mjs';
import { runtimeSecretEnv } from '../gates/runtime-host.mjs';
import { DEFAULT_API_BASE, botCall, endpoint, telegramSettings } from './telegram.mjs';
import { botPolite, redact } from './telegram-polite.mjs';
import { clip } from '../lib/clip.mjs';
import { readMachine, withMachine } from '../../engine/db/machine.mjs';
import { argsOf, connectorLog, ownerConfig } from './lib.mjs';
import { parseJson } from '../lib/json.mjs';
import { sleep } from '../lib/sleep.mjs';
import { isSpecRun } from '../lib/env.mjs';
import { LIMITS, MIME, mediaKindOf, planSettleMedia, readSettle } from './telegram-media-plan.mjs';
export { collectDrawings, fitCaption, mediaKindOf } from './telegram-media-plan.mjs';

const SELF = fileURLToPath(import.meta.url);
const parse = parseJson;
const extOf = (file) => path.extname(file).toLowerCase();
/* ------------------------------------------------------------ Bot API uploads */

const blobOf = async (file) => {
  const type = MIME[extOf(file)] ?? 'application/octet-stream';
  if (typeof fs.openAsBlob === 'function') return fs.openAsBlob(file, { type });
  return new Blob([fs.readFileSync(file)], { type });
};

/**
 * One multipart Bot API call (Node's fetch + FormData + Blob): `fields` are sent as strings (objects as
 * JSON), `files` as [{field, file}] uploads. The same polite retries as telegram.mjs botCall: 429 waits
 * retry_after (<= 60 s), 5xx and network errors back off, any other 4xx fails at once. The token is
 * scrubbed from every error.
 */
export async function botUpload({ token, method, fields = {}, files = [], apiBase = DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = sleep, attempts = 3, timeoutMs = 180000 }) {
  return botPolite({ token, sleepImpl, attempts }, async () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) form.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    for (const { field, file } of files) form.append(field, await blobOf(file), path.basename(file));
    return fetchImpl(endpoint(apiBase, token, method), { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) });
  });
}

/**
 * One album of <= 10 images: sendPhoto for one, sendMediaGroup for more, the caption on the first.
 * Telegram refuses a photo whose dimensions it will not compress; a 4xx retries the same files as a
 * document album, which keeps them at full size.
 */
async function sendAlbum(call, chatId, files, caption) {
  const single = async (type) => botUpload({ ...call, method: type === 'photo' ? 'sendPhoto' : 'sendDocument', fields: { chat_id: chatId, ...(caption ? { caption } : {}) }, files: [{ field: type, file: files[0] }] });
  const group = async (type) => botUpload({ ...call, method: 'sendMediaGroup',
    fields: { chat_id: chatId, media: files.map((f, i) => ({ type, media: `attach://f${i}`, ...(i === 0 && caption ? { caption } : {}) })) },
    files: files.map((file, i) => ({ field: `f${i}`, file })) });
  const send = files.length === 1 ? single : group;
  const photo = await send('photo');
  if (photo.ok || (photo.status ?? 500) >= 500 || photo.status === 429 || photo.status === 401 || photo.status === 403) return photo;
  return send('document');
}

/** One video with its caption; a 4xx sendVideo (a format Telegram will not stream) retries as a document. */
async function sendVideoFile(call, chatId, file, caption) {
  const video = await botUpload({ ...call, method: 'sendVideo', fields: { chat_id: chatId, caption, supports_streaming: 'true' }, files: [{ field: 'video', file }] });
  if (video.ok || (video.status ?? 500) >= 500 || [401, 403, 429].includes(video.status)) return video;
  return botUpload({ ...call, method: 'sendDocument', fields: { chat_id: chatId, caption }, files: [{ field: 'document', file }] });
}

const sendNote = (call, chatId, text) => botCall({ ...call, method: 'sendMessage',
  payload: { chat_id: chatId, text: clip(text, LIMITS.text), link_preview_options: { is_disabled: true } } });

/* ------------------------------------------------------------ dedupe store */

// One send per workflow|job|attempt: a machine.sqlite notifications row (kind 'media', dedupe_key
// `media|<workflow>|<job>|<attempt>`) claimed before the upload (delivery 'sending') and settled after it
// (sent | partial, ref {op, verdict, sent, failed}); a send that delivered nothing gives its claim up.
const mediaDedupeKey = (workflowId, jobId, attempt) => `media|${workflowId}|${jobId}|${attempt}`;
/** The dedupe row of one settle ({delivery, sent_at, ref: {...}}), or null. */
export const mediaSent = (key, env = process.env) => readMachine((m) => {
  const row = m.db.prepare("SELECT delivery, sent_at, ref FROM notifications WHERE dedupe_key=? AND kind='media'").get(key);
  return row ? { ...row, ref: parse(row.ref, null) } : null;
}, null, { env });
/** Claim `key` for this send: false when a row exists already (sent, or another sender is on it). */
const claimMedia = (key, { op, verdict, env }) => withMachine((m) => m.insert('notifications', { channel: 'telegram', kind: 'media', text: `${op} ${verdict}`, delivery: 'sending',
  ref: JSON.stringify({ op, verdict }), dedupe_key: key }, { orIgnore: true }).changes > 0, { env });
/** Settle a claim: the outcome of the upload, or — nothing delivered — the claim given up (a later run tries again). */
const settleMedia = (key, { op, verdict, sent, failed, env }) => withMachine((m) => (sent
  ? m.update('notifications', { delivery: failed ? 'partial' : 'sent', sent_at: m.now(), ref: JSON.stringify({ op, verdict, sent, failed }) }, { dedupe_key: key })
  : m.update('notifications', { delivery: 'failed', dedupe_key: `${key}#failed-${m.now()}` }, { dedupe_key: key })), { env });

const sendPlanItem = async (item, call, chatId) => {
  if (item.type === 'album') return sendAlbum(call, chatId, item.files, item.caption);
  if (item.type === 'video') return sendVideoFile(call, chatId, item.file, item.caption);
  return sendNote(call, chatId, item.text);
};

async function sendPlanItems(plan, call, settings, op, jobId, warn) {
  let sent = 0, failed = 0;
  for (const item of plan.sends) {
    const result = await sendPlanItem(item, call, settings.chatId);
    if (result?.ok) sent++;
    else { failed++; warn(`telegram-media: ${op} ${jobId} ${item.type} not sent: ${redact(result?.error ?? 'unknown error', settings.token)}`); }
  }
  return { sent, failed };
}

const readSettleSafely = (ledgerFile, request, warn) => {
  try { return { ok: true, value: readSettle(ledgerFile, request) }; }
  catch (error) { warn(`telegram-media: ledger unreadable (${error.message})`); return { ok: false }; }
};

/**
 * Send the media one settled op produced. Never throws: every failure is one stderr line (through
 * `warn`) and an {ok:false} result. Deduped per workflow|job|attempt; a send that delivered nothing
 * releases its claim so a later run can try again. Everything external is injectable.
 */
export async function sendSettleMedia({ ledgerFile, repo, workflowId, jobId, attempt, op, verdict, dispatchId = null }, {
  config = ownerConfig(), env = process.env, root = configRoot, fetchImpl = fetch, apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE,
  warn = (line) => process.stderr.write(`${line}\n`), sleepImpl = sleep, now = Date.now(),
} = {}) {
  try {
    if (env.STARCI_CONNECTORS_OFF === '1') return { ok: true, skipped: 'STARCI_CONNECTORS_OFF' };
    if (isSpecRun(env) && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch) return { ok: true, skipped: 'test context' };
    if (!mediaKindOf(op)) return { ok: true, skipped: 'not a media op' };
    const settings = telegramSettings({ config, env, root });
    if (!settings.ready) {
      if (settings.warning) { warn(settings.warning); }
      return { ok: true, skipped: settings.warning ?? 'telegram off' };
    }
    const readResult = readSettleSafely(ledgerFile, { workflowId, op, attempt, dispatchId }, warn);
    if (!readResult.ok) return { ok: false, error: 'ledger unreadable' };
    const read = readResult.value;
    const plan = planSettleMedia({ op, verdict, report: read.report, workflow: read.workflow, repo: path.resolve(repo ?? path.dirname(path.dirname(ledgerFile))), language: settings.language });
    if (plan.skip) return { ok: true, skipped: plan.skip };
    const key = mediaDedupeKey(workflowId, jobId, attempt);
    if (!claimMedia(key, { op, verdict, env })) return { ok: true, skipped: 'already sent', key };
    const call = { token: settings.token, apiBase, fetchImpl, sleepImpl };
    const { sent, failed } = await sendPlanItems(plan, call, settings, op, jobId, warn);
    settleMedia(key, { op, verdict, sent, failed, env });
    return { ok: failed === 0, kind: plan.kind, sent, failed, key };
  } catch (error) {
    const line = `telegram-media: send failed: ${redact(error?.message ?? error)}`;
    try { warn(line); } catch { /* nothing left */ }
    return { ok: false, error: line };
  }
}

/**
 * The settle's hook (scripts/kernel/cli.mjs cmdSettle): launch the sender detached when this op has
 * media to send and Telegram is on, and return at once. Synchronous and never throws, so the settle
 * is never slowed or failed by Telegram; a launch failure is one stderr line.
 */
export function queueSettleMedia(job, { env = process.env, config = undefined, root = configRoot, spawnImpl = spawnNode, script = SELF } = {}) {
  try {
    const kind = mediaKindOf(job?.op);
    if (!kind) return { queued: false, skipped: 'not a media op' };
    if (kind === 'draw' && job.verdict !== 'pass') return { queued: false, skipped: 'a draw is sent when it settles pass' };
    if (env.STARCI_CONNECTORS_OFF === '1') return { queued: false, skipped: 'STARCI_CONNECTORS_OFF' };
    // A spec run (node --test sets NODE_TEST_CONTEXT, which a spawned cli.mjs inherits) never
    // reaches the real Bot API: only a spec that points STARCI_TELEGRAM_API_BASE at a fake queues.
    if (isSpecRun(env) && !env.STARCI_TELEGRAM_API_BASE) return { queued: false, skipped: 'test context' };
    const owner = config === undefined ? ownerConfig() : config;
    if (!owner || connectorsConfig(owner, env, root).telegram.enabled !== true) return { queued: false, skipped: 'telegram off' };
    env = runtimeSecretEnv(env, root);
    const settings = telegramSettings({ config: owner, env, root, preparedEnv: env });
    if (!settings.ready) return { queued: false, skipped: 'telegram off' };
    const args = [script, 'settle', '--ledger', job.ledgerFile, '--repo', job.repo, '--workflow', job.workflowId, '--job', job.jobId,
      '--attempt', String(job.attempt), '--op', job.op, '--verdict', job.verdict, ...(job.dispatchId ? ['--dispatch', String(job.dispatchId)] : [])];
    // The sender logs to machine_logs itself (actor connector, kind telegram-media.*): no output is kept.
    const child = spawnImpl(args, { detached: true, stdio: 'ignore', env });
    child?.on?.('error', (error) => { try { process.stderr.write(`telegram-media: sender not started: ${redact(error?.message ?? error)}\n`); } catch { /* nothing */ } });
    child?.unref?.();
    return { queued: true, pid: child?.pid ?? null };
  } catch (error) {
    try { process.stderr.write(`telegram-media: not queued: ${redact(error?.message ?? error)}\n`); } catch { /* nothing left */ }
    return { queued: false, error: 'not queued' };
  }
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const out = (value) => console.log(JSON.stringify(value));
  if (args._[0] !== 'settle') {
    console.error('usage: starci connect telegram-media settle --ledger <file> --repo <repo> --workflow <id> --job <id> --attempt <n> --op <op> --verdict pass|fail|blocked [--dispatch <id>]');
    process.exit(2);
  }
  for (const k of ['ledger', 'workflow', 'job', 'op', 'verdict']) if (typeof args[k] !== 'string') { out({ ok: false, error: `settle needs --${k}` }); process.exit(2); }
  const warn = (line) => connectorLog('telegram-media', line, { kind: 'settle', level: 'warn' });
  const result = await sendSettleMedia({ ledgerFile: args.ledger, repo: typeof args.repo === 'string' ? args.repo : null, workflowId: args.workflow, jobId: args.job,
    attempt: args.attempt ?? '1', op: args.op, verdict: args.verdict, dispatchId: typeof args.dispatch === 'string' ? args.dispatch : null }, { warn });
  if (!result.ok || result.sent) {
    const outcome = result.ok ? `sent ${result.sent}` : result.error ?? `${result.failed} failed`;
    connectorLog('telegram-media', `${args.op} ${args.job}: ${outcome}`, { kind: 'settle', level: result.ok ? 'info' : 'warn', data: result });
  }
  out(result);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const result = main();
  if (result && typeof result.then === 'function') {
    try { await result; } catch (error) { console.error(error); process.exit(1); }
  }
}
