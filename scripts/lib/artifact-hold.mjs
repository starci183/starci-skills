// artifact-hold.mjs — the retention exemption for job proofs. A path an indexed job artifact lives at
// (job_artifacts, engine/schema.sql), a tree holding one, and the evidence directory around one are never
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
import { hasLedgerTable, machineFileFor, openLedgerReader } from '../../engine/ledger-db.mjs';

const require = createRequire(import.meta.url);
const REGISTRY_TTL_MS = 30000;
const norm = (p) => { const v = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, ''); return process.platform === 'win32' ? v.toLowerCase() : v; };
const under = (child, parent) => child === parent || child.startsWith(`${parent}/`);
let cache = { file: null, at: 0, repos: [] };

const openReadOnly = (file) => openLedgerReader(file);

/** The repositories whose ledgers the registry enrols: [{repo, ledger}], cached briefly per registry file; null when the registry cannot be read. */
export function registeredRepos({ env = process.env, now = Date.now() } = {}) {
  const file = machineFileFor(env);
  if (cache.file === file && now - cache.at < REGISTRY_TTL_MS) return cache.repos;
  let repos = [];
  if (fs.existsSync(file)) {
    try {
      const db = openReadOnly(file);
      try { repos = db.prepare('SELECT file FROM ledgers').all().map((row) => ({ ledger: row.file, repo: path.dirname(path.dirname(row.file)) })); }
      finally { db.close(); }
    } catch { repos = null; }
  }
  cache = { file, at: now, repos };
  return repos;
}

/**
 * Null when removing `target` touches no indexed artifact; else {ledger, repo, paths:[...up to 5], count}.
 * Held: an indexed file at or under `target`, or `target` inside the directory of an indexed file.
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
    if (!under(t, r) && !under(r, t)) continue;
    // The repository's typed logs (scripts/kernel/typed-logs.mjs: the ledger's logs table, and the retired logs.sqlite
    // with its migrated copy) are append-only history: never swept.
    const work = path.join(repo, '.starciwork');
    const logFiles = [path.basename(ledger), 'logs.sqlite', ...(fs.existsSync(work) && under(norm(work), t) ? fs.readdirSync(work).filter((n) => /^logs\.sqlite\.migrated-/.test(n)) : [])]
      .filter((name, i, all) => all.indexOf(name) === i).map((name) => path.join(work, name)).filter((file) => under(norm(file), t) && fs.existsSync(file));
    if (logFiles.length) return { ledger, repo, paths: logFiles.map((file) => `.starciwork/${path.basename(file)}`), count: logFiles.length };
    if (!fs.existsSync(ledger)) continue;
    let paths;
    try {
      const db = openReadOnly(ledger);
      try { paths = hasLedgerTable(db, 'job_artifacts') ? db.prepare('SELECT DISTINCT path FROM job_artifacts').all().map((row) => row.path) : []; }
      finally { db.close(); }
    } catch (error) {
      return { ledger, repo, paths: [], count: null, error: String(error?.message ?? error) };
    }
    const held = paths.filter((rel) => {
      const abs = norm(path.join(repo, rel));
      return under(abs, t) || under(t, norm(path.dirname(abs)));
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
