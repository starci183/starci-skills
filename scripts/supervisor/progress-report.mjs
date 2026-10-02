#!/usr/bin/env node
// progress-report.mjs — the supervisor's periodic progress report, sent to the
// owner's Telegram.
//   node scripts/supervisor/progress-report.mjs [--repo <path>]... [--send] [--json]
// Owner, 2026-09-23: "every 10 minutes the supervisor draws a progress table with the
// estimate of what is left and sends it over telegram", then, on the first terse table:
// "too simple, write everything out clearly". So each workflow gets a readable section in
// the owner's language: its goal, every leg by name (done / running / waiting / not yet),
// what is running and for how long, the latest report, the owner's pending
// approval questions (with a link only while a form serves; forms are served on
// demand from the ask's Telegram button or /asks), what is stuck, and a finish
// time. Credential asks are one count line pointing at /creds, never listed.
// Owner asks still reach Telegram only from the kernel (api serve-ask); this
// is the supervisor's status digest. Ledgers are read read-only.
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { botCall, telegramSettings, TEXT_MAX } from '../connectors/telegram.mjs';
import { clipLine } from '../lib/clip.mjs';
import { blockingJobs, blockingOthersOf } from '../kernel/waiter-priority.mjs';
import { askClassOf } from '../kernel/ask-server.mjs';
import { RUNTIME_INCIDENT } from './poll.mjs';
import { productRepos, supervisorSettings } from '../machine/home.mjs';
import { parseJson } from '../lib/json.mjs';
import { opLabel, opLabelMap } from '../lib/display-names.mjs';
import { WORKFLOW_ALIASES } from '../lib/example-refs.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';

const TZ = 'Asia/Ho_Chi_Minh';

// A plain-language label for each leg, so the owner never has to decode an op id: the shared op labels
// (modules/ops/_labels.yaml through scripts/lib/display-names.mjs), the same words the UI and Orca show.
export const LEG_VI = Object.freeze(Object.fromEntries(Object.entries(opLabelMap()).map(([op, label]) => [op, label.vi ?? op])));
// The label in the report's language (modules/ops/_labels.yaml carries vi and en), the vi one when neither is declared.
const legLabel = (op, language) => opLabel(op, language);
// English alias sources; the i18n catalog carries the owner's wording for each. The product-keyed slugs
// themselves are declared once in scripts/lib/example-refs.mjs (R206).
const ALIASES = WORKFLOW_ALIASES;
const baseName = (wf) => wf.replace(/^wf-/, '').replace(/-mu[a-z0-9]{6,}$/, '');
// The workflow's display name (api rename / define-goal: workflows.display_name) when the ledger has one,
// else the older alias, else the goal slug.
const displayName = (wf, names = null, tr = (s) => s) => names?.get(wf) ?? tr(ALIASES[baseName(wf)] ?? baseName(wf));
/** workflow_id -> display_name for the workflows of `db` that have one. */
const namedWorkflows = (db) => { try { return new Map(db.prepare('SELECT * FROM workflows').all().filter((w) => w.display_name).map((w) => [w.workflow_id, w.display_name])); } catch { return new Map(); } };

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dur = (ms, tr) => (ms == null ? '?' : ms < 60000 ? tr('<1 minute') : ms < 3600000 ? tr('{n} minutes', { n: Math.round(ms / 60000) }) : tr('{h} hours', { h: (ms / 3600000).toFixed(1) }));
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
 * open - api status frontier.heldSettleJobs. The owner saw nothing of them: "nobody messages
 * when a job finishes or gets stuck" (2026-09-25; a product's op-integration.verify-25532858e7 sat done behind peer-wait
 * inc-8cce1cf1b330). Each: {jobId, op, outcome, heldBecause, incident, peer, peerJob, since, doneAt,
 * workerReleased}; `since` is when the hold began (the later of the wait and the consumed report).
 */
export function settleHoldsOf(db, workflowId, { now = Date.now() } = {}) {
  const waits = db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
    .map((row) => {
      const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
      if (!['peer-wait', 'owner-gate', 'owner-gate-pending'].includes(kind)) return null;
      const raised = db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
      const p = parseJson(raised?.payload_json, {}) ?? {};
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
    const payload = parseJson(job.payload_json, {}) ?? {};
    const report = db.prepare('SELECT outcome, consumed_at FROM reports WHERE workflow_id=? AND job_id=? AND consumed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1')
      .get(workflowId, job.job_id);
    if (!report) continue;
    out.push({ jobId: job.job_id, op: job.op_id, outcome: report.outcome, heldBecause: wait.heldBecause, incident: wait.incident,
      peer: wait.peer, peerJob: wait.peerJob, since: Math.max(wait.since ?? 0, report.consumed_at ?? 0), doneAt: report.consumed_at,
      workerReleased: payload.workerReleased?.custody?.state === 'released', ageMs: Math.max(0, now - Math.max(wait.since ?? 0, report.consumed_at ?? 0)) });
  }
  return out;
}

/** One running workflow's progress, read from its ledger. */
export function workflowProgress(db, wf, { now = Date.now(), publicBase = null, blocking = null, language = ownerLanguage() } = {}) {
  const tr = translator(language);
  const goalRow = db.prepare('SELECT json, markdown FROM goals WHERE workflow_id=? ORDER BY goal_seq DESC LIMIT 1').get(wf.workflow_id);
  const g = parseJson(goalRow?.json, {}) ?? {};
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
  const asks = db.prepare("SELECT r.dispatch_id, a.op_id, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.outcome='ask' ORDER BY r.report_id").all(wf.workflow_id)
    .filter((r) => !closed.has(r.dispatch_id))
    .map((r) => {
      const q = parseJson(r.report_json, {})?.question ?? {};
      // Only a form that still serves has a link: a form is served on demand (the ask's Telegram
      // "Generate URL" button, or /asks), so an expired or exited one shows none.
      const serving = db.prepare("SELECT seq, payload_json FROM events WHERE workflow_id=? AND kind='ask-serving' AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(wf.workflow_id, r.dispatch_id);
      const ended = serving && db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-serving-expired' AND json_extract(payload_json,'$.dispatchId')=? AND seq>? LIMIT 1").get(wf.workflow_id, r.dispatch_id, serving.seq);
      const payload = parseJson(serving?.payload_json, {}) ?? {};
      const url = serving && !ended && !(Number.isInteger(payload.pid) && !alive(payload.pid)) ? payload.url ?? null : null;
      const nonce = url ? /\/(a-[0-9a-f]+)/.exec(url)?.[1] : null;
      return { op: r.op_id, askClass: askClassOf({ opId: r.op_id, question: q }), text: clipLine(q.text ?? '', 160), link: nonce && publicBase ? `${publicBase}/${nonce}` : url };
    });
  const incidents = db.prepare("SELECT incident_id, last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at DESC").all(wf.workflow_id);
  const names = namedWorkflows(db);
  const holds = settleHoldsOf(db, wf.workflow_id, { now }).map((h) => (h.peer ? { ...h, peerName: displayName(h.peer, names, tr) } : h));
  const runtime = incidents.filter((i) => RUNTIME_INCIDENT.test(i.last_progress ?? ''));
  const ownerGates = incidents.filter((i) => /^\[owner-gate/.test(i.last_progress ?? ''));
  const last = db.prepare('SELECT a.op_id, r.outcome, r.report_json, r.created_at FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? ORDER BY r.report_id DESC LIMIT 1').get(wf.workflow_id);
  const elapsed = Math.max(0, now - Number(wf.created_at));
  const etaMs = done > 0 && total > done ? Math.round((elapsed / done) * (total - done)) : (total > 0 && done >= total ? 0 : null);
  // Jobs of this workflow other workflows wait on (scripts/kernel/waiter-priority.mjs).
  let blockingOthers = [];
  try { blockingOthers = blockingOthersOf(blocking ?? blockingJobs(db, { now }), wf.workflow_id, { now }); } catch { blockingOthers = []; }
  return {
    id: wf.workflow_id, name: displayName(wf.workflow_id, names, tr), goal: goalText, done, total,
    legs: counted,
    lastReport: last ? { op: last.op_id, outcome: last.outcome, summary: clipLine(parseJson(last.report_json, {})?.summary ?? '', 260), at: last.created_at } : null,
    asks, holds, runtime: runtime.map((i) => clipLine(i.last_progress, 140)), ownerGates: ownerGates.map((i) => clipLine(i.last_progress, 140)),
    startedAt: Number(wf.created_at), elapsedMs: elapsed, etaMs, etaAt: etaMs != null ? now + etaMs : null,
    blocking: blockingOthers.map((b) => ({ jobId: b.jobId, op: b.opId, status: b.status, workflows: b.workflows.map((id) => displayName(id, names, tr)), since: b.since })),
  };
}

export function collectProgress(repos, { now = Date.now(), language = ownerLanguage(), config = (() => { try { return loadConfig(); } catch { return null; } })() } = {}) {
  const publicBase = publicBaseOf(config);
  const out = [];
  for (const repo of repos) {
    let handle;
    try { handle = inspectLedger({ file: ledgerFileFor(repo) }); } catch (error) { out.push({ repo, error: String(error?.message ?? error) }); continue; }
    try {
      const wfs = handle.db.prepare("SELECT workflow_id, created_at FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();
      let blocking = null;
      try { blocking = blockingJobs(handle.db, { now }); } catch { blocking = null; }
      for (const wf of wfs) out.push({ repo, ...workflowProgress(handle.db, wf, { now, publicBase, blocking, language }) });
    } finally { try { handle.close(); } catch { /* closed */ } }
  }
  return out;
}

// The report's English sources translate through the i18n catalog (modules/i18n/messages, scripts/lib/i18n.mjs).
const OUTCOME = { done: 'done', partial: 'partially done', failed: 'failed', ask: 'asked you', blocked: 'blocked' };
const outcomeText = (outcome, tr) => tr(OUTCOME[outcome] ?? outcome);

/** One held settle as a report line: "done, waiting on <peer workflow>/<job>" and how long. */
export function holdLine(h, { now = Date.now(), language = ownerLanguage() } = {}) {
  const tr = translator(language);
  const on = h.heldBecause === 'peer-wait'
    ? `${h.peer ? h.peerName ?? displayName(h.peer, null, tr) : tr('another workflow')}${h.peerJob ? `/${h.peerJob}` : ''}`
    : tr('you');
  return tr('⏸ {op} ({jobId}): {outcome}, waiting on {on} ({incident}) — for {ago}', {
    op: esc(legLabel(h.op, language)), jobId: esc(h.jobId), outcome: esc(outcomeText(h.outcome, tr)), on: esc(on), incident: esc(h.incident), ago: esc(dur(now - h.since, tr)) })
    + (h.workerReleased ? tr(', worker released') : '');
}

/** One readable section for one workflow (HTML). */
export function workflowSection(r, { now = Date.now(), language = ownerLanguage() } = {}) {
  const tr = translator(language);
  const line = [];
  line.push(tr('<b>▶ {name}</b> — {done}/{total} legs done', { name: esc(r.name), done: r.done, total: r.total }));
  if (r.goal) line.push(tr('Goal: {goal}', { goal: esc(r.goal) }));
  const doneLegs = r.legs.filter((l) => l.state === 'done' && !l.rework).map((l) => legLabel(l.op, language));
  const active = r.legs.filter((l) => l.state === 'running' || l.rework);
  const queued = r.legs.filter((l) => l.state === 'queued').map((l) => legLabel(l.op, language));
  const failed = r.legs.filter((l) => l.state === 'failed').map((l) => legLabel(l.op, language));
  const todo = r.legs.filter((l) => l.state === 'todo').map((l) => legLabel(l.op, language));
  if (doneLegs.length) line.push(tr('✅ Done: {legs}', { legs: esc(doneLegs.join(', ')) }));
  for (const l of active) line.push(`${tr('🔄 In progress: <b>{op}</b>', { op: esc(legLabel(l.op, language)) })}${l.rework ? tr(' (rework)') : ''}${l.count > 1 ? tr(' — {count} ops in parallel', { count: l.count }) : ''}${l.since ? tr(', running for {ago}', { ago: esc(dur(now - l.since, tr)) }) : ''}`);
  if (queued.length) line.push(tr('⏳ Waiting its turn: {legs}', { legs: esc(queued.join(', ')) }));
  if (failed.length) line.push(tr('⚠️ The last run failed; the kernel will retry: {legs}', { legs: esc(failed.join(', ')) }));
  if (todo.length) line.push(tr('⬜ Remaining: {legs}', { legs: esc(todo.join(' → ')) }));
  if (r.lastReport) line.push(tr('📝 Latest report ({op}, {outcome}, {at}): {summary}', { op: esc(legLabel(r.lastReport.op, language)), outcome: esc(outcomeText(r.lastReport.outcome, tr)), at: esc(clock(r.lastReport.at)), summary: esc(r.lastReport.summary) }));
  for (const a of r.asks.filter((ask) => ask.askClass !== 'credential')) line.push(`${tr('❓ Waiting on your answer ({op}): {text}', { op: esc(legLabel(a.op, language)), text: esc(a.text) })}${a.link ? `\n   ${esc(a.link)}` : `\n   ${tr('(press /asks for an answer link)')}`}`);
  for (const h of r.holds ?? []) line.push(holdLine(h, { now, language }));
  for (const g of r.ownerGates) line.push(tr('🔒 Waiting on you: {gate}', { gate: esc(g) }));
  for (const b of r.blocking ?? []) line.push(`${tr('⛓ Blocking other workflows: <b>{op}</b> ({jobId}) — {count} workflow(s) waiting ({workflows}), for {ago}', { op: esc(legLabel(b.op, language)), jobId: esc(b.jobId), count: b.workflows.length, workflows: esc(b.workflows.join(', ')), ago: esc(dur(now - b.since, tr)) })}${b.status === 'queued' ? tr(', not yet dispatched') : ''}`);
  if (r.runtime.length) line.push(tr('🐞 Open runtime defects: {count} (the supervisor is on them)', { count: r.runtime.length }));
  line.push(r.etaAt == null
    ? tr('🕒 ETA: cannot estimate yet (no leg done)')
    : r.etaMs <= 0 ? tr('🕒 All legs done, waiting for handover')
    : tr('🕒 ETA: ~{dur} more (around {etaAt}), at the pace since it started ({startedAt})', { dur: esc(dur(r.etaMs, tr)), etaAt: esc(clock(r.etaAt)), startedAt: esc(clock(r.startedAt)) }));
  return line.join('\n');
}

/** The report as Telegram messages (HTML), split under the message size limit. */
export function progressMessages(rows, { now = Date.now(), language = ownerLanguage() } = {}) {
  const tr = translator(language);
  const ok = rows.filter((r) => !r.error);
  const creds = ok.reduce((n, r) => n + r.asks.filter((a) => a.askClass === 'credential').length, 0);
  const asks = ok.reduce((n, r) => n + r.asks.length, 0) - creds;
  const runtime = ok.reduce((n, r) => n + r.runtime.length, 0);
  const etas = ok.map((r) => r.etaAt).filter((x) => x != null);
  const header = [
    tr('<b>[StarCi] Progress report at {now}</b>', { now: esc(clock(now)) }),
    tr('{running} workflow(s) running · {done}/{total} legs done', { running: ok.length, done: ok.reduce((n, r) => n + r.done, 0), total: ok.reduce((n, r) => n + r.total, 0) }),
    asks ? tr('❓ {count} question(s) waiting on you (/asks sends each with a link button)', { count: asks }) : tr('❓ No questions waiting on you'),
    ...(creds ? [tr('🔑 {count} credential request(s) waiting, not blocking the main work: /creds', { count: creds })] : []),
    tr('🐞 {count} open runtime defect(s)', { count: runtime }),
    ...(ok.some((r) => r.holds?.length) ? [tr('⏸ {count} done job(s) waiting on another workflow or on you before settling (see ⏸ per workflow)', { count: ok.reduce((n, r) => n + (r.holds?.length ?? 0), 0) })] : []),
    etas.length ? tr('🕒 All done by: around {eta}', { eta: esc(clock(Math.max(...etas))) }) : '',
    ...rows.filter((r) => r.error).map((r) => tr('⚠️ Cannot read ledger {repo}: {error}', { repo: esc(r.repo), error: esc(r.error) })),
  ].filter(Boolean).join('\n');
  const messages = [];
  let current = header;
  for (const r of ok) {
    const section = workflowSection(r, { now, language });
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
  // One model-scorecard line (pool shares/pass rates) over the same repos, last 24h; a failure adds nothing.
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

if (isMain(import.meta.url)) main();
