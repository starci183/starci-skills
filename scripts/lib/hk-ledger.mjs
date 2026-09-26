// hk-ledger.mjs — ledger retention housekeeping (audit E1: product `.starciwork/runtime.sqlite`
// files grew without bound).
//
// The retention path itself is not new: engine/ledger-db.mjs once carried it as
// `compactSnapshots`/`RETENTION`, `reclaimSpace` and `checkpointLedger`, deleted by a5f2b1e3c
// ("opening a ledger writes nothing; delete the dead retention/anchor/arbiter surface") because
// nothing ever called it — and because running it on every open made reads wait on the write lock.
// This module is the caller it never had, in the only two safe places: `api finish` (the workflow's
// own finish event) and the housekeeping sweep (finished ledgers only).
//
// What retention does — never history erasure (docs/ledger-db.md §5: finish keeps goals/events/jobs):
//   1. state_snapshots compaction: the reserved table keeps ONE state body per
//      (workflow, generation, goal_identity), only the newest `save:` checkpoint per generation,
//      and nothing from dropped generations — the deleted engine RETENTION verbatim.
//   2. PRAGMA wal_checkpoint(TRUNCATE): folds the -wal back into the main file and zeroes it.
//      The WAL is the unbounded growth: auto-checkpoint replays pages but never shrinks the file.
//   3. PRAGMA incremental_vacuum: hands freelist pages back to the filesystem; a no-op on ledgers
//      created before auto_vacuum=INCREMENTAL was set (reclaimSpace's original contract).
//
// The liveness fence is the ledger's own state, no host probe: a ledger is retainable only when
// EVERY workflow row is finished or archived, no `signals scope='kernel'` seat row exists (the
// kernel liveness singleton start-workflow reserves and api finish deletes), and no job sits
// outside the settled statuses. Anything else is skipped — never vacuum a ledger a kernel still
// holds. The decision is re-taken inside BEGIN IMMEDIATE before any write, so a kernel booting
// between probe and retain lands in the transaction window and flips the answer back to skipped.
import fs from 'node:fs';
import path from 'node:path';
import { inspectLedger, machineFileFor, openLedger, openMachine, JOB_STATUSES } from '../../engine/ledger-db.mjs';
import { allocationSettings } from '../../engine/config.mjs';

const SETTLED = JOB_STATUSES.settled;
const statSize = (file) => { try { return fs.statSync(file).size; } catch { return 0; } };
/** db + -wal + -shm: the bytes the filesystem actually holds for one ledger. */
const familySize = (file) => statSize(file) + statSize(`${file}-wal`) + statSize(`${file}-shm`);
const positiveMs = (value) => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; };
const positiveInt = (value) => { const n = Number(value); return Number.isInteger(n) && n >= 1 ? n : null; };

/**
 * The one eligibility question, answered from the ledger alone. Returns null when the file may be
 * retained, else {reason, detail?}. Order: live phases first (they name the workflow still owed),
 * then the kernel seat, then unsettled jobs, then the freshness window the contract may declare.
 */
export function ledgerHoldOf(db, { now = Date.now(), minFinishedAgeMs = 0 } = {}) {
  const workflows = db.prepare('SELECT workflow_id,phase,archived_at,updated_at FROM workflows ORDER BY workflow_id').all();
  if (!workflows.length) return { reason: 'empty-ledger' };
  const live = workflows.filter((row) => row.phase !== 'finished' && row.archived_at === null).map((row) => row.workflow_id);
  if (live.length) return { reason: 'workflows-live', detail: live };
  const seats = db.prepare("SELECT key FROM signals WHERE scope='kernel' ORDER BY key").all().map((row) => row.key);
  if (seats.length) return { reason: 'kernel-signal-held', detail: seats };
  const openJobs = Number(db.prepare(`SELECT count(*) n FROM jobs WHERE status NOT IN (${SETTLED.map(() => '?').join(',')})`).get(...SETTLED).n);
  if (openJobs) return { reason: 'unsettled-jobs', detail: openJobs };
  if (minFinishedAgeMs > 0) {
    const youngest = Math.max(...workflows.map((row) => Number(row.updated_at) || 0));
    if (now - youngest < minFinishedAgeMs) return { reason: 'recently-finished', detail: { youngest, minFinishedAgeMs } };
  }
  return null;
}

/**
 * The deleted engine RETENTION={snapshotBodiesKept:1}, ledger-wide form: nothing below each
 * workflow's newest generation, ONE state body per (workflow, generation, goal_identity), only the
 * newest `save:` checkpoint per generation. Reserved-table rows only — audit history is untouched.
 */
export function compactSnapshots(db, { keep = 1 } = {}) {
  const bodiesCleared = db.prepare(`UPDATE state_snapshots SET state_json='' WHERE state_json<>'' AND snapshot_id NOT IN (
      SELECT snapshot_id FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id
        AND s.generation=state_snapshots.generation AND s.goal_identity=state_snapshots.goal_identity
        ORDER BY s.snapshot_id DESC LIMIT ?)`).run(keep).changes;
  const saves = db.prepare(`DELETE FROM state_snapshots WHERE checkpoint_id LIKE 'save:%' AND snapshot_id<>(
      SELECT max(snapshot_id) FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id
        AND s.generation=state_snapshots.generation)`).run().changes;
  const dropped = db.prepare(`DELETE FROM state_snapshots WHERE generation<(
      SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id)`).run().changes;
  return { deleted: saves + dropped, bodiesCleared };
}

/** wal_checkpoint(TRUNCATE): the deleted runCheckpoint, tolerant of a busy or non-WAL file. */
const runCheckpoint = (db) => {
  try {
    const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() ?? { busy: 0, log: 0, checkpointed: 0 };
    return { ok: !row.busy, busy: Boolean(row.busy), logFrames: Number(row.log), checkpointedFrames: Number(row.checkpointed) };
  } catch (error) {
    return { ok: false, busy: false, error: String(error?.message ?? error) };
  }
};
/** Give freelist pages back where the file was created to allow it; a no-op on an older file. */
const reclaimSpace = (db) => { try { db.exec('PRAGMA incremental_vacuum'); return true; } catch { return false; } };

/**
 * Run the retention path on an open read-write db (an openLedger().db). Refuses — by re-checking
 * the eligibility inside the write lock — anything a live kernel can still hold. Call outside every
 * transaction: it opens its own BEGIN IMMEDIATE for the eligibility re-check + snapshot compaction,
 * then checkpoints and vacuums outside it (both pragmas refuse inside a transaction).
 * `minFinishedAgeMs` is the sweep's freshness window; `api finish` passes 0 — it IS the finish.
 */
export function retainLedgerDb(db, { now = Date.now(), minFinishedAgeMs = 0, snapshotBodiesKept = 1 } = {}) {
  if (!db) throw Error('retainLedgerDb needs an open ledger db');
  const hold = ledgerHoldOf(db, { now, minFinishedAgeMs });
  if (hold) return { retained: false, reason: hold.reason, detail: hold.detail ?? null, deleted: 0, bodiesCleared: 0 };
  let compacted;
  db.exec('BEGIN IMMEDIATE');
  try {
    const raced = ledgerHoldOf(db, { now, minFinishedAgeMs });
    if (raced) { db.exec('ROLLBACK'); return { retained: false, reason: raced.reason, detail: raced.detail ?? null, deleted: 0, bodiesCleared: 0 }; }
    compacted = compactSnapshots(db, { keep: snapshotBodiesKept });
    db.exec('COMMIT');
  } catch (error) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw error; }
  return { retained: true, ...compacted, checkpoint: runCheckpoint(db), vacuumed: reclaimSpace(db) };
}

/** What a dry-run would give back: the WAL's bytes, the freelist's pages, the rows compaction would drop. */
function estimatedReclaimable(db, file) {
  const pageSize = Number(db.prepare('PRAGMA page_size').get().page_size);
  const freelistPages = Number(db.prepare('PRAGMA freelist_count').get().freelist_count);
  const walBytes = statSize(`${file}-wal`);
  const deleted = Number(db.prepare(`SELECT count(*) n FROM state_snapshots WHERE checkpoint_id LIKE 'save:%' AND snapshot_id<>(
      SELECT max(snapshot_id) FROM state_snapshots s WHERE s.workflow_id=state_snapshots.workflow_id
        AND s.generation=state_snapshots.generation)`).get().n)
    + Number(db.prepare(`SELECT count(*) n FROM state_snapshots WHERE generation<(
      SELECT max(generation) FROM state_snapshots m WHERE m.workflow_id=state_snapshots.workflow_id)`).get().n);
  return { bytes: walBytes + freelistPages * pageSize, walBytes, freelistPages, deleted };
}

/**
 * The housekeeping sweep over ledger files: `files` when given, else every ledger the machine
 * registry knows (`ledgers.file`; a host with no registry has nothing enrolled). A read-only probe
 * decides eligibility first; apply re-checks it under the write lock before touching a byte.
 * `allocation` is the runtimes.yaml allocation block: `housekeeping.ledgerRetentionMs` (a finished
 * ledger younger than that is left to settle) and `housekeeping.snapshotBodiesKept` when the
 * contract declares them.
 * Returns the standard hk shape: { ok, freedBytes, deleted, skipped: [{path,reason}], errors: [{path,error}] }.
 */
export function sweepLedgers({ apply = false, now = Date.now(), env = process.env, allocation = allocationSettings(), files = null, machineFile = null } = {}) {
  const out = { ok: true, apply: Boolean(apply), freedBytes: 0, deleted: 0, retained: [], skipped: [], errors: [] };
  const minFinishedAgeMs = positiveMs(allocation?.housekeeping?.ledgerRetentionMs);
  const keep = positiveInt(allocation?.housekeeping?.snapshotBodiesKept) ?? 1;
  let list = files;
  if (!list) {
    const file = machineFile ?? machineFileFor(env);
    if (!fs.existsSync(file)) return out;
    const machine = openMachine({ file, env });
    try { list = machine.db.prepare('SELECT file FROM ledgers ORDER BY ledger_id').all().map((row) => row.file); }
    finally { machine.close(); }
  }
  for (const entry of new Set(list.map((file) => path.resolve(String(file))))) {
    const file = entry;
    if (!fs.existsSync(file)) { out.skipped.push({ path: file, reason: 'ledger-file-missing' }); continue; }
    let probe = null;
    try {
      probe = inspectLedger({ file });
      const hold = ledgerHoldOf(probe.db, { now, minFinishedAgeMs });
      if (hold) { out.skipped.push({ path: file, reason: hold.reason, ...(hold.detail !== undefined ? { detail: hold.detail } : {}) }); continue; }
      if (!apply) {
        const estimate = estimatedReclaimable(probe.db, file);
        out.freedBytes += estimate.bytes;
        out.deleted += estimate.deleted;
        out.retained.push({ path: file, dryRun: true, ...estimate });
        continue;
      }
    } catch (error) { out.errors.push({ path: file, error: String(error?.message ?? error) }); continue; }
    finally { try { probe?.close(); } catch { /* closed already or never opened */ } }
    let ledger = null;
    try {
      const before = familySize(file);
      ledger = openLedger({ file });
      const result = retainLedgerDb(ledger.db, { now, minFinishedAgeMs, snapshotBodiesKept: keep });
      if (!result.retained) { out.skipped.push({ path: file, reason: result.reason, ...(result.detail !== undefined && result.detail !== null ? { detail: result.detail } : {}) }); continue; }
      const freedBytes = Math.max(0, before - familySize(file));
      out.freedBytes += freedBytes;
      out.deleted += result.deleted;
      out.retained.push({ path: file, freedBytes, deleted: result.deleted, bodiesCleared: result.bodiesCleared, checkpoint: result.checkpoint, vacuumed: result.vacuumed });
    } catch (error) { out.errors.push({ path: file, error: String(error?.message ?? error) }); }
    finally { try { ledger?.close(); } catch { /* a failed open leaves nothing to close */ } }
  }
  out.ok = out.errors.length === 0;
  return out;
}
