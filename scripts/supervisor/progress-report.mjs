#!/usr/bin/env node
// progress-report.mjs — the supervisor's periodic progress table, sent to the
// owner's Telegram.
//   node scripts/supervisor/progress-report.mjs [--repo <path>]... [--send] [--json]
// Owner, 2026-09-23: "supervisor cứ 10 phút kẻ bảng báo cáo tiến độ và dự tính
// phần còn lại và gửi qua telegram". Owner asks still go to Telegram only from
// the kernel (serve-ask); this is the supervisor's separate status digest.
// Everything is read from the ledgers read-only: per running workflow the
// approved legs, which are done/running/waiting, what waits on the owner, and
// a remaining-time estimate from that workflow's own pace so far.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { botCall, telegramSettings } from '../connectors/telegram.mjs';

const DEFAULT_REPOS = ['D:/Repositories/nivo-backend', 'D:/Repositories/starci-next', 'D:/Repositories/mia-mia-backend'];
const FINAL = new Set(['succeeded', 'failed', 'cancelled']);
const RUNTIME_INCIDENT = /^\[(?:source-runtime-defect|runtime-[^\]]*|environment|provider-launch-failure|op-boundary-drift|worker-prompt-stall|settled-terminal[^\]]*)\]/;

const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
// Short names that fit a phone-width table; anything else falls back to its trimmed id.
const ALIASES = { 'nivo-app-auth': 'AUTH', 'nivo-workspace-provision': 'WSPV', 'nivo-modules-agentos': 'Modules',
  'nivo-collab-group-chat': 'Collab', 'starci-next-work-and-stacks': 'sn-work', 'starci-next-base-repos': 'sn-base',
  'miamia-work-and-stacks': 'mm-work', 'miamia-base-repos': 'mm-base' };
const shortName = (wf) => { const s = wf.replace(/^wf-/, '').replace(/-mu[a-z0-9]{6,}$/, ''); return ALIASES[s] ?? s.slice(0, 10); };

/** The repos to report on: --repo args, else config.yaml supervisor.repos, else the three product repos. */
export function reportRepos(argvRepos = [], config = (() => { try { return loadConfig(); } catch { return null; } })()) {
  if (argvRepos.length) return argvRepos;
  const fromConfig = config?.supervisor?.repos;
  return Array.isArray(fromConfig) && fromConfig.length ? fromConfig : DEFAULT_REPOS;
}

/** One running workflow's progress from its ledger: {id, name, done, total, current[], waiting[], ownerWait, etaMs}. */
export function workflowProgress(db, wf, { now = Date.now() } = {}) {
  const goal = db.prepare('SELECT json FROM goals WHERE workflow_id=? ORDER BY goal_seq DESC LIMIT 1').get(wf.workflow_id);
  const g = parse(goal?.json, {}) ?? {};
  const legs = [...new Set((g.derivedPlan?.legs ?? g.opChain?.legs ?? []).map((l) => (typeof l === 'string' ? l : l?.op)).filter(Boolean))];
  const statusOf = (op) => db.prepare('SELECT status FROM jobs WHERE workflow_id=? AND op_id=?').all(wf.workflow_id, op).map((r) => r.status);
  // A leg that already succeeded stays done; a new job on it is rework, shown apart.
  const legState = legs.map((op) => {
    const s = statusOf(op);
    const active = s.includes('running') || s.includes('answering') || s.includes('leased');
    if (!s.length) return { op, state: 'todo' };
    if (s.includes('succeeded')) return { op, state: 'done', rework: active };
    if (active) return { op, state: 'running' };
    if (s.includes('queued')) return { op, state: 'queued' };
    return { op, state: 'failed' };
  });
  // request.analyze is an intake leg the kernel never enqueues; it does not count toward the total.
  const counted = legState.filter((l) => !(l.op === 'request.analyze' && l.state === 'todo'));
  const done = counted.filter((l) => l.state === 'done').length;
  const total = counted.length;
  const answered = new Set(db.prepare("SELECT json_extract(payload_json,'$.dispatchId') d FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded')").all(wf.workflow_id).map((r) => r.d));
  const openAsks = db.prepare("SELECT dispatch_id FROM reports WHERE workflow_id=? AND outcome='ask'").all(wf.workflow_id).filter((r) => !answered.has(r.dispatch_id)).length;
  const runtime = db.prepare("SELECT last_progress FROM incidents WHERE workflow_id=? AND status='open'").all(wf.workflow_id).filter((i) => RUNTIME_INCIDENT.test(i.last_progress ?? '')).length;
  const started = Number(wf.created_at);
  const elapsed = Math.max(0, now - started);
  // The workflow's own pace: elapsed time per finished leg; no estimate before the first leg lands.
  const etaMs = done > 0 && total > done ? Math.round((elapsed / done) * (total - done)) : (total > 0 && done >= total ? 0 : null);
  return {
    id: wf.workflow_id, name: shortName(wf.workflow_id), done, total,
    current: [...legState.filter((l) => l.state === 'running').map((l) => l.op), ...legState.filter((l) => l.rework).map((l) => `↻${l.op}`)],
    waiting: legState.filter((l) => l.state === 'queued').map((l) => l.op),
    openAsks, runtime, elapsedMs: elapsed, etaMs,
  };
}

export function collectProgress(repos, { now = Date.now() } = {}) {
  const out = [];
  for (const repo of repos) {
    let handle;
    try { handle = inspectLedger({ file: ledgerFileFor(repo) }); } catch (error) { out.push({ repo, error: String(error?.message ?? error) }); continue; }
    try {
      const wfs = handle.db.prepare("SELECT workflow_id, created_at FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();
      for (const wf of wfs) out.push({ repo, ...workflowProgress(handle.db, wf, { now }) });
    } finally { try { handle.close(); } catch { /* closed */ } }
  }
  return out;
}

const hours = (ms) => (ms == null ? '?' : ms <= 0 ? 'xong' : ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))}p` : `${(ms / 3600000).toFixed(1)}h`);
const pad = (s, n) => { const t = String(s); return t.length >= n ? t.slice(0, n) : t + ' '.repeat(n - t.length); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The Telegram message (HTML with one <pre> table) for a progress snapshot. */
export function progressMessage(rows, { now = Date.now(), timeZone = 'Asia/Ho_Chi_Minh' } = {}) {
  const ok = rows.filter((r) => !r.error);
  const time = new Date(now).toLocaleString('vi-VN', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  // Phone width: about 34 monospace columns.
  const table = [
    `${pad('WF', 7)} ${pad('Chặng', 5)} ${pad('Còn', 5)} Đang làm`,
    ...ok.map((r) => `${pad(r.name, 7)} ${pad(`${r.done}/${r.total}`, 5)} ${pad(hours(r.etaMs), 5)} ${(r.current[0] ?? (r.waiting[0] ? `chờ ${r.waiting[0]}` : '-')).slice(0, 18)}`),
  ].join('\n');
  const etas = ok.map((r) => r.etaMs).filter((x) => x != null);
  const overall = etas.length ? hours(Math.max(...etas)) : '?';
  const asks = ok.filter((r) => r.openAsks > 0).map((r) => `${r.name} (${r.openAsks})`);
  const runtime = ok.reduce((n, r) => n + r.runtime, 0);
  const lines = [
    `<b>[StarCi] Tiến độ ${esc(time)}</b>`,
    `<pre>${esc(table)}</pre>`,
    `Dự tính xong tất cả: ~${esc(overall)} (theo tốc độ từng workflow đến giờ)`,
    asks.length ? `Chờ thầy trả lời: ${esc(asks.join(', '))}` : 'Không có câu hỏi nào đang chờ thầy.',
    `Sạn runtime đang mở: ${runtime}`,
    ...rows.filter((r) => r.error).map((r) => `Không đọc được ledger ${esc(r.repo)}: ${esc(r.error)}`),
  ];
  return lines.join('\n').slice(0, 3900);
}

async function main() {
  const argv = process.argv.slice(2);
  const repos = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--repo') repos.push(argv[++i]);
  const rows = collectProgress(reportRepos(repos));
  const text = progressMessage(rows);
  if (argv.includes('--json')) console.log(JSON.stringify({ rows, text }, null, 2));
  else console.log(text);
  if (!argv.includes('--send')) return;
  const settings = telegramSettings();
  if (!settings.ready) { console.error(settings.warning ?? 'telegram is off'); process.exitCode = 1; return; }
  const sent = await botCall({ token: settings.token, method: 'sendMessage',
    payload: { chat_id: settings.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } } });
  console.error(sent.ok ? `sent message ${sent.messageId ?? ''}` : `telegram send failed: ${sent.error}`);
  if (!sent.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
