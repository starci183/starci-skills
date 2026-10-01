#!/usr/bin/env node
// blob-gc.mjs — mark-and-sweep of the content-addressed blob store (ARCHITECTURE-DB §4.2, GC controller trigger
// `blob-sweep`), with the retention policy Q4-Q6 and archive-before-delete.
//
//   node scripts/housekeeping/blob-gc.mjs [--json]            dry run (default): marks, candidates, bytes; writes nothing
//   node scripts/housekeeping/blob-gc.mjs --apply [--json]    archive, verify, mark archived, then remove the files
//
// Mark: for EACH ledger machine.ledgers enrols (state <> 'retired'), opened read-only one at a time (no ATTACH),
// every column its blob_ref_columns table names contributes the sha256 values it holds; then the same for
// machine.sqlite. A blob with pinned=1 in any DB is always marked (a Work record cites it: kept forever).
// Retention (Q4) removes a reference from the mark set, never a row:
//   - op_attempts prompt/transcript/session and sup_attempts prompt/transcript: kept while the workflow (the Supervisor
//     job) lives; after it ends, 30 days for a pass verdict and 90 days for any other;
//   - attempt_transcript_snapshots: pruned once the attempt's final transcript_sha exists, otherwise the attempt rule;
//   - seat_transcript_snapshots: pruned once the seat session's final agent_sessions.transcript_sha exists, otherwise
//     90 days after the snapshot (a seat has no verdict: the longer window);
//   - agent_sessions.transcript_sha: 90 days after the session ended.
// Q5 (debug logs go to the attempt's raw log blob, not the DB) and Q6 (finished workflows purge their rows after 30
// days, scripts/work/purge-workflow.mjs) need no rule here: a purged row simply stops marking its blobs.
//
// Sweep: a stored blob is removed only when it is in no mark of this run, pinned=0 in every DB, older than the 24 h
// grace (created_at of its rows, else its sidecar; the grace covers put-before-insert), and archived_at IS NOT NULL
// in every DB that holds a row for it. An unmarked blob past the grace that is not archived yet is first written to a
// verified zip under <archive-root>/blob-retention-<date>/ (entry name = sha256, re-read and re-hashed), then marked
// archived through the writers, then removed. Every run is one gc_runs row (trigger blob-sweep) with its gc_marks and
// one gc_items row per blob it archived, removed or refused.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { artifactRoot } from '../../engine/db/blob.mjs';
import { writeZip, readZip } from '../api/fs/zip-write.mjs';
import { hasLedgerTable, openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineFileFor, openMachineReader } from '../../engine/db/machine.mjs';

export const RETENTION = Object.freeze({ graceMs: 86_400_000, passMs: 30 * 86_400_000, failMs: 90 * 86_400_000, seatMs: 90 * 86_400_000 });
const SHA = /^[a-f0-9]{64}$/;
const ARCHIVE_PART_BYTES = 1024 ** 3;

const columnsOf = (db, table) => { try { return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name); } catch { return []; } };
const has = (db, table, col) => hasLedgerTable(db, table) && (!col || columnsOf(db, table).includes(col));

/** The ledger-side reference queries with the Q4 retention built in; null falls back to a plain DISTINCT. */
function ledgerRefSql(db, table, col) {
  const end = "COALESCE(w.finished_at, w.archived_at)";
  const expired = `(w.phase IN ('finished','archived') AND ${end} IS NOT NULL AND ${end} + (CASE WHEN a.verdict='pass' THEN :pass ELSE :fail END) < :now)`;
  if (table === 'op_attempts' && ['prompt_sha', 'transcript_sha', 'session_sha'].includes(col) && has(db, 'workflows', 'finished_at')) {
    return `SELECT DISTINCT a.${col} AS sha FROM op_attempts a JOIN workflows w ON w.workflow_id=a.workflow_id WHERE a.${col} IS NOT NULL AND NOT ${expired}`;
  }
  if (table === 'attempt_transcript_snapshots' && col === 'sha256' && has(db, 'op_attempts', 'transcript_sha')) {
    return `SELECT DISTINCT s.sha256 AS sha FROM attempt_transcript_snapshots s JOIN op_attempts a ON a.attempt_id=s.attempt_id
      JOIN workflows w ON w.workflow_id=a.workflow_id WHERE a.transcript_sha IS NULL AND NOT ${expired}`;
  }
  return null;
}

/** The machine-side reference queries with retention; null falls back to a plain DISTINCT. */
function machineRefSql(db, table, col) {
  if (table === 'sup_attempts' && ['prompt_sha', 'transcript_sha'].includes(col) && has(db, 'sup_attempts', 'closed_at')) {
    const end = 'COALESCE(closed_at, landed_at, cancelled_at)';
    return `SELECT DISTINCT ${col} AS sha FROM sup_attempts WHERE ${col} IS NOT NULL
      AND NOT (${end} IS NOT NULL AND ${end} + (CASE WHEN verdict='pass' THEN :pass ELSE :fail END) < :now)`;
  }
  if (table === 'agent_sessions' && col === 'transcript_sha' && has(db, 'agent_sessions', 'ended_at')) {
    return 'SELECT DISTINCT transcript_sha AS sha FROM agent_sessions WHERE transcript_sha IS NOT NULL AND NOT (ended_at IS NOT NULL AND ended_at + :seat < :now)';
  }
  if (table === 'seat_transcript_snapshots' && col === 'sha256' && has(db, 'agent_sessions', 'seat_id')) {
    return `SELECT DISTINCT s.sha256 AS sha FROM seat_transcript_snapshots s WHERE s.at + :seat >= :now
      AND NOT EXISTS (SELECT 1 FROM agent_sessions g WHERE g.seat_id=s.seat_id AND g.transcript_sha IS NOT NULL
                      AND (s.terminal_handle IS NULL OR g.terminal_handle IS NULL OR g.terminal_handle=s.terminal_handle))`;
  }
  return null;
}

/** One DB's marks: {marks: Set, pinned: Set, rows: Map sha -> row, refs: [{table, column, count}], error?}. */
export function markSource(db, { kind, now = Date.now(), retention = RETENTION } = {}) {
  const out = { marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error: null };
  if (!hasLedgerTable(db, 'blob_ref_columns')) { out.error = 'no blob_ref_columns table (an old-schema DB): nothing marked from it'; return out; }
  const params = { now, pass: retention.passMs, fail: retention.failMs, seat: retention.seatMs };
  for (const { table_name: table, column_name: col } of db.prepare('SELECT table_name, column_name FROM blob_ref_columns ORDER BY 1,2').all()) {
    if (!has(db, table, col)) { out.refs.push({ table, column: col, count: null, missing: true }); continue; }
    const special = kind === 'machine' ? machineRefSql(db, table, col) : ledgerRefSql(db, table, col);
    const sql = special ?? `SELECT DISTINCT "${col}" AS sha FROM "${table}" WHERE "${col}" IS NOT NULL`;
    const stmt = db.prepare(sql);
    const bound = Object.fromEntries(Object.entries(params).filter(([k]) => sql.includes(`:${k}`)));
    const rows = Object.keys(bound).length ? stmt.all(bound) : stmt.all();
    for (const r of rows) if (SHA.test(String(r.sha))) out.marks.add(r.sha);
    out.refs.push({ table, column: col, count: rows.length, retention: Boolean(special) });
  }
  if (has(db, 'blobs', 'sha256')) {
    for (const r of db.prepare('SELECT sha256, bytes, created_at, pinned, archived_at, archive_ref FROM blobs').all()) {
      out.rows.set(r.sha256, r);
      if (Number(r.pinned) === 1) { out.pinned.add(r.sha256); out.marks.add(r.sha256); }
    }
  }
  return out;
}

/** The ledgers the machine registry enrols (state <> retired): [{ledgerId, name, file}]. */
export function enrolledLedgers(machineDb) {
  if (!hasLedgerTable(machineDb, 'ledgers')) return [];
  const cols = columnsOf(machineDb, 'ledgers');
  const where = cols.includes('state') ? "WHERE state <> 'retired'" : '';
  return machineDb.prepare(`SELECT * FROM ledgers ${where}`).all().map((r) => ({ ledgerId: r.ledger_id, name: r.name ?? r.ledger_id, file: r.file }));
}

/** Every blob file in the store: Map sha -> {file, size, createdAt}. */
export function storeBlobs(root = artifactRoot()) {
  const out = new Map();
  let shards = [];
  try { shards = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && /^[a-f0-9]{2}$/.test(e.name)); } catch { return out; }
  for (const shard of shards) {
    for (const name of fs.readdirSync(path.join(root, shard.name))) {
      if (!SHA.test(name)) continue;
      const file = path.join(root, shard.name, name);
      let st;
      try { st = fs.lstatSync(file); } catch { continue; }
      if (!st.isFile()) continue;
      let createdAt = st.mtimeMs;
      try { const meta = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8')); if (meta.createdAt) createdAt = Date.parse(meta.createdAt) || createdAt; } catch { /* no sidecar */ }
      out.set(name, { file, size: st.size, createdAt });
    }
  }
  return out;
}

const readOnly = (file, fn) => { const db = openLedgerReader(file); try { return fn(db); } finally { db.close(); } };
const readMachineDb = (file, fn) => { const m = openMachineReader({ file }); if (!m) throw new Error('machine.sqlite does not exist'); try { return fn(m.db); } finally { m.close(); } };

/** The dry-run plan. Reads only. */
export async function planBlobGc({ env = process.env, now = Date.now(), retention = RETENTION, machineFile = machineFileFor(env), root = artifactRoot(env) } = {}) {
  const sources = [];
  let ledgers = [];
  if (fs.existsSync(machineFile)) {
    try {
      const m = readMachineDb(machineFile, (db) => { ledgers = enrolledLedgers(db); return markSource(db, { kind: 'machine', now, retention }); });
      sources.push({ name: 'machine', kind: 'machine', file: machineFile, ...m });
    } catch (error) { sources.push({ name: 'machine', kind: 'machine', file: machineFile, marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error: String(error?.message ?? error) }); }
  } else sources.push({ name: 'machine', kind: 'machine', file: machineFile, marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error: 'machine.sqlite does not exist' });
  for (const l of ledgers) {
    if (!fs.existsSync(l.file)) { sources.push({ name: l.name, kind: 'ledger', file: l.file, ledgerId: l.ledgerId, marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error: 'ledger file missing: its blobs are not marked, so nothing is swept this run' }); continue; }
    try { sources.push({ name: l.name, kind: 'ledger', file: l.file, ledgerId: l.ledgerId, ...readOnly(l.file, (db) => markSource(db, { kind: 'ledger', now, retention })) }); }
    catch (error) { sources.push({ name: l.name, kind: 'ledger', file: l.file, ledgerId: l.ledgerId, marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error: String(error?.message ?? error) }); }
  }
  // A source that could not be read, or an old-schema DB without blob_ref_columns, may hold references nobody saw:
  // fail closed, sweep nothing.
  const unreadable = sources.filter((s) => s.error && !(s.kind === 'machine' && /does not exist/.test(s.error)));
  const marked = new Set(sources.flatMap((s) => [...s.marks]));
  const store = storeBlobs(root);
  const toArchive = [], toSweep = [], young = [], kept = [];
  for (const [sha, blob] of store) {
    if (marked.has(sha)) continue;
    const rows = sources.map((s) => s.rows.get(sha)).filter(Boolean);
    if (rows.some((r) => Number(r.pinned) === 1)) { kept.push({ sha, why: 'pinned' }); continue; }
    const created = rows.length ? Math.min(...rows.map((r) => Number(r.created_at) || blob.createdAt)) : blob.createdAt;
    if (created >= now - retention.graceMs) { young.push({ sha, bytes: blob.size }); continue; }
    const item = { sha, bytes: blob.size, file: blob.file, rows: sources.filter((s) => s.rows.has(sha)).map((s) => s.name), ageMs: now - created };
    const archived = rows.length > 0 && rows.every((r) => r.archived_at != null && r.archive_ref);
    (archived ? toSweep : toArchive).push({ ...item, archiveRef: archived ? rows[0].archive_ref : null });
  }
  const bytes = (xs) => xs.reduce((s, x) => s + (x.bytes || 0), 0);
  return {
    schema: 'starci/blob-gc-plan@1', at: now, root, graceMs: retention.graceMs,
    sources: sources.map((s) => ({ name: s.name, kind: s.kind, file: s.file, marks: s.marks.size, pinned: s.pinned.size, rows: s.rows.size, refs: s.refs, error: s.error })),
    marked: marked.size, stored: store.size, storedBytes: bytes([...store.values()].map((b) => ({ bytes: b.size }))),
    blocked: unreadable.map((s) => `${s.name}: ${s.error}`),
    toArchive, toSweep, young: young.length, kept: kept.length,
    orphansPastGrace: [...toArchive, ...toSweep], archiveBytes: bytes(toArchive), sweepBytes: bytes(toSweep),
    marksBySource: Object.fromEntries(sources.map((s) => [s.name, [...s.marks]])),
  };
}

/**
 * The writer functions --apply calls (lanes a3-1 / a3-2 own them). machine-db.mjs: openMachine, startGcRun,
 * addGcMarks, addGcItem, finishGcRun, recordArchive, markMachineBlobArchived, pruneSeatSnapshots (fn(m, args)). ledger-db.mjs:
 * openLedger, markBlobArchived(db, {sha256, archivedAt, archiveRef}), pruneAttemptSnapshots(db, {now, passMs, failMs})
 * - the ledger two are run inside the handle's transaction.
 */
export async function gcWriters() {
  const missing = [];
  let machine = null, ledger = null;
  try { machine = await import('../../engine/db/machine.mjs'); } catch { missing.push('engine/db/machine.mjs'); }
  try { ledger = await import('../../engine/db/ledger.mjs'); } catch { missing.push('engine/db/ledger.mjs'); }
  for (const fn of ['openMachine', 'startGcRun', 'addGcMarks', 'addGcItem', 'finishGcRun', 'recordArchive', 'markMachineBlobArchived', 'pruneSeatSnapshots']) if (machine && typeof machine[fn] !== 'function') missing.push(`machine-db.mjs ${fn}`);
  for (const fn of ['openLedger', 'markBlobArchived', 'pruneAttemptSnapshots']) if (ledger && typeof ledger[fn] !== 'function') missing.push(`ledger-db.mjs ${fn}`);
  return { ok: missing.length === 0, missing, machine, ledger };
}

/** Zip the blobs, re-open the zip and check each entry hashes to its own name. */
function archiveBlobs(items, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const parts = [];
  let cur = [], size = 0;
  for (const it of items) { if (cur.length && (size + it.bytes > ARCHIVE_PART_BYTES || cur.length >= 60_000)) { parts.push(cur); cur = []; size = 0; } cur.push(it); size += it.bytes; }
  if (cur.length) parts.push(cur);
  const zips = [];
  for (const part of parts) {
    const file = path.join(dir, `blobs-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.zip`);
    const written = writeZip(file, part.flatMap((it) => [{ name: it.sha, file: it.file }, ...(fs.existsSync(`${it.file}.json`) ? [{ name: `${it.sha}.json`, file: `${it.file}.json` }] : [])]));
    const read = readZip(file);
    const bad = read.filter((e) => !e.crcOk || (SHA.test(e.name) && crypto.createHash('sha256').update(e.data).digest('hex') !== e.name));
    if (bad.length || read.length !== written.entries.length) { fs.renameSync(file, `${file}.failed`); throw new Error(`${file}: verification failed (${bad.length} bad entries)`); }
    zips.push({ file, bytes: written.bytes, sha256: written.sha256, entries: written.entries.length, shas: part.map((it) => it.sha) });
  }
  return zips;
}

/** Run one sweep. Dry by default; apply needs the writers and the host GC lock. */
export async function runBlobGc({ apply = false, env = process.env, now = Date.now(), archiveRoot = 'D:/starci-archive', retention = RETENTION, writers = null } = {}) {
  const plan = await planBlobGc({ env, now, retention });
  if (!apply) return { ...plan, apply: false };
  if (plan.blocked.length) return { ...plan, apply: true, ok: false, refused: `a source could not be read, so nothing is swept: ${plan.blocked.join('; ')}` };
  const w = writers ?? await gcWriters();
  if (!w.ok) return { ...plan, apply: true, ok: false, refused: `writers missing: ${w.missing.join(', ')}` };
  let lock = null;
  try { const gc = await import('../supervisor/gc.mjs'); lock = gc.acquireGcLock?.({ env, holder: 'blob-gc' }) ?? null; } catch { lock = null; }
  if (lock && !lock.ok) return { ...plan, apply: true, ok: false, busy: true, refused: 'another GC apply holds the host gc lock' };
  const machine = w.machine.openMachine({ env });
  const items = [];
  let runId = null;
  try {
    runId = w.machine.startGcRun(machine, { trigger: 'blob-sweep', startedAt: now, collectors: ['blobs'] });
    w.machine.addGcMarks(machine, runId, Object.entries(plan.marksBySource).flatMap(([source, shas]) => shas.map((sha) => ({ sha256: sha, source }))));
    // Snapshot rows past their retention (Q4 + the final-transcript rule) are pruned by their writers.
    const pruned = { seat: w.machine.pruneSeatSnapshots(machine, { now, seatMs: retention.seatMs }) };
    const date = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
    const zips = plan.toArchive.length ? archiveBlobs(plan.toArchive, path.join(archiveRoot, `blob-retention-${date}`)) : [];
    const refOf = new Map();
    for (const z of zips) {
      w.machine.recordArchive(machine, { archivePath: z.file, kind: 'blob-retention', subject: `gc run ${runId}`, bytes: z.bytes, sha256: z.sha256,
        manifestSha256: null, entries: z.entries, integrity: 'sha-verified', createdAt: now, verifiedAt: Date.now(), expiresAt: null });
      for (const sha of z.shas) refOf.set(sha, `${z.file}!${sha}`);
    }
    // archived_at on every row of every DB, then remove the file.
    const ledgersByName = new Map();
    const ledgerOf = (name) => {
      if (!ledgersByName.has(name)) { const src = plan.sources.find((s) => s.name === name); ledgersByName.set(name, w.ledger.openLedger({ file: src.file })); }
      return ledgersByName.get(name);
    };
    try {
      const inLedger = (name, fn, args) => { const h = ledgerOf(name); return h.transaction((db) => fn(db, args)); };
      for (const name of plan.sources.filter((s) => s.kind === 'ledger').map((s) => s.name)) pruned[name] = inLedger(name, w.ledger.pruneAttemptSnapshots, { now, passMs: retention.passMs, failMs: retention.failMs });
      for (const it of [...plan.toArchive, ...plan.toSweep]) {
        const ref = it.archiveRef ?? refOf.get(it.sha);
        const zip = ref?.split('!')[0];
        if (!ref || !fs.existsSync(zip)) { items.push({ sha: it.sha, action: 'refuse', reason: `no verified archive (${ref ?? 'none'})` }); continue; }
        for (const name of it.rows) {
          if (it.archiveRef) continue;
          if (name === 'machine') w.machine.markMachineBlobArchived(machine, { sha256: it.sha, archivedAt: now, archiveRef: ref });
          else inLedger(name, w.ledger.markBlobArchived, { sha256: it.sha, archivedAt: now, archiveRef: ref });
        }
        let removed = false, error = null;
        try { for (const f of [it.file, `${it.file}.json`]) { if (fs.existsSync(f) && fs.lstatSync(f).isFile()) fs.unlinkSync(f); } removed = !fs.existsSync(it.file); } catch (e) { error = String(e?.message ?? e); }
        items.push({ sha: it.sha, action: removed ? 'removed' : 'failed', bytes: it.bytes, reason: removed ? `archived at ${ref}` : error, verifiedGone: removed });
      }
    } finally { for (const h of ledgersByName.values()) try { h.close?.(); } catch { /* closed */ } }
    for (const it of items) {
      w.machine.addGcItem(machine, { runId, collector: 'blobs', kind: 'blob', target: it.sha, action: it.action, reason: it.reason ?? null, bytes: it.bytes ?? null,
        outcome: it.action === 'removed' ? 'done' : 'gave-up', verifiedGoneAt: it.verifiedGone ? Date.now() : null, at: Date.now() });
    }
    const freed = items.filter((i) => i.action === 'removed').reduce((s, i) => s + (i.bytes || 0), 0);
    w.machine.finishGcRun(machine, runId, { finishedAt: Date.now(), freedBytes: freed,
      counts: { marked: plan.marked, archived: zips.reduce((s, z) => s + z.shas.length, 0), removed: items.filter((i) => i.action === 'removed').length, refused: items.filter((i) => i.action !== 'removed').length, pruned },
      errors: items.filter((i) => i.action !== 'removed').map((i) => `${i.sha}: ${i.reason}`) });
    return { ...plan, apply: true, ok: items.every((i) => i.action === 'removed'), runId, zips, items, freedBytes: freed, pruned };
  } finally {
    try { machine?.close?.(); } catch { /* closed */ }
    try { lock?.release?.(); } catch { /* released */ }
  }
}

function describe(r) {
  const L = [`blob GC ${r.apply ? 'APPLY' : 'dry run'} - store ${r.root}: ${r.stored} blob(s)`];
  for (const s of r.sources) L.push(`  mark ${s.name.padEnd(28)} ${String(s.marks).padStart(7)} sha (${s.pinned} pinned, ${s.rows} blob rows)${s.error ? `  ! ${s.error}` : ''}`);
  L.push(`  marked ${r.marked}; kept ${r.kept} pinned-only, ${r.young} younger than the 24 h grace`);
  L.push(`  archive then remove: ${r.toArchive.length} blob(s) ${(r.archiveBytes / 1024 ** 2).toFixed(1)} MB; remove (already archived): ${r.toSweep.length} blob(s) ${(r.sweepBytes / 1024 ** 2).toFixed(1)} MB`);
  if (r.blocked.length) L.push(`  ! sweeping nothing: ${r.blocked.join('; ')}`);
  if (r.refused) L.push(`  refused: ${r.refused}`);
  if (r.items) L.push(`  removed ${r.items.filter((i) => i.action === 'removed').length}, refused ${r.items.filter((i) => i.action !== 'removed').length}, freed ${(r.freedBytes / 1024 ** 2).toFixed(1)} MB (gc run ${r.runId})`);
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const archiveAt = argv.indexOf('--archive-root');
  runBlobGc({ apply: argv.includes('--apply'), archiveRoot: archiveAt >= 0 ? argv[archiveAt + 1] : 'D:/starci-archive' }).then((r) => {
    const { marksBySource, ...shown } = r;
    console.log(argv.includes('--json') ? JSON.stringify({ ...shown, marksBySource: Object.fromEntries(Object.entries(marksBySource).map(([k, v]) => [k, v.length])) }, null, 2) : describe(r));
    process.exitCode = r.refused ? 1 : 0;
  }, (error) => { console.error(error?.stack ?? error); process.exitCode = 2; });
}
