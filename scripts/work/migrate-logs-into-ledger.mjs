#!/usr/bin/env node
// migrate-logs-into-ledger.mjs — move a product repo's typed logs from the retired <repo>/.starciwork/logs.sqlite into
// the ledger's `logs` table (<repo>/.starciwork/runtime.sqlite; owner ruling 2026-09-27: one complete RDBMS per product
// repo), then retire the old file as logs.sqlite.migrated-<date> (renamed, never deleted).
//
//   node scripts/work/migrate-logs-into-ledger.mjs --repo <repo> [--apply --backup-dir <dir>] [--batch 500] [--date YYYYMMDD] [--json]
//
// Dry run by default: counts what would be copied per workflow, the rows of a workflow the ledger does not hold
// (orphans, never copied), the cursors, and writes nothing. --apply needs --backup-dir: both files are first copied
// there as consistent snapshots (VACUUM INTO, safe while kernels and ops keep writing) and their row counts checked.
// Then the rows are copied in short BEGIN IMMEDIATE batches (--batch, default 500) so live writers are never held
// for long:
//   - idempotent by src: a row whose src is already stored (re-derived since, or copied by an earlier run) is skipped;
//     a row stored without a src gets `legacy:<seq>` so a second run skips it too;
//   - a row keeps its seq when that seq is still free (openLedger seeds the new table's AUTOINCREMENT past the old
//     file's newest seq, so it normally is), else it takes a new one;
//   - the sync cursors (events:<ledger>, jl:<job>) move forward only (max).
// Verify: every workflow's old rows are all present in the ledger (by src, same workflow). Only then, with no
// orphans, is the old file checkpointed and renamed. While it is still there, typed-log sync waits
// (typed-logs.mjs legacyLogsPending). Idempotent: a second --apply copies nothing, and a repo whose file is already
// retired reports `nothing to migrate`.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { LEGACY_LOGS_FILE, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';

const require = createRequire(import.meta.url);
const USAGE = 'use: node scripts/work/migrate-logs-into-ledger.mjs --repo <repo> [--apply --backup-dir <dir>] [--batch 500] [--date YYYYMMDD] [--json]';
const COLUMNS = ['at', 'workflow_id', 'job_id', 'actor', 'node_id', 'level', 'kind', 'msg', 'data_json', 'refs_json'];
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const ledgerKeyOf = (db) => String(db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value ?? 'l').slice(0, 12);

/** The effective src of an old row: its own, else legacy:<seq> (stable across runs). */
export const legacySrcOf = (row) => row.src ?? `legacy:${row.seq}`;
export const legacyFileOf = (repo) => path.join(path.resolve(repo), '.starciwork', LEGACY_LOGS_FILE);
export const retiredFileOf = (repo, date = today()) => `${legacyFileOf(repo)}.migrated-${date}`;

function openLegacy(file, { readOnly = true } = {}) {
  const { DatabaseSync } = require('node:sqlite');
  return new DatabaseSync(file, { readOnly, timeout: 15000 });
}

/** A consistent snapshot of `file` into `dest` (VACUUM INTO: a read transaction, safe beside live writers); its row count of `table`. */
function snapshot(file, dest, table) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) throw Object.assign(new Error(`backup ${dest} already exists`), { code: 'backup-exists' });
  const db = openLegacy(file);
  let source;
  try { source = Number(db.prepare(`SELECT count(*) n FROM ${table}`).get().n); db.prepare('VACUUM INTO ?').run(dest); } finally { db.close(); }
  const copy = openLegacy(dest);
  try {
    const n = Number(copy.prepare(`SELECT count(*) n FROM ${table}`).get().n);
    const integrity = copy.prepare('PRAGMA quick_check').get()?.quick_check;
    return { file, backup: dest, table, rows: n, sourceRowsAtStart: source, integrity, bytes: fs.statSync(dest).size };
  } finally { copy.close(); }
}

/** Per-workflow old counts and how many of them the ledger holds (by src, same workflow). */
function verify(legacy, ledgerDb) {
  const bySrc = ledgerDb.prepare('SELECT workflow_id FROM logs WHERE src=?');
  const per = new Map();
  for (const row of legacy.prepare('SELECT seq, workflow_id, src FROM logs ORDER BY seq').iterate()) {
    const w = per.get(row.workflow_id) ?? { workflowId: row.workflow_id, legacy: 0, inLedger: 0, ledgerTotal: 0 };
    w.legacy += 1;
    if (bySrc.get(legacySrcOf(row))?.workflow_id === row.workflow_id) w.inLedger += 1;
    per.set(row.workflow_id, w);
  }
  const total = ledgerDb.prepare('SELECT count(*) n FROM logs WHERE workflow_id=?');
  for (const w of per.values()) w.ledgerTotal = Number(total.get(w.workflowId).n);
  const workflows = [...per.values()].sort((a, b) => a.workflowId.localeCompare(b.workflowId));
  return { workflows, ok: workflows.every((w) => w.inLedger === w.legacy), legacyRows: workflows.reduce((n, w) => n + w.legacy, 0), matched: workflows.reduce((n, w) => n + w.inLedger, 0) };
}

export function migrateLogs({ repo, apply = false, backupDir = null, batch = 500, date = today() }) {
  const root = path.resolve(repo);
  const legacyFile = legacyFileOf(root), ledgerFile = ledgerFileFor(root);
  const out = { ok: true, repo: root, dryRun: !apply, legacy: legacyFile, ledger: ledgerFile };
  if (!fs.existsSync(legacyFile)) {
    const retired = fs.existsSync(path.dirname(legacyFile)) ? fs.readdirSync(path.dirname(legacyFile)).filter((n) => n.startsWith(`${LEGACY_LOGS_FILE}.migrated-`)) : [];
    return { ...out, nothing: true, retired, message: 'nothing to migrate: no logs.sqlite beside the ledger' };
  }
  if (!fs.existsSync(ledgerFile)) throw Object.assign(new Error(`no ledger at ${ledgerFile}`), { code: 'ledger-missing' });
  if (apply && !backupDir) throw Object.assign(new Error('--apply needs --backup-dir <dir>: both files are snapshotted there first'), { code: 'backup-required' });

  // The ledger's own migration creates the logs table (seeded past the old file's newest seq) when it is missing.
  const ledger = openLedger({ file: ledgerFile });
  const legacy = openLegacy(legacyFile);
  try {
    const db = ledger.db;
    const key = ledgerKeyOf(db);
    const workflows = new Set(db.prepare('SELECT workflow_id FROM workflows').all().map((r) => r.workflow_id));
    const perWorkflow = legacy.prepare('SELECT workflow_id, count(*) n FROM logs GROUP BY workflow_id ORDER BY workflow_id').all().map((r) => ({ workflowId: r.workflow_id, rows: Number(r.n) }));
    const orphans = perWorkflow.filter((w) => !workflows.has(w.workflowId));
    const cursors = legacy.prepare('SELECT name, value FROM log_cursors ORDER BY name').all().map((r) => ({ name: r.name, value: Number(r.value) }));
    const legacyRows = perWorkflow.reduce((n, w) => n + w.rows, 0);
    const maxSeq = Number(legacy.prepare('SELECT COALESCE(MAX(seq),0) n FROM logs').get().n);
    Object.assign(out, { ledgerKey: key, legacyRows, legacyMaxSeq: maxSeq, workflows: perWorkflow.length, orphans, cursors, ledgerRowsBefore: Number(db.prepare('SELECT count(*) n FROM logs').get().n) });

    const hasSrc = db.prepare('SELECT 1 FROM logs WHERE src=?');
    if (!apply) {
      let wouldCopy = 0, present = 0;
      for (const row of legacy.prepare('SELECT seq, workflow_id, src FROM logs').iterate()) {
        if (!workflows.has(row.workflow_id)) continue;
        if (hasSrc.get(legacySrcOf(row))) present += 1; else wouldCopy += 1;
      }
      return { ...out, wouldCopy, alreadyPresent: present, verify: verify(legacy, db) };
    }

    out.backups = [snapshot(ledgerFile, path.join(backupDir, `${path.basename(root)}.runtime.sqlite`), 'events'), snapshot(legacyFile, path.join(backupDir, `${path.basename(root)}.logs.sqlite`), 'logs')];
    if (out.backups.some((b) => b.integrity !== 'ok' || b.rows < b.sourceRowsAtStart)) throw Object.assign(new Error('a backup failed its check'), { code: 'backup-bad', backups: out.backups });

    const seqFree = db.prepare('SELECT 1 FROM logs WHERE seq=?');
    const withSeq = db.prepare(`INSERT OR IGNORE INTO logs(seq,${COLUMNS.join(',')},src) VALUES(?,${COLUMNS.map(() => '?').join(',')},?)`);
    const noSeq = db.prepare(`INSERT OR IGNORE INTO logs(${COLUMNS.join(',')},src) VALUES(${COLUMNS.map(() => '?').join(',')},?)`);
    const read = legacy.prepare(`SELECT seq,${COLUMNS.join(',')},src FROM logs WHERE seq>? ORDER BY seq LIMIT ?`);
    const copied = { inserted: 0, keptSeq: 0, newSeq: 0, duplicate: 0, orphan: 0, batches: 0 };
    let after = 0;
    for (;;) {
      const rows = read.all(after, batch);
      if (!rows.length) break;
      ledger.transaction(() => {
        for (const row of rows) {
          if (!workflows.has(row.workflow_id)) { copied.orphan += 1; continue; }
          const src = legacySrcOf(row);
          if (hasSrc.get(src)) { copied.duplicate += 1; continue; }
          const values = COLUMNS.map((c) => row[c]);
          const free = !seqFree.get(row.seq);
          const r = free ? withSeq.run(row.seq, ...values, src) : noSeq.run(...values, src);
          if (r.changes) { copied.inserted += 1; if (free) copied.keptSeq += 1; else copied.newSeq += 1; } else copied.duplicate += 1;
        }
      });
      copied.batches += 1;
      after = rows.at(-1).seq;
    }
    // The cursors move forward only; the AUTOINCREMENT never falls behind a copied seq.
    ledger.transaction(() => {
      const move = db.prepare('INSERT INTO log_cursors(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=max(value,excluded.value)');
      for (const c of cursors) move.run(c.name, c.value);
      db.prepare("UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name='logs'").run(maxSeq);
    });
    out.copied = copied;
    out.verify = verify(legacy, db);
    out.ledgerRowsAfter = Number(db.prepare('SELECT count(*) n FROM logs').get().n);
    if (!out.verify.ok || orphans.length) {
      out.ok = false; out.retired = null;
      out.reason = orphans.length ? `${orphans.length} workflow(s) of logs.sqlite are not in the ledger: kept in place` : 'some rows are not in the ledger: kept in place';
      return out;
    }
    // Only a complete copy is recorded: from here on typed-log sync no longer waits on the old file.
    ledger.transaction(() => db.prepare("INSERT INTO meta(key,value) VALUES('logs_migrated_from',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ file: legacyFile, at: Date.now(), legacyRows, inserted: copied.inserted, duplicate: copied.duplicate })));
  } finally { try { legacy.close(); } catch { /* closed */ } ledger.close(); }

  // Retire: checkpoint the old file's WAL into it, then rename it (never delete). A live writer on OLD code that still
  // holds it open makes the rename fail on Windows: reported, and a re-run retires it.
  // A second retire the same day (a file an old-code process recreated) gets -2, -3, ...: never overwritten.
  let target = retiredFileOf(root, date);
  for (let n = 2; fs.existsSync(target); n++) target = `${retiredFileOf(root, date)}-${n}`;
  try {
    const rw = openLegacy(legacyFile, { readOnly: false });
    try { rw.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { rw.close(); }
    fs.renameSync(legacyFile, target);
    for (const side of ['-wal', '-shm', '-journal']) if (fs.existsSync(`${legacyFile}${side}`)) fs.renameSync(`${legacyFile}${side}`, `${target}${side}`);
    out.retired = target;
  } catch (error) { out.ok = false; out.retired = null; out.reason = `retire failed: ${error?.message ?? error}`; }
  return out;
}

function main() {
  const argv = process.argv.slice(2), args = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const name = k.slice(2); if (['apply', 'json', 'dry-run'].includes(name)) args[name] = true; else args[name] = argv[++i]; }
  if (!args.repo) { console.error(USAGE); process.exit(2); }
  const out = migrateLogs({ repo: args.repo, apply: Boolean(args.apply) && !args['dry-run'], backupDir: args['backup-dir'] ?? null, batch: Math.max(50, Number(args.batch) || 500), date: args.date ?? today() });
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else if (out.nothing) console.log(`${out.repo}: ${out.message}${out.retired?.length ? ` (retired: ${out.retired.join(', ')})` : ''}`);
  else {
    console.log(`${out.repo}: ${out.dryRun ? `dry run - would copy ${out.wouldCopy} of ${out.legacyRows} row(s) (${out.alreadyPresent} already present)` : `copied ${out.copied.inserted} (kept seq ${out.copied.keptSeq}), ${out.copied.duplicate} duplicate(s)`}; ${out.orphans.length} orphan workflow(s); verify ${out.verify.ok ? 'ok' : 'INCOMPLETE'} (${out.verify.matched}/${out.verify.legacyRows})`);
    for (const w of out.verify.workflows) console.log(`  ${w.workflowId}: ${w.inLedger}/${w.legacy} in ledger (ledger total ${w.ledgerTotal})`);
    if (!out.dryRun) console.log(out.retired ? `  retired -> ${out.retired}` : `  NOT retired: ${out.reason}`);
  }
  if (!out.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(1); }
}
