#!/usr/bin/env node
// stall-alert.mjs — the stall check with no chat: run headless, tell the
// supervisor and the owner about every NEW stall finding.
//
// The supervisor chat's own cron ticks starve while it is busy with the owner,
// so a workflow that stops moving must be caught by something that does not
// depend on that chat (incident 2026-09-24: nivo Collab idle ~2 h behind an
// owner gate whose condition had landed). scripts/kernel/resume-all.mjs, which
// the StarCi-Resume-Every10m scheduled task runs, launches this detached every
// pass; it can also run by hand.
//
//   node scripts/supervisor/stall-alert.mjs [--repo <path>]... [--supervisor <id>]
//       [--stall-minutes <n>] [--rate-minutes <n>] [--dry-run] [--json]
//
// Ledgers: config.yaml supervisor.repos plus every --repo (resume-all.mjs
// resumeRepos), each opened read-only (inspectLedger). Findings come from
// scripts/supervisor/stall.mjs; only STALLED, STALE-GATE, STALE-WAIT and STALE-PEER-WAIT alert
// (a justified GATE or PEER-WAIT line explains a stall, it is not one).
//
// For each finding that is new, or last alerted more than --rate-minutes ago
// (default 60) on that channel:
//   (a) one message in the supervisor's channel inbox (<state>/supervisors/<id>.inbox.jsonl,
//       default id 'main'), so its Monitor on `channel.mjs wait --id <id>` wakes at once;
//   (b) one short Telegram message to the owner in config.yaml `language`.
// Dedupe state: <state>/stall-alerts.json {findings: {<key>: {firstAt, inboxAt, telegramAt, line}}};
// a finding that disappears is dropped, so its return alerts at once. One run at a time
// (claimManager 'stall-alert'); a summary line per run goes to <state>/stall-alert.log.
// The bot token is never printed; errors are scrubbed (telegram.mjs redact).
// STARCI_TELEGRAM_API_BASE replaces the Bot API host (specs).
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { argsOf, claimManager, ownerConfig, readJson, stateFile, writeJson } from '../connectors/lib.mjs';
import { appendInbox } from '../connectors/telegram-bridge.mjs';
import { DEFAULT_API_BASE, redact, sendMessage, telegramSettings } from '../connectors/telegram.mjs';
import { resumeRepos } from '../kernel/resume-all.mjs';
import { stallFindings, stallMinutesOf } from './stall.mjs';

export const ALERT_NAME = 'stall-alert';
export const ALERT_FILE = fileURLToPath(import.meta.url);
export const DEFAULT_SUPERVISOR_ID = 'main';
export const RATE_MS = 60 * 60_000;
export const ALERT_TYPES = ['STALLED', 'STALE-GATE', 'STALE-WAIT', 'STALE-PEER-WAIT'];
const MAX_TEXT = 3900;
const LOG_CAP = 2 * 1024 * 1024;

export const alertStateFile = (env = process.env) => stateFile('stall-alerts.json', env);
export const alertLogFile = (env = process.env) => stateFile('stall-alert.log', env);

/**
 * Which findings to send now, per channel, and the next dedupe state. A finding is due on a
 * channel when that channel never carried it or carried it `rateMs` or more ago. Keys that are
 * no longer found are dropped, so a finding that comes back is new again.
 */
export function planAlerts(findings, state, { now = Date.now(), rateMs = RATE_MS } = {}) {
  const live = findings.filter((f) => f.alert && ALERT_TYPES.includes(f.type));
  const keys = new Set(live.map((f) => f.key));
  const entries = Object.fromEntries(Object.entries(state?.findings ?? {}).filter(([key]) => keys.has(key)));
  const inbox = [], telegram = [];
  for (const f of live) {
    const prev = entries[f.key] ?? { firstAt: now };
    entries[f.key] = { ...prev, type: f.type, line: f.line, lastSeenAt: now };
    if (!(now - (prev.inboxAt ?? -Infinity) < rateMs)) inbox.push(f);
    if (!(now - (prev.telegramAt ?? -Infinity) < rateMs)) telegram.push(f);
  }
  return { inbox, telegram, state: { schema: 'starci/stall-alerts@1', findings: entries } };
}

const TEXT = {
  en: {
    head: (n) => `⚠️ StarCi supervision: ${n} workflow finding(s) need attention`,
    tail: 'The supervisor was told through its channel inbox.',
    type: { STALLED: 'stalled', 'STALE-GATE': 'gate whose reason is gone', 'STALE-WAIT': 'waiting on a settled blocker', 'STALE-PEER-WAIT': 'peer wait that no longer holds' },
  },
  vi: {
    head: (n) => `⚠️ Giám sát StarCi: ${n} vấn đề workflow cần xử lý`,
    tail: 'Đã báo supervisor qua inbox.',
    type: { STALLED: 'workflow đứng yên', 'STALE-GATE': 'cổng chờ đã hết lý do', 'STALE-WAIT': 'đang chờ việc đã xong', 'STALE-PEER-WAIT': 'chờ workflow khác nhưng không còn lý do' },
  },
};
export const alertText = (language) => TEXT[language] ?? TEXT.en;

/** The owner's Telegram message: localized head and tail, one bullet per finding. */
export function telegramAlert(findings, language) {
  const t = alertText(language);
  const text = [t.head(findings.length), ...findings.map((f) => `• ${t.type[f.type] ?? f.type}: ${f.line}`), t.tail].join('\n\n');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** The supervisor's inbox message; its first line is what `channel.mjs wait` prints. */
export const inboxAlert = (findings) => `STALL-ALERT ${findings.length} finding(s): ${findings.map((f) => f.line).join('\n')}`;

const openLedgers = (repos) => {
  const ledgers = [], errors = [];
  for (const repo of repos) {
    try { ledgers.push({ repo, handle: inspectLedger({ file: ledgerFileFor(repo) }) }); }
    catch (error) { errors.push({ repo, error: String(error?.message ?? error).slice(0, 200) }); }
  }
  return { ledgers: ledgers.map((l) => ({ repo: l.repo, db: l.handle.db, close: () => l.handle.close() })), errors };
};

/**
 * One alert pass over `repos`. Every seam is injectable: `detect` (stall.mjs stallFindings),
 * `frontierOf`, the Telegram `settings`, `apiBase`/`fetchImpl`. Never throws; returns
 * {ok, findings, alerted:{inbox, telegram}, telegram, inbox, errors}.
 */
export async function runStallAlert({
  repos = [], env = process.env, now = Date.now(), stallMinutes = stallMinutesOf(), rateMs = RATE_MS,
  supervisorId = DEFAULT_SUPERVISOR_ID, detect = stallFindings, frontierOf = undefined, settings = null,
  apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = undefined, dryRun = false,
} = {}) {
  const result = { ok: true, dryRun, repos, findings: [], alerted: { inbox: [], telegram: [] }, inbox: null, telegram: null, errors: [] };
  const { ledgers, errors } = openLedgers(repos);
  result.errors.push(...errors);
  let findings = [];
  try {
    for (const l of ledgers) {
      try { findings.push(...detect(l.db, { repo: l.repo, ledgers, now, stallMinutes, ...(frontierOf ? { frontierOf } : {}) })); }
      catch (error) { result.errors.push({ repo: l.repo, error: String(error?.message ?? error).slice(0, 200) }); }
    }
  } finally { for (const l of ledgers) { try { l.close(); } catch { /* closed */ } } }
  result.findings = findings.map((f) => ({ type: f.type, key: f.key, alert: f.alert, line: f.line }));
  if (result.errors.length) result.ok = false;

  const stateFileName = alertStateFile(env);
  const plan = planAlerts(findings, readJson(stateFileName, {}), { now, rateMs });
  if (dryRun) { result.alerted = { inbox: plan.inbox.map((f) => f.key), telegram: plan.telegram.map((f) => f.key) }; return result; }
  const entries = plan.state.findings;

  if (plan.inbox.length) {
    try {
      const item = appendInbox(supervisorId, { chatId: null, messageId: null, text: inboxAlert(plan.inbox) }, { env });
      for (const f of plan.inbox) entries[f.key].inboxAt = now;
      result.alerted.inbox = plan.inbox.map((f) => f.key);
      result.inbox = { ok: true, supervisor: supervisorId, id: item.id };
    } catch (error) { result.ok = false; result.inbox = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
  }

  if (plan.telegram.length) {
    const s = settings ?? telegramSettings({ env });
    const skipped = env.STARCI_CONNECTORS_OFF === '1' ? 'STARCI_CONNECTORS_OFF'
      : env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch ? 'test context: refusing the real Bot API'
      : !s?.ready ? (s?.warning ?? 'telegram is off (connectors.telegram)') : null;
    if (skipped) result.telegram = { ok: true, skipped };
    else {
      try {
        const r = await sendMessage({ token: s.token, chatId: s.chatId, text: telegramAlert(plan.telegram, s.language), apiBase, fetchImpl, ...(sleepImpl ? { sleepImpl } : {}) });
        if (r.ok) {
          for (const f of plan.telegram) entries[f.key].telegramAt = now;
          result.alerted.telegram = plan.telegram.map((f) => f.key);
          result.telegram = { ok: true, messageId: r.messageId ?? null };
        } else { result.ok = false; result.telegram = { ok: false, status: r.status ?? null, error: redact(r.error, s.token) }; }
      } catch (error) { result.ok = false; result.telegram = { ok: false, error: redact(error?.message ?? error, s.token) }; }
    }
  }
  try { writeJson(stateFileName, plan.state); } catch (error) { result.ok = false; result.errors.push({ state: stateFileName, error: String(error?.message ?? error) }); }
  return result;
}

const appendLog = (env, line) => {
  try {
    const file = alertLogFile(env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_CAP) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* the log is a courtesy */ }
};

export const describe = (r) => [
  `[stall-alert] ${r.ok ? 'ok' : 'NOT OK'}${r.dryRun ? ' (dry run)' : ''}: ${r.repos.length} ledger(s), ${r.findings.length} finding(s), alerted inbox ${r.alerted.inbox.length} telegram ${r.alerted.telegram.length}`
    + `${r.telegram?.skipped ? ` (telegram skipped: ${r.telegram.skipped})` : r.telegram?.ok === false ? ` (telegram FAILED: ${r.telegram.error})` : ''}`
    + `${r.inbox?.ok === false ? ` (inbox FAILED: ${r.inbox.error})` : ''}`,
  ...r.findings.map((f) => `  ${f.line}`),
  ...r.errors.map((e) => `  error ${e.repo ?? e.state}: ${e.error}`),
].join('\n');

async function main() {
  const args = argsOf(process.argv.slice(2));
  const list = (v) => (v === undefined ? [] : [].concat(v)).filter((x) => typeof x === 'string');
  if (args.help || args.h) {
    console.log('use: node scripts/supervisor/stall-alert.mjs [--repo <path>]... [--supervisor <id>] [--stall-minutes <n>] [--rate-minutes <n>] [--dry-run] [--json]');
    return;
  }
  const env = process.env;
  const claim = claimManager(ALERT_NAME, { env });
  if (!claim.ok) {
    const out = { ok: true, skipped: 'another stall-alert run holds the lock', holder: claim.holder?.pid ?? null };
    console.log(args.json ? JSON.stringify(out) : `[stall-alert] skipped: ${out.skipped}`);
    return;
  }
  try {
    const { repos } = resumeRepos({ config: ownerConfig(), env, extra: list(args.repo) });
    const result = await runStallAlert({
      repos, env,
      supervisorId: typeof args.supervisor === 'string' ? args.supervisor : DEFAULT_SUPERVISOR_ID,
      stallMinutes: Number(args['stall-minutes']) || stallMinutesOf(),
      rateMs: (Number(args['rate-minutes']) || RATE_MS / 60_000) * 60_000,
      dryRun: args['dry-run'] === true,
    });
    appendLog(env, describe(result).split('\n')[0] + (result.alerted.inbox.length || result.alerted.telegram.length
      ? ` :: ${[...new Set([...result.alerted.inbox, ...result.alerted.telegram])].join(', ')}` : ''));
    console.log(args.json ? JSON.stringify(result) : describe(result));
    if (!result.ok) process.exitCode = 1;
  } finally { claim.release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === ALERT_FILE) main();
