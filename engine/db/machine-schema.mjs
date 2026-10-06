// Machine schema lifecycle runs only through the machine store's connection owner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { artifactRoot } from './blob.mjs';
import { sha256 } from '../digest.mjs';
import { hasTable } from '../../scripts/lib/sqlite.mjs';

const require = createRequire(import.meta.url);
// SQLite ALTER RENAME quotes identifiers. Preserve literals/constraints while ignoring that spelling and formatting.
function sqlIdentity(sql) {
  const tokens = String(sql).match(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|[a-z_][a-z_0-9]*|\d+(?:\.\d+)?|[^\s]/gi) ?? [];
  const normalized = tokens.filter(token => !token.startsWith('--') && !token.startsWith('/*')).map(token => {
    if (token.startsWith("'")) return token;
    if (token.startsWith('"')) return token.slice(1, -1).replaceAll('""', '"').toLowerCase();
    if (token.startsWith('`')) return token.slice(1, -1).replaceAll('``', '`').toLowerCase();
    if (token.startsWith('[')) return token.slice(1, -1).toLowerCase();
    return token.toLowerCase();
  });
  for (const at of [2, 3]) if (normalized.slice(at, at + 3).join(' ') === 'if not exists') normalized.splice(at, 3);
  return JSON.stringify(normalized);
}
const objects = db => db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name").all();

/** Create or validate the host schema and atomically migrate recognized v2 writers; readers never migrate or rewrite history. */
export function machineSchemaMethods({ schema: MACHINE_SCHEMA, version: MACHINE_VERSION, initSqlFile: INIT_SQL_FILE, controllers: CONTROLLERS, runtimeRev, pragma }) {
  let requiredObjects;
  function expectedObjects() {
    if (requiredObjects) return requiredObjects;
    const { DatabaseSync } = require('node:sqlite'), reference = new DatabaseSync(':memory:');
    try {
      reference.exec(fs.readFileSync(INIT_SQL_FILE, 'utf8'));
      requiredObjects = objects(reference).map(row => ({ ...row, identity: sqlIdentity(row.sql) }));
      return requiredObjects;
    } finally { reference.close(); }
  }
  /** Refuse unsupported identity or a missing/changed current object without replacing the caller's store. */
  function refuseOld(file, why) {
    throw Object.assign(Error(`machine-schema-old: ${path.resolve(file)} ${why}; expected '${MACHINE_SCHEMA}' (user_version ${MACHINE_VERSION}) with its current physical schema; the refused store remains unchanged`),
      { code: 'STARCI_MACHINE_SCHEMA_OLD' });
  }
  function checkIdentity(db, file, expectedVersion = MACHINE_VERSION) {
    const version = Number(pragma(db, 'user_version'));
    if (!hasTable(db, 'machine_meta')) refuseOld(file, 'has no machine_meta (user_version '+version+')');
    const schema = db.prepare("SELECT value FROM machine_meta WHERE key='schema'").get()?.value;
    if (schema !== MACHINE_SCHEMA) refuseOld(file, "is schema '"+(schema ?? 'none')+"'");
    if (version !== expectedVersion) refuseOld(file, 'is user_version '+version);
  }
  function checkObjects(db, file, expected, exact = false) {
    const rows = objects(db), actual = new Map(rows.map(row => [row.type+':'+row.name, sqlIdentity(row.sql)]));
    for (const row of expected) if (actual.get(row.type+':'+row.name) !== row.identity)
      refuseOld(file, 'has a missing or changed '+row.type+" '"+row.name+"'");
    if (exact) {
      const names = new Set(expected.map(row => row.type+':'+row.name));
      for (const row of rows) if (!names.has(row.type+':'+row.name))
        refuseOld(file, 'has an unexpected '+row.type+" '"+row.name+"'");
    }
  }
  function checkSchema(db, file) {
    checkIdentity(db, file);
    checkObjects(db, file, expectedObjects());
  }
  function rollbackSchema(db, error) {
    try { db.exec('ROLLBACK'); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'machine schema failed and rollback failed', { cause: error }); }
    throw error;
  }
  /**
   * Widen only a recognized v2 signal CHECK on a writable connection. The immediate transaction rechecks competing
   * upgrades, preserves signal bytes and all other host rows, and records the executed migration only after validation.
   */
  function upgradeSchema(db, { file, now }) {
    if (MACHINE_VERSION !== 3 || Number(pragma(db, 'user_version')) !== 2) return;
    const current = expectedObjects(), signal = current.find(row => row.type === 'table' && row.name === 'sup_signals');
    const addedScopes = /,\s*'core-debug-enabled'\s*,\s*'core-debug-diagnostics'/g;
    if (!signal || signal.sql.match(addedScopes)?.length !== 1) refuseOld(file, 'has no recognized canonical v2 signal transition');
    // Exact object validation excludes unknown dependencies; canonical references also prevent an unsafe future rebuild.
    const dependent = current.find(row => row !== signal && JSON.parse(row.identity).includes('sup_signals'));
    if (dependent) refuseOld(file, 'has a canonical dependency on sup_signals: '+dependent.name);
    const historical = current.map(row => row === signal ? { ...row, identity: sqlIdentity(row.sql.replace(addedScopes, '')) } : row);
    const staging = signal.sql.replace(/^(CREATE TABLE(?: IF NOT EXISTS)? )sup_signals(?=\s*\()/i, '$1sup_signals_v3');
    if (staging === signal.sql) refuseOld(file, 'has an unrecognized canonical signal declaration');
    const columns = 'scope,key,holder_pid,token,value_json,at,expires_at';
    const copySql = staging+';\nINSERT INTO sup_signals_v3('+columns+') SELECT '+columns+' FROM sup_signals;';
    const finishSql = 'DROP TABLE sup_signals;\nALTER TABLE sup_signals_v3 RENAME TO sup_signals;';
    const sql = copySql+'\n'+finishSql, at = now(), rev = runtimeRev();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (Number(pragma(db, 'user_version')) === MACHINE_VERSION) {
        // A writer that wins while BEGIN waits owns the one migration record.
        checkSchema(db, file); db.exec('COMMIT'); return;
      }
      checkIdentity(db, file, 2);
      checkObjects(db, file, historical, true);
      const count = db.prepare('SELECT count(*) n FROM sup_signals').get().n;
      // Create-copy-drop-rename avoids rewriting references by renaming the existing table first.
      db.exec(copySql);
      const changed = db.prepare('SELECT 1 FROM (SELECT '+columns+' FROM sup_signals EXCEPT SELECT '+columns+
        ' FROM sup_signals_v3) UNION ALL SELECT 1 FROM (SELECT '+columns+' FROM sup_signals_v3 EXCEPT SELECT '+columns+
        ' FROM sup_signals) LIMIT 1').get();
      if (changed || db.prepare('SELECT count(*) n FROM sup_signals_v3').get().n !== count)
        refuseOld(file, 'did not preserve the v2 signal rows');
      db.exec(finishSql);
      checkObjects(db, file, current, true);
      if (db.prepare('SELECT count(*) n FROM sup_signals').get().n !== count) refuseOld(file, 'changed the migrated signal count');
      db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(?,'0003-core-debug-signals',?,?,?,?,'done')")
        .run(MACHINE_VERSION, rev, sha256(sql), at, now());
      db.exec('PRAGMA user_version='+MACHINE_VERSION);
      checkSchema(db, file);
      db.exec('COMMIT');
    } catch (error) { rollbackSchema(db, error); }
  }
  function createSchema(db, { file, env, now }) {
    const sql = fs.readFileSync(INIT_SQL_FILE, 'utf8'), at = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (Number(pragma(db, 'user_version')) !== 0 || db.prepare("SELECT 1 FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' LIMIT 1").get()) {
        // Another initializer may have committed while this connection waited for BEGIN; keep its current rows/journal.
        checkSchema(db, file); db.exec('COMMIT'); return;
      }
      db.exec(sql);
      const meta = db.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      for (const [key, value] of Object.entries({ host_id: os.hostname(), schema: MACHINE_SCHEMA, created_at: String(at), blob_root: artifactRoot(env),
        runtime_rev: runtimeRev(), sqlite_version: db.prepare('select sqlite_version() v').get().v,
        node_version: process.version, journal_mode: 'wal' })) meta.run(key, String(value));
      db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(?,'0001-init',?,?,?,?,'done')")
        .run(MACHINE_VERSION, runtimeRev(), sha256(sql), at, now());
      // Every controller starts in shadow until the owner switches it.
      for (const controller of CONTROLLERS) {
        db.prepare("INSERT INTO mode_changes(controller,from_mode,to_mode,by,reason,at) VALUES(?,NULL,'shadow','machine-db:init','0001-init',?)").run(controller, at);
        db.prepare("INSERT INTO controller_modes(controller,mode,set_at,set_by) VALUES(?,'shadow',?,'machine-db:init')").run(controller, at);
      }
      db.exec(`PRAGMA user_version=${MACHINE_VERSION}`);
      checkSchema(db, file);
      db.exec('COMMIT');
    } catch (error) { rollbackSchema(db, error); }
  }
  return { checkSchema, createSchema, upgradeSchema };
}
