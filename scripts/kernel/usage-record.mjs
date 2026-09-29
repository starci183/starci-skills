#!/usr/bin/env node
// usage-record.mjs — measured token usage of every op attempt, every Kernel seat and the Supervisor seat.
//
// The numbers come from the agent CLI's own session file (scripts/lib/llm-usage.mjs holds one extractor per adapter:
// Claude Code JSONL, Codex rollout JSONL, Qwen chat JSONL); an agent without an adapter is 'unavailable', never a guess.
// A session file is found by CONTENT, the way scripts/kernel/op-session.mjs attributes a session to its job: the first
// user message of an op worker names its dispatch id, task id and job id (the Orca worker preamble + the op prompt); a
// Kernel session opens with `You are [Kernel] <workflow>`, the Supervisor's with `You are the [Supervisor]`. Both the
// live session homes and the session archive root (settle moves a finished op's file there) are searched.
//
//   op attempt   one llm_usage row per model + op_attempts.tokens_in/out/cost_usd/usage_source, written once when the
//                attempt is settled (settle-tail, before its session file moves) or by the periodic sweep.
//   Kernel seat  llm_usage 'kernel-turn' rows in the workflow's ledger, incremental: turn_ref
//                `kernel:<workflow>:<session>@<turns so far>`; a run writes only what the session added over the rows
//                already recorded for that session, so a re-run never double counts.
//   Supervisor   machine.sqlite llm_usage 'supervisor-turn' rows, same increments (`supervisor:<session>@<turns>`).
//
//   node scripts/kernel/usage-record.mjs sweep [--lookback-ms <ms>] [--dry-run] [--json]
//     one pass over every registered ledger and the Supervisor; the Host controller runs it every 5 minutes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractUsage, costOfRow, loadPrices, sumRows, promptTokens, deltaRows, USAGE_AGENTS, USAGE_SOURCE, USAGE_UNAVAILABLE } from '../lib/llm-usage.mjs';
import { sessionHomes, sessionAgentOf, DEFAULT_SESSION_ARCHIVE_ROOT } from './op-session.mjs';

export const SESSION_HEAD_BYTES = 256 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_LOOKBACK_MS = 3 * DAY_MS;
/** A session file is created a little before its op's dispatch row lands (the terminal launches first). */
export const SESSION_LEAD_MS = 30 * 60 * 1000;

const JOB_ID = /\bop-[a-z0-9.]+(?:-[a-z0-9.]+)*-[0-9a-f]{10}\b/;
const message = (e) => String(e?.message ?? e);

/* --------------------------------------------------------------------------------------------------- session index */

const readHead = (file, bytes = SESSION_HEAD_BYTES) => {
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.toString('utf8', 0, n);
  } catch { return ''; } finally { if (fd !== null) try { fs.closeSync(fd); } catch { /* closed */ } }
};
const tryParse = (line) => { try { return JSON.parse(line); } catch { return null; } };
const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n') : '');

/** {startMs, firstUser} of a session file's head: the first timestamp and the first real user message text. */
export function readSessionHead(agent, head) {
  let startMs = null, firstUser = null;
  const lines = head.split('\n');
  lines.pop(); // the last line of a bounded read may be cut
  for (const line of lines) {
    if (!line.trim()) continue;
    const o = tryParse(line);
    if (!o) continue;
    const stamp = Date.parse(o.timestamp ?? o.payload?.timestamp ?? '');
    if (startMs === null && Number.isFinite(stamp)) startMs = stamp;
    if (firstUser !== null) { if (startMs !== null) break; continue; }
    if (agent === 'claude' && o.type === 'user' && !o.isMeta) firstUser = textOf(o.message?.content);
    else if (agent === 'codex' && o.type === 'response_item' && o.payload?.role === 'user') {
      const t = textOf(o.payload.content);
      if (!t.trimStart().startsWith('<environment_context>')) firstUser = t;
    } else if (agent === 'qwen' && o.type === 'user') firstUser = textOf(o.message?.parts);
  }
  return { startMs, firstUser };
}

/** What a session is: {role:'kernel', workflowId} | {role:'supervisor'} | {role:'op', dispatchId, taskId, jobId} | {role:'other'}. */
export function classifySession(firstUser) {
  const text = String(firstUser ?? '');
  const top = text.slice(0, 800);
  const kernel = /You are \[Kernel\]\s+(wf-[A-Za-z0-9_-]+)/.exec(top);
  if (kernel) return { role: 'kernel', workflowId: kernel[1] };
  if (/You are the \[Supervisor\]/.test(top)) return { role: 'supervisor' };
  const dispatchId = /--dispatch-id (ctx_[0-9a-f]+)/.exec(text)?.[1] ?? /\bctx_[0-9a-f]{12}\b/.exec(text)?.[0] ?? null;
  const taskId = /Your task ID is: (task_[0-9a-f]+)/.exec(text)?.[1] ?? null;
  const jobId = JOB_ID.exec(text)?.[0] ?? null;
  return dispatchId || taskId || jobId ? { role: 'op', dispatchId, taskId, jobId } : { role: 'other' };
}

const jsonlIn = (dir, sinceMs, out, where, agent, depth = 0) => {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of names) {
    const file = path.join(dir, d.name);
    if (d.isDirectory()) { if (depth < 4 && d.name !== 'subagents') jsonlIn(file, sinceMs, out, where, agent, depth + 1); continue; }
    if (!d.name.endsWith('.jsonl')) continue;
    let stat = null;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.isFile() && stat.mtimeMs >= sinceMs) out.push({ file, agent, where, mtimeMs: stat.mtimeMs, size: stat.size });
  }
};

/** Every session file of `agents` touched since `sinceMs`: the live session homes plus the archive root. */
export function listSessionFiles({ agents = USAGE_AGENTS, sinceMs, env = process.env, home = os.homedir(), archiveRoot = null } = {}) {
  const homes = sessionHomes({ env, home });
  const out = [];
  const root = archiveRoot ?? env.STARCI_SESSION_ARCHIVE_ROOT ?? DEFAULT_SESSION_ARCHIVE_ROOT;
  if (!homes.skipped) {
    if (agents.includes('claude')) {
      let dirs = [];
      try { dirs = fs.readdirSync(path.join(homes.claude, 'projects'), { withFileTypes: true }); } catch { dirs = []; }
      for (const d of dirs) if (d.isDirectory()) jsonlIn(path.join(homes.claude, 'projects', d.name), sinceMs, out, 'live', 'claude', 3);
    }
    if (agents.includes('codex')) for (const h of homes.codex) {
      const base = path.join(h, 'sessions');
      const first = new Date(sinceMs - DAY_MS);
      for (let t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()); t <= Date.now() + DAY_MS; t += DAY_MS) {
        const d = new Date(t);
        jsonlIn(path.join(base, String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0')), sinceMs, out, 'live', 'codex', 4);
      }
    }
    if (agents.includes('qwen')) jsonlIn(path.join(homes.qwen, 'projects'), sinceMs, out, 'live', 'qwen');
  }
  for (const agent of agents) {
    const dir = path.join(root, agent);
    if (agent === 'claude') jsonlIn(dir, sinceMs, out, 'archive', agent, 3);
    else jsonlIn(dir, sinceMs, out, 'archive', agent);
  }
  const seen = new Set();
  return out.filter((f) => { const k = path.resolve(f.file).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** listSessionFiles with each file's head classified: [{file, agent, where, startMs, ...classification}]. */
export function indexSessions(options = {}) {
  return listSessionFiles(options).map((f) => {
    const { startMs, firstUser } = readSessionHead(f.agent, readHead(f.file));
    return { ...f, startMs: startMs ?? f.mtimeMs, ...classifySession(firstUser) };
  });
}

/* ------------------------------------------------------------------------------------------------- op attempts */

/** The agent adapter of an attempt row (op_attempts.agent is a legacy column; provider carries the family). */
export const attemptAgent = (a) => sessionAgentOf({ agent: a?.agent, provider: a?.provider, model: a?.model });

/**
 * The session entries of one attempt: the entry naming its dispatch id or task id (exact); failing that, the entries
 * naming its job id when the job has ONE attempt (a retried job's sessions are told apart by dispatch id only).
 */
export function entriesOfAttempt(index, attempt, { attemptsOfJob = 1 } = {}) {
  const agent = attemptAgent(attempt);
  const ops = index.filter((e) => e.role === 'op' && e.agent === agent);
  const exact = ops.filter((e) => (e.dispatchId && e.dispatchId === attempt.dispatch_id) || (e.taskId && attempt.task_id && e.taskId === attempt.task_id));
  if (exact.length) return exact;
  if (attemptsOfJob === 1 && attempt.job_id) return ops.filter((e) => e.jobId === attempt.job_id);
  return [];
}

const mergeRows = (lists) => {
  const by = new Map();
  for (const row of lists.flat()) {
    const cur = by.get(row.model);
    if (!cur) { by.set(row.model, { ...row }); continue; }
    for (const k of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'turns', 'toolCalls']) cur[k] += row[k] ?? 0;
    for (const k of ['reasoningTokens', 'toolErrors']) cur[k] = cur[k] === null && row[k] === null ? null : (cur[k] ?? 0) + (row[k] ?? 0);
  }
  return [...by.values()];
};

/**
 * The usage plan of one attempt: {attemptId, agent, ok:true, source, rows (priced), files} or {ok:false, source:'unavailable',
 * reason}. Pure over the index; nothing is written.
 */
export function planAttemptUsage(attempt, entries, { prices = loadPrices(), extract = extractUsage } = {}) {
  const agent = attemptAgent(attempt);
  const base = { attemptId: attempt.attempt_id, workflowId: attempt.workflow_id, opId: attempt.op_id, agent, provider: attempt.provider ?? agent, endedAt: attempt.settled_at ?? attempt.dispatched_at ?? null };
  if (!agent || !USAGE_AGENTS.includes(agent)) return { ...base, ok: false, source: USAGE_UNAVAILABLE, definitive: true, ...extract(agent, null) };
  if (!entries.length) return { ...base, ok: false, source: USAGE_UNAVAILABLE, reason: 'no session file names this attempt (not found live or in the archive)' };
  const got = entries.map((e) => extract(agent, e.file));
  const ok = got.filter((g) => g.ok);
  if (!ok.length) return { ...base, ok: false, source: USAGE_UNAVAILABLE, reason: got[0]?.reason ?? 'session file holds no usage record' };
  const rows = mergeRows(ok.map((g) => g.models)).map((r) => ({ ...r, costUsd: costOfRow(r, prices) }));
  return { ...base, ok: true, source: USAGE_SOURCE, rows, files: ok.map((g) => g.file) };
}

/** How long after an attempt ended a missing session file stays 'not found yet' (the file may still be archived) before it is recorded unavailable. */
export const UNAVAILABLE_GRACE_MS = 30 * 60 * 1000;

/**
 * Write one plan through the ledger's typed writers (idempotent). An ok plan records the measured usage; a plan that cannot be
 * measured records usage_source 'unavailable' with its reason - at once when the agent has no adapter, else once the attempt has
 * been over for UNAVAILABLE_GRACE_MS (until then it stays undecided and the sweep looks again).
 */
export function applyAttemptUsage(ledger, plan, { at = Date.now() } = {}) {
  if (!plan.ok) {
    const settled = plan.endedAt != null && at - plan.endedAt > UNAVAILABLE_GRACE_MS;
    if (!plan.definitive && !settled) return { recorded: false, reason: plan.reason, pending: true };
    return { recorded: false, reason: plan.reason, ...ledger.write.markAttemptUsageUnavailable({ attemptId: plan.attemptId, reason: plan.reason, at }) };
  }
  return ledger.write.recordAttemptUsage({ attemptId: plan.attemptId, rows: plan.rows, source: plan.source, provider: plan.provider, at });
}

/** Settled attempts with no usage yet since `sinceMs`, each with the number of attempts its job has. */
export function attemptsMissingUsage(db, { sinceMs = 0 } = {}) {
  return db.prepare(`SELECT a.*, (SELECT count(*) FROM op_attempts b WHERE b.job_id=a.job_id) AS attempts_of_job
    FROM op_attempts a
    WHERE (a.settled_at IS NOT NULL OR a.end_state IS NOT NULL) AND a.dispatched_at >= ?
      AND NOT EXISTS (SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)
      AND NOT (COALESCE(a.usage_source,'')='unavailable' AND COALESCE(a.usage_reason,'') LIKE 'no usage adapter%')
    ORDER BY a.attempt_id`).all(sinceMs);
}

/**
 * The settle hook: usage of the one attempt of a just-settled job, taken from its attributed session files BEFORE they
 * are archived. `files` are the files op-session.mjs releaseSettledSession attributed. Never throws.
 * Returns {recorded, reason?}.
 */
export function recordSettledAttemptUsage(ledger, { jobId, agent, files, extract = extractUsage }) {
  try {
    if (!files?.length) return { recorded: false, reason: 'no attributed session file' };
    const attempt = ledger.db.prepare('SELECT * FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
    if (!attempt) return { recorded: false, reason: 'no attempt row' };
    const withAgent = { ...attempt, agent: agent ?? attempt.agent };
    const family = attemptAgent(withAgent);
    // The files were attributed by job id; a retried job has several attempts, so keep the ones this attempt's own dispatch names.
    const index = files.map((file) => {
      const { firstUser } = readSessionHead(family, readHead(file));
      const text = String(firstUser ?? '');
      // op-session.mjs attributed these files by job id, so the head names the job (or this attempt's own dispatch/task id) by content.
      return { file, agent: family, ...classifySession(firstUser), role: 'op',
        jobId: text.includes(jobId) ? jobId : null,
        dispatchId: attempt.dispatch_id && text.includes(attempt.dispatch_id) ? attempt.dispatch_id : null,
        taskId: attempt.task_id && text.includes(attempt.task_id) ? attempt.task_id : null };
    });
    const attemptsOfJob = ledger.db.prepare('SELECT count(*) n FROM op_attempts WHERE job_id=?').get(jobId).n;
    return applyAttemptUsage(ledger, planAttemptUsage(withAgent, entriesOfAttempt(index, withAgent, { attemptsOfJob }), { extract }));
  } catch (error) { return { recorded: false, reason: message(error).slice(0, 200) }; }
}

/* ---------------------------------------------------------------------------------------------- Kernel + Supervisor */

const USAGE_SUMS = `response_model AS model, sum(input_tokens) AS inputTokens, sum(output_tokens) AS outputTokens,
  sum(cache_read_tokens) AS cacheReadTokens, sum(cache_write_tokens) AS cacheWriteTokens, sum(reasoning_tokens) AS reasoningTokens,
  sum(turns) AS turns, sum(tool_calls) AS toolCalls, sum(tool_errors) AS toolErrors`;

/** The rows already recorded for one session (`prefix` = '<seat>:<session>@'), summed per model. */
export function recordedSession(db, { subjectType, prefix, workflowId = null }) {
  const sql = `SELECT ${USAGE_SUMS} FROM llm_usage WHERE subject_type=? ${workflowId === null ? '' : 'AND workflow_id=?'} AND substr(turn_ref,1,length(?))=? GROUP BY response_model`;
  const args = workflowId === null ? [subjectType, prefix, prefix] : [subjectType, workflowId, prefix, prefix];
  return db.prepare(sql).all(...args).map((r) => ({ ...r }));
}

/**
 * What a Kernel/Supervisor session added since the rows already recorded: {ok, turnRef, rows} (rows priced deltas) or
 * {ok:false, reason} / {ok:true, rows:[]} when nothing is new. `db` is the ledger (kernel) or machine (supervisor) database.
 */
export function planSeatUsage(db, { role, workflowId = null, entry, prices = loadPrices(), extract = extractUsage }) {
  const got = extract(entry.agent, entry.file);
  if (!got.ok) return { ok: false, source: USAGE_UNAVAILABLE, reason: got.reason, file: entry.file };
  const session = got.sessionId ?? path.basename(entry.file, '.jsonl');
  const seat = role === 'kernel' ? `kernel:${workflowId}` : 'supervisor';
  const prefix = `${seat}:${session}@`;
  const recorded = recordedSession(db, { subjectType: role === 'kernel' ? 'kernel-turn' : 'supervisor-turn', prefix, workflowId: role === 'kernel' ? workflowId : null });
  const rows = deltaRows(got.models, recorded).map((r) => ({ ...r, costUsd: costOfRow(r, prices) }));
  return { ok: true, source: USAGE_SOURCE, agent: entry.agent, session, file: entry.file, turnRef: `${prefix}${got.turns}`, rows, totalTurns: got.turns };
}

/* ------------------------------------------------------------------------------------------------------- sweep */

/**
 * One pass: settled attempts without usage (every registered ledger), every Kernel session (its workflow's ledger) and the
 * Supervisor sessions (machine.sqlite). `dryRun` reads and reports, writes nothing. Returns a summary.
 */
export async function sweepUsage({ env = process.env, home = os.homedir(), now = Date.now(), lookbackMs = DEFAULT_LOOKBACK_MS, dryRun = false, archiveRoot = null, ledgerName = null, detail = false, ledgerFiles = null } = {}) {
  const [{ openMachineReader, withMachine, recordLlmUsage }, { openLedger, openLedgerReader }] = await Promise.all([
    import('../../engine/machine-db.mjs'), import('../../engine/ledger-db.mjs'),
  ]);
  const since = now - lookbackMs;
  const out = { ok: true, dryRun, lookbackMs, attempts: { pending: 0, recorded: 0, unavailable: 0 }, kernels: { sessions: 0, recorded: 0, rows: 0, unmatched: 0 }, supervisor: { sessions: 0, recorded: 0, rows: 0 }, errors: [], unavailable: [], ...(detail ? { detail: { attempts: [], kernels: [], supervisor: [] } } : {}) };
  let ledgers = [];
  const reader = ledgerFiles ? null : openMachineReader({ env });
  if (!reader && !ledgerFiles) return { ...out, ok: false, errors: ['machine.sqlite not found'] };
  if (ledgerFiles) ledgers = ledgerFiles;   // explicit [{name, file}] (a copy of a ledger, a spec): the registry is not consulted
  else try { ledgers = reader.listLedgers().filter((l) => l.file && fs.existsSync(l.file) && (!ledgerName || l.name === ledgerName)); } finally { reader.close(); }

  const perLedger = [];
  for (const l of ledgers) {
    let db = null;
    try {
      db = openLedgerReader(l.file);
      const pending = attemptsMissingUsage(db, { sinceMs: since });
      const workflows = new Set(db.prepare('SELECT workflow_id FROM workflows').all().map((r) => r.workflow_id));
      perLedger.push({ ledger: l, pending, workflows });
    } catch (error) { out.errors.push(`${l.name}: ${message(error).slice(0, 160)}`); } finally { try { db?.close(); } catch { /* closed */ } }
  }
  const wantedAgents = new Set(['claude', 'codex', 'qwen']);
  const index = indexSessions({ agents: [...wantedAgents], sinceMs: Math.min(since, ...perLedger.flatMap((p) => p.pending.map((a) => (a.dispatched_at ?? since) - SESSION_LEAD_MS)).concat(since)), env, home, archiveRoot });

  for (const { ledger: l, pending, workflows } of perLedger) {
    out.attempts.pending += pending.length;
    const kernelEntries = index.filter((e) => e.role === 'kernel' && workflows.has(e.workflowId));
    let handle = null;
    try {
      const plans = pending.map((a) => planAttemptUsage(a, entriesOfAttempt(index, a, { attemptsOfJob: a.attempts_of_job })));
      const seatPlans = [];
      if (kernelEntries.length) {
        const dbr = openLedgerReader(l.file);
        try { for (const e of kernelEntries) seatPlans.push({ e, plan: planSeatUsage(dbr, { role: 'kernel', workflowId: e.workflowId, entry: e }) }); } finally { dbr.close(); }
      }
      out.kernels.sessions += kernelEntries.length;
      if (detail) for (const p of plans) out.detail.attempts.push({ ledger: l.name, ...p });
      if (detail) for (const s of seatPlans) out.detail.kernels.push({ ledger: l.name, workflowId: s.e.workflowId, ...s.plan });
      for (const p of plans) if (!p.ok) { out.attempts.unavailable += 1; if (out.unavailable.length < 50) out.unavailable.push({ ledger: l.name, attemptId: p.attemptId, agent: p.agent, reason: p.reason }); }
      const work = plans;   // every plan is applied: ok = measured, not ok = unavailable once decided (applyAttemptUsage)
      const seatWork = seatPlans.filter((s) => s.plan.ok && s.plan.rows.length);
      if (dryRun) { out.attempts.recorded += work.filter((p) => p.ok).length; out.kernels.recorded += seatWork.length; out.kernels.rows += seatWork.reduce((n, s) => n + s.plan.rows.length, 0); continue; }
      if (!work.length && !seatWork.length) continue;
      handle = openLedger({ file: l.file, repoRoot: l.repoRoot ?? null });
      for (const p of work) { try { if (applyAttemptUsage(handle, p, { at: now }).recorded) out.attempts.recorded += 1; } catch (error) { out.errors.push(`${l.name} attempt ${p.attemptId}: ${message(error).slice(0, 160)}`); } }
      for (const { e, plan } of seatWork) {
        try {
          const r = handle.write.recordKernelUsage({ workflowId: e.workflowId, turnRef: plan.turnRef, rows: plan.rows, provider: e.agent, at: now });
          if (r.recorded) { out.kernels.recorded += 1; out.kernels.rows += r.rows; }
        } catch (error) { out.errors.push(`${l.name} kernel ${e.workflowId}: ${message(error).slice(0, 160)}`); }
      }
    } catch (error) { out.errors.push(`${l.name}: ${message(error).slice(0, 160)}`); } finally { try { handle?.close(); } catch { /* closed */ } }
  }
  const known = new Set(perLedger.flatMap((p) => [...p.workflows]));
  out.kernels.unmatched = index.filter((e) => e.role === 'kernel' && !known.has(e.workflowId)).length;

  const supervisors = index.filter((e) => e.role === 'supervisor');
  out.supervisor.sessions = supervisors.length;
  if (supervisors.length && !ledgerName) {
    const run = (m) => {
      for (const e of supervisors) {
        try {
          const plan = planSeatUsage(m.db, { role: 'supervisor', entry: e });
          if (!plan.ok || !plan.rows.length) continue;
          if (detail) out.detail.supervisor.push({ ...plan });
          out.supervisor.recorded += 1;
          out.supervisor.rows += plan.rows.length;
          if (dryRun) continue;
          m.transaction(() => { for (const r of plan.rows) recordLlmUsage(m, { subjectType: 'supervisor-turn', turnRef: plan.turnRef, provider: e.agent, responseModel: r.model, source: plan.source, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens, cacheWriteTokens: r.cacheWriteTokens, reasoningTokens: r.reasoningTokens, costUsd: r.costUsd, turns: r.turns, toolCalls: r.toolCalls, toolErrors: r.toolErrors }); });
        } catch (error) { out.errors.push(`supervisor ${path.basename(e.file)}: ${message(error).slice(0, 160)}`); }
      }
    };
    try {
      if (dryRun) { const m = openMachineReader({ env }); try { run(m); } finally { m?.close(); } } else withMachine(run, { env });
    } catch (error) { out.errors.push(`supervisor: ${message(error).slice(0, 160)}`); }
  }
  out.ok = out.errors.length === 0;
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] !== 'sweep') {
    console.error('usage: node scripts/kernel/usage-record.mjs sweep [--lookback-ms <ms>] [--dry-run] [--json]');
    process.exit(2);
  }
  const r = await sweepUsage({ lookbackMs: Number(arg('lookback-ms') ?? DEFAULT_LOOKBACK_MS), dryRun: argv.includes('--dry-run') });
  console.log(argv.includes('--json') ? JSON.stringify(r)
    : `usage ${r.dryRun ? '(dry run) ' : ''}attempts ${r.attempts.recorded}/${r.attempts.pending} recorded (${r.attempts.unavailable} unavailable), kernels ${r.kernels.recorded} of ${r.kernels.sessions} sessions, supervisor ${r.supervisor.recorded} of ${r.supervisor.sessions}${r.errors.length ? `, ${r.errors.length} error(s)` : ''}`);
  process.exit(r.ok ? 0 : 1);
}

export { sumRows, promptTokens };
