// hk-orphan-ledgers.mjs — the housekeeping area `orphanledgers`: two ledger-hygiene findings the retention sweep
// (hk-ledger.mjs, which only prunes debug logs and purges long-ended workflows of ledgers ALREADY known good) and
// the `/start` preflight (scripts/reconciler/start.mjs ledgerFindings, which only catches a ledger FILE under a
// temp-looking path or missing) do not catch in full (COOK-BRIEF F4 handover, incident 2026-09-30):
//
//   orphan ledgers   a registered, non-retired ledger whose every bound source root (machine.sqlite `repositories`
//                    rows for it, falling back to the ledger's own `repo_root`) is under the OS temp directory, no
//                    longer exists on disk, or there is none at all — a debug probe or throwaway repo that
//                    registered a ledger and never cleaned it up. Six such ledgers (worker ids fake-terminal-1,
//                    fake-kernel-terminal; workflows stuck 'running') were found in the live
//                    %LOCALAPPDATA%/StarCi on 2026-09-30, left by probes under the OS temp dir that predate
//                    STARCI_LOCAL_ROOT (engine/machine-db.mjs; skills/claude-debug/SKILL.md section 5 now requires
//                    every such probe to set it). LEDGER_ORPHAN_STATE_ROOT is the Vietnamese-catalogued finding
//                    (modules/kernel/failure-codes.yaml); --apply MOVES the ledger's whole directory (never
//                    deletes) to <stateRoot>/archive/orphan-ledgers/<YYYYMMDD>/<ledgerId>/ and retires the row
//                    through engine/machine-db.mjs setLedgerState — the one writer; nothing here opens
//                    machine.sqlite for write itself.
//   legacy stores    a bound repository (machine.sqlite `repositories`) that still has an in-repo
//                    .starciwork/runtime.sqlite (+ -wal/-shm), the pre-decision-Q1 location. LEDGER_LEGACY_WORK_SQLITE.
//                    Report only, here and in `/start --check` (both call legacyWorkSqliteFindings so the two never
//                    drift): nothing in this codebase deletes a file inside a product repository; the owner removes
//                    it once the ledger is confirmed to live only in %LOCALAPPDATA%/StarCi (owner ruling: no legacy).
//
//   node scripts/supervisor/housekeeping.mjs --only orphanledgers [--apply] --json
//   node scripts/checks/ledger-hygiene.mjs [--apply] [--json]                  the standalone report (both findings)
import fs from 'node:fs';
import path from 'node:path';
import { isUnderTempDir, machineFileFor, readMachine, starciLocalRoot, withMachine } from '../../engine/machine-db.mjs';

export const ORPHAN_LEDGER_CODE = 'LEDGER_ORPHAN_STATE_ROOT';
export const LEGACY_WORK_SQLITE_CODE = 'LEDGER_LEGACY_WORK_SQLITE';

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
/** YYYYMMDD, the same stamp scripts/supervisor/blob-gc.mjs and scripts/work/purge-workflow.mjs archive folders use. */
export const dateStamp = (now = Date.now()) => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');

/** The total bytes under `dir` (files only; missing/unreadable entries count as 0). Pure I/O, no seam needed in specs (tmp fixtures). */
function dirBytes(dir) {
  let total = 0;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirBytes(full);
    else { try { total += fs.statSync(full).size; } catch { /* vanished */ } }
  }
  return total;
}

/** Every source root a ledger is bound to: machine.sqlite `repositories` rows for it, falling back to its own `repo_root`. Deduped, non-empty. */
export function sourceRootsOf(db, ledger) {
  const rows = db.prepare('SELECT repo_root FROM repositories WHERE ledger_id=?').all(ledger.ledgerId).map((r) => r.repo_root);
  return [...new Set([...rows, ledger.repoRoot].filter(Boolean))];
}

/**
 * null | 'no-source-roots' | 'source-roots-unreachable' for a list of source roots. Pure given `unreachable`
 * (a spec seam; production default is the real isUnderTempDir/fs.existsSync check against `env`).
 */
export function orphanReason(roots, { env = process.env, unreachable = (root) => isUnderTempDir(root, { env }) || !exists(root) } = {}) {
  if (!roots || roots.length === 0) return 'no-source-roots';
  return roots.every((root) => unreachable(root)) ? 'source-roots-unreachable' : null;
}

/**
 * Orphan findings over every non-retired ledger of the registry `env`/`machineFile` resolves:
 * [{code, ledgerId, name, file, sourceRoots, reason}]. reason is 'no-source-roots' (nothing bound at all) or
 * 'source-roots-unreachable' (every bound root is under the OS temp dir or no longer exists).
 */
export function orphanLedgerFindings({ env = process.env, machineFile = null } = {}) {
  return readMachine((m) => {
    const out = [];
    for (const ledger of m.listLedgers()) {
      if (ledger.state === 'retired') continue;
      const roots = sourceRootsOf(m.db, ledger);
      const reason = orphanReason(roots, { env });
      if (reason) out.push({ code: ORPHAN_LEDGER_CODE, ledgerId: ledger.ledgerId, name: ledger.name, file: ledger.file, sourceRoots: roots, reason });
    }
    return out;
  }, [], { file: machineFile ?? machineFileFor(env), env });
}

/** Every distinct bound repository root the registry knows (machine.sqlite `repositories`). */
export function boundRepoRoots({ env = process.env, machineFile = null } = {}) {
  return readMachine((m) => [...new Set(m.db.prepare('SELECT repo_root FROM repositories').all().map((r) => r.repo_root).filter(Boolean))],
    [], { file: machineFile ?? machineFileFor(env), env });
}

/**
 * Legacy in-repo store findings, PURE over a plain list of repo roots (no DB access of its own) so `/start --check`
 * (scripts/reconciler/start.mjs, which already has its own ledger list open) and this sweep's own
 * boundRepoRoots()-backed call share exactly one detection: [{code, repoRoot, files}]. `files` lists whichever of
 * runtime.sqlite / -wal / -shm exist; a root that does not exist on this host is silently skipped (fs.existsSync).
 */
export function legacyWorkSqliteFindings(repoRoots) {
  const out = [];
  for (const repoRoot of [...new Set((repoRoots ?? []).filter(Boolean))]) {
    const base = path.join(repoRoot, '.starciwork', 'runtime.sqlite');
    const files = ['', '-wal', '-shm'].map((suffix) => `${base}${suffix}`).filter(exists);
    if (files.length) out.push({ code: LEGACY_WORK_SQLITE_CODE, repoRoot, files });
  }
  return out;
}

/**
 * Moves one orphan ledger's whole directory (never deletes) to <stateRoot>/archive/orphan-ledgers/<date>/<id>/,
 * then retires its row (engine/machine-db.mjs setLedgerState — the one writer). Returns {moved:true, from, to}.
 */
export function archiveOrphanLedger(finding, { env = process.env, now = Date.now() } = {}) {
  const from = path.dirname(finding.file);
  if (!exists(from)) throw Error(`orphan ledger directory missing: ${from}`);
  const to = path.join(starciLocalRoot(env), 'archive', 'orphan-ledgers', dateStamp(now), finding.ledgerId);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try { fs.renameSync(from, to); } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    fs.cpSync(from, to, { recursive: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
  withMachine((m) => m.setLedgerState(finding.ledgerId, 'retired', { reason: `orphan ledger archived (${finding.reason})` }), { env });
  return { moved: true, from, to };
}

/** The housekeeping sweep contract: sweep({apply, now, env, allocation}) -> {ok, movedBytes, moved, skipped, errors, report}. */
export async function sweepOrphanLedgers({ apply = false, now = Date.now(), env = process.env } = {}) {
  const out = { ok: true, movedBytes: 0, moved: [], skipped: [], errors: [], report: [] };
  const findings = orphanLedgerFindings({ env });
  for (const finding of findings) {
    if (!apply) { out.report.push(finding); continue; }
    const before = dirBytes(path.dirname(finding.file));
    try {
      const r = archiveOrphanLedger(finding, { env, now });
      out.moved.push({ ...finding, ...r });
      out.movedBytes += before;
    } catch (error) { out.errors.push({ ledgerId: finding.ledgerId, error: String(error?.message ?? error) }); }
  }
  out.ok = out.errors.length === 0;
  return out;
}
