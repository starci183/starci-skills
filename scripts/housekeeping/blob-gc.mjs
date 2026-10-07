#!/usr/bin/env node
// blob-gc.mjs — read-only retention planning for the content-addressed blob store (docs/ledger-db.md,
// GC controller trigger `blob-sweep`). Destructive apply is unsupported until ordinary reference writers fence deletion.
//
// Internal entry: spawned by scripts/housekeeping/hk-ledger.mjs; not invoked directly.
// Args: [--json]            dry run (default): marks, candidates, bytes; writes nothing
//       --apply [--json]    refused: cross-store blob writer deletion fencing is unsupported
//
// Mark: for EACH ledger machine.ledgers enrols (state <> 'retired'), opened read-only one at a time (no ATTACH),
// every column its blob_ref_columns table names contributes the sha256 values it holds; then the same for
// machine.sqlite. A blob with pinned=1 in any DB is always marked (a Work record cites it: kept forever).
// Retention (Q4) removes a reference from the mark set, never a row:
//   - op_attempts prompt/transcript/session and sup_attempts prompt/transcript: kept while the workflow (the Supervisor
//     job) lives; after it ends, 30 days for a pass verdict and 90 days for any other;
//   - attempt_transcript_snapshots: omitted from marks once the final transcript_sha exists, otherwise the attempt rule;
//   - seat_transcript_snapshots: omitted from marks once the seat's final agent_sessions.transcript_sha exists, otherwise
//     90 days after the snapshot (a seat has no verdict: the longer window);
//   - agent_sessions.transcript_sha: 90 days after the session ended.
// Q5 (debug logs go to the attempt's raw log blob, not the DB) and Q6 (finished workflows purge their rows after 30
// days, scripts/work/purge-workflow.mjs) need no rule here: a purged row simply stops marking its blobs.
//
// Candidates: unmarked/unpinned blobs older than the 24 h grace are described for archive or sweep. Recorded
// archives are read and verified against their existing machine archive identity and exact entry sha/CRC.
// Candidate lists do not authorize deletion: apply returns a refusal and retains every original and DB row.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { artifactRoot } from '../../engine/db/blob.mjs';
import { zipVisit } from '../api/fs/zip-visit.mjs';
import { hasLedgerTable, openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineFileFor, openMachineReader } from '../../engine/db/machine.mjs';

const RETENTION = Object.freeze({ graceMs: 86_400_000, passMs: 30 * 86_400_000, failMs: 90 * 86_400_000, seatMs: 90 * 86_400_000 });
const SHA = /^[a-f0-9]{64}$/;

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

function markReferenceColumns(db, { kind, now, retention }, out) {
  const params = { now, pass: retention.passMs, fail: retention.failMs, seat: retention.seatMs };
  for (const { table_name: table, column_name: col } of db.prepare('SELECT table_name, column_name FROM blob_ref_columns ORDER BY 1,2').all()) {
    if (!has(db, table, col)) { out.refs.push({ table, column: col, count: null, missing: true }); out.error=`incomplete blob reference catalog: ${table}.${col} is missing`; continue; }
    const special = kind === 'machine' ? machineRefSql(db, table, col) : ledgerRefSql(db, table, col);
    const sql = special ?? `SELECT DISTINCT "${col}" AS sha FROM "${table}" WHERE "${col}" IS NOT NULL`;
    const statement = db.prepare(sql);
    const bound = Object.fromEntries(Object.entries(params).filter(([key]) => sql.includes(`:${key}`)));
    const rows = Object.keys(bound).length ? statement.all(bound) : statement.all();
    for (const row of rows) if (SHA.test(String(row.sha))) out.marks.add(row.sha);
    out.refs.push({ table, column: col, count: rows.length, retention: Boolean(special) });
  }
}

function markBlobRows(db, out) {
  if (!has(db, 'blobs', 'sha256')) return;
  for (const row of db.prepare('SELECT sha256, bytes, created_at, pinned, archived_at, archive_ref FROM blobs').all()) {
    out.rows.set(row.sha256, row);
    if (Number(row.pinned) === 1) { out.pinned.add(row.sha256); out.marks.add(row.sha256); }
  }
}

function markArchiveIdentities(db, kind, out) {
  if (kind === 'machine' && has(db, 'archives', 'sha256')) {
    for (const row of db.prepare("SELECT archive_path,sha256 FROM archives WHERE kind='blob-retention'").all()) out.archiveIdentities.set(row.archive_path, row.sha256);
  }
}

/** One DB's marks: {marks: Set, pinned: Set, rows: Map sha -> row, refs: [{table, column, count}], error?}. */
export function markSource(db, { kind, now = Date.now(), retention = RETENTION } = {}) {
  const out = { marks: new Set(), pinned: new Set(), rows: new Map(), archiveIdentities:new Map(), refs: [], error: null };
  if (!hasLedgerTable(db, 'blob_ref_columns')) { out.error = 'no blob_ref_columns table (an old-schema DB): nothing marked from it'; return out; }
  markReferenceColumns(db, { kind, now, retention }, out);
  markBlobRows(db, out);
  markArchiveIdentities(db, kind, out);
  return out;
}

/** The ledgers the machine registry enrols (state <> retired): [{ledgerId, name, file}]. */
function enrolledLedgers(machineDb) {
  if (!hasLedgerTable(machineDb, 'ledgers')) return [];
  const cols = columnsOf(machineDb, 'ledgers');
  const where = cols.includes('state') ? "WHERE state <> 'retired'" : '';
  return machineDb.prepare(`SELECT * FROM ledgers ${where}`).all().map((r) => ({ ledgerId: r.ledger_id, name: r.name ?? r.ledger_id, file: r.file }));
}

/** Every blob file in the store: Map sha -> {file, size, createdAt}. */
function addStoreBlob(root, shard, name, out) {
  if (!SHA.test(name)) return;
  const file = path.join(root, shard, name);
  let stat;
  try { stat = fs.lstatSync(file); } catch { return; }
  if (!stat.isFile()) return;
  let createdAt = stat.mtimeMs;
  try { const meta = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8')); if (meta.createdAt) createdAt = Date.parse(meta.createdAt) || createdAt; } catch { /* no sidecar */ }
  out.set(name, { file, size: stat.size, createdAt });
}

function storeBlobs(root = artifactRoot()) {
  const out = new Map();
  let shards = [];
  try { shards = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && /^[a-f0-9]{2}$/.test(e.name)); } catch { return out; }
  for (const shard of shards) {
    for (const name of fs.readdirSync(path.join(root, shard.name))) addStoreBlob(root, shard.name, name, out);
  }
  return out;
}

const readOnly = (file, fn) => { const db = openLedgerReader(file); try { return fn(db); } finally { db.close(); } };
const readMachineDb = (file, fn) => { const m = openMachineReader({ file }); if (!m) { throw new Error('machine.sqlite does not exist'); } try { return fn(m.db); } finally { m.close(); } };

function emptySource(name, kind, file, error, ledgerId) {
  const source = { name, kind, file };
  if (ledgerId !== undefined) source.ledgerId = ledgerId;
  return { ...source, marks: new Set(), pinned: new Set(), rows: new Map(), refs: [], error };
}

function collectMarkSources({ machineFile, now, retention }) {
  const sources = [];
  let ledgers = [];
  if (fs.existsSync(machineFile)) {
    try {
      const machine = readMachineDb(machineFile, (db) => { ledgers = enrolledLedgers(db); return markSource(db, { kind: 'machine', now, retention }); });
      sources.push({ name: 'machine', kind: 'machine', file: machineFile, ...machine });
    } catch (error) { sources.push(emptySource('machine', 'machine', machineFile, String(error?.message ?? error))); }
  } else sources.push(emptySource('machine', 'machine', machineFile, 'machine.sqlite does not exist'));
  for (const ledger of ledgers) {
    if (!fs.existsSync(ledger.file)) {
      sources.push(emptySource(ledger.name, 'ledger', ledger.file, 'ledger file missing: its blobs are not marked, so nothing is swept this run', ledger.ledgerId));
      continue;
    }
    try { sources.push({ name: ledger.name, kind: 'ledger', file: ledger.file, ledgerId: ledger.ledgerId, ...readOnly(ledger.file, (db) => markSource(db, { kind: 'ledger', now, retention })) }); }
    catch (error) { sources.push(emptySource(ledger.name, 'ledger', ledger.file, String(error?.message ?? error), ledger.ledgerId)); }
  }
  return sources;
}

// The bucket and entry of one blob no ledger marks.
function classifyBlob(sha, blob, sources, now, retention) {
  const rows = sources.map((source) => source.rows.get(sha)).filter(Boolean);
  if (rows.some((row) => Number(row.pinned) === 1)) return { bucket: 'kept', entry: { sha, why: 'pinned' } };
  const created = rows.length ? Math.min(...rows.map((row) => Number(row.created_at) || blob.createdAt)) : blob.createdAt;
  if (created >= now - retention.graceMs) return { bucket: 'young', entry: { sha, bytes: blob.size } };
  const item = { sha, bytes: blob.size, file: blob.file, rows: sources.filter((source) => source.rows.has(sha)).map((source) => source.name), ageMs: now - created };
  const archived = rows.length > 0 && rows.every((row) => row.archived_at != null && row.archive_ref);
  return { bucket: archived ? 'toSweep' : 'toArchive',
    entry: { ...item, archiveRef: archived ? rows[0].archive_ref : null, archiveRefs: archived ? [...new Set(rows.map((row) => row.archive_ref))] : [] } };
}

function classifyBlobs(store, sources, marked, now, retention) {
  const buckets = { toArchive: [], toSweep: [], young: [], kept: [] };
  for (const [sha, blob] of store) {
    if (marked.has(sha)) continue;
    const { bucket, entry } = classifyBlob(sha, blob, sources, now, retention);
    buckets[bucket].push(entry);
  }
  return buckets;
}

function verifySweepArchives(toSweep, sources) {
  const archiveErrors = [], archiveChecks = new Map(), identities = sources.find((source) => source.kind === 'machine')?.archiveIdentities ?? new Map();
  const readArchive = (file) => {
    if (!archiveChecks.has(file)) {
      try { archiveChecks.set(file, zipVisit(file, () => {})); }
      catch (error) { archiveChecks.set(file, error); }
    }
    const checked = archiveChecks.get(file);
    if (checked instanceof Error) throw checked;
    return checked;
  };
  for (const item of toSweep) {
    try {
      for (const ref of item.archiveRefs) {
        const file = String(ref).slice(0, String(ref).lastIndexOf('!'));
        const expected = identities.get(file);
        if (!SHA.test(String(expected))) throw new Error('recorded archive identity is absent');
        verifyBlobArchive(ref, item.sha, { expectedArchiveSha: expected, read: readArchive });
      }
      item.archiveVerified = true;
    } catch (error) {
      item.archiveVerified = false;
      archiveErrors.push(`archive:${item.sha}: ${error.message}`);
    }
  }
  return archiveErrors;
}

const byteTotal = (items) => items.reduce((sum, item) => sum + (item.bytes || 0), 0);

/** The dry-run plan. Reads only. */
export async function planBlobGc({ env = process.env, now = Date.now(), retention = RETENTION, machineFile = machineFileFor(env), root = artifactRoot(env) } = {}) {
  const sources = collectMarkSources({ machineFile, now, retention });
  // A source that could not be read, or an old-schema DB without blob_ref_columns, may hold references nobody saw:
  // fail closed, sweep nothing.
  const unreadable = sources.filter((s) => s.error);
  const marked = new Set(sources.flatMap((s) => [...s.marks]));
  const store = storeBlobs(root);
  const { toArchive, toSweep, young, kept } = classifyBlobs(store, sources, marked, now, retention);
  const archiveErrors = verifySweepArchives(toSweep, sources);
  return {
    schema: 'starci/blob-gc-plan@1', at: now, root, graceMs: retention.graceMs,
    sources: sources.map((s) => ({ name: s.name, kind: s.kind, file: s.file, marks: s.marks.size, pinned: s.pinned.size, rows: s.rows.size, refs: s.refs, error: s.error })),
    marked: marked.size, stored: store.size, storedBytes: byteTotal([...store.values()].map((b) => ({ bytes: b.size }))),
    blocked: [...unreadable.map((s) => `${s.name}: ${s.error}`),...archiveErrors],
    toArchive, toSweep, young: young.length, kept: kept.length,
    orphansPastGrace: [...toArchive, ...toSweep], archiveBytes: byteTotal(toArchive), sweepBytes: byteTotal(toSweep),
    marksBySource: Object.fromEntries(sources.map((s) => [s.name, [...s.marks]])),
  };
}

/** A recorded archive is evidence only after exact entry and archive verification. */
export function verifyBlobArchive(ref,sha,{expectedArchiveSha=null,read=zipVisit}={}){
  if(!SHA.test(String(sha)))throw new Error('archive verification needs an exact blob sha');
  const at=String(ref??'').lastIndexOf('!');
  if(at<1||String(ref).slice(at+1)!==sha)throw new Error('archive reference does not name the exact blob entry');
  const file=String(ref).slice(0,at),summary=read(file,()=>{});
  const entry=summary.entries.find(e=>e.name===sha);
  if(!entry||!entry.crcOk||entry.sha256!==sha||summary.entries.some(e=>!e.crcOk))throw new Error('archive blob digest/CRC verification failed');
  if(expectedArchiveSha&&summary.sha256!==expectedArchiveSha)throw new Error('archive identity mismatch');
  return {ok:true,file,sha,archiveSha256:summary.sha256,bytes:entry.bytes};
}

/**
 * Planning remains read-only. The host GC lock serializes GC processes, but
 * ordinary machine/ledger reference writers do not consume it. No rescan can
 * prove safe unlink of a reused old sha across these stores. Until the existing
 * blob lifecycle has a writer-consumed deletion fence, destructive apply refuses
 * before acquiring locks, opening writers, pruning rows or publishing archives.
 */
export async function runBlobGc({apply=false,env=process.env,now=Date.now(),retention=RETENTION,plan=planBlobGc}={}){
  const observed=await plan({env,now,retention});
  if(!apply)return {...observed,apply:false,ok:!observed.blocked.length};
  return {...observed,apply:true,ok:false,effectState:'none',freedBytes:0,items:[],
    capability:'blob-deletion-fence-unavailable',
    refused:'destructive blob GC is unsupported: the existing GC lock does not fence ordinary cross-store reference writers or old-sha reuse; originals are retained'};
}

function describe(r) {
  const L = [`blob GC ${r.apply ? 'APPLY' : 'dry run'} - store ${r.root}: ${r.stored} blob(s)`];
  L.push(
    ...r.sources.map((s) => `  mark ${s.name.padEnd(28)} ${String(s.marks).padStart(7)} sha (${s.pinned} pinned, ${s.rows} blob rows)${s.error ? '  ! ' + s.error : ''}`),
    `  marked ${r.marked}; kept ${r.kept} pinned-only, ${r.young} younger than the 24 h grace`,
    `  archive then remove: ${r.toArchive.length} blob(s) ${(r.archiveBytes / 1024 ** 2).toFixed(1)} MB; remove (already archived): ${r.toSweep.length} blob(s) ${(r.sweepBytes / 1024 ** 2).toFixed(1)} MB`,
    ...(r.blocked.length ? [`  ! sweeping nothing: ${r.blocked.join('; ')}`] : []),
    ...(r.refused ? [`  refused: ${r.refused}`] : []),
    ...(r.apply ? [`  effect state ${r.effectState}; freed ${(r.freedBytes / 1024 ** 2).toFixed(1)} MB`] : []),
  );
  return L.join('\n');
}

export const blobGcExitCode=r=>(r.ok===false||r.refused||r.blocked?.length||r.items?.some(i=>i.ok===false||['failed','refuse'].includes(i.action)))?1:0;

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const archiveAt = argv.indexOf('--archive-root');
  try {
    const r = await runBlobGc({ apply: argv.includes('--apply'), ...(archiveAt >= 0 ? { archiveRoot: argv[archiveAt + 1] } : {}) });
    const { marksBySource, ...shown } = r;
    console.log(argv.includes('--json') ? JSON.stringify({ ...shown, marksBySource: Object.fromEntries(Object.entries(marksBySource).map(([k, v]) => [k, v.length])) }, null, 2) : describe(r));
    process.exitCode = blobGcExitCode(r);
  } catch (error) { console.error(error?.stack ?? error); process.exitCode = 2; }
}
