// hk-orphan-ledgers.mjs — the housekeeping area `orphanledgers`: two ledger-hygiene findings the retention sweep
// (hk-ledger.mjs, which only prunes debug logs and purges long-ended workflows of ledgers ALREADY known good) and
// the `/start` preflight (scripts/reconciler/start.mjs ledgerFindings, which only catches a ledger FILE under a
// temp-looking path or missing) do not catch in full (docs/ledger-db.md §1):
//
//   orphan ledgers   EVERY directory under <stateRoot>/projects/, not only the registered ones:
//                      - registered (any state) and its directory is gone: 'registered-dir-missing'.
//                      - registered, non-retired: every bound source root (machine.sqlite `repositories` rows for
//                        it, falling back to the ledger's own `repo_root`) is under the OS temp dir, gone, or none
//                        at all: 'source-roots-unreachable' / 'no-source-roots'.
//                      - NOT registered at all (the machine.sqlite row is gone but the directory is not — exactly
//                        unregistered ledger directories): the same two reasons, but the source roots come from
//                        the orphaned runtime.sqlite's own workflows.source_roots_json (engine/db/ledger.mjs
//                        inspectLedger, read-only), the only place left to ask once the registry has forgotten it.
//                    A debug probe or throwaway repo that registered a ledger (or never even got that far) and
//                    never cleaned it up. LEDGER_ORPHAN_STATE_ROOT is the Vietnamese-catalogued finding
//                    (modules/kernel/failure-codes.yaml); --apply MOVES the ledger's whole directory (never
//                    deletes) to <stateRoot>/archive/orphan-ledgers/<YYYYMMDD>/<ledgerId>/ and retires its row
//                    through engine/db/machine.mjs setLedgerState when one exists — the one writer; nothing here
//                    opens machine.sqlite for write itself.
//   legacy stores    a repository bound either in machine.sqlite `repositories` OR in any
//                    .workspaces/projects/*/work.json (one app repository; pathFromSource "."
//                    resolves to the Source host itself, e.g. this runtime's own backend) that still has an
//                    in-repo .starciwork/runtime.sqlite (+ -wal/-shm), the pre-decision-Q1 location.
//                    LEDGER_LEGACY_WORK_SQLITE. Report only, here and in `/start --check` (both call
//                    legacyWorkSqliteFindings so the two never drift): nothing in this codebase deletes a file
//                    inside a product repository; the owner removes it once the ledger is confirmed to live only
//                    in %LOCALAPPDATA%/StarCi (owner ruling: no legacy).
//
//   starci runtime housekeeping --only orphanledgers [--apply] --json
//   starci runtime ledger-hygiene [--apply] [--json]                  the standalone report (both findings)
import fs from 'node:fs';
import path from 'node:path';
import { inspectLedger, projectsRootFor } from '../../engine/db/ledger.mjs';
import { isUnderTempDir, machineFileFor, readMachine, starciLocalRoot, withMachine } from '../../engine/db/machine.mjs';
import { starciSourceRoot } from '../../engine/runtime-root.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { pathKey } from '../lib/path-key.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';

export const ORPHAN_LEDGER_CODE = 'LEDGER_ORPHAN_STATE_ROOT';
export const LEGACY_WORK_SQLITE_CODE = 'LEDGER_LEGACY_WORK_SQLITE';
/** A registered (any state) ledger whose directory is gone entirely — registry drift, distinct from an unreachable source root. */
export const REGISTERED_DIR_MISSING_REASON = 'registered-dir-missing';

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
/** Case-insensitive, separator-normalized directory identity, for comparing a disk path against a DB-recorded one. */
const dirKey = (p) => pathKey(p, { fold: true });
/**
 * A repo root in the forward-slash form machine.sqlite `repositories.repo_root` already stores (engine/db/machine.mjs
 * repoKey), so a root discovered on disk (native, backslash on Windows) and one read back from the registry dedupe
 * as the same string instead of surviving as two `Set` entries that only differ by separator.
 */
const canonicalRoot = (p) => path.resolve(String(p)).replace(/\\/g, '/');
/** YYYYMMDD, the same stamp scripts/housekeeping/blob-gc.mjs and scripts/work/purge-workflow.mjs archive folders use. */
export const dateStamp = (now = Date.now()) => new Date(now).toISOString().slice(0, 10).replace(/-/g, '');


/**
 * Every repository root any .workspaces/projects/*\/work.json binds (modules/schemas/workspace-routing.yaml
 * bindingShape), the one app `repository.pathFromSource` resolved against starciSourceRoot — "."
 * resolves to the Source host itself. A missing or unreadable .workspaces/projects, or one malformed work.json, is
 * skipped, never a crash. Deduped, absolute.
 */
export function workspaceBoundRepoRoots({ env = process.env } = {}) {
  const sourceRoot = starciSourceRoot(env);
  const projectsDir = path.join(sourceRoot, '.workspaces', 'projects');
  let entries = [];
  try { entries = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch { return []; }
  const roots = new Set();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path.join(projectsDir, entry.name, 'work.json'), 'utf8')); } catch { continue; }
    const rel = doc?.schema === 'starci/workspace-binding@2' ? doc?.repository?.pathFromSource : null;
    if (typeof rel === 'string' && rel.trim()) roots.add(canonicalRoot(path.resolve(sourceRoot, rel)));
  }
  return [...roots];
}

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
 * The source roots an ORPHANED ledger directory's own runtime.sqlite still names — the only place left to ask once
 * machine.sqlite no longer has a `ledgers` row for it at all (the registry forgot it, but the directory and its
 * workflows did not). Reads every workflow's source_roots_json (engine/db/ledger.mjs inspectLedger, read-only) and
 * unions them, deduped. A missing file, an unreadable/foreign-schema ledger, or workflows with no source roots at
 * all yields []; never throws.
 */
export function sourceRootsFromLedgerFile(file) {
  if (!exists(file)) return [];
  let handle;
  try { handle = inspectLedger({ file }); } catch { return []; }
  try {
    const roots = new Set();
    for (const row of handle.db.prepare('SELECT source_roots_json FROM workflows').all()) {
      if (!row.source_roots_json) continue;
      let parsed;
      try { parsed = JSON.parse(row.source_roots_json); } catch { continue; }
      if (Array.isArray(parsed)) for (const root of parsed) if (typeof root === 'string' && root.trim()) roots.add(root);
    }
    return [...roots];
  } catch { return []; }
  finally { try { handle.close(); } catch { /* closed */ } }
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
 * Orphan findings over EVERY directory under <stateRoot>/projects/, registered or not (follow-up fix 2026-09-30: a
 * ledger the registry no longer names at all — 6 of the incident's directories — was invisible to a registry-only
 * scan). [{code, ledgerId, name, file, sourceRoots, reason, registered}]:
 *   registered:true,  reason 'registered-dir-missing'      the ledger's directory is gone entirely (registry drift)
 *   registered:true,  reason 'no-source-roots' | 'source-roots-unreachable'   sourceRootsOf (registry-based)
 *   registered:false, reason 'no-source-roots' | 'source-roots-unreachable'   sourceRootsFromLedgerFile (the
 *                     orphaned directory's own runtime.sqlite — nothing else still names it)
 * A directory registered under ANY state (including retired) is never treated as unregistered.
 */
export function orphanLedgerFindings({ env = process.env, machineFile = null } = {}) {
  const file = machineFile ?? machineFileFor(env);
  // Everything that needs the open handle (listing ledgers, and each one's `repositories` rows) happens inside this
  // one readMachine call; `registered` itself is plain data and outlives the (closed) handle for the directory walk below.
  const { findings: registeredFindings, registered } = readMachine((m) => {
    const list = m.listLedgers({ includeRetired: true });
    const findings = [];
    for (const ledger of list) {
      if (ledger.state === 'retired') continue;
      const dir = path.dirname(ledger.file);
      if (!exists(dir)) { findings.push({ code: ORPHAN_LEDGER_CODE, ledgerId: ledger.ledgerId, name: ledger.name, file: ledger.file, sourceRoots: [], reason: REGISTERED_DIR_MISSING_REASON, registered: true }); continue; }
      const roots = sourceRootsOf(m.db, ledger);
      const reason = orphanReason(roots, { env });
      if (reason) findings.push({ code: ORPHAN_LEDGER_CODE, ledgerId: ledger.ledgerId, name: ledger.name, file: ledger.file, sourceRoots: roots, reason, registered: true });
    }
    return { findings, registered: list };
  }, { findings: [], registered: [] }, { file, env });

  const knownDirs = new Set(registered.map((l) => dirKey(path.dirname(l.file))));
  const out = [...registeredFindings];
  const projectsDir = projectsRootFor(env);
  let dirNames = [];
  try { dirNames = fs.readdirSync(projectsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* no projects/ yet */ }
  for (const name of dirNames) {
    const dir = path.join(projectsDir, name);
    if (knownDirs.has(dirKey(dir))) continue; // registered under some state already handled (or intentionally retired) above
    const ledgerFile = path.join(dir, 'runtime.sqlite');
    const roots = sourceRootsFromLedgerFile(ledgerFile);
    const reason = orphanReason(roots, { env });
    if (reason) out.push({ code: ORPHAN_LEDGER_CODE, ledgerId: name, name: null, file: ledgerFile, sourceRoots: roots, reason, registered: false });
  }
  return out;
}

/** Every distinct bound repository root the registry knows (machine.sqlite `repositories`). */
export function boundRepoRoots({ env = process.env, machineFile = null } = {}) {
  const registered = readMachine((m) => m.db.prepare('SELECT repo_root FROM repositories').all().map((r) => r.repo_root),
    [], { file: machineFile ?? machineFileFor(env), env });
  return [...new Set([...registered, ...workspaceBoundRepoRoots({ env })].filter(Boolean).map(canonicalRoot))];
}

/**
 * Legacy in-repo store findings, PURE over a plain list of repo roots (no DB access of its own) so `/start --check`
 * (scripts/reconciler/start.mjs, which already has its own ledger list open) and this sweep's own
 * boundRepoRoots()-backed call share exactly one detection: [{code, repoRoot, files}]. `files` lists whichever of
 * runtime.sqlite / -wal / -shm exist; a root that does not exist on this host is silently skipped (fs.existsSync).
 */
export function legacyWorkSqliteFindings(repoRoots) {
  const out = [];
  for (const repoRoot of [...new Set((repoRoots ?? []).filter(Boolean).map(canonicalRoot))]) {
    const base = path.join(repoRoot, '.starciwork', 'runtime.sqlite');
    const files = ['', '-wal', '-shm'].map((suffix) => `${base}${suffix}`).filter(exists);
    if (files.length) out.push({ code: LEGACY_WORK_SQLITE_CODE, repoRoot, files });
  }
  return out;
}

/**
 * Moves one orphan ledger's whole directory (never deletes) to <stateRoot>/archive/orphan-ledgers/<date>/<id>/,
 * then retires its row (engine/db/machine.mjs setLedgerState — the one writer). Returns {moved:true, from, to}.
 */
export function archiveOrphanLedger(finding, { env = process.env, now = Date.now() } = {}) {
  const from = path.dirname(finding.file);
  if (!exists(from)) throw Error(`orphan ledger directory missing: ${from}`);
  const to = path.join(starciLocalRoot(env), 'archive', 'orphan-ledgers', dateStamp(now), finding.ledgerId);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try { fs.renameSync(from, to); } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    // A cross-device move copies first; the source goes only after the copy is verified to hold the same top-level
    // entries (moves, never deletes), and removal goes through safeRemove — the one runtime tree delete, which
    // unlinks links and never descends into one.
    fs.cpSync(from, to, { recursive: true });
    const wanted = fs.readdirSync(from).sort();
    const copied = fs.readdirSync(to).sort();
    if (wanted.length !== copied.length || wanted.some((name, i) => name !== copied[i]))
      throw Error(`orphan ledger archive copy did not verify: ${to} holds [${copied.join(', ')}], expected [${wanted.join(', ')}]`);
    const removed = safeRemove(from, { hold: artifactHoldReason });
    if (!removed.ok) throw Error(`orphan ledger source was not fully removed after a verified copy (${from}): ${removed.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
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
