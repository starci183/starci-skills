#!/usr/bin/env node
// ledger-health.mjs — the Host controller's ledger checks (DESIGN 12.2 "ledger corrupt", 13; LANES.md Lane D item 6).
//
//   quickCheck(file)        PRAGMA quick_check on a read-only handle: {ok, result: ['ok'] | [problems...]}; an absent
//                           file is {ok: false, absent: true} (not created yet: not corrupt, and never created here)
//   backupFileOf(...)       <backupDir>/<ledgerId>-<yyyymmdd>.sqlite (local date)
//   backupDue(...)          the nightly backup of one ledger is due: past backupHour today and no file for today
//   backupLedger(...)       VACUUM INTO that file from a read-only handle, then keep the newest `keep` of that ledger
//
// A failed quick_check is the LEDGER_CORRUPT clock plus a DI for the Supervisor (controllers/host.mjs). Restore is
// manual and owner-approved (copy a backup over the ledger with every writer stopped); nothing here restores.
//
//   node scripts/reconciler/ledger-health.mjs --check --file <ledger> [--json]
//   node scripts/reconciler/ledger-health.mjs --backup --ledger-id <id> --file <ledger> [--dir <d>] [--keep <n>] [--json]
// --backup writes a file, so the Host controller reaches it only through ctx.run (recorded, not run, in shadow).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedgerReader } from '../../engine/db/ledger.mjs';

// A read-only handle through the ledger module (check-db-openers); unverified so a damaged file still gets its
// quick_check, and not query_only so VACUUM INTO can write the backup file.
const openReadOnly = (file) => openLedgerReader(file, { verify: false, queryOnly: false });

/**
 * PRAGMA quick_check on a read-only handle, then a verified open: {ok, result}. An unopenable file is not ok, and a
 * file whose pages are intact but that this runtime refuses (STARCI_LEDGER_SCHEMA_REFUSED) is not ok either: the Host
 * controller reports both as LEDGER_CORRUPT. An absent file is {ok: false, absent: true}: a ledger not created yet,
 * which the Host controller does not report (nothing to restore).
 */
export function quickCheck(file, { open = openReadOnly, verifiedOpen = (f) => openLedgerReader(f), exists = fs.existsSync } = {}) {
  if (!exists(file)) return { ok: false, absent: true, result: ['absent'] };
  let db = null;
  try {
    db = open(file);
    const rows = db.prepare('PRAGMA quick_check').all().map((r) => String(Object.values(r)[0]));
    if (!(rows.length === 1 && rows[0] === 'ok')) return { ok: false, result: rows.slice(0, 20) };
    let verified = null;
    try { verified = verifiedOpen(file); } finally { try { verified?.close(); } catch { /* closed */ } }
    return { ok: true, result: rows.slice(0, 20) };
  } catch (error) {
    return { ok: false, result: [String(error?.message ?? error).slice(0, 300)], error: true };
  } finally { try { db?.close(); } catch { /* closed */ } }
}

const pad = (n) => String(n).padStart(2, '0');
/** yyyymmdd of a local date. */
export const dayStamp = (at) => { const d = new Date(at); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
export const backupFileOf = ({ dir, ledgerId, at }) => path.join(dir, `${ledgerId}-${dayStamp(at)}.sqlite`);
const safeId = (id) => String(id).replace(/[^\w.-]+/g, '_');

/** The nightly backup is due: local hour >= backupHour and today's file is absent. */
export function backupDue({ ledgerId, now, dir, backupHour, exists = fs.existsSync }) {
  if (new Date(now).getHours() < backupHour) return false;
  return !exists(backupFileOf({ dir, ledgerId: safeId(ledgerId), at: now }));
}

/** The backups of one ledger beyond the newest `keep`, oldest first to delete. Pure over a file list. */
export function prunePlan(files, { ledgerId, keep }) {
  const re = new RegExp(`^${safeId(ledgerId).replace(/[.]/g, '\\.')}-(\\d{8})\\.sqlite$`);
  const mine = files.filter((f) => re.test(f)).sort();
  return mine.slice(0, Math.max(0, mine.length - keep));
}

/** VACUUM INTO today's file (a temp name renamed into place), then prune to `keep`. {ok, file, bytes, pruned}. */
export function backupLedger({ ledgerId, file, dir, keep, now = Date.now(), open = openReadOnly }) {
  fs.mkdirSync(dir, { recursive: true });
  const target = backupFileOf({ dir, ledgerId: safeId(ledgerId), at: now });
  const temp = `${target}.partial`;
  try { fs.rmSync(temp, { force: true }); } catch { /* none */ }
  let db = null;
  try {
    db = open(file);
    db.prepare('VACUUM INTO ?').run(temp);
  } catch (error) {
    try { fs.rmSync(temp, { force: true }); } catch { /* none */ }
    return { ok: false, file: target, error: String(error?.message ?? error).slice(0, 300) };
  } finally { try { db?.close(); } catch { /* closed */ } }
  fs.renameSync(temp, target);
  const pruned = prunePlan(fs.readdirSync(dir), { ledgerId, keep });
  for (const f of pruned) fs.rmSync(path.join(dir, f), { force: true });
  return { ok: true, file: target, bytes: fs.statSync(target).size, pruned };
}

const argsOf = (argv) => {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i].replace(/^--/, ''), next = argv[i + 1];
    if (next != null && !next.startsWith('--')) { a[k] = next; i += 1; } else a[k] = true;
  }
  return a;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = argsOf(process.argv.slice(2));
  let r;
  if (a.check && a.file) r = quickCheck(a.file);
  else if (a.backup && a.file && a['ledger-id']) {
    const { hostSettings } = await import('./services.mjs');
    const lh = hostSettings().ledgerHealth;
    r = backupLedger({ ledgerId: a['ledger-id'], file: a.file, dir: a.dir ?? lh.backupDir, keep: Number(a.keep ?? lh.keep) });
  } else { console.error('usage: ledger-health.mjs --check --file <f> | --backup --ledger-id <id> --file <f> [--dir <d>] [--keep <n>]'); process.exit(2); }
  console.log(JSON.stringify(r));
  if (!r.ok) process.exitCode = 1;
}
