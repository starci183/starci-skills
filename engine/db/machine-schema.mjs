// Machine schema lifecycle runs only through the machine store's connection owner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifactRoot } from './blob.mjs';
import { sha256 } from '../digest.mjs';
import { hasTable } from '../../scripts/lib/sqlite.mjs';

export function machineSchemaMethods({ schema: MACHINE_SCHEMA, version: MACHINE_VERSION, initSqlFile: INIT_SQL_FILE, controllers: CONTROLLERS, runtimeRev, pragma }) {
  const PROVIDER_SQL_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations', 'machine', '0002-provider-reservations.sql');
  const sqlProviderSchema = () => fs.readFileSync(PROVIDER_SQL_FILE, 'utf8');
  /** An old or foreign store: refuse it; a fresh store is created by openMachine on first use. */
  function refuseOld(file, why) {
    throw Object.assign(Error(`machine-schema-old: ${path.resolve(file)} ${why}; this runtime opens only '${MACHINE_SCHEMA}' (user_version ${MACHINE_VERSION}) — move the refused file aside and openMachine creates a fresh machine.sqlite on first use`),
      { code: 'STARCI_MACHINE_SCHEMA_OLD' });
  }

  function checkSchema(db, file, { readOnly = false } = {}) {
    const version = Number(pragma(db, 'user_version'));
    const hasMeta = hasTable(db, 'machine_meta');
    if (!hasMeta) refuseOld(file, `has no machine_meta (user_version ${version})`);
    const schema = db.prepare("SELECT value FROM machine_meta WHERE key='schema'").get()?.value;
    if (schema !== MACHINE_SCHEMA) refuseOld(file, `is schema '${schema ?? 'none'}'`);
    if (version !== MACHINE_VERSION && !(readOnly && version === 1)) refuseOld(file, `is user_version ${version}`);
  }

  /** The one compatible additive upgrade: preserve every v1 host row, journal and version it atomically. */
  function rollbackSchema(db, error) {
    try { db.exec('ROLLBACK'); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'machine schema failed and rollback failed', { cause: error }); }
    throw error;
  }

  function upgradeProviderSchema(db, { file, now }) {
    if (Number(pragma(db, 'user_version')) !== 1) return;
    checkSchema(db, file, { readOnly: true });
    const sql = sqlProviderSchema();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (Number(pragma(db, 'user_version')) === 1) {
        db.exec(sql);
        db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(2,'0002-provider-reservations',?,?,?,?,'done')")
          .run(runtimeRev(), sha256(sql), now(), now());
        db.exec(`PRAGMA user_version=${MACHINE_VERSION}`);
      }
      db.exec('COMMIT');
    } catch (error) { rollbackSchema(db, error); }
  }

  function createSchema(db, { file, env, now }) {
    const sql = fs.readFileSync(INIT_SQL_FILE, 'utf8');
    const at = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (Number(pragma(db, 'user_version')) === 0 && !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' LIMIT 1").get()) {
        db.exec(sql);
        const meta = db.prepare('INSERT INTO machine_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
        for (const [key, value] of Object.entries({ host_id: os.hostname(), schema: MACHINE_SCHEMA, created_at: String(at), blob_root: artifactRoot(env),
          runtime_rev: runtimeRev(), sqlite_version: db.prepare('select sqlite_version() v').get().v,
          node_version: process.version, journal_mode: 'wal' })) meta.run(key, String(value));
        db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(1,'0001-init',?,?,?,?,'done')")
          .run(runtimeRev(), sha256(sql), at, now());
        // Every controller starts in shadow (COMMON: controllers stay shadow until the owner switches them).
        for (const controller of CONTROLLERS) {
          db.prepare("INSERT INTO mode_changes(controller,from_mode,to_mode,by,reason,at) VALUES(?,NULL,'shadow','machine-db:init','0001-init',?)").run(controller, at);
          db.prepare("INSERT INTO controller_modes(controller,mode,set_at,set_by) VALUES(?,'shadow',?,'machine-db:init')").run(controller, at);
        }
        const providerSql = sqlProviderSchema();
        db.exec(providerSql);
        db.prepare("INSERT INTO schema_migrations(version,name,runtime_rev,sql_sha256,started_at,finished_at,status) VALUES(2,'0002-provider-reservations',?,?,?,?,'done')")
          .run(runtimeRev(), sha256(providerSql), at, now());
        db.exec(`PRAGMA user_version=${MACHINE_VERSION}`);
      }
      db.exec('COMMIT');
    } catch (error) { rollbackSchema(db, error); }
  }

  return { refuseOld, checkSchema, createSchema, upgradeProviderSchema };
}
