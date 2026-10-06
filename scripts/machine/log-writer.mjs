// log-writer.mjs — the ONE buffered typed-log writer of a process (owner ruling 2026-09-27: the typed logs live in the
// ledger, <repo>/.starciwork/runtime.sqlite, and twenty ops plus nine kernels logging must never slow a ledger write).
//
// Every write of the `logs` and `log_cursors` tables goes through here:
//   - its OWN connection to the ledger (engine/db/ledger.mjs openLedgerConnection: WAL, synchronous=NORMAL,
//     busy_timeout 15000, ...), never a caller's handle, so a log write is never inside a caller's ledger transaction;
//   - rows are queued and flushed every <= flushMs (250) or as soon as >= maxRows (200) are queued, in ONE short
//     BEGIN IMMEDIATE transaction per <= maxRows rows with prepared statements (engine/db/ledger.mjs beginImmediate:
//     spin briefly for the lock, then busy_timeout), so the write lock is held for milliseconds, never across a
//     caller's work;
//   - a flush never runs while this process holds a ledger write transaction (ledgerTransactionDepth): it waits for the
//     next tick instead of waiting on a lock its own thread holds;
//   - `write()` (starci kernel log, settle, a read's sync) flushes its rows before it returns, so the caller's own rows are
//     durable (committed to the WAL) when it exits; queued rows are flushed on process exit too. A commit never waits
//     for another writer's fsync (synchronous=NORMAL in WAL fsyncs at checkpoint, not per commit);
//   - an SQLite authorizer on the connection refuses any INSERT/UPDATE/DELETE outside logs, log_cursors and
//     sqlite_sequence: the ui server, which writes only through here, can write nothing else (its other handles are
//     read-only).
// Per-job cap: past perJobCap a job's own rows (not derived ev: rows) are dropped and ONE log.truncated row says so.
// A row whose workflow the ledger does not hold is refused (the FK), counted as `rejected`, never thrown.
import path from 'node:path';
import { appendLog, beginImmediate, ledgerTransactionDepth, LOG_ACTORS, LOG_LEVELS, openLedgerConnection, setLogCursor } from '../../engine/db/ledger.mjs';
import { isBusyError } from '../../engine/db/machine.mjs';
import { guardWrites } from '../../engine/db/authorizer.mjs';

const LOG_FLUSH_MS = 250;
const LOG_FLUSH_ROWS = 200;
const LOG_WRITABLE_TABLES = Object.freeze(['logs', 'log_cursors', 'sqlite_sequence', 'logs_fts', 'logs_fts_data', 'logs_fts_idx', 'logs_fts_docsize', 'logs_fts_config']);
const TRUNCATED = 'log.truncated';
const writers = new Map();
const keyOf = (file) => { const p = path.resolve(file); return process.platform === 'win32' ? p.toLowerCase() : p; };

function createWriter(file, { flushMs = LOG_FLUSH_MS, maxRows = LOG_FLUSH_ROWS } = {}) {
  let db = null, stmts = null, timer = null, refs = 0, closed = false;
  const queue = [];           // {row, perJobCap, now}
  const cursors = new Map();  // name -> {value, mode}
  const stats = { flushes: 0, rows: 0, inserted: 0, duplicate: 0, dropped: 0, rejected: 0, busy: 0, deferred: 0 };

  const connect = () => {
    if (db) return db;
    // Its own connection (wal_autocheckpoint=0: the reconciler engine is the one checkpointer); rows go through the
    // ledger writer's appendLog/setLogCursor, never a statement of this module's own.
    const conn = openLedgerConnection(file);
    guardWrites(conn, { writable: LOG_WRITABLE_TABLES, deletable: (table) => table.startsWith('logs_fts') });
    db = conn;
    stmts = {
      bySrc: db.prepare('SELECT 1 FROM logs WHERE src=?'),
      capped: db.prepare(`SELECT count(*) n FROM logs WHERE job_id=? AND kind<>'${TRUNCATED}' AND (src IS NULL OR src NOT LIKE 'ev:%')`),
      truncated: db.prepare(`SELECT 1 FROM logs WHERE job_id=? AND kind='${TRUNCATED}' LIMIT 1`),
      upTo: db.prepare('SELECT count(*) n FROM (SELECT 1 FROM logs WHERE job_id=? LIMIT ?)'),
      workflow: db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?'),
    };
    return db;
  };

  // Every decision is read BEFORE the write lock (a WAL read needs none): which workflows exist, which srcs are stored,
  // how full each job is. Under the lock only the inserts run (INSERT OR IGNORE still settles a src another process
  // stored meanwhile; the per-job cap is a soft limit, exact within one process). Returns the plan per item.
  const plan = (items) => {
    const known = new Map(), counts = new Map(), batchOf = new Map(), truncated = new Map();
    for (const { row } of items) if (row.jobId) batchOf.set(row.jobId, (batchOf.get(row.jobId) ?? 0) + 1);
    const decisions = [];
    for (const { row, perJobCap, now } of items) {
      if (!known.has(row.workflowId)) known.set(row.workflowId, Boolean(stmts.workflow.get(row.workflowId)));
      if (!known.get(row.workflowId) || !LOG_ACTORS.includes(row.actor) || !LOG_LEVELS.includes(row.level)) { decisions.push({ act: 'reject' }); continue; }
      const capped = row.jobId && row.kind !== TRUNCATED && !String(row.src ?? '').startsWith('ev:');
      if (!capped) { decisions.push({ act: 'insert', row }); continue; }
      if (row.src && stmts.bySrc.get(row.src)) { decisions.push({ act: 'duplicate' }); continue; }
      if (!counts.has(row.jobId)) {
        // Cheap bound first: every row of the job, counted on the job index alone up to the cap. Only a job that could
        // reach the cap with this batch gets the exact count of its own (capped) rows.
        const all = Number(stmts.upTo.get(row.jobId, perJobCap).n);
        counts.set(row.jobId, all + batchOf.get(row.jobId) <= perJobCap ? 0 : Number(stmts.capped.get(row.jobId).n));
      }
      if (counts.get(row.jobId) >= perJobCap) {
        if (!truncated.has(row.jobId)) truncated.set(row.jobId, Boolean(stmts.truncated.get(row.jobId)));
        decisions.push({ act: 'drop', truncate: !truncated.get(row.jobId) ? { now, perJobCap, row } : null });
        truncated.set(row.jobId, true);
        continue;
      }
      counts.set(row.jobId, counts.get(row.jobId) + 1);
      decisions.push({ act: 'insert', row });
    }
    return decisions;
  };

  // One short transaction over `items` (<= maxRows) and the cursor moves; returns its counts.
  const commit = (items, cursorMoves) => {
    const out = { inserted: 0, duplicate: 0, dropped: 0, rejected: 0, seqs: [] };
    const decisions = plan(items);
    beginImmediate(db);
    try {
      for (const d of decisions) {
        if (d.act === 'reject') { out.rejected += 1; out.seqs.push(null); continue; }
        if (d.act === 'duplicate') { out.duplicate += 1; out.seqs.push(null); continue; }
        if (d.act === 'drop') {
          out.dropped += 1; out.seqs.push(null);
          if (d.truncate) appendLog(db, { at: d.truncate.now, workflowId: d.truncate.row.workflowId, jobId: d.truncate.row.jobId, attemptId: d.truncate.row.attemptId ?? null,
            actor: 'runtime', level: 'warn', kind: TRUNCATED, msg: `the job log hit its ${d.truncate.perJobCap}-line cap; later lines are dropped`, data: { cap: d.truncate.perJobCap }, refs: [] });
          continue;
        }
        const { row } = d;
        const r = appendLog(db, { at: row.at, workflowId: row.workflowId, jobId: row.jobId ?? null, attemptId: row.attemptId ?? null, traceId: row.traceId ?? null,
          spanId: row.spanId ?? null, actor: row.actor, nodeId: row.nodeId ?? null, level: row.level, kind: row.kind, msg: row.msg, data: row.data ?? {}, refs: row.refs ?? [],
          src: row.src ?? null, orIgnore: true });
        if (r.changes) { out.inserted += 1; out.seqs.push(Number(r.lastInsertRowid)); }
        else { out.duplicate += 1; out.seqs.push(null); }
      }
      for (const [name, { value, mode }] of cursorMoves) setLogCursor(db, { name, value, mode });
      db.exec('COMMIT');
    } catch (error) { try { db.exec('ROLLBACK'); } catch { /* none open */ } throw error; }
    stats.flushes += 1; stats.rows += items.length;
    for (const k of ['inserted', 'duplicate', 'dropped', 'rejected']) stats[k] += out[k];
    return out;
  };

  const push = (rows, { perJobCap = 2000, now = Date.now(), cursors: moves = [] } = {}) => {
    if (closed) throw Object.assign(new Error('log writer is closed'), { code: 'log-writer-closed' });
    for (const row of rows) queue.push({ row, perJobCap, now });
    for (const { name, value, mode = 'set' } of moves) {
      const prev = cursors.get(name);
      cursors.set(name, { value: mode === 'max' && prev ? Math.max(prev.value, value) : value, mode });
    }
  };

  const isBusy = isBusyError;

  /** Flush everything queued, in chunks of <= maxRows; cursors ride on the last chunk. Returns the summed counts. */
  const flush = ({ force = false } = {}) => {
    if (timer) { clearTimeout(timer); timer = null; }
    const out = { inserted: 0, duplicate: 0, dropped: 0, rejected: 0, seqs: [], deferred: false };
    if (!queue.length && !cursors.size) return out;
    if (!force && ledgerTransactionDepth() > 0) { stats.deferred += 1; out.deferred = true; schedule(); return out; }
    connect();
    while (queue.length || cursors.size) {
      const items = queue.slice(0, maxRows);
      const moves = items.length === queue.length ? [...cursors] : [];
      let r;
      try { r = commit(items, moves); }
      catch (error) {
        if (isBusy(error)) { stats.busy += 1; out.deferred = true; schedule(); return out; }
        // Anything else is this chunk's own fault: it leaves the queue so it cannot poison every later flush.
        queue.splice(0, items.length);
        if (moves.length) cursors.clear();
        throw error;
      }
      queue.splice(0, items.length);
      if (moves.length) cursors.clear();
      for (const k of ['inserted', 'duplicate', 'dropped', 'rejected']) out[k] += r[k];
      out.seqs.push(...r.seqs);
    }
    return out;
  };
  const schedule = () => { if (timer || closed) return; timer = setTimeout(() => { timer = null; try { flush(); } catch (error) { process.stderr.write(`log-writer flush failed: ${error?.message ?? error}\n`); } }, flushMs); timer.unref?.(); };

  const writer = {
    file,
    get db() { return connect(); },
    stats,
    get pending() { return queue.length; },
    /** Queue prepared rows (typed-logs.mjs prepareLogRow `row`s) and cursor moves; flushed by the timer or at maxRows. */
    enqueue(rows = [], options = {}) {
      push(rows, options);
      if (queue.length >= maxRows) { try { flush(); } catch (error) { process.stderr.write(`log-writer flush failed: ${error?.message ?? error}\n`); } }
      else schedule();
    },
    /**
     * Queue `rows` and flush now: the caller's rows are committed when this returns (unless the process holds a ledger
     * transaction, then {deferred:true} and the next tick writes them). {inserted, duplicate, dropped, rejected, seqs}
     * for THIS call's rows (earlier queued rows are flushed first).
     */
    write(rows = [], options = {}) {
      const earlier = flush();
      if (earlier.deferred) { writer.enqueue(rows, options); return { inserted: 0, duplicate: 0, dropped: 0, rejected: 0, seqs: [], deferred: true }; }
      push(rows, options);
      return flush();
    },
    flush,
    retain() { refs += 1; return writer; },
    /** Drop one reference; the last one flushes and closes the connection. */
    release() {
      refs = Math.max(0, refs - 1);
      if (refs > 0) return;
      writer.close();
    },
    close() {
      try { flush({ force: true }); } catch (error) { process.stderr.write(`log-writer close flush failed: ${error?.message ?? error}\n`); }
      if (timer) { clearTimeout(timer); timer = null; }
      closed = true;
      try { db?.close(); } catch { /* closing */ }
      db = null; stmts = null;
      writers.delete(keyOf(file));
    },
  };
  return writer;
}

/** The process's writer for the ledger `file` (one per file per process), created on first use. */
export function logWriterFor(file, options = {}) {
  const key = keyOf(file);
  let w = writers.get(key);
  if (!w) { w = createWriter(path.resolve(file), options); writers.set(key, w); }
  return w;
}

/** Flush every writer of this process (on exit: the rows a CLI queued are durable before it ends). */
function flushAllLogWriters({ force = true } = {}) {
  for (const w of writers.values()) { try { w.flush({ force }); } catch (error) { process.stderr.write(`log-writer exit flush failed: ${error?.message ?? error}\n`); } }
}
process.once('exit', () => flushAllLogWriters());
