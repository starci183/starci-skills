// critic-run-usage.mjs - the tokens the runtime's own Critic spent, measured from its session like the tokens of an op attempt.
//
// The settler launches the Critic of a decision leg as a worker of its own (scripts/kernel/settle/critic-run.mjs, event `runtime-critic-run`, which
// names the worker's dispatch id and task id). Its session file opens with the Orca worker preamble that names its task id, so the usage sweep
// (scripts/kernel/usage-record.mjs) finds it the way it finds an op attempt's and appends one `runtime-critic-usage` event per run:
// the tokens in and out, the cost and the models. `starci kernel status` and `starci debug digest` read the tokens from it; a run whose session is
// not found yet stays unmeasured until the sweep sees it, and one the agent cannot meter records why.
import { parseJson } from '../lib/json.mjs';
import { costOfRow, extractUsage, loadPrices, promptTokens, sumRows } from '../lib/llm-usage.mjs';

/** The ledger event that records the measured usage of one runtime Critic run. */
export const CRITIC_USAGE_EVENT = 'runtime-critic-usage';
const RUN_EVENT = 'runtime-critic-run';

/** The key a run is measured under: its dispatch id, else its task id. */
const keyOfRun = (critic) => critic?.dispatchId ?? critic?.taskId ?? null;

/** The runtime Critic runs of a ledger that name a dispatch or a task and have no usage event yet: [{workflowId, jobId, op, dispatchId, taskId, provider, digest}]. */
export function criticRunsWithoutUsage(db) {
  const rows = db.prepare('SELECT workflow_id, entity_id, payload_json FROM events WHERE kind=? ORDER BY seq').all(RUN_EVENT);
  const measured = new Set(db.prepare('SELECT json_extract(payload_json,\'$.dispatchId\') AS dispatch FROM events WHERE kind=?').all(CRITIC_USAGE_EVENT).map((row) => row.dispatch));
  return rows.flatMap((row) => {
    const body = parseJson(row.payload_json, {}) ?? {};
    const key = keyOfRun(body.critic);
    if (!key || measured.has(key)) return [];
    return [{ workflowId: row.workflow_id, jobId: row.entity_id, op: body.op ?? null, dispatchId: key, taskId: body.critic?.taskId ?? null, provider: body.critic?.provider ?? null, digest: body.digest ?? null }];
  });
}

/**
 * The usage event payload of one run, or null while its session is not in the index. `index` is the session index of usage-record.mjs
 * (indexSessions): the entry whose first user message names the dispatch id.
 */
export function criticUsagePayload(run, index, { extract = extractUsage, prices = loadPrices() } = {}) {
  const entry = index.find((e) => e.role === 'op' && (e.dispatchId === run.dispatchId || (run.taskId && e.taskId === run.taskId)));
  if (!entry) return null;
  const got = extract(entry.agent, entry.file);
  const base = { jobId: run.jobId, op: run.op, dispatchId: run.dispatchId, digest: run.digest, agent: entry.agent };
  if (!got.ok) return { ...base, tokens: null, reason: got.reason ?? 'the session holds no usage record' };
  const rows = got.models.map((row) => ({ ...row, costUsd: costOfRow(row, prices) }));
  const total = sumRows(rows);
  const tokensIn = promptTokens(total);
  return { ...base, tokens: tokensIn + total.outputTokens, tokensIn, tokensOut: total.outputTokens,
    costUsd: rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0), models: rows.map((row) => row.model) };
}

/**
 * One ledger's pass: the runs without usage whose session the index holds get their event. `dryRun` counts without writing. Returns how many runs were (or would be) measured.
 * `open` is {reader(file), writer({file, repoRoot})} (the sweep's ledger openers).
 */
export function sweepCriticUsage(ledgerRef, index, { open, dryRun = false, now = Date.now() } = {}) {
  const reader = open.reader(ledgerRef.file);
  let runs = [];
  try { runs = criticRunsWithoutUsage(reader); } finally { reader.close?.(); }
  const measurable = runs.filter((run) => criticUsagePayload(run, index) !== null);
  if (dryRun || !measurable.length) return measurable.length;
  const handle = open.writer({ file: ledgerRef.file, repoRoot: ledgerRef.repoRoot ?? null });
  try { return recordCriticUsage(handle, measurable, index, { now }).length; } finally { handle.close(); }
}

/** Append the usage events of the runs whose session is indexed; returns the payloads written. */
function recordCriticUsage(ledger, runs, index, { now = Date.now(), extract, prices } = {}) {
  const written = [];
  for (const run of runs) {
    const payload = criticUsagePayload(run, index, { extract, prices });
    if (!payload) continue;
    ledger.transaction(() => ledger.appendEvent({ workflowId: run.workflowId, entityType: 'job', entityId: run.jobId, kind: CRITIC_USAGE_EVENT, createdAt: now, payload }));
    written.push(payload);
  }
  return written;
}
