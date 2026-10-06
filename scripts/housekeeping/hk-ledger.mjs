// hk-ledger.mjs — row retention of the project ledgers (docs/ledger-db.md).
//
// Two places call it: `starci kernel finish` / `starci kernel archive` (retainLedgerDb on the ending workflow's ledger) and the
// housekeeping sweep (sweepLedgers over every ledger machine.ledgers enrols).
//
// What retention does — never erase history a live workflow can still need:
//   1. Q5: typed `debug` log rows older than 14 days are deleted (the logs delete guard admits exactly those).
//   2. Q6: a workflow that ended (phase finished, or archived) more than 30 days ago is archived to a verified zip and
//      then purged as a unit through scripts/work/purge-workflow.mjs (workflow_purges: planned -> archived ->
//      deleting -> purged; engine/db/ledger.mjs deleteWorkflowRows cascades the rows). The approval is the owner's Q6
//      current installation's retention.workflowPurge profile, never a historical owner's Q6 decision. A workflow is kept, and reported, while any job of it is
//      live or while a Work record cites one of its artifacts (work_citations pins its evidence; a purge would orphan it).
//      Only the sweep purges, and only with --apply; `starci kernel finish` never purges (the workflow just ended).
//   3. PRAGMA incremental_vacuum hands freelist pages back. No WAL checkpoint here: the reconciler engine's connection
//      is the ONE that checkpoints (RESEARCH-STORAGE §3).
// Blobs are not touched: the blob GC (scripts/housekeeping/blob-gc.mjs) owns their lifetime.
import fs from 'node:fs';
import path from 'node:path';
import { openLedger, openLedgerReader, JOB_STATUSES } from '../../engine/db/ledger.mjs';
import { machineFileFor, readMachine } from '../../engine/db/machine.mjs';
import { allocationSettings, workflowPurgeSettings } from '../../engine/config.mjs';
import { hasTable } from '../lib/sqlite.mjs';
import { positiveNumber } from '../lib/number.mjs';

const DEBUG_LOG_RETENTION_MS = 14 * 86_400_000; // Q5
const WORKFLOW_RETENTION_MS = 30 * 86_400_000; // Q6
export function workflowPurgeApproval(repo,config){
  const profile=config===undefined?workflowPurgeSettings():workflowPurgeSettings(config);
  if(!profile)return null;
  const key=p=>{const real=fs.realpathSync(p);return process.platform==='win32'?real.toLowerCase():real;};
  const actual=key(repo);
  return profile.repos.some(p=>key(p)===actual)?{by:profile.approvedBy,ref:profile.approvalRef}:null;
}

const SETTLED = new Set(JOB_STATUSES.settled);
const statSize = (file) => { try { return fs.statSync(file).size; } catch { return 0; } };
const familySize = (file) => statSize(file) + statSize(`${file}-wal`) + statSize(`${file}-shm`);

const has = hasTable;

/** Q5 on an open ledger db (its own transaction): old debug log rows. Returns the rows deleted. */
function pruneDebugLogs(db, { now }) {
  if (!has(db, 'logs')) return 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const n = db.prepare("DELETE FROM logs WHERE level='debug' AND at < ?").run(now - DEBUG_LOG_RETENTION_MS).changes;
    db.exec('COMMIT');
    return n;
  } catch (error) { try { db.exec('ROLLBACK'); } catch { /* rolled back */ } throw error; }
}
const reclaimSpace = (db) => { try { db.exec('PRAGMA incremental_vacuum'); return true; } catch { return false; } };

/**
 * The retention an ending workflow runs on its own ledger (starci kernel finish / starci kernel archive): Q5 debug logs and the
 * freelist. Call outside every transaction. Returns {retained, debugLogsDeleted, vacuumed}.
 */
export function retainLedgerDb(db, { now = Date.now() } = {}) {
  if (!db) throw Error('retainLedgerDb needs an open ledger db');
  const debugLogsDeleted = pruneDebugLogs(db, { now });
  return { retained: true, debugLogsDeleted, vacuumed: reclaimSpace(db) };
}

/**
 * Q6 candidates of one ledger: [{workflowId, endedAt, ok, why?}] for every workflow that ended more than
 * `retentionMs` ago and is not purged yet. `ok:false` names why it is kept (live jobs, cited evidence).
 */
function expiredWorkflows(db, { now = Date.now(), retentionMs = WORKFLOW_RETENTION_MS } = {}) {
  const purged = has(db, 'workflow_purges') ? new Set(db.prepare("SELECT workflow_id FROM workflow_purges WHERE state='purged'").all().map((r) => r.workflow_id)) : new Set();
  const rows = db.prepare(`SELECT workflow_id, phase, COALESCE(finished_at, archived_at) AS ended_at FROM workflows
    WHERE (phase='finished' OR archived_at IS NOT NULL) AND COALESCE(finished_at, archived_at) IS NOT NULL AND COALESCE(finished_at, archived_at) < ?
    ORDER BY ended_at`).all(now - retentionMs);
  const cites = has(db, 'work_citations') && has(db, 'job_artifacts');
  return rows.filter((r) => !purged.has(r.workflow_id)).map((r) => {
    const live = db.prepare('SELECT status FROM jobs WHERE workflow_id=?').all(r.workflow_id).filter((j) => !SETTLED.has(j.status)).length;
    const cited = cites ? Number(db.prepare('SELECT count(*) n FROM work_citations c JOIN job_artifacts a ON a.artifact_id=c.artifact_id WHERE a.workflow_id=?').get(r.workflow_id).n) : 0;
    const why = live ? `${live} job(s) not settled` : cited ? `${cited} Work citation(s) pin its evidence` : null;
    return { workflowId: r.workflow_id, endedAt: r.ended_at, ok: !why, ...(why ? { why } : {}) };
  });
}

/**
 * Housekeeping sweep: for every enrolled ledger, Q5 + vacuum, then Q6 purge of the expired workflows. Dry run by
 * default: reports what it would delete and purge. `allocation.housekeeping.workflowRetentionMs` overrides 30 days.
 */
export async function sweepLedgers({ apply = false, now = Date.now(), env = process.env, allocation = allocationSettings(), files = null, machineFile = null,
  archiveRoot = null, purge = null, config } = {}) {
  const out = { ok: true, apply: Boolean(apply), freedBytes: 0, deleted: 0, retained: [], skipped: [], purged: [], errors: [] };
  const retentionMs = positiveNumber(allocation?.housekeeping?.workflowRetentionMs, WORKFLOW_RETENTION_MS);
  let list = files ? files.map((file) => ({ file, repoRoot: null })) : null;
  if (!list) {
    list = readMachine((m) => m.listLedgers().map((l) => ({ file: l.file, repoRoot: l.repoRoot })), null, { file: machineFile ?? machineFileFor(env), env });
    if (!list) return out;
  }
  const purgeFn = purge ?? (await import('../work/purge-workflow.mjs')).purgeWorkflow;
  for (const { file: raw, repoRoot } of list) {
    const file = path.resolve(String(raw));
    if (!fs.existsSync(file)) { out.skipped.push({ path: file, reason: 'ledger-file-missing' }); continue; }
    let ledger = null;
    let expired = [];
    try {
      const before = familySize(file);
      if(apply)ledger = openLedger({ file });
      else {const db=openLedgerReader(file);ledger={db,close:()=>db.close()};}
      const repo = repoRoot ?? ledger.db.prepare("SELECT value FROM meta WHERE key='repo_root'").get()?.value ?? null;
      if (apply) {
        const r = retainLedgerDb(ledger.db, { now });
        out.deleted += r.debugLogsDeleted;
        out.retained.push({ path: file, debugLogsDeleted: r.debugLogsDeleted, vacuumed: r.vacuumed, freedBytes: Math.max(0, before - familySize(file)) });
      } else {
        const n = has(ledger.db, 'logs') ? Number(ledger.db.prepare("SELECT count(*) n FROM logs WHERE level='debug' AND at < ?").get(now - DEBUG_LOG_RETENTION_MS).n) : 0;
        out.deleted += n;
        out.retained.push({ path: file, dryRun: true, debugLogsDeletable: n });
      }
      expired = expiredWorkflows(ledger.db, { now, retentionMs }).map((w) => ({ ...w, repo }));
    } catch (error) { out.errors.push({ path: file, error: String(error?.message ?? error) }); continue; }
    finally { try { ledger?.close(); } catch { /* closed */ } }
    for (const w of expired) {
      if (!w.ok) { out.skipped.push({ path: file, workflowId: w.workflowId, reason: 'kept', detail: w.why }); continue; }
      if (!w.repo) { out.errors.push({ path: file, workflowId: w.workflowId, error: 'the ledger names no repo_root: purge-workflow cannot resolve it' }); continue; }
      try {
        const approval=workflowPurgeApproval(w.repo,config);
        if(!approval){out.skipped.push({path:file,workflowId:w.workflowId,reason:'workflow-purge-policy-not-adopted'});continue;}
        const r = purgeFn({ repo: w.repo, workflowId: w.workflowId, apply, approvedBy: approval.by, approvalRef: approval.ref,
          ...(archiveRoot ? { archiveRoot } : {}), now: () => now });
        out.purged.push({ path: file, workflowId: w.workflowId, endedAt: w.endedAt, dryRun: !apply, archive: r.archive ?? r.purge?.archive_path ?? null, counts: r.counts ?? null, state: r.purge?.state ?? null });
      } catch (error) { out.errors.push({ path: file, workflowId: w.workflowId, error: String(error?.message ?? error) }); }
    }
  }
  out.ok = out.errors.length === 0;
  return out;
}
