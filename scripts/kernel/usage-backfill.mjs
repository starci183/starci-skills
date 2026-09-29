#!/usr/bin/env node
// usage-backfill.mjs — one-shot backfill of the token meter for attempts and Kernels that ran before it existed.
//
//   node scripts/kernel/usage-backfill.mjs [--ledger <name>] [--since <YYYY-MM-DD|ISO|epoch-ms>] [--apply] [--json]
//
// Same pass the Host controller runs every 5 minutes (scripts/kernel/usage-record.mjs sweepUsage), scoped to one ledger and a
// start date, with the per-workflow / per-op / per-model / Kernel numbers printed. DRY RUN BY DEFAULT: nothing is written; with
// --apply the rows go through the ledger writer (engine/ledger-db.mjs recordAttemptUsage / recordKernelUsage), idempotently -
// a second --apply adds nothing. A session file is found live or in the session archive by the dispatch/task id its first
// user message names; an attempt with no adapter (devin) or no session file is reported unavailable, never estimated.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sweepUsage } from './usage-record.mjs';
import { sumRows, promptTokens } from '../lib/llm-usage.mjs';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const sinceOf = (v) => {
  if (!v) { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (/^\d{10,}$/.test(v)) return Number(v);
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
  if (!Number.isFinite(t)) { console.error(`--since ${v} is not a date`); process.exit(2); }
  return t;
};

const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');
export function backfillReport(sweep) {
  const rows = [];
  const byWorkflowOp = new Map(), byModel = new Map();
  for (const a of sweep.detail.attempts) {
    if (!a.ok) continue;
    for (const r of a.rows) {
      const key = `${a.ledger} ${a.workflowId} ${a.opId}`;
      const cur = byWorkflowOp.get(key) ?? { ledger: a.ledger, workflowId: a.workflowId, opId: a.opId, attempts: new Set(), rows: [] };
      cur.attempts.add(a.attemptId); cur.rows.push(r); byWorkflowOp.set(key, cur);
      const mk = `${a.provider}/${r.model}`;
      const m = byModel.get(mk) ?? { model: mk, rows: [] }; m.rows.push(r); byModel.set(mk, m);
    }
  }
  for (const v of byWorkflowOp.values()) { const t = sumRows(v.rows); rows.push({ ledger: v.ledger, workflowId: v.workflowId, opId: v.opId, attempts: v.attempts.size, tokens: promptTokens(t) + t.outputTokens, ...t }); }
  return {
    ops: rows.sort((a, b) => a.workflowId.localeCompare(b.workflowId) || b.tokens - a.tokens),
    models: [...byModel.values()].map((m) => { const t = sumRows(m.rows); return { model: m.model, tokens: promptTokens(t) + t.outputTokens, ...t }; }).sort((a, b) => b.tokens - a.tokens),
    kernels: sweep.detail.kernels.filter((k) => k.ok && k.rows.length).map((k) => { const t = sumRows(k.rows); return { ledger: k.ledger, workflowId: k.workflowId, agent: k.agent, session: k.session, models: k.rows.map((r) => r.model), tokens: promptTokens(t) + t.outputTokens, ...t }; }),
    unavailable: sweep.detail.attempts.filter((a) => !a.ok).map((a) => ({ ledger: a.ledger, workflowId: a.workflowId, opId: a.opId, attemptId: a.attemptId, agent: a.agent, reason: a.reason })),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const since = sinceOf(arg('since'));
  const apply = argv.includes('--apply');
  const sweep = await sweepUsage({ ledgerName: arg('ledger'), lookbackMs: Math.max(1, Date.now() - since), dryRun: !apply, detail: true });
  const report = backfillReport(sweep);
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: sweep.ok, applied: apply, since, ledger: arg('ledger'), summary: { attempts: sweep.attempts, kernels: sweep.kernels, errors: sweep.errors }, ...report }, null, 2));
  else {
    console.log(`usage backfill ${apply ? 'APPLIED' : 'DRY RUN (nothing written; --apply writes through the ledger writer)'} since ${new Date(since).toISOString()}${arg('ledger') ? ` ledger ${arg('ledger')}` : ''}`);
    console.log(`  attempts: ${sweep.attempts.pending} pending, ${sweep.attempts.recorded} ${apply ? 'recorded' : 'measurable'}, ${sweep.attempts.unavailable} unavailable; kernel sessions ${sweep.kernels.sessions}, ${sweep.kernels.recorded} with new usage`);
    console.log('  by workflow / op:');
    for (const o of report.ops) console.log(`    ${o.workflowId} ${o.opId}: ${o.attempts} attempt(s) ${fmt(o.tokens)} tok (in ${fmt(o.inputTokens)} cache-read ${fmt(o.cacheReadTokens)} cache-write ${fmt(o.cacheWriteTokens)} out ${fmt(o.outputTokens)})`);
    console.log('  by model:');
    for (const m of report.models) console.log(`    ${m.model}: ${fmt(m.tokens)} tok`);
    console.log('  kernels:');
    for (const k of report.kernels) console.log(`    ${k.workflowId} (${k.agent}, ${k.models.join(',')}) session ${k.session}: ${fmt(k.tokens)} tok`);
    if (report.unavailable.length) { console.log('  unavailable:'); for (const u of report.unavailable) console.log(`    attempt ${u.attemptId} ${u.workflowId} ${u.opId} (${u.agent ?? '?'}): ${u.reason}`); }
    for (const e of sweep.errors) console.log(`  error: ${e}`);
  }
  process.exit(sweep.ok ? 0 : 1);
}
