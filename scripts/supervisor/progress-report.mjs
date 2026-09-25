#!/usr/bin/env node
// progress-report.mjs — the supervisor's periodic progress report, sent to the
// owner's Telegram.
//   node scripts/supervisor/progress-report.mjs [--repo <path>]... [--send] [--json]
// Owner, 2026-09-23: "supervisor cứ 10 phút kẻ bảng báo cáo tiến độ và dự tính
// phần còn lại và gửi qua telegram", then, on the first terse table: "quá đơn
// giản, ghi rõ ràng ra mọi thứ". So each workflow gets a readable Vietnamese
// section: its goal, every leg by name (done / running / waiting / not yet),
// what is running and for how long, the latest report, the owner's pending
// approval questions (with a link only while a form serves; forms are served on
// demand from the ask's Telegram button or /asks), what is stuck, and a finish
// time. Credential asks are one count line pointing at /creds, never listed.
// Owner asks still reach Telegram only from the kernel (api serve-ask); this
// is the supervisor's status digest. Ledgers are read read-only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { botCall, telegramSettings, TEXT_MAX } from '../connectors/telegram.mjs';
import { clipLine } from '../lib/clip.mjs';
import { blockingJobs, blockingOthersOf } from '../kernel/waiter-priority.mjs';
import { askClassOf } from '../kernel/serve-ask.mjs';
import { RUNTIME_INCIDENT } from './poll.mjs';
import { productRepos, supervisorSettings } from './home.mjs';

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
const dur = (ms) => (ms == null ? '?' : ms < 60000 ? '<1 phút' : ms < 3600000 ? `${Math.round(ms / 60000)} phút` : `${(ms / 3600000).toFixed(1)} giờ`);
const clock = (ms) => new Date(ms).toLocaleString('vi-VN', { timeZone: TZ, hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/** The repos to report on: --repo args, else config.yaml supervisor.repos (productRepos). */
export function reportRepos(argvRepos = [], config = undefined) {
  return argvRepos.length ? argvRepos : productRepos(supervisorSettings({ config }));
}

const publicBaseOf = (config) => {
  const cf = config?.connectors?.cloudflare;
  return cf?.mode === 'named' && cf?.hostname ? `https://${cf.hostname}` : null;
};

/**
 * Jobs of one workflow that are DONE but held: the worker filed its report, the Kernel consumed it,
 * and an open peer-wait or owner-gate incident naming the job (--holds, else --op) keeps its settle
 * open - api status frontier.heldSettleJobs. The owner saw nothing of them: "job qwen xong/treo cũng
 * không ai nhắn" (2026-09-25; nivo op-integration.verify-25532858e7 sat done behind peer-wait
 * inc-8cce1cf1b330). Each: {jobId, op, outcome, heldBecause, incident, peer, peerJob, since, doneAt,
 * workerReleased}; `since` is when the hold began (the later of the wait and the consumed report).
 */
export function settleHoldsOf(db, workflowId, { now = Date.now() } = {}) {
  const waits = db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
    .map((row) => {
      const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
      if (!['peer-wait', 'owner-gate', 'owner-gate-pending'].includes(kind)) return null;
      const raised = db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
      const p = parse(raised?.payload_json, {}) ?? {};
      const until = Array.isArray(p.until) ? p.until : [];
      return { incident: row.incident_id, heldBecause: kind === 'peer-wait' ? 'peer-wait' : 'owner-gate',
        holds: Array.isArray(p.holds) && p.holds.length ? p.holds : [row.op_id].filter(Boolean),
        peer: typeof p.peer === 'string' ? p.peer : null,
        peerJob: until.find((u) => u?.type === 'job' && u.jobId)?.jobId ?? null,
        since: raised?.created_at ?? row.updated_at };
    }).filter(Boolean);
  if (!waits.length) return [];
  const out = [];
  for (const job of db.prepare("SELECT job_id, op_id, payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status IN ('running','answering') ORDER BY created_at").all(workflowId)) {
    const wait = waits.find((w) => w.holds.includes(job.job_id) || (job.op_id && w.holds.includes(job.op_id)));
    if (!wait) continue;
    const payload = parse(job.payload_json, {}) ?? {};
    const dispatchIds = [payload.managed?.dispatchId, payload.orca?.dispatchId, payload.hierarchy?.runtime?.dispatchId, job.job_id].filter(Boolean);
    const report = db.prepare(`SELECT outcome, consumed_at FROM reports WHERE workflow_id=? AND consumed_at IS NOT NULL AND (dispatch_id IN (${dispatchIds.map(() => '?').join(',')})
      OR dispatch_id=(SELECT worker_id FROM jobs WHERE job_id=?)) ORDER BY created_at DESC LIMIT 1`).get(workflowId, ...dispatchIds, job.job_id);
    if (!report) continue;
    out.push({ jobId: job.job_id, op: job.op_id, outcome: report.outcome, heldBecause: wait.heldBecause, incident: wait.incident,
      peer: wait.peer, peerJob: wait.peerJob, since: Math.max(wait.since ?? 0, report.consumed_at ?? 0), doneAt: report.consumed_at,
      workerReleased: payload.workerReleased?.custody?.state === 'released', ageMs: Math.max(0, now - Math.max(wait.since ?? 0, report.consumed_at ?? 0)) });
  }
  return out;
}

/** One running workflow's progress, read from its ledger. */
export function workflowProgress(db, wf, { now = Date.now(), publicBase = null, blocking = null } = {}) {
  const goalRow = db.prepare('SELECT json, markdown FROM goals WHERE workflow_id=? ORDER BY goal_seq DESC LIMIT 1').get(wf.workflow_id);
  const g = parse(goalRow?.json, {}) ?? {};
  const goalText = clipLine(g.opChain?.input?.text ?? goalRow?.markdown ?? '', 220);
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
      return { op: r.op_id, askClass: askClassOf({ opId: r.op_id, question: q }), text: clipLine(q.text ?? '', 160), link: nonce && publicBase ? `${publicBase}/${nonce}` : url };
    });
  const incidents = db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at DESC").all(wf.workflow_id);
  const holds = settleHoldsOf(db, wf.workflow_id, { now });
  const runtime = incidents.filter((i) => RUNTIME_INCIDENT.test(i.last_progress ?? ''));
  const ownerGates = incidents.filter((i) => /^\[owner-gate/.test(i.last_progress ?? ''));
  const last = db.prepare('SELECT op_id, outcome, report_json, created_at FROM reports WHERE workflow_id=? ORDER BY report_id DESC LIMIT 1').get(wf.workflow_id);
  const elapsed = Math.max(0, now - Number(wf.created_at));
  const etaMs = done > 0 && total > done ? Math.round((elapsed / done) * (total - done)) : (total > 0 && done >= total ? 0 : null);
  // Jobs of this workflow other workflows wait on (scripts/kernel/waiter-priority.mjs).
  let blockingOthers = [];
  try { blockingOthers = blockingOthersOf(blocking ?? blockingJobs(db, { now }), wf.workflow_id, { now }); } catch { blockingOthers = []; }
  return {
    id: wf.workflow_id, name: displayName(wf.workflow_id), goal: goalText, done, total,
    legs: counted,
    lastReport: last ? { op: last.op_id, outcome: last.outcome, summary: clipLine(parse(last.report_json, {})?.summary ?? '', 260), at: last.created_at } : null,
    asks, holds, runtime: runtime.map((i) => clipLine(i.last_progress, 140)), ownerGates: ownerGates.map((i) => clipLine(i.last_progress, 140)),
    startedAt: Number(wf.created_at), elapsedMs: elapsed, etaMs, etaAt: etaMs != null ? now + etaMs : null,
    blocking: blockingOthers.map((b) => ({ jobId: b.jobId, op: b.opId, status: b.status, workflows: b.workflows.map(displayName), since: b.since })),
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
      let blocking = null;
      try { blocking = blockingJobs(handle.db, { now }); } catch { blocking = null; }
      for (const wf of wfs) out.push({ repo, ...workflowProgress(handle.db, wf, { now, publicBase, blocking }) });
    } finally { try { handle.close(); } catch { /* closed */ } }
  }
  return out;
}

const OUTCOME_VI = { done: 'xong', partial: 'xong một phần', failed: 'thất bại', ask: 'hỏi thầy', blocked: 'bị chặn' };

/** One held settle as a report line: "done, waiting on <peer workflow>/<job>" and how long. */
export function holdLine(h, { now = Date.now() } = {}) {
  const on = h.heldBecause === 'peer-wait'
    ? `${h.peer ? displayName(h.peer) : 'workflow khác'}${h.peerJob ? `/${h.peerJob}` : ''}`
    : 'thầy';
  return `⏸ ${esc(legVi(h.op))} (${esc(h.jobId)}): ${esc(OUTCOME_VI[h.outcome] ?? h.outcome)}, đang chờ ${esc(on)} (${esc(h.incident)}) — đã ${esc(dur(now - h.since))}${h.workerReleased ? ', worker đã đóng' : ''}`;
}

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
  for (const a of r.asks.filter((ask) => ask.askClass !== 'credential')) line.push(`❓ Đang chờ thầy trả lời (${esc(legVi(a.op))}): ${esc(a.text)}${a.link ? `\n   ${esc(a.link)}` : '\n   (bấm /asks để lấy link trả lời)'}`);
  for (const h of r.holds ?? []) line.push(holdLine(h, { now }));
  for (const g of r.ownerGates) line.push(`🔒 Chờ thầy: ${esc(g)}`);
  for (const b of r.blocking ?? []) line.push(`⛓ Đang chặn workflow khác: <b>${esc(legVi(b.op))}</b> (${esc(b.jobId)}) — ${b.workflows.length} workflow đang chờ (${esc(b.workflows.join(', '))}), đã ${esc(dur(now - b.since))}${b.status === 'queued' ? ', chưa được giao chạy' : ''}`);
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
  const creds = ok.reduce((n, r) => n + r.asks.filter((a) => a.askClass === 'credential').length, 0);
  const asks = ok.reduce((n, r) => n + r.asks.length, 0) - creds;
  const runtime = ok.reduce((n, r) => n + r.runtime.length, 0);
  const etas = ok.map((r) => r.etaAt).filter((x) => x != null);
  const header = [
    `<b>[StarCi] Báo cáo tiến độ lúc ${esc(clock(now))}</b>`,
    `${ok.length} workflow đang chạy · ${ok.reduce((n, r) => n + r.done, 0)}/${ok.reduce((n, r) => n + r.total, 0)} chặng đã xong`,
    asks ? `❓ ${asks} câu hỏi đang chờ thầy trả lời (/asks gửi từng câu kèm nút tạo link)` : '❓ Không có câu hỏi nào đang chờ thầy',
    ...(creds ? [`🔑 ${creds} yêu cầu credential đang chờ, không chặn việc chính: /creds`] : []),
    `🐞 ${runtime} sạn runtime đang mở`,
    ...(ok.some((r) => r.holds?.length) ? [`⏸ ${ok.reduce((n, r) => n + (r.holds?.length ?? 0), 0)} việc đã xong đang chờ workflow khác hoặc thầy trước khi chốt (xem ⏸ từng workflow)`] : []),
    etas.length ? `🕒 Dự kiến xong tất cả: khoảng ${esc(clock(Math.max(...etas)))}` : '',
    ...rows.filter((r) => r.error).map((r) => `⚠️ Không đọc được ledger ${esc(r.repo)}: ${esc(r.error)}`),
  ].filter(Boolean).join('\n');
  const messages = [];
  let current = header;
  for (const r of ok) {
    const section = workflowSection(r, { now });
    if ((current + '\n\n' + section).length > TEXT_MAX) { messages.push(current); current = section.slice(0, TEXT_MAX); }
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
  // One model-scorecard line (pool shares/pass rates, qwen tokens) over the same repos, last 24h; a failure adds nothing.
  try {
    const sc = await import('../agent/model-scorecard.mjs');
    const line = `\n📊 ${esc(sc.summaryLine(sc.scorecardFor({ repos: reportRepos(repos), sinceHours: 24 })))}`;
    const at = messages[0].indexOf('\n\n'); // end of the header block
    messages[0] = at < 0 ? messages[0] + line : messages[0].slice(0, at) + line + messages[0].slice(at);
  } catch { /* optional line */ }
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
