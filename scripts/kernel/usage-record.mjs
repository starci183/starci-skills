#!/usr/bin/env node
// usage-record.mjs — measured token usage of every op attempt, every Kernel seat and the Supervisor seat.
//
// The numbers come from the agent CLI's own session file (scripts/lib/llm-usage.mjs holds one extractor per adapter:
// Claude Code JSONL, Codex rollout JSONL); an agent without an adapter is 'unavailable', never a guess.
// A session file is found by CONTENT, the way scripts/kernel/op-session.mjs attributes a session to its job: the first
// user message of an op worker names its dispatch id, task id and job id (the Orca worker preamble + the op prompt); a
// Kernel session's task opens with `You are [Kernel] <workflow>`, the Supervisor's with `You are the [Supervisor]` or `[Supervisor] <name>`; both
// follow Orca's worker preamble (the `=== TASK ===` marker), never the start of the message. Both the
// live session homes and the session archive root (settle moves a finished op's file there) are searched.
//
//   op attempt   one llm_usage row per model + op_attempts.tokens_in/out/cost_usd/usage_source, written once when the
//                attempt is settled (settle-tail, before its session file moves) or by the periodic sweep.
//   Kernel seat  llm_usage 'kernel-turn' rows in the workflow's ledger, incremental: turn_ref
//                `kernel:<workflow>:<session>@<turns so far>#w<wake seq>`; a run writes only what the session added over the rows
//                already recorded for that session, so a re-run never double counts. The session is cut at the seat's wake events
//                (kernel-woken) by the timestamps of its usage records, and the rows of each cut carry the wake that owns them.
//   Supervisor   machine.sqlite llm_usage 'supervisor-turn' rows, same increments and cuts at its supervisor-wake events
//                (`supervisor:<session>@<turns>#w<wake seq>`).
//
// Internal entry: spawned by scripts/kernel/cli.mjs; not invoked directly.
// Args: sweep [--lookback-ms <ms>] [--dry-run] [--json].
//     one pass over every registered ledger and the Supervisor; the Host controller runs it every 5 minutes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { extractUsage, costOfRow, loadPrices, deltaRows, USAGE_AGENTS, USAGE_SOURCE, USAGE_UNAVAILABLE } from '../lib/llm-usage.mjs';
import { sessionHomes } from './op-session.mjs';
import { agentOfJob } from '../lib/job-agent.mjs';
import { archiveRoot as archiveRootOf } from '../machine/home.mjs';
import { kernelWakesOf, supervisorWakesOf, wakeTag } from './wake-budget.mjs';

const SESSION_HEAD_BYTES = 256 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 3 * DAY_MS;
/** A session file is created a little before its op's dispatch row lands (the terminal launches first). */
export const SESSION_LEAD_MS = 30 * 60 * 1000;

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
const textOf = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n');
};

const timestampOf = (entry) => {
  const stamp = Date.parse(entry.timestamp ?? entry.payload?.timestamp ?? '');
  return Number.isFinite(stamp) ? stamp : null;
};
const firstUserOf = (agent, entry) => {
  if (agent === 'claude' && entry.type === 'user' && !entry.isMeta) return textOf(entry.message?.content);
  if (agent === 'codex' && entry.type === 'response_item' && entry.payload?.role === 'user') {
    const text = textOf(entry.payload.content);
    return text.trimStart().startsWith('<environment_context>') ? null : text;
  }
  return null;
};

/** {startMs, firstUser} of a session file's head: the first timestamp and the first real user message text. */
function readSessionHead(agent, head) {
  let startMs = null, firstUser = null;
  const lines = head.split('\n');
  lines.pop(); // the last line of a bounded read may be cut
  for (const line of lines) {
    if (!line.trim()) continue;
    const o = tryParse(line);
    if (!o) continue;
    const stamp = timestampOf(o);
    if (startMs === null && stamp !== null) startMs = stamp;
    if (firstUser === null) firstUser = firstUserOf(agent, o);
    if (firstUser !== null && startMs !== null) break;
  }
  return { startMs, firstUser };
}

const TASK_MARKER = '=== TASK ===';
/** The seat prompt of a first user message: Orca prefixes every dispatched worker with its ~6 KB preamble and the prompt follows the TASK marker. */
const taskBodyOf = (text) => {
  const at = text.indexOf(TASK_MARKER);
  return at < 0 ? text : text.slice(at + TASK_MARKER.length);
};

/** What a session is: {role:'kernel', workflowId} | {role:'supervisor'} | {role:'op', dispatchId, taskId} | {role:'other'}. */
function classifySession(firstUser) {
  const text = String(firstUser ?? '');
  const top = taskBodyOf(text).slice(0, 800);
  const kernel = /You are \[Kernel\]\s+(wf-[A-Za-z0-9_-]+)/.exec(top);
  if (kernel) return { role: 'kernel', workflowId: kernel[1] };
  if (/You are the \[Supervisor\]|^\s*\[Supervisor\]\s/.test(top)) return { role: 'supervisor' };
  const dispatchId = /--dispatch-id (ctx_[0-9a-f]+)/.exec(text)?.[1] ?? /\bctx_[0-9a-f]{12}\b/.exec(text)?.[0] ?? null;
  const taskId = /Your task ID is: (task_[0-9a-f]+)/.exec(text)?.[1] ?? null;
  return dispatchId || taskId ? { role: 'op', dispatchId, taskId } : { role: 'other' };
}

const jsonlIn = (dir, sinceMs, out, where, agent, depth = 0) => {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const d of names) {
    const file = path.join(dir, d.name);
    if (d.isDirectory()) { if (depth < 4 && d.name !== 'subagents') { jsonlIn(file, sinceMs, out, where, agent, depth + 1); } continue; }
    if (!d.name.endsWith('.jsonl')) continue;
    let stat = null;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.isFile() && stat.mtimeMs >= sinceMs) out.push({ file, agent, where, mtimeMs: stat.mtimeMs, size: stat.size });
  }
};

function appendClaudeLiveSessions(homes, sinceMs, out) {
  let dirs = [];
  try { dirs = fs.readdirSync(path.join(homes.claude, 'projects'), { withFileTypes: true }); } catch { dirs = []; }
  for (const d of dirs) if (d.isDirectory()) jsonlIn(path.join(homes.claude, 'projects', d.name), sinceMs, out, 'live', 'claude', 3);
}

function appendCodexLiveSessions(homes, sinceMs, out) {
  for (const h of homes.codex) {
    const base = path.join(h, 'sessions');
    const first = new Date(sinceMs - DAY_MS);
    for (let t = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()); t <= Date.now() + DAY_MS; t += DAY_MS) {
      const d = new Date(t);
      jsonlIn(path.join(base, String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')), sinceMs, out, 'live', 'codex', 4);
    }
  }
}

/** Every session file of `agents` touched since `sinceMs`: the live session homes plus the archive root. */
function listSessionFiles({ agents = USAGE_AGENTS, sinceMs, env = process.env, home = os.homedir(), archiveRoot = null } = {}) {
  const homes = sessionHomes({ env, home });
  const out = [];
  const root = archiveRoot ?? env.STARCI_SESSION_ARCHIVE_ROOT ?? archiveRootOf({ env });
  if (!homes.skipped) {
    if (agents.includes('claude')) appendClaudeLiveSessions(homes, sinceMs, out);
    if (agents.includes('codex')) appendCodexLiveSessions(homes, sinceMs, out);
  }
  for (const agent of agents) {
    const dir = path.join(root, agent);
    if (agent === 'claude') jsonlIn(dir, sinceMs, out, 'archive', agent, 3);
    else jsonlIn(dir, sinceMs, out, 'archive', agent);
  }
  return dedupeSessions(out);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** The CLI's own session id: the last UUID of the file name (`rollout-<time>-<uuid>.jsonl`, `<uuid>.jsonl`, an archive's `<slug>__<uuid>.jsonl`), else the path. */
const sessionKeyOf = (file) => (path.basename(file).match(UUID)?.pop() ?? path.resolve(file)).toLowerCase();

/**
 * One entry per session. The session archive can hold the same session under two names (a Codex rollout as `<DD>__rollout-...` and
 * `rollout-...`, a Claude file with and without its `<slug>__` prefix) and a session can sit live and archived at once; counting each
 * file would count that session twice. The live copy wins, then the larger (later) one.
 */
function dedupeSessions(files) {
  const best = new Map();
  for (const f of files) {
    const k = `${f.agent}:${sessionKeyOf(f.file)}`;
    const cur = best.get(k);
    if (!cur || (f.where === 'live') > (cur.where === 'live') || (f.where === cur.where && f.size > cur.size)) best.set(k, f);
  }
  return [...best.values()];
}

/** listSessionFiles with each file's head classified: [{file, agent, where, startMs, ...classification}]. */
export function indexSessions(options = {}) {
  return listSessionFiles(options).map((f) => {
    const { startMs, firstUser } = readSessionHead(f.agent, readHead(f.file));
    return { ...f, startMs: startMs ?? f.mtimeMs, ...classifySession(firstUser) };
  });
}

/* ------------------------------------------------------------------------------------------------- op attempts */

/** The agent adapter of an attempt row (op_attempts.agent names the adapter; provider carries the family). */
export const attemptAgent = (a) => agentOfJob({ agent: a?.agent, provider: a?.provider, model: a?.model });

/**
 * The session entries of one attempt, by EXACT id only: the entry whose first user message names this attempt's dispatch id
 * (op_attempts.dispatch_id, the Orca worker preamble's --dispatch-id) or task id. Both are unique per attempt, so a sibling that
 * shares the checkout, the job or the time window never matches; nothing is matched by cwd, time window or job id.
 */
export function entriesOfAttempt(index, attempt) {
  const agent = attemptAgent(attempt);
  return index.filter((e) => e.role === 'op' && e.agent === agent
    && ((e.dispatchId && e.dispatchId === attempt.dispatch_id) || (e.taskId && attempt.task_id && e.taskId === attempt.task_id)));
}

/** Which id linked a session to the attempt: 'dispatch-id', 'task-id' or both. */
export const matchedBy = (entry, attempt) => [entry.dispatchId && entry.dispatchId === attempt.dispatch_id ? 'dispatch-id' : null, entry.taskId && attempt.task_id && entry.taskId === attempt.task_id ? 'task-id' : null].filter(Boolean).join('+');

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
  return { ...base, ok: true, source: USAGE_SOURCE, rows, files: ok.map((g) => g.file),
    sessions: entries.filter((e) => ok.some((g) => g.file === e.file)).map((e) => ({ session: sessionKeyOf(e.file), matchedBy: matchedBy(e, attempt), where: e.where ?? null })) };
}

/** How long after an attempt ended a missing session file stays 'not found yet' (the file may still be archived) before it is recorded unavailable. */
const UNAVAILABLE_GRACE_MS = 30 * 60 * 1000;

/**
 * Write one plan through the ledger's typed writers (idempotent). An ok plan records the measured usage; a plan that cannot be
 * measured records usage_source 'unavailable' with its reason - at once when the agent has no adapter, else once the attempt has
 * been over for UNAVAILABLE_GRACE_MS (until then it stays undecided and the sweep looks again).
 */
function applyAttemptUsage(ledger, plan, { at = Date.now() } = {}) {
  if (!plan.ok) {
    const settled = plan.endedAt != null && at - plan.endedAt > UNAVAILABLE_GRACE_MS;
    if (!plan.definitive && !settled) return { recorded: false, reason: plan.reason, pending: true };
    return { recorded: false, reason: plan.reason, ...ledger.write.markAttemptUsageUnavailable({ attemptId: plan.attemptId, reason: plan.reason, at }) };
  }
  return ledger.write.recordAttemptUsage({ attemptId: plan.attemptId, rows: plan.rows, source: plan.source, provider: plan.provider, sessions: plan.sessions, at });
}

const MISSING_ATTEMPT_USAGE = `FROM op_attempts a JOIN workflows w ON w.workflow_id=a.workflow_id
    WHERE (a.settled_at IS NOT NULL OR a.end_state IS NOT NULL) AND a.dispatched_at >= ?
      AND NOT EXISTS (SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)
      AND NOT (COALESCE(a.usage_source,'')='unavailable' AND COALESCE(a.usage_reason,'') LIKE 'no usage adapter%')`;
const ARCHIVED_WORKFLOW = `(w.archived_at IS NOT NULL OR w.phase='archived')`;
const archivedRefusal = (error) => message(error).includes('workflow-archived: no further writes');

/** Settled attempts with no usage yet in workflows that still accept usage writes. */
function attemptsMissingUsage(db, { sinceMs = 0 } = {}) {
  return db.prepare(`SELECT a.* ${MISSING_ATTEMPT_USAGE} AND NOT ${ARCHIVED_WORKFLOW} ORDER BY a.attempt_id`).all(sinceMs);
}

const archivedAttemptsMissingUsage = (db, sinceMs) => db.prepare(`SELECT count(*) AS n ${MISSING_ATTEMPT_USAGE} AND ${ARCHIVED_WORKFLOW}`).get(sinceMs).n;

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
    // op-session.mjs attributed these files by job id; a retried job has several attempts, so only a file whose first message names THIS attempt's dispatch/task id counts.
    const index = dedupeSessions(files.map((file) => {
      const text = String(readSessionHead(family, readHead(file)).firstUser ?? '');
      return { file, agent: family, where: 'live', size: fs.statSync(file).size, role: 'op',
        dispatchId: attempt.dispatch_id && text.includes(attempt.dispatch_id) ? attempt.dispatch_id : null,
        taskId: attempt.task_id && text.includes(attempt.task_id) ? attempt.task_id : null };
    }));
    return applyAttemptUsage(ledger, planAttemptUsage(withAgent, entriesOfAttempt(index, withAgent), { extract }));
  } catch (error) { return { recorded: false, reason: message(error).slice(0, 200) }; }
}

/* ---------------------------------------------------------------------------------------------- Kernel + Supervisor */

const WAKE_TAG = "CASE WHEN instr(turn_ref,'#')>0 THEN substr(turn_ref, instr(turn_ref,'#')+1) ELSE '' END";
const USAGE_SUMS = `response_model AS model, ${WAKE_TAG} AS tag, sum(input_tokens) AS inputTokens, sum(output_tokens) AS outputTokens,
  sum(cache_read_tokens) AS cacheReadTokens, sum(cache_write_tokens) AS cacheWriteTokens, sum(reasoning_tokens) AS reasoningTokens,
  sum(turns) AS turns, sum(tool_calls) AS toolCalls, sum(tool_errors) AS toolErrors`;

/** The rows already recorded for one session (`prefix` = '<seat>:<session>@'), summed per model. */
function recordedSession(db, { subjectType, prefix, workflowId = null }) {
  const sql = `SELECT ${USAGE_SUMS} FROM llm_usage WHERE subject_type=? ${workflowId === null ? '' : 'AND workflow_id=?'} AND substr(turn_ref,1,length(?))=? GROUP BY response_model, tag`;
  const args = workflowId === null ? [subjectType, prefix, prefix] : [subjectType, workflowId, prefix, prefix];
  return db.prepare(sql).all(...args).map((r) => ({ ...r }));
}

/**
 * The rows a session added per wake: one group {turnRef, rows} for each cut of the session (bucket 0 before the first wake, bucket i
 * after wake i-1) that holds usage not yet recorded under its tag. Rows recorded before the wake tags existed (no tag) are taken off
 * the earliest buckets first, so a session recorded by an older run is never counted twice.
 */
function wakeGroups({ got, wakes, recorded, prefix, prices }) {
  const tagged = (tag) => recorded.filter((row) => row.tag === tag);
  let untagged = recorded.filter((row) => row.tag === '');
  let turns = 0;
  const groups = [];
  got.buckets.forEach((bucket, index) => {
    const tag = index === 0 ? wakeTag(0) : wakeTag(wakes[index - 1].seq);
    turns += bucket.turns;
    const own = deltaRows(bucket.models, tagged(tag));
    const fresh = deltaRows(own, untagged);
    untagged = deltaRows(untagged, own);
    if (fresh.length) groups.push({ turnRef: `${prefix}${turns}#${tag}`, rows: fresh.map((row) => ({ ...row, costUsd: costOfRow(row, prices) })) });
  });
  return groups;
}

/**
 * What a Kernel/Supervisor session added since the rows already recorded: {ok, groups, rows, turnRef} (groups per wake, rows their
 * priced deltas) or {ok:false, reason} / {ok:true, rows:[]} when nothing is new. `db` is the ledger (kernel) or machine (supervisor)
 * database; `wakes` are the seat's wake events [{seq, at}] the session is cut at.
 */
function planSeatUsage(db, { role, workflowId = null, entry, prices = loadPrices(), extract = extractUsage }) {
  const wakes = role === 'kernel' ? kernelWakesOf(db, workflowId) : supervisorWakesOf(db);
  const got = extract(entry.agent, entry.file, { cuts: wakes.map((wake) => wake.at) });
  if (!got.ok) return { ok: false, source: USAGE_UNAVAILABLE, reason: got.reason, file: entry.file };
  const session = got.sessionId ?? path.basename(entry.file, '.jsonl');
  const seat = role === 'kernel' ? `kernel:${workflowId}` : 'supervisor';
  const prefix = `${seat}:${session}@`;
  const recorded = recordedSession(db, { subjectType: role === 'kernel' ? 'kernel-turn' : 'supervisor-turn', prefix, workflowId: role === 'kernel' ? workflowId : null });
  const groups = wakeGroups({ got: { buckets: got.buckets ?? [{ models: got.models, turns: got.turns }] }, wakes, recorded, prefix, prices });
  return { ok: true, source: USAGE_SOURCE, agent: entry.agent, session, file: entry.file, groups, rows: groups.flatMap((group) => group.rows), turnRef: groups.at(-1)?.turnRef ?? `${prefix}${got.turns}`, totalTurns: got.turns };
}

/* ------------------------------------------------------------------------------------------------------- sweep */

const ledgerUsagePlan = (l, { since, out, openLedgerReader }) => {
  let db = null;
  try {
    db = openLedgerReader(l.file);
    const pending = attemptsMissingUsage(db, { sinceMs: since });
    const skippedAttempts = archivedAttemptsMissingUsage(db, since);
    const workflowRows = db.prepare('SELECT workflow_id,phase,archived_at FROM workflows').all();
    const workflows = new Set(workflowRows.map((r) => r.workflow_id));
    const writableWorkflows = new Set(workflowRows.filter((r) => r.archived_at == null && r.phase !== 'archived').map((r) => r.workflow_id));
    return { ledger: l, pending, skippedAttempts, workflows, writableWorkflows };
  } catch (error) {
    out.errors.push(`${l.name}: ${message(error).slice(0, 160)}`);
    return null;
  } finally { try { db?.close(); } catch { /* closed */ } }
};

function kernelUsagePlans(ledger, entries, openLedgerReader) {
  if (!entries.length) return [];
  const db = openLedgerReader(ledger.file);
  try { return entries.map((entry) => ({ entry, plan: planSeatUsage(db, { role: 'kernel', workflowId: entry.workflowId, entry }) })); }
  finally { db.close(); }
}

function addLedgerUsageDetails(ledger, plans, seatPlans, out, detail) {
  if (!detail) return;
  for (const plan of plans) out.detail.attempts.push({ ledger: ledger.name, ...plan });
  for (const seat of seatPlans) out.detail.kernels.push({ ledger: ledger.name, workflowId: seat.entry.workflowId, ...seat.plan });
}

function recordUnavailableAttempts(ledger, plans, out) {
  for (const plan of plans) {
    if (!plan.ok) {
      out.attempts.unavailable += 1;
      if (out.unavailable.length < 50) out.unavailable.push({ ledger: ledger.name, attemptId: plan.attemptId, agent: plan.agent, reason: plan.reason });
    }
  }
}

function countDryRunUsage(work, seatWork, out) {
  out.attempts.recorded += work.filter((plan) => plan.ok).length;
  out.kernels.recorded += seatWork.length;
  out.kernels.rows += seatWork.reduce((total, seat) => total + seat.plan.rows.length, 0);
}

function recordAttemptUsagePlans(handle, work, ledger, out, now) {
  for (const plan of work) {
    try {
      if (applyAttemptUsage(handle, plan, { at: now }).recorded) out.attempts.recorded += 1;
    } catch (error) {
      if (archivedRefusal(error)) out.attempts.skippedEnded += 1;
      else out.errors.push(`${ledger.name} attempt ${plan.attemptId}: ${message(error).slice(0, 160)}`);
    }
  }
}

function recordKernelUsagePlans(handle, seatWork, ledger, out, now) {
  for (const { entry, plan } of seatWork) {
    try {
      for (const group of plan.groups) {
        const result = handle.write.recordKernelUsage({ workflowId: entry.workflowId, turnRef: group.turnRef, rows: group.rows, provider: entry.agent, at: now });
        if (result.recorded) { out.kernels.recorded += 1; out.kernels.rows += result.rows; }
      }
    } catch (error) {
      if (archivedRefusal(error)) out.kernels.skippedEnded += 1;
      else out.errors.push(`${ledger.name} kernel ${entry.workflowId}: ${message(error).slice(0, 160)}`);
    }
  }
}

function recordLedgerUsage(plan, { index, out, detail, dryRun, now, openLedger, openLedgerReader }) {
  const { ledger: l, pending, skippedAttempts, workflows, writableWorkflows } = plan;
  out.attempts.pending += pending.length;
  out.attempts.skippedEnded += skippedAttempts;
  const kernelEntries = index.filter((e) => e.role === 'kernel' && writableWorkflows.has(e.workflowId));
  out.kernels.skippedEnded += index.filter((e) => e.role === 'kernel' && workflows.has(e.workflowId) && !writableWorkflows.has(e.workflowId)).length;
  let handle = null;
  try {
    const plans = pending.map((a) => planAttemptUsage(a, entriesOfAttempt(index, a)));
    const seatPlans = kernelUsagePlans(l, kernelEntries, openLedgerReader);
    out.kernels.sessions += kernelEntries.length;
    addLedgerUsageDetails(l, plans, seatPlans, out, detail);
    recordUnavailableAttempts(l, plans, out);
    const work = plans;
    const seatWork = seatPlans.filter((s) => s.plan.ok && s.plan.rows.length);
    if (dryRun) {
      countDryRunUsage(work, seatWork, out);
      return;
    }
    if (!work.length && !seatWork.length) return;
    handle = openLedger({ file: l.file, repoRoot: l.repoRoot ?? null });
    recordAttemptUsagePlans(handle, work, l, out, now);
    recordKernelUsagePlans(handle, seatWork, l, out, now);
  } catch (error) { out.errors.push(`${l.name}: ${message(error).slice(0, 160)}`); } finally { try { handle?.close(); } catch { /* closed */ } }
}

function recordSupervisorUsage(supervisors, { out, detail, dryRun, env, openMachineReader, withMachine, recordMachineLlmUsage }) {
  const run = (m) => {
    for (const e of supervisors) {
      try {
        const plan = planSeatUsage(m.db, { role: 'supervisor', entry: e });
        if (!plan.ok || !plan.rows.length) continue;
        if (detail) out.detail.supervisor.push({ ...plan });
        out.supervisor.recorded += 1;
        out.supervisor.rows += plan.rows.length;
        if (dryRun) continue;
        m.transaction(() => { for (const { turnRef, rows } of plan.groups) for (const r of rows) recordMachineLlmUsage(m, { subjectType: 'supervisor-turn', turnRef, provider: e.agent, responseModel: r.model, source: plan.source, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens, cacheWriteTokens: r.cacheWriteTokens, reasoningTokens: r.reasoningTokens, costUsd: r.costUsd, turns: r.turns, toolCalls: r.toolCalls, toolErrors: r.toolErrors }); });
      } catch (error) { out.errors.push(`supervisor ${path.basename(e.file)}: ${message(error).slice(0, 160)}`); }
    }
  };
  try {
    if (dryRun) { const m = openMachineReader({ env }); try { run(m); } finally { m?.close(); } } else withMachine(run, { env });
  } catch (error) { out.errors.push(`supervisor: ${message(error).slice(0, 160)}`); }
}

/**
 * One pass: settled attempts without usage (every registered ledger), every Kernel session (its workflow's ledger) and the
 * Supervisor sessions (machine.sqlite). `dryRun` reads and reports, writes nothing. Returns a summary.
 */
export async function sweepUsage({ env = process.env, home = os.homedir(), now = Date.now(), lookbackMs = DEFAULT_LOOKBACK_MS, dryRun = false, archiveRoot = null, ledgerName = null, detail = false, ledgerFiles = null } = {}) {
  const [{ openMachineReader, withMachine, recordMachineLlmUsage }, { openLedger, openLedgerReader }] = await Promise.all([
    import('../../engine/db/machine.mjs'), import('../../engine/db/ledger.mjs'),
  ]);
  const since = now - lookbackMs;
  const out = { ok: true, dryRun, lookbackMs, attempts: { pending: 0, recorded: 0, unavailable: 0, skippedEnded: 0 }, kernels: { sessions: 0, recorded: 0, rows: 0, unmatched: 0, skippedEnded: 0 }, supervisor: { sessions: 0, recorded: 0, rows: 0 }, errors: [], unavailable: [], ...(detail ? { detail: { attempts: [], kernels: [], supervisor: [] } } : {}) };
  let ledgers = [];
  const reader = ledgerFiles ? null : openMachineReader({ env });
  if (!reader && !ledgerFiles) return { ...out, ok: false, errors: ['machine.sqlite not found'] };
  if (ledgerFiles) ledgers = ledgerFiles;   // explicit [{name, file}] (a copy of a ledger, a spec): the registry is not consulted
  else try { ledgers = reader.listLedgers().filter((l) => l.file && fs.existsSync(l.file) && (!ledgerName || l.name === ledgerName)); } finally { reader.close(); }

  const perLedger = ledgers.map((l) => ledgerUsagePlan(l, { since, out, openLedgerReader })).filter(Boolean);
  const wantedAgents = new Set(['claude', 'codex']);
  const index = indexSessions({ agents: [...wantedAgents], sinceMs: Math.min(since, ...perLedger.flatMap((p) => p.pending.map((a) => (a.dispatched_at ?? since) - SESSION_LEAD_MS)).concat(since)), env, home, archiveRoot });

  for (const plan of perLedger) recordLedgerUsage(plan, { index, out, detail, dryRun, now, openLedger, openLedgerReader });
  const known = new Set(perLedger.flatMap((p) => [...p.workflows]));
  out.kernels.unmatched = index.filter((e) => e.role === 'kernel' && !known.has(e.workflowId)).length;

  const supervisors = index.filter((e) => e.role === 'supervisor');
  out.supervisor.sessions = supervisors.length;
  if (supervisors.length && !ledgerName) recordSupervisorUsage(supervisors, { out, detail, dryRun, env, openMachineReader, withMachine, recordMachineLlmUsage });
  out.ok = out.errors.length === 0;
  return out;
}

const usageSummary = (r) => {
  const mode = r.dryRun ? '(dry run) ' : '';
  const errors = r.errors.length ? `, ${r.errors.length} error(s)` : '';
  return `usage ${mode}attempts ${r.attempts.recorded}/${r.attempts.pending} recorded (${r.attempts.unavailable} unavailable), kernels ${r.kernels.recorded} of ${r.kernels.sessions} sessions, supervisor ${r.supervisor.recorded} of ${r.supervisor.sessions}${errors}`;
};

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] !== 'sweep') {
    console.error('args: sweep [--lookback-ms <ms>] [--dry-run] [--json]');
    process.exit(2);
  }
  const r = await sweepUsage({ lookbackMs: Number(arg('lookback-ms') ?? DEFAULT_LOOKBACK_MS), dryRun: argv.includes('--dry-run') });
  console.log(argv.includes('--json') ? JSON.stringify(r) : usageSummary(r));
  process.exit(r.ok ? 0 : 1);
}

export { sumRows, promptTokens } from '../lib/llm-usage.mjs';
