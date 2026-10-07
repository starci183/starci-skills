// engine/db/machine.mjs — the ONE writer of machine.sqlite (DBTREE.sql Part B, schema 'starci/machine@1', user_version MACHINE_VERSION).
//
// machine.sqlite is the host's single operational store: the ledger registry, the Supervisor (sup_*), the engine
// reconciler (process_runs, engine_leader, leader_history, schedules, engine_actions, controller_modes, sla_episodes),
// services, seats and deliveries, throttle and pool backoff, GC, the land queue, lanes, pushes, machine_logs (+FTS5),
// metrics and notifications. It replaces reconciler.sqlite, the supervisor ledger, journal.sqlite, the JSON state files
// (ram-throttle.json, gc-state.json, reconciler-starts.json, the heartbeat, the land queue dirs, connectors/, env-servers/,
// uat-slots/) and the text logs. The DDL is engine/db/schema/machine.sql (executed as data).
//
// Connection policy (DBTREE header, RESEARCH-STORAGE §3):
//   new file : page_size=4096, auto_vacuum=INCREMENTAL before the first table, then journal_mode=WAL (anything else refuses)
//   writer   : synchronous=NORMAL, foreign_keys=ON, busy_timeout=15000, temp_store=MEMORY, cache_size=-16000,
//              journal_size_limit=64 MiB, trusted_schema=OFF, wal_autocheckpoint=0 on EVERY connection. The one checkpointer
//              is the reconciler engine LEADER: openMachine({checkpointer:true}) + checkpoint({name, holder, epoch}) on its
//              60 s timer, a PASSIVE checkpoint fenced on the engine_leader row (a standby or a draining engine never
//              checkpoints). SQLite 3.50.4 (Node 25.2.1) is in the WAL-reset bug range 3.7.0–3.51.2: two checkpoints close
//              together while another connection resets the WAL can drop a committed transaction (incident 2026-09-28).
//   writes   : BEGIN IMMEDIATE transactions (handle.transaction) or single autocommit statements, busy_timeout 15000.
//   corrupt  : a transient SQLITE_CORRUPT / SQLITE_NOTADB is retried after reopening the connection (CORRUPT_RETRY_DELAYS_MS):
//              an autocommit statement alone, a transaction as a whole. A retry that recovers is a machine_logs warn row;
//              one that persists throws STARCI_MACHINE_CORRUPT and is recorded as an incident (machine_logs error row,
//              or the outbox when the store refuses it). Never swallowed: readMachine rethrows it too.
//   outbox   : <machine.sqlite>.outbox.jsonl, append-only: a typed write the store refused (writeOrDefer) waits there
//              and the next flushOutbox (the land gate) applies it. Only idempotent writers are deferrable (DEFERRABLE).
//   reader   : readOnly, query_only=ON, busy_timeout=15000; observer diagnostics never persist
//   startup  : sqlite_version, node_version, journal_mode and user_version are recorded in machine_meta; a file that is
//              not 'starci/machine@1' at user_version MACHINE_VERSION is refused — a fresh machine.sqlite is created by
//              openMachine on first use from engine/db/schema/machine.sql. The store has exactly one schema: an existing file that is not exactly that schema is refused unchanged, for writers and readers alike, and has no upgrade path.
// Nothing outside engine/ opens machine.sqlite with `new DatabaseSync`: callers use openMachine / openMachineReader / openMachineObserver /
// withMachine / readMachine and the typed functions on the handle.
import { assertMutationFence } from '../../scripts/lib/mutation-fence.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { putBlob as storeBlob, blobPath, getBlob } from './blob.mjs';
import { redactBytes, redactData, redactText } from '../../scripts/lib/redact.mjs'; import { isMain } from '../../scripts/lib/is-main.mjs';
import { isSpecRun, readEnv } from '../../scripts/lib/env.mjs';
import { pathKey } from '../../scripts/lib/path-key.mjs'; import { pidAlive } from '../../scripts/lib/pid-alive.mjs';
import { insertRowWith } from '../../scripts/lib/sqlite.mjs';
import { need as refuseUnless } from '../refuse.mjs';
import { sha256 } from '../digest.mjs';
import { starciLocalRoot } from '../runtime-root.mjs';
import { machineSchemaMethods } from './machine-schema.mjs';
import { machineConnectionMethods, corruptDiagnostic, MACHINE_BUSY_TIMEOUT_MS, MACHINE_CORRUPT_CODE, CORRUPT_RETRY_DELAYS_MS,
  waitForRetry, isCorruptError, isBusyError, errText } from './machine-connection.mjs';
export { MACHINE_BUSY_CODE, isMachineBusy, isBusyError } from './machine-connection.mjs';
import { providerReservationMethods } from './provider-reservations.mjs';

const require = createRequire(import.meta.url);
const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const MACHINE_SCHEMA = 'starci/machine@1';
export const MACHINE_VERSION = 3;
/** Test seam: STARCI_MACHINE_BUSY_TIMEOUT_MS (a positive integer) replaces the writer's busy_timeout; unset in production. */
const busyTimeoutOf = (env = process.env) => { const n = Number(env?.STARCI_MACHINE_BUSY_TIMEOUT_MS); return Number.isInteger(n) && n > 0 ? n : MACHINE_BUSY_TIMEOUT_MS; };
export const INIT_SQL_FILE = path.join(ENGINE_DIR, 'schema', 'machine.sql');
export const CONTROLLERS = Object.freeze(['job', 'workflow', 'resource', 'host', 'gc', 'workers', 'learning']);

// ---------------------------------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Overrides the per-host state base itself (machine.sqlite, projects/, archive/), the one seam starciLocalRoot and
 * engine/db/ledger.mjs (which re-exports starciLocalRoot for its own projectsRootFor) both read. Debug probes and
 * throwaway repos (skills/starci/references/host-maintenance.md) point this at a temp directory so they never touch the real
 * <runtime root>/.runtime and leak fake ledgers/workflows into it (2026-09-30 incident: probe-*, dbg-ask-*, dbg-env*
 * repos left six fake-worker ledgers in the live store). STARCI_PROJECTS_ROOT (ledger-db.mjs) and
 * STARCI_TEST_MACHINE_FILE (TEST_REGISTRY_ENV) are narrower overrides that still win over this one when set.
 */
export { LOCAL_ROOT_ENV, starciLocalRoot } from '../runtime-root.mjs';
/** <local root>/projects: one directory per ledger (decision Q1). */
export const localProjectsRoot = (env = process.env) => path.join(starciLocalRoot(env), 'projects');
/** The runtime.sqlite of one ledger (decision Q1): <runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite. */
export const projectLedgerFile = (ledgerId, env = process.env) => {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(String(ledgerId ?? ''))) throw new Error(`projectLedgerFile needs a ledger id, got ${ledgerId}`);
  return path.join(localProjectsRoot(env), String(ledgerId), 'runtime.sqlite');
};
/** The explicit test registry: a machine.sqlite that replaces the host's for this process tree (tests/setup/isolated-registry.mjs). */
export const TEST_REGISTRY_ENV = 'STARCI_TEST_MACHINE_FILE';
const normDir = (file) => pathKey(file, { fold: true });
const tempDirsOf = (env = process.env) => [...new Set([os.tmpdir(), env.TEMP, env.TMP].filter(Boolean)
  .flatMap((dir) => { const out = [normDir(dir)]; try { out.push(normDir(fs.realpathSync.native(dir))); } catch { /* missing */ } return out; }))]
  .filter((dir) => !/^(?:[a-z]:)?$/.test(dir));
/** True when `file` sits under an OS temp directory, as written or as its realpath. */
export function isUnderTempDir(file, { env = process.env, tempDirs = tempDirsOf(env) } = {}) {
  if (typeof file !== 'string' || !file) return false;
  const forms = [normDir(file)];
  try { forms.push(normDir(fs.realpathSync.native(file))); } catch { /* missing */ }
  return forms.some((form) => tempDirs.map(normDir).some((dir) => form.startsWith(`${dir}/`)));
}
/**
 * machine.sqlite for `env`: TEST_REGISTRY_ENV when set; else <starciLocalRoot>/machine.sqlite (beside projects/) — except inside a node --test
 * process tree whose runtime root is not under the temp directory, which gets a shared temp registry instead.
 */
export const machineFileFor = (env = process.env) => {
  if (env[TEST_REGISTRY_ENV]) return path.resolve(env[TEST_REGISTRY_ENV]);
  const file = path.join(starciLocalRoot(env), 'machine.sqlite');
  if (isSpecRun(env) && !isUnderTempDir(file, { env })) return path.join(os.tmpdir(), 'starci-test-registry', 'machine.sqlite');
  return file;
};

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------------
const need = (ok, message, code = 'STARCI_MACHINE_DB') => refuseUnless(ok, message, code);
const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');
export const newTraceId = () => hex(16);
export const newSpanId = () => hex(8);
const JSON_LIMIT = 65536;
const toJson = (value) => { if (value === undefined || value === null) return null; if (typeof value !== 'string') return JSON.stringify(value); JSON.parse(value); return value; };
const parse = (text) => { if (text == null) { return null; } try { return JSON.parse(text); } catch { return null; } };
const int = (v) => (v === undefined || v === null || v === '' ? null : Math.trunc(Number(v)));
const bool = (v) => { if (v === undefined || v === null) return null; return v ? 1 : 0; };
const writerPragmas = (env) => ({ synchronous: 'NORMAL', busy_timeout: busyTimeoutOf(env), temp_store: 'MEMORY', cache_size: -16000,
  journal_size_limit: 67108864, trusted_schema: 'OFF' });
const pragma = (db, name) => { const row = db.prepare(`PRAGMA ${name}`).get(); return row ? Object.values(row)[0] : null; };
export { pidAlive };
const { openWithRetry, connectionState } = machineConnectionMethods({ reportIncident: corruptIncident });
/** Operational failures also persist their incident through a fresh writer or the deferred outbox. */
function corruptIncident(file, error, details) {
  const out = corruptDiagnostic(file, error, details);
  if (out === error) return out;
  const { retries, where } = details;
  const row = { actor: 'harness', kind: 'machine-db.corrupt', level: 'error', msg: out.message,
    data: { file, where, retries, error: errText(error), errcode: error?.errcode ?? null, quickCheck: out.quickCheck, pid: process.pid, sqlite: process.versions.sqlite, node: process.version } };
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file, { timeout: MACHINE_BUSY_TIMEOUT_MS });
    try {
      db.exec('PRAGMA wal_autocheckpoint=0;');
      db.prepare('INSERT INTO machine_logs(at,actor,level,kind,msg,data_json) VALUES(?,?,?,?,?,?)').run(Date.now(), row.actor, row.level, row.kind, row.msg, JSON.stringify(row.data));
    } finally { db.close(); }
  } catch (e) {
    try { out.deferred = deferWrite({ op: 'log', args: [{ ...row, src: null }], file, error: e }); } catch (error_) { process.stderr.write(`[machine-db] INCIDENT could not be recorded: ${errText(error_)}\n`); }
  }
  return out;
}

/**
 * The rev of the runtime this process runs, as its callers know it: '<HEAD committer time, ms, 13 digits>:<short sha>' of
 * the .claude checkout, which scripts/machine/home.mjs runtimeRevOf computes and the caller passes in (`rev`,
 * `writerRev`, `sourceRev`). The db never spawns git: with no rev passed the default is STARCI_RUNTIME_REV, else
 * 'unknown'. The time prefix orders two revs, so a writer can refuse a store row written by a NEWER runtime (MB-15);
 * 'unknown' sorts before every real rev.
 */
export function runtimeRev() {
  return readEnv('STARCI_RUNTIME_REV') ? String(readEnv('STARCI_RUNTIME_REV')) : 'unknown';
}
/** Order of two runtime revs: <0 when a is older than b (time prefix; anything unparsable is oldest). */
const compareRevs = (a, b) => { const t = (r) => (/^\d{13}:/.test(String(r ?? '')) ? Number(String(r).slice(0, 13)) : -1); return t(a) - t(b); };

const { checkSchema, createSchema } = machineSchemaMethods({ schema: MACHINE_SCHEMA, version: MACHINE_VERSION, initSqlFile: INIT_SQL_FILE, controllers: CONTROLLERS, runtimeRev, pragma });

function openConnection(file, { readOnly = false, env = process.env, now = Date.now, onCorrupt = corruptIncident } = {}) {
  const { DatabaseSync } = require('node:sqlite');
  need(typeof file === 'string' && file.trim(), 'openMachine needs a file');
  if (!readOnly) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  return openWithRetry(() => {
    let db;
    try {
      if (readOnly) {
        db = new DatabaseSync(file, { readOnly: true, timeout: MACHINE_BUSY_TIMEOUT_MS });
        db.exec('PRAGMA query_only=ON; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-16000;');
        checkSchema(db, file);
        return db;
      }
      db = new DatabaseSync(file, { timeout: busyTimeoutOf(env) });
      const empty = Number(pragma(db, 'user_version')) === 0 && !db.prepare("SELECT 1 FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get();
      if (!empty) checkSchema(db, file); // Refuse a store that is not exactly the current schema before persistent WAL/facts changes.
      if (empty) db.exec('PRAGMA page_size=4096; PRAGMA auto_vacuum=INCREMENTAL;');
      const mode = String(pragma(db, 'journal_mode=WAL')).toLowerCase();
      need(mode === 'wal', `machine.sqlite journal_mode is '${mode}', not wal (${file})`, 'STARCI_MACHINE_NOT_WAL');
      db.exec('PRAGMA foreign_keys=ON;');
      for (const [k, v] of Object.entries(writerPragmas(env))) db.exec(`PRAGMA ${k}=${v};`);
      // Never an automatic checkpoint: the engine leader's fenced checkpoint() is the only one (header, G17).
      db.exec('PRAGMA wal_autocheckpoint=0;');
      if (empty) createSchema(db, { file, env, now });
      checkSchema(db, file);
      recordFacts(db);
      return db;
    } catch (error) {
      try { db?.close(); } catch { /* closed */ }
      throw error;
    }
  }, { file, onCorrupt });
}

function recordFacts(db) {
  const facts = { sqlite_version: db.prepare('select sqlite_version() v').get().v, node_version: process.version, journal_mode: String(pragma(db, 'journal_mode')).toLowerCase() };
  const stale = Object.entries(facts).filter(([k, v]) => db.prepare('SELECT value FROM machine_meta WHERE key=?').get(k)?.value !== v);
  if (!stale.length) return;
  const put = db.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  try { for (const [k, v] of stale) put.run(k, v); } catch (error) { if (!isBusyError(error)) throw error; /* another writer records them */ }
}

// ---------------------------------------------------------------------------------------------------------------------
// Generic row writes (column names are checked against the live table; table names are this module's constants)
// ---------------------------------------------------------------------------------------------------------------------
const columnsCache = new WeakMap();
function columnsOf(db, table) {
  let byTable = columnsCache.get(db);
  if (!byTable) { byTable = new Map(); columnsCache.set(db, byTable); }
  if (!byTable.has(table)) {
    const cols = db.prepare(`PRAGMA table_xinfo(${JSON.stringify(table)})`).all().filter((c) => !c.hidden).map((c) => c.name);
    need(cols.length, `machine-db: unknown table ${table}`);
    byTable.set(table, new Set(cols));
  }
  return byTable.get(table);
}
const cellOf = (key, value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (key.endsWith('_json')) return toJson(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};
function rowCells(db, table, row) {
  const cols = columnsOf(db, table);
  const entries = Object.entries(row).map(([k, v]) => [k, cellOf(k, v)]).filter(([, v]) => v !== undefined);
  for (const [k] of entries) need(cols.has(k), `machine-db: ${table} has no column ${k}`);
  return entries;
}
const insertRow = insertRowWith(rowCells);
function upsertRow(db, table, row, keys) {
  const entries = rowCells(db, table, row);
  const updates = entries.filter(([k]) => !keys.includes(k));
  const sql = `INSERT INTO ${table}(${entries.map(([k]) => k).join(',')}) VALUES(${entries.map(() => '?').join(',')}) ON CONFLICT(${keys.join(',')}) DO `
    + (updates.length ? `UPDATE SET ${updates.map(([k]) => k + '=excluded.' + k).join(',')}` : 'NOTHING');
  return db.prepare(sql).run(...entries.map(([, v]) => v));
}
function updateRow(db, table, set, where) {
  const s = rowCells(db, table, set), w = rowCells(db, table, where);
  need(s.length && w.length, `machine-db: update ${table} needs set and where`);
  return db.prepare(`UPDATE ${table} SET ${s.map(([k]) => k + '=?').join(',')} WHERE ${w.map(([k]) => k + ' IS ?').join(' AND ')}`)
    .run(...s.map(([, v]) => v), ...w.map(([, v]) => v));
}

// ---------------------------------------------------------------------------------------------------------------------
// The handle
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Open machine.sqlite read-write (creating it from schema/machine.sql on an empty file). Every connection runs wal_autocheckpoint=0;
 * `checkpointer:true` marks the reconciler engine's connection, the only one allowed to call checkpoint(), and only while
 * the engine_leader row names it (header).
 */
export function openMachine({ file = null, env = process.env, now = Date.now, checkpointer = false, tempDirs = null } = {}) {
  const resolved = path.resolve(file ?? machineFileFor(env));
  const live = !env[TEST_REGISTRY_ENV] && !isUnderTempDir(resolved, { env, tempDirs: tempDirs ?? tempDirsOf(env) });
  return makeHandle(() => openConnection(resolved, { env, now }), { file: resolved, env, now, live, readOnly: false, checkpointer, tempDirs: tempDirs ?? tempDirsOf(env) });
}
/** Open machine.sqlite read-only (query_only); null when the file does not exist yet. */
export function openMachineReader({ file = null, env = process.env, now = Date.now } = {}) {
  const resolved = path.resolve(file ?? machineFileFor(env));
  if (!fs.existsSync(resolved)) return null;
  return makeHandle(() => openConnection(resolved, { readOnly: true }), { file: resolved, env, now, live: false, readOnly: true, checkpointer: false, tempDirs: [] });
}
/** Observation-only reads: supported schemas, bounded retries and diagnostics without incident or recovery writes. */
export function openMachineObserver({ file = null, env = process.env, now = Date.now } = {}) {
  const resolved = path.resolve(file ?? machineFileFor(env));
  if (!fs.existsSync(resolved)) return null;
  const { db, recovered, close } = connectionState(() => openConnection(resolved, { readOnly: true, env, now, onCorrupt: corruptDiagnostic }),
    { file: resolved, onCorrupt: corruptDiagnostic });
  const observer = { schema: MACHINE_SCHEMA, file: resolved, path: resolved, readOnly: true, db, recovered, close };
  for (const [name, fn] of Object.entries({ listLedgers, services, seats, providerHealth, logs, latestMetrics, throttleState, poolBackoff, quotas, hostLeases, budgets }))
    observer[name] = (...args) => fn(observer, ...args);
  return observer;
}
/** fn(handle) over a writer, closed afterwards. */
export function withMachine(fn, options = {}) {
  const m = openMachine(options);
  try { return fn(m); } finally { m.close(); }
}
/** fn(handle) over a reader; `fallback` when the store does not exist or cannot be read — but a corrupt store is thrown, never hidden. */
export function readMachine(fn, fallback = null, options = {}) {
  let m = null;
  try { m = openMachineReader(options); return m ? fn(m) : fallback; }
  catch (error) { if (isCorruptError(error)) { throw error; } return fallback; }
  finally { try { m?.close(); } catch { /* closed */ } }
}

// The fenced unit of a transaction(): COMMIT or ROLLBACK-and-rethrow.
const commitUnit = (db, fn) => { try { assertMutationFence({ kind: 'machine-write', db }); const out = fn(db); db.exec('COMMIT'); return out; } catch (error) { try { if (db.isTransaction) db.raw.exec('ROLLBACK'); } catch { /* none */ } throw error; } };
// transaction()'s catch: a transient corrupt error waits, reopens and retries; anything else (or retries spent) throws.
const retryCorrupt = (error, { file, retries, db }) => { if (!isCorruptError(error) || error.code === MACHINE_CORRUPT_CODE) { throw error; }
  if (retries >= CORRUPT_RETRY_DELAYS_MS.length) { throw corruptIncident(file, error, { retries, where: 'transaction' }); }
  waitForRetry(CORRUPT_RETRY_DELAYS_MS[retries]); try { db.reopen(); } catch (openError) { if (!isCorruptError(openError)) { throw openError; } } };
function makeHandle(openRaw, { file, env, now, live, readOnly, checkpointer, tempDirs }) {
  let depth = 0;
  const { db, recovered, noteRecovered, close } = connectionState(openRaw, { file, inTransaction: () => depth > 0 });
  /**
   * BEGIN IMMEDIATE … COMMIT (nested calls join the open one). A transient corrupt error anywhere in the unit rolls it
   * back, reopens the connection and runs the unit again (bodies are DB-only, RESEARCH-STORAGE §3 rule 3, so a re-run is
   * exact); still corrupt after CORRUPT_RETRY_DELAYS_MS it is an incident.
   */
  const transaction = (fn) => {
    if (depth > 0) return fn(db);            // nested: join the open transaction
    need(!readOnly, 'machine-db: read-only handle');
    for (let retries = 0; ; retries += 1) {
      try {
        db.exec('BEGIN IMMEDIATE');   // a refused BEGIN changed nothing: db.exec backs off (BUSY_RETRY_DELAYS_MS), then throws STARCI_MACHINE_BUSY
        depth += 1;
        let out;
        try { out = commitUnit(db, fn); } finally { depth -= 1; }
        if (retries) noteRecovered({ where: 'transaction', retries });
        return out;
      } catch (error) { retryCorrupt(error, { file, retries, db }); }
    }
  };
  const m = { schema: MACHINE_SCHEMA, file, path: file, db, env, now, live, readOnly, checkpointer: Boolean(checkpointer) && !readOnly, transaction,
    /** Retries that recovered on this handle ({where, retries, at}); close() records them as one machine_logs warn row. */
    recovered,
    close() {
      if (recovered.length) {
        const row = { actor: 'harness', kind: 'machine-db.corrupt-recovered', level: 'warn', msg: `transient SQLITE_CORRUPT recovered ${recovered.length} time(s) on ${path.basename(file)}`,
          data: { file, pid: process.pid, recovered: recovered.slice(0, 20), sqlite: process.versions.sqlite, node: process.version } };
        recovered.length = 0;
        // a reader cannot write: its notice waits in the outbox for the next flush
        try { if (readOnly) { throw new Error('read-only handle'); } API.log(m, row); } catch (error) { try { deferWrite({ op: 'log', args: [row], file, error }); } catch { /* stderr already has it */ } }
      }
      close();
    } };
  for (const [name, fn] of Object.entries(API)) m[name] = (...args) => {
    if (!readOnly) assertMutationFence({ kind: 'machine-access', name });
    return fn(m, ...args);
  };
  m.tempDirs = tempDirs;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// Blobs
// ---------------------------------------------------------------------------------------------------------------------
/** Store bytes (Buffer | string | file path via {file}) in the blob store and record the blobs row. Returns the sha. */
function putMachineBlob(m, content, { mediaType = 'application/octet-stream', pinned = false } = {}) {
  // Every blob is redacted before it is stored (scripts/lib/redact.mjs): text media 'v1', anything else 'binary'.
  let raw = content; if (!Buffer.isBuffer(raw)) raw = Buffer.from(typeof raw === 'string' ? raw : JSON.stringify(raw));
  const { bytes, redaction } = redactBytes(raw, mediaType);
  const { sha, size, mediaType: stored } = storeBlob(bytes, { mediaType });
  const file = blobPath(sha);
  insertRow(m.db, 'blobs', { sha256: sha, bytes: size, media_type: stored, redaction, file_uri: String(file).replaceAll('\\', '/'), created_at: m.now(), pinned: pinned ? 1 : 0 }, { orIgnore: true });
  return sha;
}
/** A JSON value as `{json, sha}`: inline when it fits `limit`, else a small stub inline and the full value as a blob. */
function jsonOrBlob(m, value, limit = JSON_LIMIT) {
  if (value === undefined || value === null) return { json: null, sha: null };
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (Buffer.byteLength(text) <= limit) return { json: text, sha: null };
  const sha = putMachineBlob(m, text, { mediaType: 'application/json' });
  return { json: JSON.stringify({ truncated: true, bytes: Buffer.byteLength(text), sha256: sha }), sha };
}
/** The full JSON value behind a jsonOrBlob stub ({truncated, sha256}); the value itself otherwise. */
export function fullJson(value) {
  if (value && typeof value === 'object' && value.truncated === true && typeof value.sha256 === 'string') {
    try { return JSON.parse(getBlob(value.sha256).toString('utf8')); } catch { return value; }
  }
  return value;
}
const textBlob = (m, text, mediaType = 'text/plain') => (text == null || text === '' ? null : putMachineBlob(m, String(text), { mediaType }));

// ---------------------------------------------------------------------------------------------------------------------
// B0. Ledgers registry and repositories
// ---------------------------------------------------------------------------------------------------------------------
const ledgerRow = (row) => (row ? { ledgerId: row.ledger_id, name: row.name, product: row.product, repoRoot: row.repo_root, file: row.file, state: row.state,
  schemaVersion: row.schema_version, registeredAt: row.registered_at, seenAt: row.seen_at, retiredAt: row.retired_at, retiredReason: row.retired_reason } : null);
/** A ledger's own meta (key → value), read-only; {} when the file cannot be read. */
function ledgerMetaOf(file) {
  let db = null;
  try {
    if (!fs.existsSync(file)) return {};
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(file, { readOnly: true, timeout: MACHINE_BUSY_TIMEOUT_MS });
    return Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
  } catch { return {}; } finally { try { db?.close(); } catch { /* closed */ } }
}
const repoKey = (root) => path.resolve(String(root)).replaceAll('\\', '/').replace(/^[a-z]:/, (d) => d.toUpperCase());
export const repoKeyOf = repoKey;
/**
 * Register (or refresh) a ledger. `ledgerId` is the ledger's own meta.ledger_id. A new row needs name and repoRoot;
 * `file` defaults to projectLedgerFile(ledgerId). The live registry refuses a ledger file under the OS temp directory
 * (returns {registered:false, refused}); nothing is written then.
 */
function registerLedger(m, { ledgerId, name = null, repoRoot = null, file = null, product = null, schemaVersion = null } = {}) {
  need(ledgerId, 'registerLedger needs the ledger meta.ledger_id');
  const target = path.resolve(file ?? projectLedgerFile(ledgerId, m.env));
  if (m.live && isUnderTempDir(target, { env: m.env, tempDirs: m.tempDirs }))
    return { ledgerId, registered: false, refused: `registry-temp-ledger: ${target} is under the OS temp directory and ${m.file} is the live registry; set ${TEST_REGISTRY_ENV}` };
  // The live registry also refuses a repository under the OS temp directory (a repro or test run outside the isolated
  // registry would leave a junk workflow in the harness UI): typed refusal, nothing written.
  const tempRepo = (root) => (m.live && root && isUnderTempDir(String(root), { env: m.env, tempDirs: m.tempDirs })
    ? { ledgerId, registered: false, code: 'STARCI_REGISTRY_TEMP_REPO',
      refused: `registry-temp-repo: repo_root ${repoKey(root)} is under the OS temp directory and ${m.file} is the live registry; set ${TEST_REGISTRY_ENV}` } : null);
  // A ledger opened by its writer names itself: repo_root / product come from its own meta when not given.
  const insertLedger = (db, at) => { if (!repoRoot) { const own = ledgerMetaOf(target); repoRoot = own.repo_root ?? null; product = product ?? own.product ?? null; }
    name = name ?? (repoRoot ? path.basename(path.resolve(repoRoot)) : null);
    if (!name || !repoRoot) return { ledgerId, registered: false, refused: `registry-no-repo-root: ${target} names no repo_root in its meta and none was given` };
    insertRow(db, 'ledgers', { ledger_id: ledgerId, name, product, repo_root: repoKey(repoRoot), file: target, state: 'active', schema_version: int(schemaVersion), registered_at: at, seen_at: at });
    return null; };
  return m.transaction((db) => {
    const at = m.now();
    const existing = db.prepare('SELECT * FROM ledgers WHERE ledger_id=?').get(ledgerId);
    const refusedRepo = tempRepo(repoRoot ?? (existing ? null : ledgerMetaOf(target).repo_root ?? null));
    if (refusedRepo) return refusedRepo;
    if (existing) {
      updateRow(db, 'ledgers', { file: target, seen_at: at, ...(name ? { name } : {}), ...(repoRoot ? { repo_root: repoKey(repoRoot) } : {}),
        ...(product ? { product } : {}), ...(schemaVersion != null ? { schema_version: int(schemaVersion) } : {}),
        ...(existing.state === 'retired' ? {} : { state: 'active' }) }, { ledger_id: ledgerId });
    } else {
      const refusedInsert = insertLedger(db, at);
      if (refusedInsert) return refusedInsert;
    }
    if (repoRoot) upsertRow(db, 'repositories', { repo_root: repoKey(repoRoot), name: name ?? existing?.name ?? path.basename(repoRoot), role: 'backend', ledger_id: ledgerId, seen_at: at }, ['repo_root']);
    return { ledgerId, registered: true, file: target };
  });
}
/**
 * The ledger for a repository root, name or id; null when unregistered. `create:true` with repoRoot (and name) mints a
 * new ledger id, registers it at projectLedgerFile(id) and returns it — the caller then creates runtime.sqlite there
 * with meta.ledger_id = ledgerId.
 */
function resolveLedger(m, { ledgerId = null, name = null, repoRoot = null, create = false, product = null } = {}) {
  const db = m.db;
  let row = null;
  if (ledgerId) row = db.prepare('SELECT * FROM ledgers WHERE ledger_id=?').get(ledgerId);
  else if (repoRoot) row = db.prepare("SELECT * FROM ledgers WHERE repo_root=? ORDER BY state='retired', seen_at DESC LIMIT 1").get(repoKey(repoRoot));
  else if (name) row = db.prepare('SELECT * FROM ledgers WHERE name=?').get(name);
  if (row || !create) return ledgerRow(row);
  need(repoRoot, 'resolveLedger create needs repoRoot');
  const id = crypto.randomUUID();
  const made = registerLedger(m, { ledgerId: id, name: name ?? path.basename(path.resolve(repoRoot)), repoRoot, product });
  if (made.refused) throw Object.assign(new Error(made.refused), { code: made.code ?? 'STARCI_MACHINE_DB' });
  return ledgerRow(db.prepare('SELECT * FROM ledgers WHERE ledger_id=?').get(id));
}
function listLedgers(m, { state = null, includeRetired = false } = {}) {
  let rows; if (state) rows = m.db.prepare('SELECT * FROM ledgers WHERE state=? ORDER BY name').all(state); else rows = m.db.prepare(`SELECT * FROM ledgers ${includeRetired ? '' : "WHERE state<>'retired'"} ORDER BY name`).all();
  return rows.map(ledgerRow);
}
function touchLedger(m, ledgerId, { at = m.now() } = {}) { return m.db.prepare('UPDATE ledgers SET seen_at=? WHERE ledger_id=?').run(at, ledgerId).changes > 0; }
function setLedgerState(m, ledgerId, state, { reason = null } = {}) {
  const at = m.now();
  return m.db.prepare('UPDATE ledgers SET state=?, retired_at=CASE WHEN ?=\'retired\' THEN ? ELSE NULL END, retired_reason=CASE WHEN ?=\'retired\' THEN ? ELSE NULL END WHERE ledger_id=?')
    .run(state, state, at, state, reason, ledgerId).changes > 0;
}
function upsertRepository(m, { repoRoot, name, role, ledgerId = null, defaultBranch = null, remote = null }) {
  return upsertRow(m.db, 'repositories', { repo_root: repoKey(repoRoot), name, role, ledger_id: ledgerId, default_branch: defaultBranch, remote, seen_at: m.now() }, ['repo_root']);
}
/**
 * Run fn({ledger, db}) over every registered ledger opened READ-ONLY, one at a time (B8: no ATTACH-UNION). A ledger that
 * cannot be opened yields {ledger, error}. Returns the array of results.
 */
function forEachLedger(m, fn, { state = 'active' } = {}) {
  const { DatabaseSync } = require('node:sqlite');
  const out = [];
  for (const ledger of listLedgers(m, { state })) {
    let db = null;
    try {
      need(fs.existsSync(ledger.file), `ledger file missing: ${ledger.file}`);
      db = new DatabaseSync(ledger.file, { readOnly: true, timeout: MACHINE_BUSY_TIMEOUT_MS });
      db.exec('PRAGMA query_only=ON;');
      out.push({ ledger, result: fn({ ledger, db }) });
    } catch (error) { out.push({ ledger, error: String(error?.message ?? error) }); } finally { try { db?.close(); } catch { /* closed */ } }
  }
  return out;
}
/** Manual queries only: ATTACH up to 9 ledgers read-only to this handle as l0..l8. Returns the attached names. */
function attachLedgers(m, ledgers = listLedgers(m)) {
  need(ledgers.length <= 9, 'attachLedgers: at most 9 ledgers per batch');
  return ledgers.map((l, i) => { m.db.exec(`ATTACH DATABASE ${JSON.stringify(pathToFileURL(l.file).href + '?mode=ro')} AS l${i}`); return { alias: `l${i}`, ...l }; });
}

// ---------------------------------------------------------------------------------------------------------------------
// B1. Supervisor
// ---------------------------------------------------------------------------------------------------------------------
/** Append one sup_events row; the digest chain is computed here (JS), inside the caller's or a new transaction. */
function supEvent(m, { entityType = 'supervisor', entityId = 'main', kind, payload = null, spanId = null, at = m.now(), eventId = null }) {
  need(kind, 'supEvent needs kind');
  return m.transaction((db) => {
    const { json, sha } = jsonOrBlob(m, payload == null ? null : redactData(payload), 16384);
    const prev = db.prepare('SELECT digest FROM sup_events ORDER BY seq DESC LIMIT 1').get()?.digest ?? null;
    const id = eventId ?? crypto.randomUUID();
    const digest = sha256([prev ?? '', id, entityType, entityId, kind, json ?? '', sha ?? '', at].join('\n'));
    const r = insertRow(db, 'sup_events', { event_id: id, entity_type: entityType, entity_id: String(entityId), kind, span_id: spanId, payload_json: json,
      payload_sha: sha, prev_digest: prev, digest, created_at: at });
    return { seq: Number(r.lastInsertRowid), eventId: id, digest };
  });
}
function supEvents(m, { kind = null, kinds = null, entityType = null, entityId = null, since = null, limit = 200, order = 'desc' } = {}) {
  const where = [], args = [];
  const list = kinds ?? (kind ? [kind] : null);
  if (list) { where.push(`kind IN (${list.map(() => '?').join(',')})`); args.push(...list); }
  if (entityType) { where.push('entity_type=?'); args.push(entityType); }
  if (entityId) { where.push('entity_id=?'); args.push(String(entityId)); }
  if (since != null) { where.push('seq>?'); args.push(since); }
  const rows = m.db.prepare(`SELECT * FROM sup_events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY seq ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`).all(...args, limit);
  return rows.map((r) => ({ ...r, payload: fullJson(parse(r.payload_json)) }));
}
const newestSupEvent = (m, kind) => supEvents(m, { kind, limit: 1 })[0] ?? null;

function upsertSupJob(m, { jobId, traceId = null, kind, role = 'worker', cluster = null, title, status = 'queued', lane = null, files = null, brief = null, payload = null }) {
  const at = m.now();
  const existing = m.db.prepare('SELECT trace_id, created_at FROM sup_jobs WHERE job_id=?').get(jobId);
  return upsertRow(m.db, 'sup_jobs', { job_id: jobId, trace_id: existing?.trace_id ?? traceId ?? newTraceId(), kind, role, cluster, title, status, lane,
    files_json: files, brief, payload_json: payload, created_at: existing?.created_at ?? at, updated_at: at }, ['job_id']);
}
function setSupJobStatus(m, jobId, status, { payload = undefined } = {}) {
  return m.transaction(() => {
    const changed = updateRow(m.db, 'sup_jobs', { status, updated_at: m.now(), ...(payload !== undefined ? { payload_json: payload } : {}) }, { job_id: jobId }).changes;
    if (changed) supEvent(m, { entityType: 'sup-job', entityId: jobId, kind: `sup-job-${status}` });
    return changed > 0;
  });
}
const supJob = (m, jobId) => { const r = m.db.prepare('SELECT * FROM sup_jobs WHERE job_id=?').get(jobId); return r ? { ...r, files: parse(r.files_json), payload: parse(r.payload_json) } : null; };
function listSupJobs(m, { status = null, statuses = null, kind = null } = {}) {
  const where = [], args = [];
  const list = statuses ?? (status ? [status] : null);
  if (list) { where.push(`status IN (${list.map(() => '?').join(',')})`); args.push(...list); }
  if (kind) { where.push('kind=?'); args.push(kind); }
  return m.db.prepare(`SELECT * FROM sup_jobs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at, job_id`).all(...args)
    .map((r) => ({ ...r, files: parse(r.files_json), payload: parse(r.payload_json) }));
}
function acquireSupLeases(m, jobId, paths, { ttlMs = 3600000 } = {}) {
  return m.transaction((db) => {
    const at = m.now();
    db.prepare('DELETE FROM sup_leases WHERE expires_at<?').run(at);
    const held = paths.map((p) => db.prepare('SELECT job_id FROM sup_leases WHERE path=?').get(p)).map((r, i) => (r && r.job_id !== jobId ? { path: paths[i], holder: r.job_id } : null)).filter(Boolean);
    if (held.length) return { ok: false, conflicts: held };
    for (const p of paths) upsertRow(db, 'sup_leases', { path: p, job_id: jobId, acquired_at: at, expires_at: at + ttlMs }, ['path']);
    return { ok: true };
  });
}
const releaseSupLeases = (m, jobId) => m.db.prepare('DELETE FROM sup_leases WHERE job_id=?').run(jobId).changes;
const supLeases = (m) => m.db.prepare('SELECT * FROM sup_leases ORDER BY path').all();
function startSupAttempt(m, { jobId, spanId = newSpanId(), parentSpanId = null, ...rest }) {
  const seq = Number(m.db.prepare('SELECT COALESCE(max(dispatch_seq),0)+1 n FROM sup_attempts WHERE job_id=?').get(jobId).n);
  const cols = snake(rest);
  const r = insertRow(m.db, 'sup_attempts', { job_id: jobId, dispatch_seq: seq, span_id: spanId, parent_span_id: parentSpanId, spawned_at: m.now(), ...cols });
  return { attemptId: Number(r.lastInsertRowid), dispatchSeq: seq, spanId };
}
const updateSupAttempt = (m, attemptId, fields) => updateRow(m.db, 'sup_attempts', snake(fields), { attempt_id: attemptId }).changes > 0;
const latestSupAttempt = (m, jobId) => m.db.prepare('SELECT * FROM sup_attempts WHERE job_id=? ORDER BY dispatch_seq DESC LIMIT 1').get(jobId) ?? null;
function recordSupReport(m, { attemptId, jobId, outcome, report, reportText = null }) {
  const reportSha = reportText ? textBlob(m, reportText, 'text/markdown') : null;
  const r = upsertRow(m.db, 'sup_reports', { attempt_id: attemptId, job_id: jobId, outcome, report_json: report ?? {}, report_sha: reportSha, created_at: m.now() }, ['attempt_id']);
  return { reportId: Number(r.lastInsertRowid), reportSha };
}
const supReports = (m, { jobId = null, unconsumed = false } = {}) => m.db.prepare(`SELECT * FROM sup_reports WHERE 1=1 ${jobId ? 'AND job_id=?' : ''} ${unconsumed ? 'AND consumed_at IS NULL' : ''} ORDER BY report_id`)
  .all(...(jobId ? [jobId] : [])).map((r) => ({ ...r, report: parse(r.report_json) }));
const consumeSupReport = (m, reportId) => m.db.prepare('UPDATE sup_reports SET consumed_at=? WHERE report_id=? AND consumed_at IS NULL').run(m.now(), reportId).changes > 0;

/**
 * Open a Supervisor Decision Item, idempotent on its key (MB-07: '<kind>:<entity>:<signature>:<head>', no empty part).
 * Returns {diId, created}. An existing open item with the same key is returned unchanged.
 */
function openSupDecision(m, { keyParts, kind, decider = 'supervisor', summary, ledgerId = null, workflowId = null, entityType = null, entityId = null,
  openedBy = 'reconciler', dueAt = null, escalateTo = null, evidence = null, options = null, allowedVerbs = null, payload = {} }) {
  need(keyParts && typeof keyParts === 'object' && !Array.isArray(keyParts), 'openSupDecision needs keyParts {kind, entity, signature, head, ...}');
  const parts = Object.values(keyParts).map((v) => String(v ?? ''));
  need(parts.length >= 2 && parts.every((p) => p.trim() && !p.includes(':')), `openSupDecision: empty or ':'-bearing key part in ${JSON.stringify(keyParts)} (MB-07)`);
  const key = parts.join(':');
  return m.transaction((db) => {
    const hit = db.prepare('SELECT di_id, status FROM sup_decision_items WHERE idempotency_key=?').get(key);
    if (hit) return { diId: hit.di_id, created: false, status: hit.status };
    const diId = `sdi-${crypto.randomUUID()}`;
    insertRow(db, 'sup_decision_items', { di_id: diId, idempotency_key: key, key_parts_json: keyParts, ledger_id: ledgerId, workflow_id: workflowId, kind, decider,
      entity_type: entityType, entity_id: entityId, summary, status: 'open', opened_by: openedBy, opened_at: m.now(), due_at: dueAt, escalate_to: escalateTo,
      evidence_json: evidence, options_json: options, allowed_verbs_json: allowedVerbs, payload_json: payload ?? {} });
    supEvent(m, { entityType: 'sup-decision', entityId: diId, kind: 'sup-decision-opened', payload: { key, kind, summary } });
    return { diId, created: true, status: 'open' };
  });
}
function setSupDecision(m, diId, { status, by = null, verb = null, choice = null, rationale = null, result = null, supersededBy = null, spanId = newSpanId() }) {
  return m.transaction((db) => {
    const at = m.now();
    const set = { status };
    if (status === 'claimed') Object.assign(set, { claim_by: by, claim_at: at });
    if (status === 'escalated') db.prepare('UPDATE sup_decision_items SET escalations=escalations+1 WHERE di_id=?').run(diId);
    if (status === 'superseded') set.superseded_by = supersededBy;
    let decisionId = null;
    if (status === 'resolved') {
      decisionId = `sdec-${crypto.randomUUID()}`;
      const di = db.prepare('SELECT * FROM sup_decision_items WHERE di_id=?').get(diId);
      insertRow(db, 'sup_decisions', { decision_id: decisionId, di_id: diId, decider: by ?? di?.decider ?? 'supervisor', span_id: spanId, ledger_id: di?.ledger_id, workflow_id: di?.workflow_id,
        subject_type: di?.entity_type, subject_id: di?.entity_id, choice: choice ?? verb ?? 'resolved', rationale, result_json: result, decided_at: at });
      Object.assign(set, { resolved_by: by, resolved_at: at, resolution_verb: verb, decision_id: decisionId });
    }
    const changed = updateRow(db, 'sup_decision_items', set, { di_id: diId }).changes;
    if (changed) supEvent(m, { entityType: 'sup-decision', entityId: diId, kind: `sup-decision-${status}`, payload: { by, verb } });
    return { changed: changed > 0, decisionId };
  });
}
const markSupDecisionDelivered = (m, diId) => m.db.prepare('UPDATE sup_decision_items SET delivered_at=COALESCE(delivered_at,?) WHERE di_id=?').run(m.now(), diId).changes > 0;
function listSupDecisions(m, { open = true, kind = null } = {}) {
  return m.db.prepare(`SELECT * FROM sup_decision_items WHERE 1=1 ${open ? "AND status IN ('open','claimed','escalated')" : ''} ${kind ? 'AND kind=?' : ''} ORDER BY opened_at`)
    .all(...(kind ? [kind] : [])).map((r) => ({ ...r, keyParts: parse(r.key_parts_json), payload: parse(r.payload_json), evidence: parse(r.evidence_json) }));
}
function openOwed(m, { owedId, kind, subject, cluster = null, dueAt = null, detail = null }) {
  return m.transaction((db) => {
    const hit = db.prepare('SELECT state FROM sup_owed WHERE owed_id=?').get(owedId);
    if (hit) { if (detail !== null) { updateRow(db, 'sup_owed', { detail_json: detail, ...(dueAt ? { due_at: dueAt } : {}) }, { owed_id: owedId }); } return { owedId, created: false, state: hit.state }; }
    insertRow(db, 'sup_owed', { owed_id: owedId, kind, subject, cluster, state: 'open', opened_at: m.now(), due_at: dueAt, detail_json: detail });
    return { owedId, created: true, state: 'open' };
  });
}
const ackOwed = (m, owedId, { by = 'supervisor' } = {}) => m.db.prepare("UPDATE sup_owed SET state='acked', acked_at=?, acked_by=? WHERE owed_id=? AND state='open'").run(m.now(), by, owedId).changes > 0;
const closeOwed = (m, owedId) => m.db.prepare("UPDATE sup_owed SET state='closed', closed_at=? WHERE owed_id=? AND state<>'closed'").run(m.now(), owedId).changes > 0;
const listOwed = (m, { open = true } = {}) => m.db.prepare(`SELECT * FROM sup_owed ${open ? "WHERE state<>'closed'" : ''} ORDER BY opened_at`).all().map((r) => ({ ...r, detail: parse(r.detail_json) }));
function upsertLearning(m, { itemId, kind, parentId = null, title, state = null, sourceRef = null, lane = null, landedSha = null, detail = null }) {
  const at = m.now();
  const created = m.db.prepare('SELECT created_at FROM sup_learning WHERE item_id=?').get(itemId)?.created_at ?? at;
  return upsertRow(m.db, 'sup_learning', { item_id: itemId, kind, parent_id: parentId, title, state, source_ref: sourceRef, lane, landed_sha: landedSha, detail_json: detail, created_at: created, updated_at: at }, ['item_id']);
}
const listLearning = (m, { kind = null } = {}) => m.db.prepare(`SELECT * FROM sup_learning ${kind ? 'WHERE kind=?' : ''} ORDER BY created_at, item_id`).all(...(kind ? [kind] : [])).map((r) => ({ ...r, detail: parse(r.detail_json) }));
const recordOwnerRuling = (m, { rulingId = `rul-${crypto.randomUUID()}`, saidAt, channel = null, verbatim, paraphrase = null, appliesTo = null, contractRef = null, recordedBy = null }) => {
  insertRow(m.db, 'sup_owner_rulings', { ruling_id: rulingId, said_at: saidAt, channel, verbatim, paraphrase, applies_to: appliesTo, contract_ref: contractRef, recorded_by: recordedBy, created_at: m.now() }); return rulingId; };
function upsertBridge(m, { bridgeId, ledgerId = null, action, state, approvedBy = null, detail = null }) {
  const at = m.now();
  const created = m.db.prepare('SELECT created_at FROM sup_bridges WHERE bridge_id=?').get(bridgeId)?.created_at ?? at;
  return upsertRow(m.db, 'sup_bridges', { bridge_id: bridgeId, ledger_id: ledgerId, action, state, approved_by: approvedBy, detail_json: detail, created_at: created, updated_at: at }, ['bridge_id']);
}
function recordSupMessage(m, { msgId = `msg-${crypto.randomUUID()}`, direction, channel, chatId = null, messageId = null, from = null, to = null, via = null, text, ok = null, at = m.now() }) {
  insertRow(m.db, 'sup_messages', { msg_id: msgId, direction, channel, chat_id: chatId, message_id: messageId, from_ref: from, to_ref: to, via, text, ok: bool(ok), at }, { orIgnore: true });
  return msgId;
}
const supMessages = (m, { direction = null, unread = false, limit = 200 } = {}) => m.db.prepare(`SELECT * FROM sup_messages WHERE 1=1 ${direction ? 'AND direction=?' : ''} ${unread ? 'AND read_at IS NULL' : ''} ORDER BY at DESC LIMIT ?`)
  .all(...(direction ? [direction] : []), limit).reverse();
const markSupMessagesRead = (m, ids) => { let n = 0; for (const id of ids) { n += m.db.prepare('UPDATE sup_messages SET read_at=? WHERE msg_id=? AND read_at IS NULL').run(m.now(), id).changes; } return n; };
function setSupSignal(m, { scope, key = 'main', value = null, token = null, holderPid = process.pid, expiresAt = null }) {
  return upsertRow(m.db, 'sup_signals', { scope, key, holder_pid: holderPid, token, value_json: value, at: m.now(), expires_at: expiresAt }, ['scope', 'key']);
}
const supSignal = (m, scope, key = 'main') => { const r = m.db.prepare('SELECT * FROM sup_signals WHERE scope=? AND key=?').get(scope, key); return r ? { ...r, value: parse(r.value_json) } : null; };
const clearSupSignal = (m, scope, key = 'main') => m.db.prepare('DELETE FROM sup_signals WHERE scope=? AND key=?').run(scope, key).changes > 0;
function recordMachineLlmUsage(m, { subjectType, supAttemptId = null, turnRef = null, spanId = null, provider, requestModel = null, responseModel = null, source = 'cli-transcript', ...counts }) {
  return Number(insertRow(m.db, 'llm_usage', { subject_type: subjectType, sup_attempt_id: supAttemptId, turn_ref: turnRef, span_id: spanId, provider, request_model: requestModel,
    response_model: responseModel, source, at: m.now(), ...snake(counts) }).lastInsertRowid);
}

// ---------------------------------------------------------------------------------------------------------------------
// B2. Engine: process runs, leader, cursors, queue, schedules, actions, modes, SLA, invariants
// ---------------------------------------------------------------------------------------------------------------------
/** A long-lived runtime process starts (MB-04, G1). Returns run_id. */
function startProcessRun(m, { role, pid = process.pid, rev = runtimeRev(), epoch = null, parentActionId = null, startReason = 'manual' }) {
  return Number(insertRow(m.db, 'process_runs', { role, pid, host: os.hostname(), rev, epoch, parent_action_id: parentActionId, start_reason: startReason,
    started_at: m.now(), last_heartbeat_at: m.now() }).lastInsertRowid);
}
const heartbeatProcessRun = (m, runId, { draining = null } = {}) => m.db.prepare('UPDATE process_runs SET last_heartbeat_at=?, draining_since=CASE WHEN ?=1 THEN COALESCE(draining_since,?) ELSE draining_since END WHERE run_id=? AND ended_at IS NULL')
  .run(m.now(), draining ? 1 : 0, m.now(), runId).changes > 0;
/** A process run ends, once (trigger process_runs_end_once). exitReason: clean|reload-handover|crash|killed|lost-lease|stopped|unknown. */
function endProcessRun(m, runId, { exitCode = null, exitReason, killedBy = null }) {
  const at = m.now();
  const row = m.db.prepare('SELECT last_heartbeat_at, ended_at FROM process_runs WHERE run_id=?').get(runId);
  if (!row || row.ended_at != null) return false;
  return m.db.prepare('UPDATE process_runs SET ended_at=?, exit_code=?, exit_reason=?, killed_by=?, heartbeat_age_at_end_ms=? WHERE run_id=? AND ended_at IS NULL')
    .run(at, exitCode, exitReason, killedBy, row.last_heartbeat_at != null ? at - row.last_heartbeat_at : null, runId).changes > 0;
}
const openProcessRuns = (m, { role = null } = {}) => m.db.prepare(`SELECT * FROM process_runs WHERE ended_at IS NULL ${role ? 'AND role=?' : ''} ORDER BY run_id`).all(...(role ? [role] : []));
const processRuns = (m, { role = null, sinceMs = null, limit = 200 } = {}) => m.db.prepare(`SELECT * FROM process_runs WHERE 1=1 ${role ? 'AND role=?' : ''} ${sinceMs != null ? 'AND started_at>?' : ''} ORDER BY run_id DESC LIMIT ?`)
  .all(...(role ? [role] : []), ...(sinceMs != null ? [m.now() - sinceMs] : []), limit);

const leaderOf = (m, name = 'reconciler') => m.db.prepare('SELECT * FROM engine_leader WHERE name=?').get(name) ?? null;
/**
 * Acquire or renew the leader lease (fencing epoch). A fresh/expired lease is taken with a new epoch and a leader_history
 * row; renewal by the holder keeps the epoch. Returns {leader:boolean, epoch, row}.
 */
function acquireLeader(m, { name = 'reconciler', holder, pid = process.pid, leaseMs, rev = runtimeRev(), processRunId = null, handover = false }) {
  return m.transaction((db) => {
    const at = m.now();
    const cur = db.prepare('SELECT * FROM engine_leader WHERE name=?').get(name);
    if (cur && cur.holder === holder && cur.pid === pid) {
      db.prepare('UPDATE engine_leader SET heartbeat_at=?, expires_at=?, rev=?, process_run_id=COALESCE(?,process_run_id) WHERE name=?').run(at, at + leaseMs, rev, processRunId, name);
      return { leader: true, epoch: cur.epoch, renewed: true };
    }
    if (cur && cur.expires_at > at && !handover) return { leader: false, epoch: cur.epoch, holder: cur.holder, pid: cur.pid };
    const epoch = Math.max(Number(cur?.epoch ?? 0), Number(db.prepare('SELECT COALESCE(max(epoch),0) e FROM leader_history').get().e)) + 1;
    if (cur) db.prepare('UPDATE leader_history SET released_at=?, release_reason=? WHERE epoch=? AND released_at IS NULL').run(at, handover ? 'reload' : 'lost', cur.epoch);
    upsertRow(db, 'engine_leader', { name, holder, pid, epoch, process_run_id: processRunId, heartbeat_at: at, expires_at: at + leaseMs, rev, draining: 0, passes: 0, last_pass_ms: null, last_error: null }, ['name']);
    let how = 'fresh'; if (cur) how = handover ? 'handover' : 'takeover-stale';
    insertRow(db, 'leader_history', { epoch, holder, pid, process_run_id: processRunId, rev, acquired_at: at, acquired_how: how });
    return { leader: true, epoch, renewed: false };
  });
}
/** Renew only if still the holder at `epoch` (fence). Also records pass stats. */
function renewLeader(m, { name = 'reconciler', epoch, leaseMs, passes = null, lastPassMs = null, lastError = undefined, draining = null }) {
  const at = m.now();
  return m.db.prepare(`UPDATE engine_leader SET heartbeat_at=?, expires_at=?, passes=COALESCE(?,passes), last_pass_ms=COALESCE(?,last_pass_ms)
    ${lastError !== undefined ? ', last_error=?' : ''} ${draining != null ? ', draining=?' : ''} WHERE name=? AND epoch=?`)
    .run(at, at + leaseMs, passes, lastPassMs, ...(lastError !== undefined ? [lastError] : []), ...(draining != null ? [draining ? 1 : 0] : []), name, epoch).changes > 0;
}
/** Release the lease held at `epoch`; closes its leader_history row with the reason (reload|lost|killed|stop|crash). */
function releaseLeader(m, { name = 'reconciler', epoch, reason = 'stop' }) {
  return m.transaction((db) => {
    const n = db.prepare('DELETE FROM engine_leader WHERE name=? AND epoch=?').run(name, epoch).changes;
    db.prepare('UPDATE leader_history SET released_at=?, release_reason=? WHERE epoch=? AND released_at IS NULL').run(m.now(), reason, epoch);
    return n > 0;
  });
}
const leaderHistory = (m, { limit = 50 } = {}) => m.db.prepare('SELECT * FROM leader_history ORDER BY epoch DESC LIMIT ?').all(limit);
const cursorOf = (m, ledgerId) => m.db.prepare('SELECT last_seq FROM engine_cursors WHERE ledger_id=?').get(ledgerId)?.last_seq ?? null;
const setCursor = (m, ledgerId, lastSeq) => upsertRow(m.db, 'engine_cursors', { ledger_id: ledgerId, last_seq: lastSeq, updated_at: m.now() }, ['ledger_id']);
const cursors = (m) => m.db.prepare('SELECT * FROM engine_cursors').all();

function enqueue(m, { controller, key, dueAt = m.now(), reason = null }) {
  return m.db.prepare('INSERT INTO engine_queue(controller,key,due_at,reason) VALUES(?,?,?,?) ON CONFLICT(controller,key) DO UPDATE SET due_at=min(COALESCE(due_at,excluded.due_at),excluded.due_at), reason=excluded.reason')
    .run(controller, key, dueAt, reason);
}
const dueQueue = (m, { controller = null, limit = 100 } = {}) => m.db.prepare(`SELECT * FROM engine_queue WHERE due_at<=? ${controller ? 'AND controller=?' : ''} ORDER BY due_at LIMIT ?`)
  .all(m.now(), ...(controller ? [controller] : []), limit);
const queueRows = (m) => m.db.prepare('SELECT * FROM engine_queue ORDER BY due_at').all();
const dequeue = (m, controller, key) => m.db.prepare('DELETE FROM engine_queue WHERE controller=? AND key=?').run(controller, key).changes > 0;
const requeue = (m, { controller, key, dueAt, error = null }) => m.db.prepare('UPDATE engine_queue SET due_at=?, tries=tries+1, last_error=? WHERE controller=? AND key=?').run(dueAt, error, controller, key).changes > 0;

/** MB-01: the schedule row of a periodic duty; created with next_due_at = now + interval when absent (never "first run now"). */
function ensureSchedule(m, { controller, duty, intervalMs, firstDueAt = null }) {
  m.db.prepare('INSERT INTO schedules(controller,duty,interval_ms,next_due_at) VALUES(?,?,?,?) ON CONFLICT(controller,duty) DO UPDATE SET interval_ms=excluded.interval_ms')
    .run(controller, duty, intervalMs, firstDueAt ?? m.now() + intervalMs);
  return m.db.prepare('SELECT * FROM schedules WHERE controller=? AND duty=?').get(controller, duty);
}
/** Claim a due duty (no overlap): true when this caller should run it now. */
/**
 * Claim a due duty (no overlap): true when this caller should run it now. A claim whose holder process is dead, or that
 * is older than `ttlMs` (default: the interval, at least 1 h), is released first, so a crashed run never blocks the duty.
 */
function claimSchedule(m, { controller, duty, actionId = null, pid = process.pid, ttlMs = null, alive = pidAlive }) {
  return m.transaction((db) => {
    const at = m.now();
    const row = db.prepare('SELECT * FROM schedules WHERE controller=? AND duty=?').get(controller, duty);
    if (!row) return false;
    if (row.running_pid != null && row.running_pid !== pid) {
      const ttl = ttlMs ?? Math.max(row.interval_ms, 3600000);
      if (!alive(row.running_pid) || at - (row.last_started_at ?? 0) > ttl)
        db.prepare("UPDATE schedules SET running_pid=NULL, last_result='unknown', last_finished_at=? WHERE controller=? AND duty=? AND running_pid=?").run(at, controller, duty, row.running_pid);
    }
    return db.prepare('UPDATE schedules SET last_started_at=?, running_pid=?, last_action_id=COALESCE(?,last_action_id) WHERE controller=? AND duty=? AND next_due_at<=? AND (running_pid IS NULL OR running_pid=?)')
      .run(at, pid, actionId, controller, duty, at, pid).changes > 0;
  });
}
function finishSchedule(m, { controller, duty, result = 'done', digest = null, nextDueAt = null }) {
  const at = m.now();
  const row = m.db.prepare('SELECT interval_ms FROM schedules WHERE controller=? AND duty=?').get(controller, duty);
  if (!row) return false;
  return m.db.prepare('UPDATE schedules SET last_finished_at=?, last_result=?, last_result_digest=?, next_due_at=?, running_pid=NULL WHERE controller=? AND duty=?')
    .run(at, result, digest, nextDueAt ?? at + row.interval_ms, controller, duty).changes > 0;
}
const schedules = (m) => m.db.prepare('SELECT * FROM schedules ORDER BY controller, duty').all();

/** Deterministic action id = sha(controller, key, verb, epoch, observed_generation). */
const actionIdOf = ({ controller, key = '', verb = '', epoch = 0, observedGeneration = 0 }) => sha256([controller, key, verb, epoch, observedGeneration].join('\u0000')).slice(0, 32);
/** Record an action intent (idempotent on id). */
function actionIntent(m, { id = null, controller, duty = null, key = null, verb = null, argvDigest = null, epoch = null, observedGeneration = null, spanId = newSpanId(), traceId = null,
  mode = null, ledgerId = null, workflowId = null, jobId = null, attemptId = null }) {
  const actionId = id ?? actionIdOf({ controller, key, verb, epoch, observedGeneration });
  insertRow(m.db, 'engine_actions', { id: actionId, controller, duty, key, verb, argv_digest: argvDigest, epoch, observed_generation: observedGeneration, span_id: spanId, trace_id: traceId,
    state: 'intent', mode, ledger_id: ledgerId, workflow_id: workflowId, job_id: jobId, attempt_id: attemptId }, { orIgnore: true });
  return actionId;
}
const actionRunning = (m, id, { requestId = null, childRunId = null } = {}) => m.db.prepare("UPDATE engine_actions SET state='running', started_at=COALESCE(started_at,?), request_id=COALESCE(?,request_id), child_run_id=COALESCE(?,child_run_id) WHERE id=? AND state IN ('intent','running')")
  .run(m.now(), requestId, childRunId, id).changes > 0;
/**
 * Finish an action (MB-03): `result` is kept IN FULL as a blob (result_sha); result_json holds only a ≤8 KiB summary.
 * stdout/stderr are stored in full as blobs.
 */
function actionFinish(m, id, { state = 'done', exitCode = null, result: rawResult = null, summary: rawSummary = null, stdout = null, stderr = null, errorSignature = null }) {
  const result = rawResult == null ? null : redactData(rawResult);
  const summary = rawSummary == null ? null : redactData(rawSummary);
  let full = null; if (result != null) full = typeof result === 'string' ? result : JSON.stringify(result);
  const resultSha = full == null ? null : putMachineBlob(m, full, { mediaType: typeof result === 'string' ? 'text/plain' : 'application/json' });
  let brief = summary ?? (full != null && Buffer.byteLength(full) <= 8192 && typeof result !== 'string' ? result : null);
  if (brief != null) { const s = JSON.stringify(brief); if (Buffer.byteLength(s) > 8192) brief = { truncated: true, bytes: Buffer.byteLength(s), sha256: resultSha }; }
  const stdoutSha = textBlob(m, stdout), stderrSha = textBlob(m, stderr);
  return m.db.prepare('UPDATE engine_actions SET state=?, finished_at=?, started_at=COALESCE(started_at,?), exit_code=?, result_json=?, result_sha=?, stdout_sha=?, stderr_sha=?, error_signature=? WHERE id=?')
    .run(state, m.now(), m.now(), exitCode, brief == null ? null : JSON.stringify(brief), resultSha, stdoutSha, stderrSha, errorSignature, id).changes > 0;
}
/** Actions left in intent/running by a dead engine become unknown (never replayed). */
const markStaleActionsUnknown = (m, { olderThanMs = 0, exceptEpoch = null } = {}) => m.db.prepare(`UPDATE engine_actions SET state='unknown', finished_at=? WHERE state IN ('intent','running') AND COALESCE(started_at,0)<=? ${exceptEpoch != null ? 'AND COALESCE(epoch,-1)<>?' : ''}`)
  .run(m.now(), m.now() - olderThanMs, ...(exceptEpoch != null ? [exceptEpoch] : [])).changes;
const actionOf = (m, id) => { const r = m.db.prepare('SELECT * FROM engine_actions WHERE id=?').get(id); return r ? { ...r, result: parse(r.result_json) } : null; };
function actions(m, { controller = null, state = null, sinceMs = null, limit = 200 } = {}) {
  const where = [], args = [];
  if (controller) { where.push('controller=?'); args.push(controller); }
  if (state) { where.push('state=?'); args.push(state); }
  if (sinceMs != null) { where.push('COALESCE(finished_at,started_at)>?'); args.push(m.now() - sinceMs); }
  return m.db.prepare(`SELECT * FROM engine_actions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(finished_at,started_at) DESC LIMIT ?`).all(...args, limit)
    .map((r) => ({ ...r, result: parse(r.result_json) }));
}
function actionStep(m, actionId, { step, ms = null, ok = null, detail = null }) {
  const n = Number(m.db.prepare('SELECT COALESCE(max(step_no),0)+1 n FROM action_steps WHERE action_id=?').get(actionId).n);
  insertRow(m.db, 'action_steps', { action_id: actionId, step_no: n, step, started_at: m.now(), ms, ok: bool(ok), detail: detail == null ? null : String(detail) });
  return n;
}

const controllerModes = (m) => Object.fromEntries(m.db.prepare('SELECT controller, mode FROM controller_modes').all().map((r) => [r.controller, r.mode]));
/** Change a controller mode: a mode_changes row first (who and why, G6), then controller_modes (trigger enforces the order). */
function setControllerMode(m, { controller, mode, by, reason }) {
  need(by && reason, 'setControllerMode needs by and reason');
  return m.transaction((db) => {
    const from = db.prepare('SELECT mode FROM controller_modes WHERE controller=?').get(controller)?.mode ?? null;
    if (from === mode) return { changed: false, mode };
    insertRow(db, 'mode_changes', { controller, from_mode: from, to_mode: mode, by, reason, at: m.now() });
    upsertRow(db, 'controller_modes', { controller, mode, set_at: m.now(), set_by: by }, ['controller']);
    return { changed: true, from, mode };
  });
}
const modeChanges = (m, { limit = 100 } = {}) => m.db.prepare('SELECT * FROM mode_changes ORDER BY change_id DESC LIMIT ?').all(limit);

/** Open an SLA episode for (entity,state) unless one is open (G3). Returns the episode id. */
function openSlaEpisode(m, { entity, state, code, severity = 'warn', ledgerId = null, workflowId = null, slaMs, enteredAt = m.now() }) {
  const open = m.db.prepare('SELECT episode_id FROM sla_episodes WHERE entity=? AND state=? AND cleared_at IS NULL').get(entity, state);
  if (open) return Number(open.episode_id);
  return Number(insertRow(m.db, 'sla_episodes', { entity, state, code, severity, ledger_id: ledgerId, workflow_id: workflowId, entered_at: enteredAt, sla_ms: slaMs }).lastInsertRowid);
}
const markSlaViolated = (m, episodeId) => m.db.prepare('UPDATE sla_episodes SET violated_at=? WHERE episode_id=? AND violated_at IS NULL').run(m.now(), episodeId).changes > 0;
const markSlaReported = (m, episodeId, { diId = null } = {}) => m.db.prepare('UPDATE sla_episodes SET reported_at=?, di_id=COALESCE(di_id,?) WHERE episode_id=? AND reported_at IS NULL').run(m.now(), diId, episodeId).changes > 0;
function clearSla(m, { entity, state = null, reason = 'resolved' }) {
  return m.db.prepare(`UPDATE sla_episodes SET cleared_at=?, clear_reason=? WHERE entity=? ${state ? 'AND state=?' : ''} AND cleared_at IS NULL`).run(m.now(), reason, entity, ...(state ? [state] : [])).changes;
}
const openSla = (m) => m.db.prepare('SELECT * FROM v_sla_open ORDER BY entered_at').all();
function recordViolation(m, { code, severity = 'warn', entity, ledgerId = null, workflowId = null, episodeId = null, diId = null, lessonId = null, detail = null }) {
  return Number(insertRow(m.db, 'invariant_violations', { code, severity, entity, ledger_id: ledgerId, workflow_id: workflowId, episode_id: episodeId, violated_at: m.now(), di_id: diId, lesson_id: lessonId, detail_json: detail }).lastInsertRowid);
}
const clearViolation = (m, violationId) => m.db.prepare('UPDATE invariant_violations SET cleared_at=? WHERE violation_id=? AND cleared_at IS NULL').run(m.now(), violationId).changes > 0;

// ---------------------------------------------------------------------------------------------------------------------
// B3. Services, seats, deliveries, terminals, locks, claims, sessions
// ---------------------------------------------------------------------------------------------------------------------
/** Set a service's state; a change appends service_events (G5). */
function setService(m, { name, kind, state, pid = undefined, port = undefined, url = undefined, probe = undefined, quarantinedUntil = undefined, action = null, actionId = null, probeMs = null, probeError = null }) {
  return m.transaction((db) => {
    const cur = db.prepare('SELECT state FROM services WHERE name=?').get(name);
    const at = m.now();
    upsertRow(db, 'services', { name, kind, state, since: cur?.state === state ? undefined : at, pid, port, url, last_probe_json: probe, quarantined_until: quarantinedUntil }, ['name']);
    if (!cur || cur.state !== state || (action && action !== 'none'))
      insertRow(db, 'service_events', { name, at, from_state: cur?.state ?? null, to_state: state, probe_ms: probeMs, probe_error: probeError, action, action_id: actionId });
    return { changed: !cur || cur.state !== state, from: cur?.state ?? null };
  });
}
const recordProbe = (m, { name, ok, latencyMs = null, detail = null }) => insertRow(m.db, 'service_probes', { name, at: m.now(), ok: ok ? 1 : 0, latency_ms: latencyMs, detail_json: detail });
const services = (m) => m.db.prepare('SELECT * FROM v_services ORDER BY name').all().map((r) => ({ ...r, lastProbe: parse(r.last_probe_json) }));
const serviceEvents = (m, { name = null, sinceMs = 86400000 } = {}) => m.db.prepare(`SELECT * FROM service_events WHERE at>? ${name ? 'AND name=?' : ''} ORDER BY seq`).all(m.now() - sinceMs, ...(name ? [name] : []));

const upsertSeat = (m, seat) => upsertRow(m.db, 'seats', snake(seat), ['seat_id']);
const seatOf = (m, seatId) => { const r = m.db.prepare('SELECT * FROM seats WHERE seat_id=?').get(seatId); return r ? { ...r, detail: parse(r.detail_json) } : null; };
const seats = (m) => m.db.prepare('SELECT * FROM v_seats ORDER BY seat_id').all();
/** One delivery attempt to a seat (G11, MB-02); the trigger counts consecutive input failures on the seat. */
function recordDelivery(m, { messageKind, messageRef, ledgerId = null, seatId = null, terminalHandle = null, channel, outcome, turnId = null, detail = null }) {
  return Number(insertRow(m.db, 'deliveries', { message_kind: messageKind, message_ref: String(messageRef), ledger_id: ledgerId, seat_id: seatId, terminal_handle: terminalHandle,
    channel, attempted_at: m.now(), outcome, turn_id: turnId, detail: detail == null ? null : String(detail) }).lastInsertRowid);
}
/** A wake outcome (scripts/kernel/wake-delivery.mjs action) as a deliveries.outcome, or null when it says nothing about input. */
const WAKE_OUTCOMES = Object.freeze({ 'kernel-woken': 'delivered', 'kernel-unwritable': 'unwritable', 'kernel-exited': 'exited', 'kernel-unavailable': 'unavailable',
  'kernel-send-failed': 'failed', 'kernel-busy': 'busy-deferred' });
/**
 * MB-05: count one wake of a seat. The outcome becomes a deliveries row; the deliveries trigger keeps
 * seats.input_failures_consecutive / _total (a refused input adds one, a delivered one resets). A seat whose
 * terminal changed starts from zero. Returns {failures, since, replace} with replace at `max` in a row.
 */
function recordSeatInput(m, { seatId, terminal = null, action, messageKind = 'wake', messageRef = 'wake', channel = 'orca', role = 'supervisor', max = 3, detail = null }) {
  return m.transaction((db) => {
    const seat = db.prepare('SELECT * FROM seats WHERE seat_id=?').get(seatId);
    if (!seat) insertRow(db, 'seats', { seat_id: seatId, role, state: 'live', terminal_handle: terminal });
    else if (terminal && seat.terminal_handle !== terminal)
      db.prepare('UPDATE seats SET terminal_handle=?, input_failures_consecutive=0, last_input_failure_at=NULL WHERE seat_id=?').run(terminal, seatId);
    const outcome = WAKE_OUTCOMES[action] ?? null;
    // A busy seat is not an input answer: its row carries no seat_id, so the trigger leaves the run of failures as it is.
    if (outcome) recordDelivery(m, { messageKind, messageRef, seatId: outcome === 'busy-deferred' ? null : seatId, terminalHandle: terminal, channel, outcome, detail: detail ?? `${seatId} ${action}` });
    const row = db.prepare('SELECT input_failures_consecutive n, last_input_ok_at ok, last_input_failure_at bad FROM seats WHERE seat_id=?').get(seatId);
    const failures = Number(row.n) || 0;
    const since = failures ? db.prepare("SELECT min(attempted_at) at FROM (SELECT attempted_at FROM deliveries WHERE seat_id=? AND outcome IN ('unwritable','exited','unavailable','failed') ORDER BY delivery_id DESC LIMIT ?)").get(seatId, failures)?.at ?? row.bad : null;
    return { failures, since, replace: failures >= max };
  });
}
const startSeatTurn = (m, { seatId, wokenByDelivery = null, spanId = newSpanId() }) => Number(insertRow(m.db, 'seat_turns', { seat_id: seatId, woken_by_delivery: wokenByDelivery, started_at: m.now(), span_id: spanId }).lastInsertRowid);
const endSeatTurn = (m, turnId, { endReason = 'idle', actionsCount = null } = {}) => m.db.prepare('UPDATE seat_turns SET ended_at=?, end_reason=?, actions_count=COALESCE(?,actions_count) WHERE turn_id=? AND ended_at IS NULL').run(m.now(), endReason, actionsCount, turnId).changes > 0;
function seatTranscriptSnapshot(m, { seatId, terminalHandle = null, text }) {
  const sha = putMachineBlob(m, String(text), { mediaType: 'text/plain' });
  insertRow(m.db, 'seat_transcript_snapshots', { seat_id: seatId, terminal_handle: terminalHandle, at: m.now(), lines: String(text).split('\n').length, bytes: Buffer.byteLength(String(text)), sha256: sha }, { orIgnore: true });
  return sha;
}
const upsertTerminal = (m, terminal) => upsertRow(m.db, 'terminals', snake(terminal), ['handle']);
const closeTerminal = (m, handle, { by = null, verified = false } = {}) => m.db.prepare('UPDATE terminals SET closed_at=COALESCE(closed_at,?), closed_by=COALESCE(closed_by,?), close_verified_at=CASE WHEN ? THEN ? ELSE close_verified_at END WHERE handle=?')
  .run(m.now(), by, verified ? 1 : 0, m.now(), handle).changes > 0;

/**
 * Take a host lock (replaces connectors/*.lock and *.starting.json): succeeds when free, released, expired, or already
 * ours. Returns {ok, holder?}.
 */
function acquireHostLock(m, { name, holder = null, pid = process.pid, ttlMs = 60000, processRunId = null, state = 'held' }) {
  return m.transaction((db) => {
    const at = m.now();
    const cur = db.prepare('SELECT * FROM host_locks WHERE name=?').get(name);
    if (cur && cur.state !== 'released' && cur.expires_at > at && cur.holder_pid !== pid) return { ok: false, holder: cur };
    upsertRow(db, 'host_locks', { name, holder_pid: pid, holder, process_run_id: processRunId, started_at: cur && cur.holder_pid === pid && cur.state !== 'released' ? cur.started_at : at,
      heartbeat_at: at, expires_at: at + ttlMs, handed_over_from: cur && cur.holder_pid !== pid && cur.state !== 'released' ? cur.holder_pid : null, state }, ['name']);
    return { ok: true };
  });
}
const renewHostLock = (m, { name, pid = process.pid, ttlMs = 60000, state = undefined }) => m.db.prepare(`UPDATE host_locks SET heartbeat_at=?, expires_at=? ${state ? ', state=?' : ''} WHERE name=? AND holder_pid=? AND state<>'released'`)
  .run(m.now(), m.now() + ttlMs, ...(state ? [state] : []), name, pid).changes > 0;
const releaseHostLock = (m, { name, pid = process.pid, force = false }) => m.db.prepare(`UPDATE host_locks SET state='released', heartbeat_at=? WHERE name=? ${force ? '' : 'AND holder_pid=?'} AND state<>'released'`)
  .run(m.now(), name, ...(force ? [] : [pid])).changes > 0;
const hostLock = (m, name) => m.db.prepare('SELECT * FROM host_locks WHERE name=?').get(name) ?? null;
const hostLocks = (m) => m.db.prepare("SELECT * FROM host_locks WHERE state<>'released' ORDER BY name").all();

function claimResource(m, { resourcePath, kind, ownerActionId = null, ownerPid = process.pid, ownerRunId = null, hasJunctions = false }) {
  return Number(insertRow(m.db, 'claims', { resource_path: path.resolve(resourcePath), kind, owner_action_id: ownerActionId, owner_pid: ownerPid, owner_run_id: ownerRunId,
    has_junctions: hasJunctions ? 1 : 0, created_at: m.now() }).lastInsertRowid);
}
const releaseClaim = (m, claimId) => m.db.prepare('UPDATE claims SET released_at=? WHERE claim_id=? AND released_at IS NULL').run(m.now(), claimId).changes > 0;
const sweptClaim = (m, claimId, { error = null } = {}) => m.db.prepare('UPDATE claims SET swept_at=?, sweep_error=? WHERE claim_id=?').run(m.now(), error, claimId).changes > 0;
const liveClaims = (m) => m.db.prepare('SELECT * FROM claims WHERE released_at IS NULL AND swept_at IS NULL ORDER BY claim_id').all();
const upsertAgentSession = (m, session) => upsertRow(m.db, 'agent_sessions', snake(session), ['session_id']);

// ---------------------------------------------------------------------------------------------------------------------
// B4. Resources: throttle, samples, providers, pool backoff, quotas, guards, host leases, budgets
// ---------------------------------------------------------------------------------------------------------------------
const throttleState = (m) => { const r = m.db.prepare('SELECT * FROM throttle_state WHERE id=1').get(); return r ? { ...r, slotTargets: parse(r.slot_targets_json), priorities: parse(r.priorities_json) } : null; };
/** Write the current throttle row (MB-15: writer + rev). A mode change appends throttle_events first (G7). */
function setThrottle(m, { mode, effectiveCap = null, heavyCap = null, running = null, freeRamPct = null, freeRamMb = null, cpuPct = null, cpuHot = null, reason = null,
  writer, writerRev = runtimeRev(), slotTargets = null, priorities = null, sample = null }) {
  need(writer, 'setThrottle needs writer');
  return m.transaction((db) => {
    const at = m.now();
    const cur = db.prepare('SELECT mode, since, writer, writer_rev FROM throttle_state WHERE id=1').get();
    // MB-15: a process running an OLDER runtime never overwrites what a newer runtime wrote.
    if (cur && compareRevs(writerRev, cur.writer_rev) < 0)
      return { changed: false, refused: `stale-writer-rev: ${writerRev} is older than ${cur.writer_rev} (${cur.writer})`, from: cur.mode };
    const changed = !cur || cur.mode !== mode;
    if (changed) insertRow(db, 'throttle_events', { at, from_mode: cur?.mode ?? null, to_mode: mode, reason, free_ram_pct: freeRamPct, cpu_pct: cpuPct, effective_cap: effectiveCap, running, writer_rev: writerRev, sample_json: sample });
    upsertRow(db, 'throttle_state', { id: 1, mode, effective_cap: effectiveCap, heavy_cap: heavyCap, running, free_ram_pct: freeRamPct, free_ram_mb: freeRamMb, cpu_pct: cpuPct, cpu_hot: int(cpuHot),
      since: changed ? at : cur.since, updated_at: at, reason, writer, writer_rev: writerRev, slot_targets_json: slotTargets, priorities_json: priorities }, ['id']);
    return { changed, from: cur?.mode ?? null };
  });
}
const throttleEvents = (m, { sinceMs = 86400000 } = {}) => m.db.prepare('SELECT * FROM throttle_events WHERE at>? ORDER BY seq').all(m.now() - sinceMs);
const recordThrottleDecision = (m, { ledgerId = null, workflowId = null, jobId = null, reason, waitedMs = null }) =>
  Number(insertRow(m.db, 'throttle_decisions', { at: m.now(), ledger_id: ledgerId, workflow_id: workflowId, job_id: jobId, reason, waited_ms: waitedMs }).lastInsertRowid);
const releaseThrottleDecision = (m, seq) => m.db.prepare('UPDATE throttle_decisions SET released_at=?, waited_ms=?-at WHERE seq=? AND released_at IS NULL').run(m.now(), m.now(), seq).changes > 0;
const recordHostSample = (m, sample) => Number(insertRow(m.db, 'host_samples', { at: m.now(), ...snake(sample) }).lastInsertRowid);
const hostSamples = (m, { kind = 'host', sinceMs = 3600000 } = {}) => m.db.prepare('SELECT * FROM host_samples WHERE kind=? AND at>? ORDER BY seq').all(kind, m.now() - sinceMs);
function setProviderHealth(m, { provider, status, failureKind = null, strikes = 0, strikeLimit = null, circuitOpenUntil = null, reason = null, ledgerId = null, attemptId = null, detail = null }) {
  return m.transaction((db) => {
    const cur = db.prepare('SELECT status FROM provider_health WHERE provider=?').get(provider);
    const at = m.now();
    upsertRow(db, 'provider_health', { provider, status, failure_kind: failureKind, strikes, strike_limit: strikeLimit, circuit_open_until: circuitOpenUntil,
      recovered_at: status === 'recovered' ? at : undefined, reason, updated_at: at, detail_json: detail }, ['provider']);
    if (!cur || cur.status !== status) insertRow(db, 'provider_health_events', { provider, at, from_status: cur?.status ?? null, to_status: status, failure_kind: failureKind, ledger_id: ledgerId, attempt_id: attemptId, detail_json: detail });
    return { changed: !cur || cur.status !== status };
  });
}
const providerHealth = (m) => m.db.prepare('SELECT * FROM provider_health ORDER BY provider').all();
const poolBackoff = (m, pool = null) => (pool ? m.db.prepare('SELECT * FROM pool_backoff WHERE pool=?').get(pool) ?? null : m.db.prepare('SELECT * FROM pool_backoff ORDER BY pool').all());
const setPoolBackoff = (m, { pool, untilAt = null, strikes = 0, reason = null }) => upsertRow(m.db, 'pool_backoff', { pool, until_at: untilAt, strikes, reason, updated_at: m.now() }, ['pool']);
const clearPoolBackoff = (m, pool) => m.db.prepare('DELETE FROM pool_backoff WHERE pool=?').run(pool).changes > 0;
const setQuota = (m, { provider, window, used = null, limitValue = null, resetAt = null, source = null }) => upsertRow(m.db, 'quotas', { provider, window, used, limit_value: limitValue, reset_at: resetAt, source, observed_at: m.now() }, ['provider', 'window']);
const quotas = (m) => m.db.prepare('SELECT * FROM quotas ORDER BY provider, window').all();

const { reserveProvider, providerReservations, providerReservationUsage, markProviderReservation, releaseProviderReservation } = providerReservationMethods({ need, parse, toJson, hex });

const upsertGuardJob = (m, { jobId, ledgerId = null, workflowId = null, attemptId = null, allow, hooks = null, ttlMs = 86400000 }) =>
  upsertRow(m.db, 'guard_jobs', { job_id: jobId, ledger_id: ledgerId, workflow_id: workflowId, attempt_id: attemptId, allow_json: allow, hooks_json: hooks, created_at: m.now(), expires_at: m.now() + ttlMs, released_at: null }, ['job_id']);
const guardJob = (m, jobId) => { const r = m.db.prepare('SELECT * FROM guard_jobs WHERE job_id=?').get(jobId); return r ? { ...r, allow: parse(r.allow_json), hooks: parse(r.hooks_json) } : null; };
const releaseGuardJob = (m, jobId) => m.db.prepare('UPDATE guard_jobs SET released_at=? WHERE job_id=? AND released_at IS NULL').run(m.now(), jobId).changes > 0;
const recordGuardRefusal = (m, refusal) => Number(insertRow(m.db, 'guard_refusals', { at: m.now(), ...snake(refusal) }).lastInsertRowid);
/** Host leases (the machine side of a ledger's two-phase reserve): drop by token. */
function releaseHostLeases(m, tokens) {
  const list = [...new Set([tokens].flat().map((t) => (typeof t === 'string' ? t : t?.token)).filter(Boolean))];
  let released = 0; for (const token of list) released += m.db.prepare('DELETE FROM host_leases WHERE token=?').run(token).changes;
  return { ok: true, released };
}
const hostLeases = (m) => m.db.prepare('SELECT * FROM host_leases ORDER BY resource_key').all();
const setBudget = (m, { scopeKey, limitValue, window = null }) => m.db.prepare('INSERT INTO budgets(scope_key,limit_value,window,updated_at) VALUES(?,?,?,?) ON CONFLICT(scope_key) DO UPDATE SET limit_value=excluded.limit_value, window=excluded.window, updated_at=excluded.updated_at')
  .run(scopeKey, limitValue, window, m.now());
/** Reserve units against a budget; refuses when used+reserved+units > limit. */
function reserveBudget(m, { scopeKey, ledgerId, jobId, units }) {
  return m.transaction((db) => {
    const b = db.prepare('SELECT * FROM budgets WHERE scope_key=?').get(scopeKey);
    if (!b) return { ok: false, reason: 'no-budget' };
    const held = db.prepare('SELECT units FROM budget_reservations WHERE scope_key=? AND ledger_id=? AND job_id=?').get(scopeKey, ledgerId, jobId);
    if (held) return { ok: true, already: true };
    if (b.used_value + b.reserved_value + units > b.limit_value) return { ok: false, reason: 'budget-exhausted', budget: b };
    insertRow(db, 'budget_reservations', { scope_key: scopeKey, ledger_id: ledgerId, job_id: jobId, units, at: m.now() });
    db.prepare('UPDATE budgets SET reserved_value=reserved_value+?, updated_at=? WHERE scope_key=?').run(units, m.now(), scopeKey);
    return { ok: true };
  });
}
/** Settle a reservation: `used` units move to used_value, the rest is returned. */
function settleBudget(m, { scopeKey, ledgerId, jobId, used = null }) {
  return m.transaction((db) => {
    const r = db.prepare('SELECT units FROM budget_reservations WHERE scope_key=? AND ledger_id=? AND job_id=?').get(scopeKey, ledgerId, jobId);
    if (!r) return false;
    db.prepare('DELETE FROM budget_reservations WHERE scope_key=? AND ledger_id=? AND job_id=?').run(scopeKey, ledgerId, jobId);
    db.prepare('UPDATE budgets SET reserved_value=max(0,reserved_value-?), used_value=used_value+?, updated_at=? WHERE scope_key=?').run(r.units, used ?? r.units, m.now(), scopeKey);
    return true;
  });
}
const budgets = (m) => m.db.prepare('SELECT * FROM budgets ORDER BY scope_key').all();

// ---------------------------------------------------------------------------------------------------------------------
// B5. GC, lanes, land queue, land runs, pushes, worktrees, env servers, UAT slots, connectors, asks
// ---------------------------------------------------------------------------------------------------------------------
const startGcRun = (m, { trigger = 'sweep', actionId = null, collectors = null, startedAt = m.now() } = {}) => Number(insertRow(m.db, 'gc_runs', { action_id: actionId, started_at: startedAt, trigger, collectors_json: collectors }).lastInsertRowid);
/** Finish a GC run; the full report is a blob (G4). */
function finishGcRun(m, runId, { freedBytes = null, counts = null, errors = null, report = null, finishedAt = m.now() } = {}) {
  const reportSha = report == null ? null : putMachineBlob(m, JSON.stringify(report), { mediaType: 'application/json' });
  return m.db.prepare('UPDATE gc_runs SET finished_at=?, freed_bytes=?, counts_json=?, errors_json=?, report_sha=? WHERE run_id=?')
    .run(finishedAt, freedBytes, toJson(counts), toJson(errors), reportSha, runId).changes > 0;
}
/** One thing GC touched (G4, MB-14). `outcome` is the final fate; a retry sets nextTryAt past the grace window. */
const recordGcItem = (m, item) => Number(insertRow(m.db, 'gc_items', { at: m.now(), ...snake(item) }).lastInsertRowid);
const updateGcItem = (m, itemId, fields) => updateRow(m.db, 'gc_items', snake(fields), { item_id: itemId }).changes > 0;
const gcItems = (m, { runId = null, open = false, collector = null, limit = 500 } = {}) => m.db.prepare(`SELECT * FROM gc_items WHERE 1=1 ${runId != null ? 'AND run_id=?' : ''} ${open ? 'AND outcome IS NULL' : ''} ${collector ? 'AND collector=?' : ''} ORDER BY item_id DESC LIMIT ?`)
  .all(...(runId != null ? [runId] : []), ...(collector ? [collector] : []), limit);
function gcMark(m, runId, entries) {
  return m.transaction((db) => { const st = db.prepare('INSERT OR IGNORE INTO gc_marks(run_id,sha256,source,pinned) VALUES(?,?,?,?)'); for (const e of entries) { st.run(runId, e.sha256, e.source, e.pinned ? 1 : 0); } return entries.length; });
}
/** A blob whose bytes were archived (zip) before the sweep: archived_at + archive_ref on the machine's blobs row. */
const markMachineBlobArchived = (m, { sha256: sha, archivedAt = m.now(), archiveRef }) => m.db.prepare('UPDATE blobs SET archived_at=?, archive_ref=? WHERE sha256=?').run(archivedAt, archiveRef, sha).changes > 0;
/**
 * Seat scrollback snapshots that are no longer needed (Q4): every snapshot taken before a seat session ended whose FINAL
 * transcript is stored (agent_sessions.transcript_sha of that seat, ended_at set), plus any snapshot older than `seatMs`
 * except each seat's newest one. Returns the rows deleted.
 */
const pruneSeatSnapshots = (m, { now = m.now(), seatMs }) => m.transaction((db) => {
  const final = db.prepare(`DELETE FROM seat_transcript_snapshots WHERE EXISTS (SELECT 1 FROM agent_sessions a
    WHERE a.seat_id=seat_transcript_snapshots.seat_id AND a.transcript_sha IS NOT NULL AND a.ended_at IS NOT NULL
      AND seat_transcript_snapshots.at<=a.ended_at)`).run().changes;
  const aged = db.prepare(`DELETE FROM seat_transcript_snapshots WHERE at<? AND snapshot_id NOT IN
    (SELECT max(snapshot_id) FROM seat_transcript_snapshots GROUP BY seat_id)`).run(now - seatMs).changes;
  return final + aged;
});
const gcRuns = (m, { limit = 20 } = {}) => m.db.prepare('SELECT * FROM gc_runs ORDER BY run_id DESC LIMIT ?').all(limit);

function upsertLane(m, { name, worktreePath, branch, baseSha = null, headSha = null, owner, supJobId = null, state = 'open' }) {
  const cur = m.db.prepare('SELECT created_at FROM lanes WHERE name=?').get(name);
  return upsertRow(m.db, 'lanes', { name, worktree_path: path.resolve(worktreePath), branch, base_sha: baseSha, head_sha: headSha, owner, sup_job_id: supJobId, state, created_at: cur?.created_at ?? m.now() }, ['name']);
}
function setLaneState(m, name, state, { reportText = null, headSha = null } = {}) {
  const set = { state };
  if (state === 'landed') set.landed_at = m.now();
  if (state === 'removed') set.removed_at = m.now();
  if (headSha) set.head_sha = headSha;
  if (reportText) set.report_sha = textBlob(m, reportText, 'text/markdown');
  return updateRow(m.db, 'lanes', set, { name }).changes > 0;
}
const laneOf = (m, name) => m.db.prepare('SELECT * FROM lanes WHERE name=?').get(name) ?? null;
const lanes = (m, { state = null } = {}) => m.db.prepare(`SELECT * FROM lanes ${state ? 'WHERE state=?' : ''} ORDER BY created_at`).all(...(state ? [state] : []));
/** Enqueue a land ticket (replaces the land queue dirs). The lane row is created when absent (FK). */
function enqueueLand(m, { ticketId = `land-${Date.now().toString(36)}-${hex(4)}`, lane = null, commitSha, commits = null, requestedBy = `pid:${process.pid}` }) {
  return m.transaction((db) => {
    if (lane && !db.prepare('SELECT 1 FROM lanes WHERE name=?').get(lane)) insertRow(db, 'lanes', { name: lane, worktree_path: '', branch: `lane/${lane}`, owner: requestedBy ?? 'unknown', state: 'open', created_at: m.now() });
    insertRow(db, 'land_queue', { ticket_id: ticketId, lane, commit_sha: commitSha, commits, requested_by: requestedBy, state: 'queued', enqueued_at: m.now() });
    return ticketId;
  });
}
/** The head of the queue enters the gate when nothing is running. Returns the ticket, or {busy: running ticket}. */
/** requested_by 'pid:<n>' names the process that waits for and then runs the ticket. */
function claimLandGate(m, { ticketId, alive = pidAlive }) {
  return m.transaction((db) => {
    // A waiter or holder whose process is gone never blocks the queue: its ticket is cancelled.
    for (const t of db.prepare("SELECT ticket_id, state, requested_by, busy_holder FROM land_queue WHERE state IN ('queued','running')").all()) {
      const owner = /^pid:(\d+)$/.exec(String(t.requested_by ?? ''));
      if (t.ticket_id !== ticketId && owner && !alive(Number(owner[1]))) db.prepare("UPDATE land_queue SET state='cancelled', finished_at=? WHERE ticket_id=?").run(m.now(), t.ticket_id);
    }
    const running = db.prepare("SELECT * FROM land_queue WHERE state='running' ORDER BY started_at LIMIT 1").get();
    if (running && running.ticket_id !== ticketId) { db.prepare('UPDATE land_queue SET busy_holder=? WHERE ticket_id=?').run(running.ticket_id, ticketId); return { ok: false, busy: running }; }
    const head = db.prepare("SELECT ticket_id FROM land_queue WHERE state='queued' ORDER BY enqueued_at, ticket_id LIMIT 1").get();
    if (!running && head && head.ticket_id !== ticketId) return { ok: false, behind: head.ticket_id };
    db.prepare("UPDATE land_queue SET state='running', gate_at=COALESCE(gate_at,?), started_at=COALESCE(started_at,?) WHERE ticket_id=? AND state IN ('queued','running')").run(m.now(), m.now(), ticketId);
    return { ok: true, ticket: db.prepare('SELECT * FROM land_queue WHERE ticket_id=?').get(ticketId) };
  });
}
const finishLandTicket = (m, ticketId, state) => m.db.prepare("UPDATE land_queue SET state=?, finished_at=? WHERE ticket_id=? AND state IN ('queued','running')").run(state, m.now(), ticketId).changes > 0;
const landQueue = (m, { open = true } = {}) => m.db.prepare(`SELECT * FROM land_queue ${open ? "WHERE state IN ('queued','running')" : ''} ORDER BY enqueued_at, ticket_id`).all();
/** One land-gate run with full stdout/stderr blobs. */
function recordLandRun(m, { ticketId = null, lane = null, spanId = newSpanId(), parentSpanId = null, commitSha, commits = null, landedSha = null, result, reason = null, pushId = null, specs = null, stdout = null, stderr = null, startedAt, finishedAt = m.now() }) {
  return Number(insertRow(m.db, 'land_runs', { ticket_id: ticketId, lane, span_id: spanId, parent_span_id: parentSpanId, commit_sha: commitSha, commits_json: commits ?? (commitSha ? [commitSha] : null), landed_sha: landedSha, result, reason, push_id: pushId,
    specs_json: specs, stdout_sha: textBlob(m, stdout), stderr_sha: textBlob(m, stderr), started_at: startedAt ?? m.now(), finished_at: finishedAt }).lastInsertRowid);
}
/**
 * The core record of one land in ONE transaction, idempotent on spanId (a replay from the outbox or a second try never
 * doubles it): the lane row when absent, the push row, the land_runs row, the lane head and the log line (its data gets
 * runId). {runId, pushId, duplicate}.
 */
function recordLandOutcome(m, { spanId, lane = null, push = null, run, laneHead = null, log: logRow = null }) {
  need(spanId && run, 'recordLandOutcome needs spanId and run');
  return m.transaction((db) => {
    const hit = db.prepare('SELECT run_id, push_id FROM land_runs WHERE span_id=?').get(spanId);
    if (hit) return { runId: Number(hit.run_id), pushId: hit.push_id == null ? null : Number(hit.push_id), duplicate: true };
    if (lane && !db.prepare('SELECT 1 FROM lanes WHERE name=?').get(lane)) insertRow(db, 'lanes', { name: lane, worktree_path: '', branch: `lane/${lane}`, owner: 'land-gate', state: 'open', created_at: m.now() });
    const pushId = push ? recordPush(m, push) : null;
    const runId = recordLandRun(m, { ...run, lane, spanId, pushId });
    if (lane && laneHead) updateRow(db, 'lanes', { head_sha: laneHead }, { name: lane });
    if (logRow) log(m, { ...logRow, data: { ...logRow.data, runId } });
    return { runId, pushId, duplicate: false };
  });
}
const landRuns = (m, { lane = null, limit = 50 } = {}) => m.db.prepare(`SELECT * FROM land_runs ${lane ? 'WHERE lane=?' : ''} ORDER BY run_id DESC LIMIT ?`).all(...(lane ? [lane] : []), limit);
/** One push (G8, MB-03): a refusal needs a stable failure signature; logs are full blobs. */
function recordPush(m, { repoRoot, branch = null, head, fromSha = null, toSha = null, result, reason = null, failureSignature = null, ms = null, actionId = null, scan = null, stdout = null, stderr = null }) {
  return Number(insertRow(m.db, 'pushes', { repo_root: repoKey(repoRoot), branch, head, from_sha: fromSha, to_sha: toSha, result, reason: reason == null ? null : redactText(String(reason)), failure_signature: failureSignature, ms, action_id: actionId,
    scan_json: scan, stdout_sha: textBlob(m, stdout), stderr_sha: textBlob(m, stderr), at: m.now() }).lastInsertRowid);
}
const pushes = (m, { repoRoot = null, limit = 50 } = {}) => m.db.prepare(`SELECT * FROM pushes ${repoRoot ? 'WHERE repo_root=?' : ''} ORDER BY push_id DESC LIMIT ?`).all(...(repoRoot ? [repoKey(repoRoot)] : []), limit);
const upsertWorktree = (m, wt) => upsertRow(m.db, 'worktrees', { created_at: m.now(), ...snake(wt), path: path.resolve(wt.path) }, ['path']);
const removedWorktree = (m, wtPath, { error = null, archivedRef = null } = {}) => m.db.prepare('UPDATE worktrees SET removed_at=CASE WHEN ? IS NULL THEN ? ELSE removed_at END, remove_error=?, archived_ref=COALESCE(?,archived_ref) WHERE path=?')
  .run(error, m.now(), error, archivedRef, path.resolve(wtPath)).changes > 0;
/**
 * The worktree registry (scripts/machine/worktree-registry.mjs and the worktree api files are its callers): reserve a row for a worktree about to be created,
 * atomically against the per-repo cap. BEGIN IMMEDIATE: two dispatches never both take the last slot. `cap` null: no cap.
 * {ok, live} | {ok:false, reason:'worktree-cap', live, cap}
 */
function reserveWorktree(m, wt, { cap = null } = {}) {
  return m.transaction((db) => {
    const repoRoot = repoKey(wt.repoRoot);
    const target = path.resolve(wt.path);
    const live = db.prepare('SELECT path FROM worktrees WHERE repo_root=? AND removed_at IS NULL').all(repoRoot).filter((r) => r.path !== target).length;
    if (cap != null && live >= cap) return { ok: false, reason: 'worktree-cap', live, cap };
    upsertRow(db, 'worktrees', { ...snake(wt), path: target, repo_root: repoRoot, created_at: m.now(), removed_at: null, remove_error: null }, ['path']);
    return { ok: true, live: live + 1 };
  });
}
/** Live (not removed) registry rows, optionally of one repo. */
const liveWorktrees = (m, { repoRoot = null } = {}) => m.db.prepare(`SELECT * FROM worktrees WHERE removed_at IS NULL ${repoRoot ? 'AND repo_root=?' : ''} ORDER BY created_at`)
  .all(...(repoRoot ? [repoKey(repoRoot)] : []));
const worktreeRow = (m, wtPath) => m.db.prepare('SELECT * FROM worktrees WHERE path=?').get(path.resolve(wtPath)) ?? null;
/** Every repo the registry ever held a worktree of. */
const worktreeRepos = (m) => m.db.prepare('SELECT DISTINCT repo_root FROM worktrees ORDER BY repo_root').all().map((r) => r.repo_root);
/** A reservation whose `git worktree add` failed: the row goes, nothing was created. */
/** A GC collector's resume point (machine_meta gc_cursor:<name>): where its last bounded pass stopped, or null. */
const gcCursor = (m, name) => m.db.prepare('SELECT value FROM machine_meta WHERE key=?').get(`gc_cursor:${name}`)?.value ?? null;
const setGcCursor = (m, name, value) => (value == null
  ? m.db.prepare('DELETE FROM machine_meta WHERE key=?').run(`gc_cursor:${name}`)
  : m.db.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(`gc_cursor:${name}`, String(value))).changes > 0;
/** The worktree GC's stop mark (a removal changed the main checkout): {at, damage, path} or null. set(null) clears it. */
const worktreeGcStop = (m) => parse(m.db.prepare("SELECT value FROM machine_meta WHERE key='worktree_gc_stopped'").get()?.value ?? null);
const setWorktreeGcStop = (m, stop) => (stop
  ? m.db.prepare("INSERT INTO machine_meta(key,value) VALUES('worktree_gc_stopped',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(stop))
  : m.db.prepare("DELETE FROM machine_meta WHERE key='worktree_gc_stopped'").run()).changes > 0;
const dropWorktree = (m, wtPath) => m.db.prepare('DELETE FROM worktrees WHERE path=? AND removed_at IS NULL').run(path.resolve(wtPath)).changes > 0;
const upsertEnvServer = (m, server) => upsertRow(m.db, 'env_servers', snake(server), ['server_id']);
const envServer = (m, serverId) => m.db.prepare('SELECT * FROM env_servers WHERE server_id=?').get(serverId) ?? null;
const envServers = (m, { live = false } = {}) => m.db.prepare(`SELECT * FROM env_servers ${live ? "WHERE state IN ('starting','ready')" : ''} ORDER BY server_id`).all();
const upsertUatSlot = (m, slot) => upsertRow(m.db, 'uat_slots', snake(slot), ['slot_id']);
const uatSlots = (m, { live = true } = {}) => m.db.prepare(`SELECT * FROM uat_slots ${live ? 'WHERE released_at IS NULL' : ''} ORDER BY acquired_at`).all();
const releaseUatSlot = (m, slotId) => m.db.prepare('UPDATE uat_slots SET released_at=? WHERE slot_id=? AND released_at IS NULL').run(m.now(), slotId).changes > 0;
const upsertConnector = (m, { name, kind = null, state = null, pid = null, port = null, publicUrl = null, config = undefined, cursor = undefined }) =>
  upsertRow(m.db, 'connectors', { name, kind, state, pid, port, public_url: publicUrl, config_json: config, cursor_json: cursor, updated_at: m.now() }, ['name']);
const connectorOf = (m, name) => { const r = m.db.prepare('SELECT * FROM connectors WHERE name=?').get(name); return r ? { ...r, config: parse(r.config_json), cursor: parse(r.cursor_json) } : null; };
const upsertAsk = (m, ask) => upsertRow(m.db, 'ask_requests', { asked_at: m.now(), ...snake(ask) }, ['ask_id']);

// ---------------------------------------------------------------------------------------------------------------------
// B6. Observation: machine_logs (+FTS), metrics, notifications, archives
// ---------------------------------------------------------------------------------------------------------------------
const LOG_ACTORS = new Set(['reconciler', 'supervisor', 'worker', 'gc', 'host', 'land', 'watchdog', 'connector', 'harness', 'runtime']);
/**
 * Append machine_logs rows ({actor, kind, msg, level?, controller?, ledgerId?, workflowId?, jobId?, attemptId?, actionId?,
 * traceId?, spanId?, data?, refs?, src?, at?}). `src` is a unique idempotency key (a duplicate is skipped). data larger than
 * 64 KiB goes to a blob. Returns the number written.
 */
function log(m, rows) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  if (!list.length) return 0;
  return m.transaction((db) => {
    let n = 0;
    for (const r of list) {
      need(LOG_ACTORS.has(r.actor), `machine log: unknown actor ${r.actor}`);
      const { json } = jsonOrBlob(m, r.data == null ? null : redactData(r.data));
      n += insertRow(db, 'machine_logs', { at: r.at ?? m.now(), actor: r.actor, controller: r.controller ?? null, ledger_id: r.ledgerId ?? null, workflow_id: r.workflowId ?? null,
        job_id: r.jobId ?? null, attempt_id: int(r.attemptId), action_id: r.actionId ?? null, trace_id: r.traceId ?? null, span_id: r.spanId ?? null, level: r.level ?? 'info',
        kind: String(r.kind), msg: redactText(String(r.msg ?? '')), data_json: json, refs_json: r.refs == null ? null : redactData(r.refs), src: r.src ?? null }, { orIgnore: true }).changes;
    }
    return n;
  });
}
function logs(m, { actor = null, kind = null, level = null, ledgerId = null, workflowId = null, jobId = null, since = null, search = null, limit = 200 } = {}) {
  const where = [], args = [];
  if (actor) { where.push('l.actor=?'); args.push(actor); }
  if (kind) { where.push(kind.endsWith('*') ? 'l.kind LIKE ?' : 'l.kind=?'); args.push(kind.endsWith('*') ? `${kind.slice(0, -1)}%` : kind); }
  if (level) { where.push('l.level=?'); args.push(level); }
  if (ledgerId) { where.push('l.ledger_id=?'); args.push(ledgerId); }
  if (workflowId) { where.push('l.workflow_id=?'); args.push(workflowId); }
  if (jobId) { where.push('l.job_id=?'); args.push(jobId); }
  if (since != null) { where.push('l.seq>?'); args.push(since); }
  if (search) { where.push('l.seq IN (SELECT rowid FROM machine_logs_fts WHERE machine_logs_fts MATCH ?)'); args.push(search); }
  return m.db.prepare(`SELECT l.* FROM machine_logs l ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.seq DESC LIMIT ?`).all(...args, limit)
    .map((r) => ({ ...r, data: fullJson(parse(r.data_json)), refs: parse(r.refs_json) }));
}
/** Retention (DBTREE B6): debug rows older than 14 days, the rest older than 90 days. Returns rows deleted. */
function pruneLogs(m, { debugMs = 14 * 86400000, restMs = 90 * 86400000 } = {}) {
  return m.transaction((db) => db.prepare("DELETE FROM machine_logs WHERE (level='debug' AND at<?) OR at<?").run(m.now() - debugMs, m.now() - restMs).changes);
}
function recordMetrics(m, { kind, ledgerId = null, workflowId = null, windowMs = null, subject = null, data }) {
  const { json, sha } = jsonOrBlob(m, data);
  return Number(insertRow(m.db, 'metrics_snapshots', { at: m.now(), kind, ledger_id: ledgerId, workflow_id: workflowId, window_ms: windowMs, subject, data_json: json, data_sha: sha }).lastInsertRowid);
}
const latestMetrics = (m, { kind, ledgerId = null, workflowId = null } = {}) => { const r = m.db.prepare('SELECT * FROM metrics_snapshots WHERE kind=? AND ledger_id IS ? AND workflow_id IS ? ORDER BY snap_id DESC LIMIT 1').get(kind, ledgerId, workflowId); return r ? { ...r, data: parse(r.data_json) } : null; };
/** A notification, deduplicated on dedupeKey (replaces telegram-sent.json). Returns {id, duplicate}. */
function recordNotification(m, { channel, kind, text, media = null, mediaType = 'image/png', sentAt = null, delivery = null, ref = null, dedupeKey = null }) {
  if (dedupeKey) { const hit = m.db.prepare('SELECT notif_id FROM notifications WHERE dedupe_key=?').get(dedupeKey); if (hit) return { id: Number(hit.notif_id), duplicate: true }; }
  const mediaSha = media ? putMachineBlob(m, media, { mediaType }) : null;
  return { id: Number(insertRow(m.db, 'notifications', { channel, kind, text, media_sha: mediaSha, sent_at: sentAt, delivery, ref, dedupe_key: dedupeKey }).lastInsertRowid), duplicate: false };
}
const notificationSent = (m, dedupeKey) => Boolean(m.db.prepare('SELECT 1 FROM notifications WHERE dedupe_key=?').get(dedupeKey));
const markNotificationSent = (m, id, { delivery = 'sent' } = {}) => m.db.prepare('UPDATE notifications SET sent_at=?, delivery=? WHERE notif_id=?').run(m.now(), delivery, id).changes > 0;
const recordArchive = (m, archive) => upsertRow(m.db, 'archives', { created_at: m.now(), ...snake(archive), archive_path: path.resolve(archive.archivePath ?? archive.archive_path) }, ['archive_path']);

// ---------------------------------------------------------------------------------------------------------------------
// Catalog projection (agents / models from modules/models/*.yaml, rewritten at engine start)
// ---------------------------------------------------------------------------------------------------------------------
function projectCatalog(m, { agents = [], models = [], sourceRev = runtimeRev() }) {
  return m.transaction((db) => {
    const at = m.now();
    for (const a of agents) upsertRow(db, 'agents', { agent: a.agent, provider: a.provider ?? null, spawn_card: a.spawnCard ?? null, cli_name: a.cliName ?? null, source_rev: sourceRev, loaded_at: at }, ['agent']);
    for (const p of models) upsertRow(db, 'models', { profile: p.profile, agent: p.agent ?? null, model: p.model ?? null, pool: p.pool ?? null, max_parallel: int(p.maxParallel), share_pct: p.sharePct ?? null,
      roles_json: p.roles ?? null, cost_json: p.cost ?? null, source_rev: sourceRev, loaded_at: at }, ['profile']);
    return { agents: agents.length, models: models.length };
  });
}

/**
 * The ONE checkpoint of machine.sqlite: PASSIVE, on the checkpointer handle (openMachine({checkpointer:true}), the engine),
 * and only while the engine_leader row `name` still names `holder` at `epoch` with a live lease. A standby, a draining or a
 * superseded engine gets {skipped} and checkpoints nothing, so two engines never checkpoint back to back (WAL-reset bug).
 * Returns {busy, log, checkpointed} or {skipped: reason}.
 */
function checkpoint(m, { name = 'reconciler', holder, epoch } = {}) {
  need(m.checkpointer, 'machine-db: only the checkpointer handle (the reconciler engine leader) checkpoints machine.sqlite', 'STARCI_MACHINE_NOT_CHECKPOINTER');
  need(holder && Number.isInteger(Number(epoch)), 'machine-db: checkpoint needs the leader {name, holder, epoch}');
  const row = m.db.prepare('SELECT holder, epoch, expires_at FROM engine_leader WHERE name=?').get(name);
  if (!row || row.holder !== holder || Number(row.epoch) !== Number(epoch)) return { skipped: `not the ${name} leader at epoch ${epoch}` };
  if (Number(row.expires_at) <= m.now()) return { skipped: `the ${name} lease of epoch ${epoch} expired` };
  return m.db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
}
/** machine_meta as an object. */
const meta = (m) => Object.fromEntries(m.db.prepare('SELECT key, value FROM machine_meta').all().map((r) => [r.key, r.value]));

// ---------------------------------------------------------------------------------------------------------------------
// Outbox: a typed write the store refused waits here until the next flush (the land gate flushes it).
// Why a file: when machine.sqlite itself refuses the write (a persistent SQLITE_CORRUPT, a lock held past busy_timeout)
// the store cannot hold the record, so the only durable place left is beside it. It is append-only JSONL (one line per
// write, appendFileSync = one write call), owned by this module, holds only DEFERRABLE (idempotent) writes, and is empty
// in the normal case; flushOutbox renames it before applying, so appends during a flush start a fresh file.
// ---------------------------------------------------------------------------------------------------------------------
const outboxFileFor = (machineFile) => `${path.resolve(machineFile)}.outbox.jsonl`;
/** The writes that may wait in the outbox: each is idempotent (recordLandOutcome on spanId, log on src). */
const DEFERRABLE = Object.freeze({ recordLandOutcome, log });
// The outbox 'log' op stamps src:'outbox:<id>' on each row of its first arg; other ops keep args as passed.
const outboxArgs = (op, args, id) => { if (op !== 'log') return args;
  return args.map((a, i) => { if (i !== 0) return a; return (Array.isArray(a) ? a : [a]).map((r) => ({ ...r, src: r.src ?? `outbox:${id}` })); }); };
/** Append one deferred write; returns its id. */
function deferWrite({ op, args = [], file = null, env = process.env, error = null }) {
  need(Object.hasOwn(DEFERRABLE, op), `machine-db: ${op} is not a deferrable write (${Object.keys(DEFERRABLE).join(', ')})`);
  const id = `ob-${Date.now().toString(36)}-${hex(4)}`;
  const list = outboxArgs(op, args, id);
  const target = outboxFileFor(file ?? machineFileFor(env));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, `${JSON.stringify({ id, at: Date.now(), pid: process.pid, op, args: list, error: error ? errText(error) : null })}\n`);
  process.stderr.write(`[machine-db] deferred ${op} ${id} to ${target}` + (error ? `: ${errText(error)}` : '') + '\n');
  return id;
}
/** withMachine(API[op](m, ...args)); when the store refuses it, the write goes to the outbox. {ok, value} | {ok:false, deferred, error}. */
export function writeOrDefer(op, args = [], { env = process.env, file = null } = {}) {
  need(Object.hasOwn(DEFERRABLE, op), `machine-db: ${op} is not a deferrable write`);
  try { return { ok: true, value: withMachine((m) => DEFERRABLE[op](m, ...args), { env, file }) }; }
  catch (error) { return { ok: false, deferred: deferWrite({ op, args, file, env, error }), error: errText(error) }; }
}
// Flush one claimed outbox file: each line through its typed writer, failed lines appended back to `base`.
const flushOutboxFile = (m, f, base) => { const back = []; let flushed = 0, failed = 0;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean)) {
    let item = null; try { item = JSON.parse(line); } catch { back.push(line); failed += 1; continue; }
    try { need(Object.hasOwn(DEFERRABLE, item.op), `unknown op ${item.op}`); m.transaction(() => DEFERRABLE[item.op](m, ...(item.args ?? []))); flushed += 1; }
    catch (error) { back.push(JSON.stringify({ ...item, error: errText(error), tries: (item.tries ?? 1) + 1 })); failed += 1; } }
  if (back.length) { fs.appendFileSync(base, `${back.join('\n')}\n`); }
  fs.rmSync(f, { force: true });
  return { flushed, failed }; };
// The outbox files this flusher owns: the live file renamed aside, plus dead flushers' leftovers.
const claimOutboxFiles = (m) => { const base = outboxFileFor(m.file), dir = path.dirname(base), stem = path.basename(base); const claimed = [];
  try { const to = `${base}.${process.pid}.${Date.now()}.flushing`; fs.renameSync(base, to); claimed.push(to); }
  catch (error) { if (error.code !== 'ENOENT') return { claimed, busy: errText(error), base }; }
  let names = []; try { names = fs.readdirSync(dir); } catch { /* none */ }
  for (const n of names) { const hit = n.startsWith(`${stem}.`) && /^(\d+)\.\d+\.flushing$/.exec(n.slice(stem.length + 1)); const full = path.join(dir, n);
    if (hit && !claimed.includes(full) && Number(hit[1]) !== process.pid && !pidAlive(Number(hit[1]))) claimed.push(full); }
  return { claimed, busy: null, base }; };
/**
 * Apply every outbox line through its typed writer (each in its own transaction). A line that fails again goes back to
 * the outbox; a claimed file of a dead flusher is taken over. {flushed, failed, pending}.
 */
function flushOutbox(m) {
  need(!m.readOnly, 'machine-db: flushOutbox needs a writer');
  const { claimed, busy, base } = claimOutboxFiles(m);
  if (busy) return { flushed: 0, failed: 0, pending: base, busy };
  let flushed = 0, failed = 0;
  for (const f of claimed) { const r = flushOutboxFile(m, f, base); flushed += r.flushed; failed += r.failed; }
  if (flushed) log(m, { actor: 'harness', kind: 'machine-db.outbox-flushed', level: failed ? 'warn' : 'info', msg: `outbox: ${flushed} deferred write(s) applied` + (failed ? `, ${failed} still pending` : ''), data: { flushed, failed } });
  return { flushed, failed, pending: failed ? base : null };
}

// camelCase → snake_case keys for the pass-through writers (seat, terminal, worktree ...).
function snake(obj) {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]));
}

const API = {
  insert: (m, table, row, opts) => insertRow(m.db, table, row, opts), upsert: (m, table, row, keys) => upsertRow(m.db, table, row, keys), update: (m, table, set, where) => updateRow(m.db, table, set, where),
  putMachineBlob, jsonOrBlob, meta, checkpoint,
  registerLedger, resolveLedger, listLedgers, touchLedger, setLedgerState, upsertRepository, forEachLedger, attachLedgers,
  supEvent, supEvents, newestSupEvent, upsertSupJob, setSupJobStatus, supJob, listSupJobs, acquireSupLeases, releaseSupLeases, supLeases,
  startSupAttempt, updateSupAttempt, latestSupAttempt, recordSupReport, supReports, consumeSupReport,
  openSupDecision, setSupDecision, markSupDecisionDelivered, listSupDecisions, openOwed, ackOwed, closeOwed, listOwed,
  upsertLearning, listLearning, recordOwnerRuling, upsertBridge, recordSupMessage, supMessages, markSupMessagesRead,
  setSupSignal, supSignal, clearSupSignal, recordMachineLlmUsage,
  startProcessRun, heartbeatProcessRun, endProcessRun, openProcessRuns, processRuns,
  leaderOf, acquireLeader, renewLeader, releaseLeader, leaderHistory, cursorOf, setCursor, cursors,
  enqueue, dueQueue, queueRows, dequeue, requeue, ensureSchedule, claimSchedule, finishSchedule, schedules,
  actionIntent, actionRunning, actionFinish, markStaleActionsUnknown, actionOf, actions, actionStep,
  controllerModes, setControllerMode, modeChanges, openSlaEpisode, markSlaViolated, markSlaReported, clearSla, openSla, recordViolation, clearViolation,
  setService, recordProbe, services, serviceEvents, upsertSeat, seatOf, seats, recordDelivery, recordSeatInput, startSeatTurn, endSeatTurn, seatTranscriptSnapshot,
  upsertTerminal, closeTerminal, acquireHostLock, renewHostLock, releaseHostLock, hostLock, hostLocks,
  claimResource, releaseClaim, sweptClaim, liveClaims, upsertAgentSession,
  throttleState, setThrottle, throttleEvents, recordThrottleDecision, releaseThrottleDecision, recordHostSample, hostSamples,
  setProviderHealth, providerHealth, poolBackoff, setPoolBackoff, clearPoolBackoff, setQuota, quotas,
  reserveProvider, providerReservations, providerReservationUsage, markProviderReservation, releaseProviderReservation,
  upsertGuardJob, guardJob, releaseGuardJob, recordGuardRefusal, releaseHostLeases, release: releaseHostLeases, hostLeases, setBudget, reserveBudget, settleBudget, budgets,
  startGcRun, finishGcRun, recordGcItem, addGcItem: recordGcItem, updateGcItem, gcItems, gcMark, addGcMarks: gcMark, gcRuns, markMachineBlobArchived, pruneSeatSnapshots,
  upsertLane, setLaneState, laneOf, lanes, enqueueLand, claimLandGate, finishLandTicket, landQueue, recordLandRun, recordLandOutcome, landRuns, recordPush, pushes, flushOutbox,
  upsertWorktree, removedWorktree, reserveWorktree, liveWorktrees, worktreeRow, worktreeRepos, dropWorktree, worktreeGcStop, setWorktreeGcStop, gcCursor, setGcCursor, upsertEnvServer, envServer, envServers, upsertUatSlot, uatSlots, releaseUatSlot, upsertConnector, connectorOf, upsertAsk,
  log, logs, pruneLogs, recordMetrics, latestMetrics, recordNotification, notificationSent, markNotificationSent, recordArchive, projectCatalog,
};

/** Every typed function at module level too: fn(handle, ...args) — blob-gc and callers holding a handle. */
export { putMachineBlob, meta, checkpoint, registerLedger, resolveLedger, listLedgers, setLedgerState, upsertRepository, forEachLedger, attachLedgers, supEvent, supEvents, newestSupEvent, upsertSupJob, setSupJobStatus, supJob, listSupJobs, acquireSupLeases, releaseSupLeases, supLeases, startSupAttempt, updateSupAttempt, latestSupAttempt, recordSupReport, supReports, consumeSupReport, openSupDecision, setSupDecision, markSupDecisionDelivered, listSupDecisions, ackOwed, upsertLearning, recordSupMessage, supMessages, setSupSignal, supSignal, recordMachineLlmUsage, startProcessRun, heartbeatProcessRun, endProcessRun, openProcessRuns, leaderOf, acquireLeader, renewLeader, releaseLeader, leaderHistory, cursorOf, setCursor, cursors, enqueue, requeue, ensureSchedule, claimSchedule, finishSchedule, schedules, actionIntent, actionRunning, actionFinish, actionOf, actions, controllerModes, setControllerMode, modeChanges, openSlaEpisode, markSlaViolated, markSlaReported, clearSla, openSla, recordViolation, setService, recordProbe, services, serviceEvents, upsertSeat, seatOf, seats, recordDelivery, recordSeatInput, seatTranscriptSnapshot, upsertTerminal, closeTerminal, acquireHostLock, renewHostLock, releaseHostLock, hostLock, claimResource, releaseClaim, throttleState, setThrottle, recordThrottleDecision, releaseThrottleDecision, recordHostSample, hostSamples, setProviderHealth, providerHealth, poolBackoff, setPoolBackoff, clearPoolBackoff, setQuota, quotas, setBudget, budgets, startGcRun, finishGcRun, recordGcItem, gcRuns, upsertLane, laneOf, lanes, enqueueLand, claimLandGate, finishLandTicket, landQueue, recordLandRun, recordLandOutcome, landRuns, recordPush, pushes, flushOutbox, removedWorktree, reserveWorktree, liveWorktrees, worktreeRow, worktreeRepos, dropWorktree, worktreeGcStop, setWorktreeGcStop, gcCursor, setGcCursor, upsertEnvServer, envServer, envServers, upsertUatSlot, uatSlots, releaseUatSlot, connectorOf, upsertAsk, log, logs, recordMetrics };
export { reserveProvider, providerReservations, providerReservationUsage, markProviderReservation, releaseProviderReservation };

/** Best-effort machine log line from anywhere (never throws): opens, appends, closes. */
export function machineLog(row, { env = process.env } = {}) {
  try { return withMachine((m) => m.log(row), { env }); } catch { return 0; }
}

// ---------------------------------------------------------------------------------------------------------------------
// CLI: starci runtime machine-db <init|status|ledgers|register|resolve> [--file <machine.sqlite>] [--json]
// ---------------------------------------------------------------------------------------------------------------------
if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  const cmd = args[0] ?? 'status';
  const file = flag('file');
  const out = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  try {
    if (cmd === 'init' || cmd === 'status') {
      withMachine((m) => out({ ok: true, file: m.file, meta: m.meta(), userVersion: Number(pragma(m.db, 'user_version')), journalMode: pragma(m.db, 'journal_mode'),
        modes: m.controllerModes(), ledgers: m.listLedgers().length, integrity: m.db.prepare('PRAGMA quick_check').get()?.quick_check,
        foreignKeyViolations: m.db.prepare('PRAGMA foreign_key_check').all().length }), { file });
    } else if (cmd === 'ledgers') {
      withMachine((m) => out(m.listLedgers({ includeRetired: args.includes('--all') })), { file });
    } else if (cmd === 'register') {
      withMachine((m) => out(m.registerLedger({ ledgerId: flag('ledger-id'), name: flag('name'), repoRoot: flag('repo'), file: flag('ledger-file'), product: flag('product') })), { file });
    } else if (cmd === 'resolve') {
      withMachine((m) => out(m.resolveLedger({ ledgerId: flag('ledger-id'), name: flag('name'), repoRoot: flag('repo'), create: args.includes('--create') })), { file });
    } else { throw new Error(`unknown command ${cmd}: init | status | ledgers [--all] | register --ledger-id --name --repo | resolve (--repo|--name|--ledger-id) [--create]`); }
  } catch (error) { process.stderr.write(`${error.code ?? 'error'}: ${error.message}\n`); process.exit(2); }
}
