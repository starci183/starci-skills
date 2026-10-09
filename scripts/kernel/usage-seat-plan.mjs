// usage-seat-plan.mjs — the usage a Kernel or Supervisor session added since the rows already recorded, per wake. The session is cut at the
// seat's wake events (scripts/kernel/wake-budget.mjs) by the timestamps of its usage records; each cut becomes rows whose turn_ref carries the
// wake that owns them, so a re-run never counts a row twice and a short wake reads exactly its own turns and tokens.
import path from 'node:path';
import { extractUsage, costOfRow, loadPrices, deltaRows, USAGE_SOURCE, USAGE_UNAVAILABLE } from '../lib/llm-usage.mjs';
import { kernelWakesOf, supervisorWakesOf, wakeTag } from './wake-budget.mjs';

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
  // A tag the session's non-empty cuts do not carry is a legacy one (rows cut before a boot was a cut): taken off the earliest buckets like untagged rows.
  const tagAt = (index) => (index === 0 ? wakeTag(0) : wakeTag(wakes[index - 1].seq));
  const live = new Set(got.buckets.flatMap((bucket, index) => (bucket.models?.length ? [tagAt(index)] : [])));
  const tagged = (tag) => recorded.filter((row) => row.tag === tag);
  let untagged = recorded.filter((row) => row.tag === '' || !live.has(row.tag));
  let turns = 0;
  const groups = [];
  got.buckets.forEach((bucket, index) => {
    const tag = tagAt(index);
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
export function planSeatUsage(db, { role, workflowId = null, entry, prices = loadPrices(), extract = extractUsage }) {
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
