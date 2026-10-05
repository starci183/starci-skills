#!/usr/bin/env node
// The Host controller's read-only health probe and verified project-ledger snapshots.
//
// Internal entry: spawned by scripts/reconciler/controllers/host.mjs; not invoked directly.
// Args: --check --file <ledger> [--json]
//       --backup --ledger-id <id> --file <ledger> [--dir <d>] [--keep <n>] [--json].
// --backup writes a file, so the Host controller reaches it only through ctx.run (recorded, not run, in shadow).
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { isCorruptError } from '../../engine/db/machine-connection.mjs';
import { sha256File } from '../../engine/digest.mjs';

const openReadOnly = (file) => openLedgerReader(file, { verify: false });
const openBackupSource = (file) => openLedgerReader(file, { queryOnly: false });

/**
 * Check pages, runtime compatibility and an optional registry identity without creating a missing file.
 */
export function quickCheck(file, { open = openReadOnly, verifiedOpen = (f) => openLedgerReader(f), exists = fs.existsSync, expectedLedgerId = null } = {}) {
  if (!exists(file)) return { ok: false, absent: true, reason: 'absent', result: ['absent'] };
  let db = null;
  try {
    db = open(file);
    const rows = db.prepare('PRAGMA quick_check').all().map((r) => String(Object.values(r)[0]));
    if (!(rows.length === 1 && rows[0] === 'ok')) return { ok: false, reason: 'integrity-failed', result: rows.slice(0, 20) };
    let verified = null;
    try {
      verified = verifiedOpen(file);
      if (expectedLedgerId !== null) {
        const actual = verified.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value ?? null;
        if (actual !== expectedLedgerId) return { ok: false, reason: 'identity-mismatch', result: [`ledger identity ${actual ?? 'missing'} differs from ${expectedLedgerId}`] };
      }
    } finally { try { verified?.close(); } catch { /* closed */ } }
    return { ok: true, result: rows.slice(0, 20) };
  } catch (error) {
    const reason = error?.code === 'STARCI_LEDGER_SCHEMA_REFUSED' ? 'schema-incompatible'
      : error?.code === 'STARCI_LEDGER_SQLITE_DOWNGRADE' ? 'sqlite-downgrade'
        : isCorruptError(error) ? 'integrity-failed' : 'inaccessible';
    return { ok: false, reason, code: error?.code ?? null, result: [String(error?.message ?? error).slice(0, 300)], error: true };
  } finally { try { db?.close(); } catch { /* closed */ } }
}

const pad = (n) => String(n).padStart(2, '0');
/** yyyymmdd of a local date. */
const dayStamp = (at) => { const d = new Date(at); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
const backupFileOf = ({ dir, ledgerId, at }) => path.join(dir, `${ledgerId}-${dayStamp(at)}.sqlite`);
const safeId = (id) => String(id).replace(/[^\w.-]+/g, '_');

/** The nightly backup is due: local hour >= backupHour and today's file is absent. */
export function backupDue({ ledgerId, now, dir, backupHour, exists = fs.existsSync, check = quickCheck }) {
  if (new Date(now).getHours() < backupHour) return false;
  const file = backupFileOf({ dir, ledgerId: safeId(ledgerId), at: now });
  return !exists(file) || !check(file, { expectedLedgerId: ledgerId }).ok;
}

/** The backups of one ledger beyond the newest `keep`, oldest first to delete. Pure over a file list. */
function prunePlan(files, { ledgerId, keep }) {
  const re = new RegExp(`^${safeId(ledgerId).replace(/[.]/g, '\\.')}-(\\d{8})\\.sqlite$`);
  const mine = files.filter((f) => re.test(f)).sort();
  return mine.slice(0, Math.max(0, mine.length - keep));
}

/** Publish an integrity-, schema- and identity-checked snapshot before retention removes an older snapshot. */
export function backupLedger({ ledgerId, file, dir, keep, now = Date.now(), open = openBackupSource, check = quickCheck, publish = fs.renameSync, remove = fs.rmSync }) {
  const target = backupFileOf({ dir, ledgerId: safeId(ledgerId), at: now });
  const temp = `${target}.${randomUUID()}.partial`;
  let db = null;
  let stage = 'prepare', published = false;
  try {
    if (!Number.isInteger(keep) || keep < 1) throw Error('backup keep must be a positive integer');
    fs.mkdirSync(dir, { recursive: true });
    stage = 'source';
    db = open(file);
    const actual = db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value ?? null;
    if (actual !== ledgerId) throw Error(`ledger identity ${actual ?? 'missing'} differs from ${ledgerId}`);
    stage = 'snapshot';
    db.prepare('VACUUM INTO ?').run(temp);
    db.close(); db = null;
    stage = 'verify';
    const verification = check(temp, { expectedLedgerId: ledgerId });
    if (!verification.ok) throw Error(`snapshot ${verification.reason ?? 'verification-failed'}: ${verification.result?.join('; ') ?? 'failed'}`);
    const digest = sha256File(temp), bytes = fs.statSync(temp).size;
    const descriptor = fs.openSync(temp, 'r+');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    stage = 'publish';
    publish(temp, target); published = true;
    if (sha256File(target) !== digest) throw Error('published snapshot digest differs from the verified bytes');
    const pruned = [], retentionErrors = [];
    let expired = [];
    try { expired = prunePlan(fs.readdirSync(dir), { ledgerId, keep }); }
    catch (error) { retentionErrors.push({ file: dir, error: String(error?.message ?? error).slice(0, 300) }); }
    for (const name of expired) {
      try { remove(path.join(dir, name), { force: true }); pruned.push(name); }
      catch (error) { retentionErrors.push({ file: name, error: String(error?.message ?? error).slice(0, 300) }); }
    }
    return { ok: true, verified: true, file: target, ledgerId, sha256: digest, bytes, pruned, ...(retentionErrors.length ? { retentionErrors } : {}) };
  } catch (error) {
    try { fs.rmSync(temp, { force: true }); } catch { /* owned partial remains for inspection */ }
    return { ok: false, verified: false, file: target, stage, published, pruned: [], error: String(error?.message ?? error).slice(0, 300) };
  } finally { try { db?.close(); } catch { /* closed */ } }
}

const argsOf = (argv) => {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i].replace(/^--/, ''), next = argv[i + 1];
    if (next != null && !next.startsWith('--')) { a[k] = next; i += 1; } else a[k] = true;
  }
  return a;
};

if (isMain(import.meta.url)) {
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
