// artifact-hold.mjs — the retention exemption for job proofs. A path an indexed job artifact lives at
// (job_artifacts, engine/db/migrations/runtime/0001-init.sql), a tree holding one, and the evidence directory around one (never a shared root:
// the repository, .starciwork, .starciwork/evidence or .starciwork/kernel-evidence itself) are never
// removed by housekeeping, whatever the workflow's phase (running, finished, archived); nor is the repository's
// ledger .starciwork/runtime.sqlite (it holds the typed logs since 2026-09-27, scripts/kernel/typed-logs.mjs), nor the
// retired logs file .starciwork/logs.sqlite or its logs.sqlite.migrated-<date> copy, nor a tree holding one. Every
// runtime delete of a tree (safe-remove.mjs safeRemoveTree) and every housekeeping unlink asks artifactHoldOf first.
// Proofs, artifacts and logs are deleted ONLY by the owner-approved workflow purge (scripts/work/purge-workflow.mjs:
// archive to a verified ZIP, then delete the finished workflow as a unit), never here.
//
// The ledgers are the ones the machine registry enrols (machine.sqlite `ledgers`); a ledger's repository is
// the directory above its .starciwork. Only a target that overlaps a registered repository opens that
// ledger, read-only, so a temp or lane sweep never touches sqlite past the registry read.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { hasLedgerColumn, hasLedgerTable, openLedgerReader } from '../../engine/db/ledger.mjs';
import { machineFileFor, readMachine } from '../../engine/db/machine.mjs';
import { pathKey, sameOrUnder } from '../lib/path-key.mjs';

const require = createRequire(import.meta.url);
const REGISTRY_TTL_MS = 30000;
const norm = pathKey;
let cache = { file: null, at: 0, repos: [] };

const openReadOnly = (file) => openLedgerReader(file);

/** The repositories whose ledgers the registry enrols: [{repo, ledger}], cached briefly per registry file; null when the registry cannot be read. */
export function registeredRepos({ env = process.env, now = Date.now() } = {}) {
  const file = machineFileFor(env);
  if (cache.file === file && now - cache.at < REGISTRY_TTL_MS) return cache.repos;
  const repos = fs.existsSync(file) ? readMachine((m) => m.listLedgers().map((l) => ({ ledger: l.file, repo: l.repoRoot })), null, { file, env }) : [];
  cache = { file, at: now, repos };
  return repos;
}

/**
 * Null when removing `target` touches no indexed artifact; else {ledger, repo, paths:[...up to 5], count}.
 * Held: an indexed file at or sameOrUnder `target`, or `target` inside the directory of an indexed file.
 * A ledger that cannot be read holds its whole repository, and an unreadable registry holds every path in or
 * holding a .starciwork directory - where every indexed artifact lives (fail closed).
 */
export function artifactHoldOf(target, { env = process.env, repos = registeredRepos({ env }) } = {}) {
  const t = norm(target);
  if (repos === null) {
    const work = t.split('/').includes('.starciwork') || fs.existsSync(path.join(target, '.starciwork'));
    return work ? { ledger: machineFileFor(env), repo: null, paths: [], count: null, error: 'the machine registry cannot be read' } : null;
  }
  for (const { ledger, repo } of repos) {
    const r = norm(repo);
    if (!sameOrUnder(t, r) && !sameOrUnder(r, t)) continue;
    // The repository's typed logs (scripts/kernel/typed-logs.mjs: the ledger's logs table, and the retired logs.sqlite
    // with its migrated copy) are append-only history: never swept.
    const work = path.join(repo, '.starciwork');
    const logFiles = [path.basename(ledger), 'logs.sqlite', ...(fs.existsSync(work) && sameOrUnder(norm(work), t) ? fs.readdirSync(work).filter((n) => /^logs\.sqlite\.migrated-/.test(n)) : [])]
      .filter((name, i, all) => all.indexOf(name) === i).map((name) => path.join(work, name)).filter((file) => sameOrUnder(norm(file), t) && fs.existsSync(file));
    if (logFiles.length) return { ledger, repo, paths: logFiles.map((file) => `.starciwork/${path.basename(file)}`), count: logFiles.length };
    if (!fs.existsSync(ledger)) continue;
    let paths;
    try {
      const db = openReadOnly(ledger);
      // alpha.3: job_artifacts index blobs by sha256 and hold no repository path (no `path` column), so an alpha.3
      // ledger holds no tree; only a ledger that still indexes paths does.
      try { paths = hasLedgerTable(db, 'job_artifacts') && hasLedgerColumn(db, 'job_artifacts', 'path') ? db.prepare('SELECT DISTINCT path FROM job_artifacts').all().map((row) => row.path) : []; }
      finally { db.close(); }
    } catch (error) {
      return { ledger, repo, paths: [], count: null, error: String(error?.message ?? error) };
    }
    // "Around" holds an evidence directory, never a shared root: an artifact filed at the repository root or directly
    // in .starciwork (e.g. a scope op indexing .starciwork/index.yaml) held every tree sameOrUnder it, so no purge could
    // remove an archived workflow's kernel-evidence directory.
    const shared = new Set([r, norm(work), norm(path.join(work, 'evidence')), norm(path.join(work, 'kernel-evidence'))]);
    const held = paths.filter((rel) => {
      const abs = norm(path.join(repo, rel));
      const dir = norm(path.dirname(abs));
      return sameOrUnder(abs, t) || (!shared.has(dir) && sameOrUnder(t, dir));
    });
    if (held.length) return { ledger, repo, paths: held.slice(0, 5), count: held.length };
  }
  return null;
}

/** artifactHoldOf as one refusal line, or null. */
export const artifactHoldReason = (target, options) => {
  const hold = artifactHoldOf(target, options);
  if (!hold) return null;
  return hold.error ? `the ledger ${hold.ledger} holding indexed job artifacts cannot be read (${hold.error})`
    : `${hold.count} indexed job artifact(s) of ${hold.ledger} (${hold.paths.join(', ')})`;
};
