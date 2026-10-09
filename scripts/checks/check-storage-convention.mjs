#!/usr/bin/env node
// check-storage-convention.mjs — RT_STORAGE_UNDECLARED (part of `npm run check`).
//   runs in the check stage (self-check storage-convention); --json prints the findings as JSON
//
// The convention (modules/schemas/storage-convention.yaml; owner ruling 2026-10-09): content lives as a file in the blob store under the runtime state dir and a database row
// holds the reference plus the small scalars it is queried by. Every text column of both stores is declared there with its class (scalar, bounded, reference, spill or
// migrate). This check creates a fresh product ledger and a fresh machine store, reads their schemas, and refuses a column that is not declared, a declared column that no longer
// exists, an unknown class, and a `migrate` column that the migrations list does not name (or the reverse). A new table or column therefore cannot appear without a class.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openMachine } from '../../engine/db/machine.mjs';

export const CODE = 'RT_STORAGE_UNDECLARED';
export const REGISTRY_FILE = 'modules/schemas/storage-convention.yaml';
const TEXTUAL = /TEXT|BLOB|JSON|CLOB|CHAR|^$/i;

/** The text columns of one open store: {table: [column]}; the full-text shadow tables and virtual tables are the engine's, not rows. */
export function textColumnsOf(db) {
  const out = {};
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%' ORDER BY name").all();
  for (const table of tables) {
    if (/VIRTUAL TABLE/i.test(table.sql ?? '')) continue;
    const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all().filter((column) => TEXTUAL.test(column.type || '')).map((column) => column.name);
    if (columns.length) out[table.name] = columns;
  }
  return out;
}

/** The message about one actual column against its declaration, or null when it is declared consistently. */
function columnProblem(key, cls, { classes, migrate }) {
  if (cls === undefined) return key + ' is a text column with no class in ' + REGISTRY_FILE + ': declare it scalar, bounded, reference, spill or migrate (content is a blob, the row holds the reference)';
  if (!(cls in classes)) return key + ' has the unknown class ' + cls;
  if ((cls === 'migrate') !== migrate.has(key)) return key + ' is ' + (cls === 'migrate' ? 'class migrate but not' : 'in the migrations list but not class migrate');
  return null;
}

/** [store, table, column] of every column of {store: {table: [column]}}. */
const cellsOf = (stores) => Object.entries(stores).flatMap(([store, tables]) => Object.entries(tables).flatMap(([table, columns]) => columns.map((column) => [store, table, column])));

/** The findings of a registry (declared: {store: {table: {column: class}}}, classes, migrations) against the actual columns of each store. Pure. */
export function storageFindings({ declared, classes, migrations = [] }, actual) {
  const migrate = new Set(migrations.map((entry) => entry.column));
  const problems = cellsOf(actual).map(([store, table, column]) => columnProblem(store + '.' + table + '.' + column, declared?.[store]?.[table]?.[column], { classes, migrate }));
  const declaredCells = Object.entries(declared ?? {}).flatMap(([store, tables]) => Object.entries(tables).flatMap(([table, columns]) => Object.keys(columns).map((column) => [store, table, column])));
  const stale = declaredCells.filter(([store, table, column]) => !actual[store]?.[table]?.includes(column))
    .map(([store, table, column]) => store + '.' + table + '.' + column + ' is declared but is no text column of the store any more');
  return [...problems, ...stale].filter(Boolean).map((message) => ({ code: CODE, path: REGISTRY_FILE, message }));
}

/** Run the check on the runtime at `root`: fresh stores in a temp directory, read-only introspection. */
export function checkStorageConvention(root = skillRoot) {
  const registry = parseYaml(fs.readFileSync(path.join(root, REGISTRY_FILE), 'utf8'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-storage-convention-'));
  let ledger = null;
  let machine = null;
  try {
    ledger = openLedger({ file: path.join(dir, 'runtime.sqlite') });
    machine = openMachine({ file: path.join(dir, 'machine.sqlite') });
    return storageFindings({ declared: registry.columns, classes: registry.classes, migrations: registry.migrations },
      { ledger: textColumnsOf(ledger.db), machine: textColumnsOf(machine.db ?? machine.raw ?? machine) });
  } finally {
    for (const handle of [ledger, machine]) { try { handle?.close(); } catch { /* closed */ } }
    safeRemove(dir, { hold: artifactHoldReason });
  }
}

if (isMain(import.meta.url)) process.exit(printFindings(checkStorageConvention(), 'OK: every text column of both stores is declared in the storage convention.'));
