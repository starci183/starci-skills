#!/usr/bin/env node
// progress-report.mjs — the supervisor's periodic progress report, sent to the
// owner's Telegram.
//   node scripts/supervisor/progress-report.mjs [--repo <path>]... [--send] [--json]
// Owner, 2026-09-23: "supervisor cứ 10 phút kẻ bảng báo cáo tiến độ và dự tính
// phần còn lại và gửi qua telegram", then, on the first terse table: "quá đơn
// giản, ghi rõ ràng ra mọi thứ". So each workflow gets a readable Vietnamese
// section: its goal, every leg by name (done / running / waiting / not yet),
// what is running and for how long, the latest report, the owner's pending
// questions (with a link only while a form serves; forms are served on demand
// from the ask's Telegram button or /asks), what is stuck, and a finish time.
// Owner asks still reach Telegram only from the kernel (api serve-ask); this
// is the supervisor's status digest. Ledgers are read read-only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { botCall, telegramSettings } from '../connectors/telegram.mjs';

const DEFAULT_REPOS = ['D:/Repositories/nivo-backend', 'D:/Repositories/starci-next', 'D:/Repositories/mia-mia-backend'];
const RUNTIME_INCIDENT = /^\[(?:source-runtime-defect|runtime-[^\]]*|environment|provider-launch-failure|op-boundary-drift|worker-prompt-stall|settled-terminal[^\]]*)\]/;
const MAX_MESSAGE = 3900;
const TZ = 'Asia/Ho_Chi_Minh';

// Plain Vietnamese for each leg, so the owner never has to decode an op id.
export const LEG_VI = {
  'request.analyze': 'Phân tích yêu cầu', 'scope.define': 'Xác định phạm vi', 'business.decide': 'Chốt nghiệp vụ',
  'architecture.decide': 'Thiết kế kiến trúc', 'brand.decide': 'Chốt thương hiệu', 'interface.draw': 'Vẽ giao diện',
  'interface.asset': 'Làm hình ảnh', 'provision.ask': 'Xin thông tin / credential', 'work.author': 'Chia việc chi tiết',
  'workspace.manage': 'Dựng workspace', 'backend.scaffold': 'Dựng khung backend', 'interface.scaffold': 'Dựng khung giao diện',
  'backend.implement': 'Code backend', 'interface.implement': 'Code giao diện', 'interface.audit': 'Soát giao diện',
  'integration.verify': 'Kiểm tích hợp thật', 'e2e.verify': 'Test end-to-end', 'uat.verify': 'Nghiệm thu (UAT)',
  'review.verify': 'Review cuối', 'handover.review': 'Bàn giao cho thầy duyệt', 'code.refactor': 'Refactor code',
};
const legVi = (op) => LEG_VI[op] ?? op;
const ALIASES = { 'nivo-app-auth': 'AUTH (đăng nhập)', 'nivo-workspace-provision': 'WSPV (mua & cấp workspace)',
  'nivo-modules-agentos': 'Modules (AgentOS)', 'nivo-collab-group-chat': 'Collab (chat nhóm)',
  'starci-next-work-and-stacks': 'StarCi Next – work & stacks', 'starci-next-base-repos': 'StarCi Next – base repos',
  'miamia-work-and-stacks': 'Mia Mia – work & stacks', 'miamia-base-repos': 'Mia Mia – base repos' };
const baseName = (wf) => wf.replace(/^wf-/, '').replace(/-mu[a-z0-9]{6,}$/, '');
const displayName = (wf) => ALIASES[baseName(wf)] ?? baseName(wf);

const parse = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const dur = (ms) => (ms == null ? '?' : ms < 60000 ? '<1 phút' : ms < 3600000 ? `${Math.round(ms / 60000)} phút` : `${(ms / 3600000).toFixed(1)} giờ`);
const clock = (ms) => new Date(ms).toLocaleString('vi-VN', { timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/** The repos to report on: --repo args, else config.yaml supervisor.repos, else the three product repos. */
export function reportRepos(argvRepos = [], config = (() => { try { return loadConfig(); } catch { return null; } })()) {
  if (argvRepos.length) return argvRepos;
  const fromConfig = config?.supervisor?.repos;
  return Array.isArray(fromConfig) && fromConfig.length ? fromConfig : DEFAULT_REPOS;
}

const publicBaseOf = (config) => {
  const cf = config?.connectors?.cloudflare;
  return cf?.mode === 'named' && cf?.hostname ? `https://${cf.hostname}` : null;
};

/** One running workflow's progress, read from its ledger. */
export function workflowProgress(db, wf, { now = Date.now(), publicBase = null } = {}) {
  const goalRow = db.prepare('SELECT json, markdown FROM goals WHERE workflow_id=? ORDER BY goal_seq DESC LIMIT 1').get(wf.workflow_id);
  const g = parse(goalRow?.json, {}) ?? {};
  const goalText = clip(g.opChain?.input?.text ?? goalRow?.markdown ?? '', 220);
  const legs = [...new Set((g.derivedPlan?.legs ?? g.opChain?.legs ?? []).map((l) => (typeof l === 'string' ? l : l?.op)).filter(Boolean))];
  const jobsOf = (op) => db.prepare('SELECT job_id, status, updated_at FROM jobs WHERE workflow_id=? AND op_id=? ORDER BY created_at').all(wf.workflow_id, op);
  const dispatchedAt = (jobId) => db.prepare("SELECT created_at FROM events WHERE entity_id=? AND kind='op-dispatched' ORDER BY seq DESC LIMIT 1").get(jobId)?.created_at ?? null;
  // A leg that already succeeded stays done; a new job on it is rework.
  const legState = legs.map((op) => {
    const jobs = jobsOf(op);
    const running = jobs.filter((j) => ['running', 'answering', 'leased'].includes(j.status));
    const since = running.length ? Math.min(...running.map((j) => dispatchedAt(j.job_id) ?? j.updated_at)) : null;
    if (!jobs.length) return { op, state: 'todo' };
    if (jobs.some((j) => j.status === 'succeeded')) return { op, state: 'done', rework: running.length > 0, since, count: running.length };
    if (running.length) return { op, state: 'running', since, count: running.length };
    if (jobs.some((j) => j.status === 'queued')) return { op, state: 'queued' };
    return { op, state: 'failed' };
  });
  const counted = legState.filter((l) => !(l.op === 'request.analyze' && l.state === 'todo'));
  const done = counted.filter((l) => l.state === 'done').length;
  const total = counted.length;

  const closed = new Set(db.prepare("SELECT json_extract(payload_json,'$.dispatchId') d FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded')").all(wf.workflow_id).map((r) => r.d));
  const asks = db.prepare("SELECT dispatch_id, op_id, report_json FROM reports WHERE workflow_id=? AND outcome='ask' ORDER BY report_id").all(wf.workflow_id)
    .filter((r) => !closed.has(r.dispatch_id))
    .map((r) => {
      const q = parse(r.report_json, {})?.question ?? {};
      // Only a form that still serves has a link: a form is served on demand (the ask's Telegram
      // "Generate URL" button, or /asks), so an expired or exited one shows none.
      const serving = db.prepare("SELECT seq, payload_json FROM events WHERE workflow_id=? AND kind='ask-serving' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(wf.workflow_id, r.dispatch_id);
      const ended = serving && db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-serving-expired' AND json_extract(payload_json,'$.dispatchId')=? AND seq>? LIMIT 1").get(wf.workflow_id, r.dispatch_id, serving.seq);
      const payload = parse(serving?.payload_json, {}) ?? {};
      const url = serving && !ended && !(Number.isInteger(payload.pid) && !alive(payload.pid)) ? payload.url ?? null : null;
      const nonce = url ? /\/(a-[0-9a-f]+)/.exec(url)?.[1] : null;
      return { op: r.op_id, text: clip(q.text ?? '', 160), link: nonce && publicBase ? `${publicBase}/${nonce}` : url };
    });
  const incidents = db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at DESC").all(wf.workflow_id);
  const runtime = incidents.filter((i) => RUNTIME_INCIDENT.test(i.last_progress ?? ''));
  const ownerGates = incidents.filter((i) => /^\[owner-gate/.test(i.last_progress ?? ''));
  const last = db.prepare('SELECT op_id, outcome, report_json, created_at FROM reports WHERE workflow_id=? ORDER BY report_id DESC LIMIT 1').get(wf.workflow_id);
  const elapsed = Math.max(0, now - Number(wf.created_at));
  const etaMs = done > 0 && total > done ? Math.round((elapsed / done) * (total - done)) : (total > 0 && done >= total ? 0 : null);
  return {
    id: wf.workflow_id, name: displayName(wf.workflow_id), goal: goalText, done, total,
    legs: counted,
    lastReport: last ? { op: last.op_id, outcome: last.outcome, summary: clip(parse(last.report_json, {})?.summary ?? '', 260), at: last.created_at } : null,
    asks, runtime: runtime.map((i) => clip(i.last_progress, 140)), ownerGates: ownerGates.map((i) => clip(i.last_progress, 140)),
    startedAt: Number(wf.created_at), elapsedMs: elapsed, etaMs, etaAt: etaMs != null ? now + etaMs : null,
  };
}

export function collectProgress(repos, { now = Date.now(), config = (() => { try { return loadConfig(); } catch { return null; } })() } = {}) {
  const publicBase = publicBaseOf(config);
  const out = [];
  for (const repo of repos) {
    let handle;
    try { handle = inspectLedger({ file: ledgerFileFor(repo) }); } catch (error) { out.push({ repo, error: String(error?.message ?? error) }); continue; }
    try {
      const wfs = handle.db.prepare("SELECT workflow_id, created_at FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();
      for (const wf of wfs) out.push({ repo, ...workflowProgress(handle.db, wf, { now, publicBase }) });
    } finally { try { handle.close(); } catch { /* closed */ } }
  }
  return out;
}

const OUTCOME_VI = { done: 'xong', partial: 'xong một phần', failed: 'thất bại', ask: 'hỏi thầy', blocked: 'bị chặn' };

/** One readable section for one workflow (HTML). */
export function workflowSection(r, { now = Date.now() } = {}) {
  const line = [];
  line.push(`<b>▶ ${esc(r.name)}</b> — ${r.done}/${r.total} chặng xong`);
  if (r.goal) line.push(`Mục tiêu: ${esc(r.goal)}`);
  const doneLegs = r.legs.filter((l) => l.state === 'done' && !l.rework).map((l) => legVi(l.op));
  const active = r.legs.filter((l) => l.state === 'running' || l.rework);
  const queued = r.legs.filter((l) => l.state === 'queued').map((l) => legVi(l.op));
  const failed = r.legs.filter((l) => l.state === 'failed').map((l) => legVi(l.op));
  const todo = r.legs.filter((l) => l.state === 'todo').map((l) => legVi(l.op));
  if (doneLegs.length) line.push(`✅ Đã xong: ${esc(doneLegs.join(', '))}`);
  for (const l of active) line.push(`🔄 Đang làm: <b>${esc(legVi(l.op))}</b>${l.rework ? ' (làm lại)' : ''}${l.count > 1 ? ` — ${l.count} op song song` : ''}${l.since ? `, đã chạy ${esc(dur(now - l.since))}` : ''}`);
  if (queued.length) line.push(`⏳ Chờ tới lượt: ${esc(queued.join(', '))}`);
  if (failed.length) line.push(`⚠️ Lần gần nhất thất bại, kernel sẽ thử lại: ${esc(failed.join(', '))}`);
  if (todo.length) line.push(`⬜ Còn lại: ${esc(todo.join(' → '))}`);
  if (r.lastReport) line.push(`📝 Báo cáo gần nhất (${esc(legVi(r.lastReport.op))}, ${esc(OUTCOME_VI[r.lastReport.outcome] ?? r.lastReport.outcome)}, ${esc(clock(r.lastReport.at))}): ${esc(r.lastReport.summary)}`);
  for (const a of r.asks) line.push(`❓ Đang chờ thầy trả lời (${esc(legVi(a.op))}): ${esc(a.text)}${a.link ? `\n   ${esc(a.link)}` : '\n   (bấm /asks để lấy link trả lời)'}`);
  for (const g of r.ownerGates) line.push(`🔒 Chờ thầy: ${esc(g)}`);
  if (r.runtime.length) line.push(`🐞 Sạn runtime đang mở: ${r.runtime.length} (supervisor đang xử lý)`);
  line.push(r.etaAt == null
    ? '🕒 Dự kiến xong: chưa ước được (chưa có chặng nào xong)'
    : r.etaMs <= 0 ? '🕒 Mọi chặng đã xong, chờ bàn giao'
    : `🕒 Dự kiến xong: ~${esc(dur(r.etaMs))} nữa (khoảng ${esc(clock(r.etaAt))}), tính theo tốc độ từ lúc bắt đầu (${esc(clock(r.startedAt))})`);
  return line.join('\n');
}

/** The report as Telegram messages (HTML), split under the message size limit. */
export function progressMessages(rows, { now = Date.now() } = {}) {
  const ok = rows.filter((r) => !r.error);
  const asks = ok.reduce((n, r) => n + r.asks.length, 0);
  const runtime = ok.reduce((n, r) => n + r.runtime.length, 0);
  const etas = ok.map((r) => r.etaAt).filter((x) => x != null);
  const header = [
    `<b>[StarCi] Báo cáo tiến độ lúc ${esc(clock(now))}</b>`,
    `${ok.length} workflow đang chạy · ${ok.reduce((n, r) => n + r.done, 0)}/${ok.reduce((n, r) => n + r.total, 0)} chặng đã xong`,
    asks ? `❓ ${asks} câu hỏi đang chờ thầy trả lời (/asks gửi từng câu kèm nút tạo link)` : '❓ Không có câu hỏi nào đang chờ thầy',
    `🐞 ${runtime} sạn runtime đang mở`,
    etas.length ? `🕒 Dự kiến xong tất cả: khoảng ${esc(clock(Math.max(...etas)))}` : '',
    ...rows.filter((r) => r.error).map((r) => `⚠️ Không đọc được ledger ${esc(r.repo)}: ${esc(r.error)}`),
  ].filter(Boolean).join('\n');
  const messages = [];
  let current = header;
  for (const r of ok) {
    const section = workflowSection(r, { now });
    if ((current + '\n\n' + section).length > MAX_MESSAGE) { messages.push(current); current = section.slice(0, MAX_MESSAGE); }
    else current += `\n\n${section}`;
  }
  messages.push(current);
  return messages;
}

async function main() {
  const argv = process.argv.slice(2);
  const repos = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--repo') repos.push(argv[++i]);
  const rows = collectProgress(reportRepos(repos));
  const messages = progressMessages(rows);
  if (argv.includes('--json')) console.log(JSON.stringify({ rows, messages }, null, 2));
  else console.log(messages.join('\n\n———\n\n'));
  if (!argv.includes('--send')) return;
  const settings = telegramSettings();
  if (!settings.ready) { console.error(settings.warning ?? 'telegram is off'); process.exitCode = 1; return; }
  for (const text of messages) {
    const sent = await botCall({ token: settings.token, method: 'sendMessage',
      payload: { chat_id: settings.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } } });
    console.error(sent.ok ? `sent message ${sent.messageId ?? ''}` : `telegram send failed: ${sent.error}`);
    if (!sent.ok) { process.exitCode = 1; return; }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
