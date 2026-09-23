// scripts/agent/balance.mjs — the recent-dispatch counts the balanced allocation
// policy reads (scripts/agent/models.mjs selectPool, config.yaml allocation.policy
// balanced), and the think author an audit leg reviews (cross-family audit).
//
// A dispatch is an op job whose payload names a routed pool (payload.model, set
// by `api route`) created inside the window. Routed-but-queued and running jobs
// count, so consecutive routes of one fan-out see the fleet filling. The counts
// cover this repo's ledger plus every other product ledger the machine arbiter
// (machine.sqlite `ledgers`) registered: ledgers under the OS temp directory are
// test fixtures and are skipped, and each ledger is opened read-only and closed.
// Every read is best effort — an unreadable ledger contributes nothing, and the
// result names the ledgers it counted.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { machineFileFor } from '../../engine/ledger-db.mjs';

const require = createRequire(import.meta.url);
const HOUR_MS = 3600000;

const openReadOnly = (file) => {
  const { DatabaseSync } = require('node:sqlite');
  return new DatabaseSync(file, { readOnly: true });
};
const norm = (file) => path.resolve(String(file)).replace(/\\/g, '/').toLowerCase();
const tempDirs = (env = process.env) => [...new Set([os.tmpdir(), env.TEMP, env.TMP].filter(Boolean).map(norm))];

/** {pool: count} of op jobs routed to a pool and created at or after sinceMs, in one open ledger db. */
export function recentPoolCounts(db, sinceMs) {
  const counts = {};
  const rows = db.prepare(`SELECT json_extract(payload_json,'$.model') AS pool, count(*) AS n FROM jobs
    WHERE kind='op' AND created_at>=? AND json_extract(payload_json,'$.model') IS NOT NULL GROUP BY 1`).all(sinceMs);
  for (const row of rows) if (row.pool) counts[row.pool] = (counts[row.pool] ?? 0) + Number(row.n);
  return counts;
}

/** The other product ledgers the machine arbiter registered: not under the OS temp directory, present on disk. */
export function machineLedgerFiles({ env = process.env, exclude = [] } = {}) {
  const machine = machineFileFor(env);
  if (!fs.existsSync(machine)) return [];
  const tmp = tempDirs(env);
  const skip = new Set(exclude.filter(Boolean).map(norm));
  let db = null;
  try {
    db = openReadOnly(machine);
    const files = db.prepare('SELECT file FROM ledgers').all().map((row) => row.file).filter(Boolean);
    return [...new Set(files.map((file) => path.resolve(file)))]
      .filter((file) => !tmp.some((dir) => norm(file).startsWith(`${dir}/`)) && !skip.has(norm(file)) && fs.existsSync(file));
  } catch { return []; } finally { try { db?.close(); } catch { /* read-only */ } }
}

/**
 * Recent dispatch counts per pool: the open repo ledger `db` (its file `ledgerFile` is excluded from the
 * machine scan) plus, when `machine` is true, every other registered product ledger. Returns
 * {counts, total, sinceMs, windowHours, ledgers:[file|'repo'], unreadable:[file]}.
 */
export function recentDispatchCounts({ db = null, ledgerFile = null, windowHours = 24, machine = true, now = Date.now(), env = process.env } = {}) {
  const sinceMs = now - Math.max(0, Number(windowHours) || 24) * HOUR_MS;
  const counts = {};
  const ledgers = [];
  const unreadable = [];
  const add = (part) => { for (const [pool, n] of Object.entries(part)) counts[pool] = (counts[pool] ?? 0) + n; };
  if (db) {
    try { add(recentPoolCounts(db, sinceMs)); ledgers.push(ledgerFile ?? 'repo'); } catch { unreadable.push(ledgerFile ?? 'repo'); }
  }
  // A ledger under the OS temp directory is a fixture: it is balanced on its own jobs only, never mixed
  // with the product ledgers of this host.
  const fixture = ledgerFile && tempDirs(env).some((dir) => norm(ledgerFile).startsWith(`${dir}/`));
  if (machine && !fixture) {
    for (const file of machineLedgerFiles({ env, exclude: [ledgerFile] })) {
      let other = null;
      try { other = openReadOnly(file); add(recentPoolCounts(other, sinceMs)); ledgers.push(file); }
      catch { unreadable.push(file); }
      finally { try { other?.close(); } catch { /* read-only */ } }
    }
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total, sinceMs, windowHours: Number(windowHours) || 24, ledgers, unreadable };
}

const pathOf = (entry) => (typeof entry === 'string' ? entry : entry?.path ?? null);
const trimGlob = (p) => String(p).replace(/\\/g, '/').replace(/\/?\*+$/, '').replace(/\/+$/, '');
const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/**
 * The think author an audit reviews: the latest succeeded op job of the same workflow, created before the
 * auditor, whose kind is think work of a non-verify role (runtimes.yaml roleOfKind) and whose owned paths or
 * records overlap the auditor's records. Returns {jobId, opId, pool} or null. Read-only.
 */
export function thinkAuthorOf(db, job, { runtimes } = {}) {
  let payload = {};
  try { payload = JSON.parse(job?.payload_json ?? '{}') ?? {}; } catch { payload = {}; }
  const reads = (payload.records ?? []).map(pathOf).filter(Boolean).map(trimGlob).filter(Boolean);
  if (!reads.length) return null;
  const authorKinds = Object.entries(runtimes?.roleOfKind ?? {})
    .filter(([, entry]) => entry && typeof entry === 'object' && entry.work === 'think' && entry.role !== 'verify')
    .map(([kind]) => kind);
  if (!authorKinds.length) return null;
  const rows = db.prepare(`SELECT job_id, op_id, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND status='succeeded'
    AND created_at<=? AND job_id<>? AND op_id IN (${authorKinds.map(() => '?').join(',')}) ORDER BY updated_at DESC LIMIT 200`)
    .all(job.workflow_id, job.created_at, job.job_id, ...authorKinds);
  for (const row of rows) {
    let p = {};
    try { p = JSON.parse(row.payload_json ?? '{}') ?? {}; } catch { continue; }
    if (!p.model) continue;
    const wrote = [...(p.owned_paths ?? []), ...(p.records ?? [])].map(pathOf).filter(Boolean).map(trimGlob).filter(Boolean);
    if (wrote.some((w) => reads.some((r) => overlaps(w, r)))) return { jobId: row.job_id, opId: row.op_id, pool: p.model };
  }
  return null;
}
