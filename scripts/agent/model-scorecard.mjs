#!/usr/bin/env node
// starci debug run model-scorecard — how each routed pool performs, per op kind, read from the ledgers.
//
//   starci debug run model-scorecard --repo <repoRoot> [--repo <another>] [--since-hours N] [--json]
//
// Reads each repo's runtime ledger READ-ONLY at the file machine.ledgers names for it (decision Q1,
// ledgerFileFor(repo): <runtime root>/.runtime/projects/<ledger id>/runtime.sqlite; never writes). One row per
// pool x op kind over `jobs` rows with kind='op':
//   pool      payload.model (claude-agent | codex-agent | devin-agent | ...); a job that was
//             never routed (no payload.model: dropped or queued before a route) is reported as
//             '(unrouted)' so the shares add up to 100%.
//   outcome   pass = verdict 'pass' (or succeeded with no verdict); blocked = verdict blocked|awaiting-owner;
//             cancelled = status cancelled; fail = any other failed row; open = not settled yet.
//   rates     pass%/fail%/blocked% are over settled jobs (succeeded|failed|cancelled); rework% is the share
//             of ALL jobs that are a retry (payload.retry.retryOf set).
//   duration  median over succeeded|failed jobs: first `op-dispatched` -> last `op-settled` event when both
//             exist, else created_at -> updated_at. `durationSource` counts which was used.
// Missing ledgers never crash: they are reported as errors.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isMain } from '../lib/is-main.mjs';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';
import { parseJson } from '../lib/json.mjs';
import { AWAITING_OWNER_STATUS, SETTLED_JOB_LIST } from '../../engine/admission.mjs';

const require = createRequire(import.meta.url);
export const UNROUTED = '(unrouted)';
export const DAY_MS = 86400000;
const SETTLED = new Set(SETTLED_JOB_LIST);
const WORKED = new Set(['succeeded', 'failed', AWAITING_OWNER_STATUS]);
const BLOCKED_VERDICTS = new Set(['blocked']);

const parse = parseJson;

/** The job's outcome bucket: pass | fail | blocked | cancelled | open. */
export function outcomeOf({ status, verdict }) {
  if (!SETTLED.has(status)) return 'open';
  if (verdict === 'pass' || (status === 'succeeded' && verdict == null)) return 'pass';
  if (status === 'cancelled') return 'cancelled';
  if (status === AWAITING_OWNER_STATUS || BLOCKED_VERDICTS.has(verdict)) return 'blocked';
  return 'fail';
}

/** The median of a numeric list, or null when empty. */
export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Every op job of one ledger (read-only), as flat rows. `sinceMs` limits by created_at.
 * Throws when the ledger file is missing; scorecardFor turns that into a per-repo error.
 */
function readLedgerJobs(file, { sinceMs = null } = {}) {
  if (!fs.existsSync(file)) throw Object.assign(new Error(`no ledger at ${file}`), { code: 'ENOENT' });
  const db = openLedgerReader(file);
  try {
    const where = sinceMs == null ? '' : ' AND created_at>=?';
    const args = sinceMs == null ? [] : [sinceMs];
    const jobs = db.prepare(`SELECT job_id, op_id, status, created_at, updated_at,
        json_extract(payload_json,'$.model') AS pool, json_extract(payload_json,'$.modelId') AS model_id,
        json_extract(payload_json,'$.difficulty') AS difficulty, json_extract(payload_json,'$.retry.retryOf') AS retry_of,
        (SELECT verdict FROM op_attempts a WHERE a.job_id=jobs.job_id ORDER BY a.attempt_id DESC LIMIT 1) AS verdict
      FROM jobs WHERE kind='op'${where} ORDER BY created_at, job_id`).all(...args);
    const times = new Map();
    const evWhere = sinceMs == null ? '' : ' AND created_at>=?';
    for (const r of db.prepare(`SELECT entity_id,
        MIN(CASE WHEN kind='op-dispatched' THEN created_at END) AS dispatched,
        MAX(CASE WHEN kind='op-settled' THEN created_at END) AS settled
      FROM events WHERE entity_type='job' AND kind IN ('op-dispatched','op-settled')${evWhere} GROUP BY entity_id`).all(...args))
      times.set(r.entity_id, r);
    return jobs.map((j) => ({
      jobId: j.job_id, opId: j.op_id ?? '(none)', pool: j.pool ?? UNROUTED, modelId: j.model_id ?? null,
      difficulty: j.difficulty ?? null, status: j.status, verdict: j.verdict ?? null, retryOf: j.retry_of ?? null,
      createdAt: Number(j.created_at), updatedAt: Number(j.updated_at),
      dispatchedAt: times.get(j.job_id)?.dispatched ?? null, settledAt: times.get(j.job_id)?.settled ?? null,
    }));
  } finally { try { db.close(); } catch { /* closed */ } }
}

/** A settled job's duration and where it came from ('events' | 'row'), or null for an unsettled/cancelled one. */
function durationOf(job) {
  if (!WORKED.has(job.status)) return null;
  if (job.dispatchedAt != null && job.settledAt != null && job.settledAt >= job.dispatchedAt)
    return { ms: job.settledAt - job.dispatchedAt, source: 'events' };
  return { ms: Math.max(0, job.updatedAt - job.createdAt), source: 'row' };
}

const emptyCell = () => ({ jobs: 0, settled: 0, pass: 0, fail: 0, blocked: 0, cancelled: 0, open: 0, rework: 0, durations: [] });
const addJob = (cell, job, outcome, duration) => {
  cell.jobs += 1;
  cell[outcome] += 1;
  if (outcome !== 'open') cell.settled += 1;
  if (job.retryOf) cell.rework += 1;
  if (duration) cell.durations.push(duration.ms);
};
const pct = (n, d) => (d ? n / d : null);
const byName = (a, b) => { if (a < b) return -1; if (a > b) return 1; return 0; };
const finish = (cell, total) => ({
  jobs: cell.jobs, share: pct(cell.jobs, total), settled: cell.settled,
  pass: cell.pass, fail: cell.fail, blocked: cell.blocked, cancelled: cell.cancelled, open: cell.open, rework: cell.rework,
  passRate: pct(cell.pass, cell.settled), failRate: pct(cell.fail, cell.settled), blockedRate: pct(cell.blocked + cell.cancelled, cell.settled),
  reworkRate: pct(cell.rework, cell.jobs), medianMs: median(cell.durations),
});

/**
 * The scorecard over flat job rows (pure).
 */
function buildScorecard(jobs, { repos = [], window = { sinceMs: null, label: 'all' }, errors = [] } = {}) {
  const pools = new Map();
  const durationSource = { events: 0, row: 0 };
  for (const job of jobs) {
    const outcome = outcomeOf(job);
    const duration = durationOf(job);
    if (duration) durationSource[duration.source] += 1;
    const p = pools.get(job.pool) ?? { total: emptyCell(), kinds: new Map() };
    pools.set(job.pool, p);
    addJob(p.total, job, outcome, duration);
    const k = p.kinds.get(job.opId) ?? emptyCell();
    p.kinds.set(job.opId, k);
    addJob(k, job, outcome, duration);
  }
  const total = jobs.length;
  const out = {};
  const order = [...pools.entries()].sort((a, b) => b[1].total.jobs - a[1].total.jobs || byName(a[0], b[0]));
  for (const [pool, p] of order) {
    const kinds = {};
    for (const [kind, cell] of [...p.kinds.entries()].sort((a, b) => b[1].jobs - a[1].jobs || byName(a[0], b[0])))
      kinds[kind] = finish(cell, p.total.jobs);
    out[pool] = { ...finish(p.total, total), kinds };
  }
  return { repos, window, jobs: total, durationSource, errors, pools: out };
}

export const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// --- composition -----------------------------------------------------------------------------------
/** The scorecard for real repos: reads each ledger read-only; a failure is an error entry, never a throw. */
export function scorecardFor({ repos, sinceHours = null, now = Date.now() } = {}) {
  const sinceMs = sinceHours == null ? null : now - Number(sinceHours) * 3600000;
  const window = { sinceMs, label: sinceHours == null ? 'all' : `${sinceHours}h` };
  const jobs = [], errors = [], seen = [];
  for (const repo of repos ?? []) {
    try { jobs.push(...readLedgerJobs(ledgerFileFor(repo), { sinceMs })); seen.push(repo); }
    catch (error) { errors.push({ repo, error: String(error?.message ?? error) }); }
  }
  return buildScorecard(jobs, { repos: seen, window, errors });
}

// --- rendering -------------------------------------------------------------------------------------
export const shortPool = (pool) => (pool === UNROUTED ? 'unrouted' : pool.replace(/-agent$/, ''));
export const pctText = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`);
const minutes = (ms) => (ms == null ? '-' : (ms / 60000).toFixed(1));

/** ONE short line for the supervisor digest: each pool's share of jobs (and pass rate; none for never-routed jobs). */
export function summaryLine(sc) {
  const parts = Object.entries(sc.pools).filter(([, p]) => p.jobs > 0)
    .map(([pool, p]) => `${shortPool(pool)} ${pctText(p.share)}${p.passRate == null || pool === UNROUTED ? '' : ' (p' + pctText(p.passRate) + ')'}`);
  return `pools ${sc.window.label}: ${parts.length ? parts.join(' · ') : 'no op jobs'}`;
}

/** The human table: pool x kind rows, then one totals line per pool. */
export function formatTable(sc) {
  const head = ['pool', 'kind', 'jobs', 'pass%', 'fail%', 'blk%', 'rework%', 'med-min'];
  const rows = [];
  for (const [pool, p] of Object.entries(sc.pools))
    for (const [kind, k] of Object.entries(p.kinds))
      rows.push([shortPool(pool), kind, String(k.jobs), pctText(k.passRate), pctText(k.failRate), pctText(k.blockedRate), pctText(k.reworkRate), minutes(k.medianMs)]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (r) => r.map((c, i) => (i < 2 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
  const lines = [
    `model scorecard — window ${sc.window.label}${sc.window.sinceMs ? ' (since ' + new Date(sc.window.sinceMs).toISOString() + ')' : ''} — repos: ${sc.repos.join(', ') || '(none)'}`,
    fmt(head), ...rows.map(fmt), '',
  ];
  for (const [pool, p] of Object.entries(sc.pools)) {
    lines.push(`TOTAL ${shortPool(pool)}: ${p.jobs} jobs (${pctText(p.share)}), pass ${p.pass} fail ${p.fail} blocked ${p.blocked} cancelled ${p.cancelled} open ${p.open}, pass% ${pctText(p.passRate)} rework% ${pctText(p.reworkRate)} median ${minutes(p.medianMs)} min`);
  }
  lines.push(`rates over settled jobs; rework over all jobs; median over succeeded|failed via op-dispatched->op-settled events (${sc.durationSource.events}) else created->updated (${sc.durationSource.row}); '${UNROUTED}' = never routed`);
  for (const e of sc.errors) lines.push(`ERROR ${e.repo}: ${e.error}`);
  lines.push(summaryLine(sc));
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  const repos = [];
  let sinceHours = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--repo') repos.push(argv[++i]);
    else if (argv[i] === '--since-hours') sinceHours = Number(argv[++i]);
  }
  if (!repos.length) { console.error('usage: starci debug run model-scorecard --repo <repoRoot> [--repo <another>] [--since-hours N] [--json]'); process.exitCode = 2; return; }
  if (sinceHours != null && !(sinceHours > 0)) { console.error('--since-hours needs a positive number'); process.exitCode = 2; return; }
  const sc = scorecardFor({ repos, sinceHours });
  console.log(argv.includes('--json') ? JSON.stringify(sc) : formatTable(sc));
}

if (isMain(import.meta.url)) main();
