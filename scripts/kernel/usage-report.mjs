// usage-report.mjs — the read side of the token meter: what llm_usage (written by scripts/kernel/usage-record.mjs) says.
//
//   usageOfWorkflow(db, workflowId, {legs})  tokens of one workflow by op, by model and for its Kernel, plus coverage
//   usageOfLedger(db, {sinceMs})             the same folded over a whole ledger (by provider/model, kernel apart)
//   machineUsage({env, now, windowMs})       every registered ledger + the Supervisor seat: what `boot.mjs --status` prints
//
// All reads. A token count is a fact recorded from a CLI session; cost is the recorded cost_usd only (modules/models/registry.yaml models.<id>.price,
// NULL while a model has no declared price) and is reported as null, never as 0, when any contributing row is unpriced.
// An attempt that settled with no llm_usage row is 'unavailable' (no adapter for its agent, or no session file found) and
// is counted apart, never given a number.
import fs from 'node:fs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { readMachine } from '../../engine/db/machine.mjs';

const NUM = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'reasoningTokens', 'turns', 'toolCalls', 'toolErrors'];
const SUMS = `sum(u.input_tokens) AS inputTokens, sum(u.output_tokens) AS outputTokens, sum(u.cache_read_tokens) AS cacheReadTokens,
  sum(u.cache_write_tokens) AS cacheWriteTokens, sum(u.reasoning_tokens) AS reasoningTokens, sum(u.turns) AS turns,
  sum(u.tool_calls) AS toolCalls, sum(u.tool_errors) AS toolErrors, sum(u.cost_usd) AS costUsd,
  sum(CASE WHEN u.cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced, count(*) AS records`;

const blank = () => ({ ...Object.fromEntries(NUM.map((k) => [k, 0])), costUsd: 0, unpriced: 0, records: 0 });
const add = (t, r) => { for (const k of NUM) t[k] += Number(r[k] ?? 0); t.costUsd += Number(r.costUsd ?? 0); t.unpriced += Number(r.unpriced ?? 0); t.records += Number(r.records ?? 0); return t; };
/** The finished shape of a folded total: tokens = every token the models handled; costUsd null unless every record is priced. */
const finish = (t) => ({
  inputTokens: t.inputTokens, outputTokens: t.outputTokens, cacheReadTokens: t.cacheReadTokens, cacheWriteTokens: t.cacheWriteTokens, reasoningTokens: t.reasoningTokens,
  tokens: t.inputTokens + t.outputTokens + t.cacheReadTokens + t.cacheWriteTokens, turns: t.turns, toolCalls: t.toolCalls, toolErrors: t.toolErrors,
  costUsd: t.records && !t.unpriced ? Math.round(t.costUsd * 1e6) / 1e6 : null,
});
const fold = (rows, key) => {
  const by = new Map();
  for (const r of rows) { const k = key(r); if (!by.has(k)) by.set(k, { key: k, ...blank(), attempts: new Set() }); add(by.get(k), r); if (r.attemptId != null) by.get(k).attempts.add(r.attemptId); }
  return [...by.values()];
};
const tally = (t) => ({ ...finish(t), ...(t.attempts ? { attempts: t.attempts.size } : {}) });

/** Tokens of one workflow: {workflowId, total, byOp[], byModel[], kernel, coverage, legs?}. */
export function usageOfWorkflow(db, workflowId, { legs = false } = {}) {
  const attemptRows = db.prepare(`SELECT a.op_id AS opId, u.provider AS provider, COALESCE(u.response_model,u.request_model,'unknown') AS model, u.attempt_id AS attemptId, ${SUMS}
    FROM llm_usage u JOIN op_attempts a ON a.attempt_id=u.attempt_id WHERE u.workflow_id=? AND u.subject_type='attempt' GROUP BY a.op_id, u.provider, model, u.attempt_id`).all(workflowId).map((r) => ({ ...r }));
  const kernelRows = db.prepare(`SELECT u.provider AS provider, COALESCE(u.response_model,u.request_model,'unknown') AS model, substr(u.turn_ref, 1, instr(u.turn_ref,'@')-1) AS session, ${SUMS}
    FROM llm_usage u WHERE u.workflow_id=? AND u.subject_type='kernel-turn' GROUP BY u.provider, model, session`).all(workflowId).map((r) => ({ ...r }));
  const byOp = fold(attemptRows, (r) => r.opId).map((t) => ({ opId: t.key, ...tally(t),
    models: fold(attemptRows.filter((r) => r.opId === t.key), (r) => `${r.provider}/${r.model}`).map((m) => ({ model: m.key, ...tally(m) })) }));
  const byModel = fold([...attemptRows, ...kernelRows], (r) => `${r.provider}/${r.model}`).map((t) => ({ model: t.key, ...tally(t) }));
  const total = blank(); for (const r of [...attemptRows, ...kernelRows]) add(total, r);
  const kernelTotal = blank(); for (const r of kernelRows) add(kernelTotal, r);
  const cov = db.prepare(`SELECT count(*) AS attempts,
      sum(CASE WHEN a.settled_at IS NULL AND a.end_state IS NULL THEN 1 ELSE 0 END) AS open,
      sum(CASE WHEN EXISTS(SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id) THEN 1 ELSE 0 END) AS measured
    FROM op_attempts a WHERE a.workflow_id=?`).get(workflowId);
  const unavailable = db.prepare(`SELECT a.attempt_id AS attemptId, a.op_id AS opId, COALESCE(a.agent,a.provider) AS agent, a.usage_reason AS reason FROM op_attempts a
    WHERE a.workflow_id=? AND a.usage_source='unavailable' ORDER BY a.attempt_id`).all(workflowId);
  const pending = Number(db.prepare(`SELECT count(*) n FROM op_attempts a WHERE a.workflow_id=? AND a.usage_source IS NULL AND (a.settled_at IS NOT NULL OR a.end_state IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)`).get(workflowId).n);
  const out = {
    workflowId, total: finish(total), byOp: byOp.toSorted((a, b) => b.tokens - a.tokens), byModel: byModel.toSorted((a, b) => b.tokens - a.tokens),
    kernel: { ...finish(kernelTotal), sessions: new Set(kernelRows.map((r) => r.session)).size,
      models: fold(kernelRows, (r) => `${r.provider}/${r.model}`).map((m) => ({ model: m.key, ...tally(m) })) },
    coverage: { attempts: Number(cov.attempts), measured: Number(cov.measured ?? 0), open: Number(cov.open ?? 0),
      unavailable: unavailable.length, pending, unavailableAttempts: unavailable.slice(0, 20).map((r) => ({ ...r })) },
  };
  if (legs) {
    out.legs = db.prepare(`SELECT a.attempt_id AS attemptId, a.job_id AS jobId, a.op_id AS opId, a.unit_id AS unitId, a.try_no AS tryNo, COALESCE(a.agent,a.provider) AS agent,
        COALESCE(u.response_model,a.model) AS model, ${SUMS}, a.usage_source AS usageSource, a.usage_reason AS usageReason,
        CASE WHEN count(u.usage_id)>0 THEN 'measured' WHEN a.usage_source='unavailable' THEN 'unavailable' WHEN a.settled_at IS NULL AND a.end_state IS NULL THEN 'open' ELSE 'pending' END AS state
      FROM op_attempts a LEFT JOIN llm_usage u ON u.subject_type='attempt' AND u.attempt_id=a.attempt_id WHERE a.workflow_id=? GROUP BY a.attempt_id, model ORDER BY a.attempt_id`).all(workflowId)
      .map((r) => ({ attemptId: r.attemptId, jobId: r.jobId, opId: r.opId, unitId: r.unitId, tryNo: r.tryNo, agent: r.agent, model: r.model, state: r.state, usageSource: r.usageSource ?? null, ...(r.usageReason ? { usageReason: r.usageReason } : {}),
        ...(r.state === 'measured' ? finish(add(blank(), r)) : {}) }));
  }
  return out;
}

/** Tokens folded over a whole ledger since `sinceMs` (null = all): {byModel[], attempts, kernel, total}. */
export function usageOfLedger(db, { sinceMs = null } = {}) {
  const where = sinceMs === null ? '' : 'WHERE u.at >= ?';
  const args = sinceMs === null ? [] : [sinceMs];
  const rows = db.prepare(`SELECT u.subject_type AS subjectType, u.provider AS provider, COALESCE(u.response_model,u.request_model,'unknown') AS model, ${SUMS}
    FROM llm_usage u ${where} GROUP BY u.subject_type, u.provider, model`).all(...args).map((r) => ({ ...r }));
  const total = blank(); for (const r of rows) add(total, r);
  const part = (type) => { const t = blank(); for (const r of rows.filter((x) => x.subjectType === type)) add(t, r); return finish(t); };
  return { total: finish(total), attempts: part('attempt'), kernel: part('kernel-turn'),
    byModel: fold(rows, (r) => `${r.provider}/${r.model}`).map((t) => ({ model: t.key, ...tally(t) })).sort((a, b) => b.tokens - a.tokens) };
}

/**
 * The machine-wide summary `boot.mjs --status` prints: every registered ledger's usage (window and all time, by model) and the
 * Supervisor seat's (machine.sqlite llm_usage). Missing stores read as empty; never throws.
 */
export function machineUsage({ env = process.env, now = Date.now(), windowMs = 24 * 60 * 60 * 1000 } = {}) {
  const out = { windowMs, ledgers: [], supervisor: null, total: null, byModel: [] };
  let ledgers = [];
  try {
    readMachine((m) => {
      ledgers = m.listLedgers().filter((l) => l.file && fs.existsSync(l.file));
      const rows = m.db.prepare(`SELECT COALESCE(u.response_model,u.request_model,'unknown') AS model, u.provider AS provider, ${SUMS} FROM llm_usage u WHERE u.subject_type='supervisor-turn' GROUP BY provider, model`).all().map((r) => ({ ...r }));
      const t = blank(); for (const r of rows) add(t, r);
      const w = blank();
      for (const r of m.db.prepare(`SELECT ${SUMS} FROM llm_usage u WHERE u.subject_type='supervisor-turn' AND u.at >= ?`).all(now - windowMs)) add(w, r);
      out.supervisor = { ...finish(t), window: finish(w), byModel: fold(rows, (r) => `${r.provider}/${r.model}`).map((x) => ({ model: x.key, ...tally(x) })) };
    }, null, { env });
  } catch (error) { out.error = String(error?.message ?? error).slice(0, 200); }
  const all = blank(), win = blank(), models = [];
  for (const l of ledgers) {
    let db = null;
    try {
      db = openLedgerReader(l.file);
      const life = usageOfLedger(db), recent = usageOfLedger(db, { sinceMs: now - windowMs });
      const unavailable = db.prepare("SELECT count(*) n FROM op_attempts WHERE usage_source='unavailable'").get().n;
      const pending = db.prepare("SELECT count(*) n FROM op_attempts WHERE usage_source IS NULL AND (settled_at IS NOT NULL OR end_state IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=op_attempts.attempt_id)").get().n;
      out.ledgers.push({ name: l.name, ledgerId: l.ledgerId, total: life.total, window: recent.total, attempts: life.attempts, kernel: life.kernel, unavailableAttempts: Number(unavailable), pendingAttempts: Number(pending), byModel: life.byModel });
      for (const m of life.byModel) models.push(m);
      add(all, { ...life.total, costUsd: life.total.costUsd ?? 0, unpriced: life.total.costUsd === null && life.total.tokens ? 1 : 0, records: life.total.tokens ? 1 : 0 });
      add(win, { ...recent.total, costUsd: recent.total.costUsd ?? 0, unpriced: recent.total.costUsd === null && recent.total.tokens ? 1 : 0, records: recent.total.tokens ? 1 : 0 });
    } catch (error) { out.ledgers.push({ name: l.name, error: String(error?.message ?? error).slice(0, 160) }); } finally { try { db?.close(); } catch { /* closed */ } }
  }
  if (out.supervisor) models.push(...out.supervisor.byModel);
  out.total = finish(all); out.window = finish(win);
  out.byModel = fold(models.map((m) => ({ ...m, unpriced: m.costUsd === null && m.tokens ? 1 : 0, records: m.tokens ? 1 : 0, costUsd: m.costUsd ?? 0 })), (r) => r.model).map((t) => ({ model: t.key, ...tally(t) })).sort((a, b) => b.tokens - a.tokens);
  return out;
}

/** Compact human lines for a usage total. */
export const tokenLine = (t) => `${(t.tokens ?? 0).toLocaleString('en-US')} tok (in ${(t.inputTokens ?? 0).toLocaleString('en-US')}, cache-read ${(t.cacheReadTokens ?? 0).toLocaleString('en-US')}, cache-write ${(t.cacheWriteTokens ?? 0).toLocaleString('en-US')}, out ${(t.outputTokens ?? 0).toLocaleString('en-US')})${t.costUsd == null ? '' : ` $${t.costUsd}`}`;
