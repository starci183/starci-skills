// artifact-hold.mjs — the retention exemption for the typed-log ledger. A registered ledger's runtime.sqlite
// (it holds the typed logs, scripts/kernel/typed-logs.mjs) and a tree holding it are never removed by housekeeping, whatever the
// workflow's phase (running, finished, archived). Every runtime delete of a tree passes artifactHoldReason as
// scripts/api/fs/safe-remove.mjs safeRemove's `hold` (a call without one is refused), and every housekeeping unlink asks
// artifactHoldOf first.
// Proofs, artifacts and logs are deleted ONLY by the owner-approved workflow purge (scripts/work/purge-workflow.mjs:
// archive to a verified ZIP, then delete the finished workflow as a unit), never here.
//
// The ledgers are the ones the machine registry enrols (machine.sqlite `ledgers`).
import fs from 'node:fs';
import path from 'node:path';
import { localProjectsRoot, machineFileFor, readMachine } from '../../engine/db/machine.mjs';
import { pathKey, sameOrUnder } from '../lib/path-key.mjs';

const REGISTRY_TTL_MS = 30000;
const norm = pathKey;
let cache = { file: null, at: 0, repos: [] };

/** The repositories whose ledgers the registry enrols: [{repo, ledger}], cached briefly per registry file; null when the registry cannot be read. */
function registeredRepos({ env = process.env, now = Date.now() } = {}) {
  const file = machineFileFor(env);
  if (cache.file === file && now - cache.at < REGISTRY_TTL_MS) return cache.repos;
  const repos = fs.existsSync(file) ? readMachine((m) => m.listLedgers().map((l) => ({ ledger: l.file, repo: l.repoRoot })), null, { file, env }) : [];
  cache = { file, at: now, repos };
  return repos;
}

/**
 * Null when removing `target` touches no held file; else {ledger, repo, paths, count}.
 * Held: a registered ledger file at or under `target`. An unreadable registry holds every path in or
 * holding the projects root of the host-state directory (fail closed).
 */
export function artifactHoldOf(target, { env = process.env, repos = registeredRepos({ env }) } = {}) {
  const t = norm(target);
  if (repos === null) {
    const projects = norm(localProjectsRoot(env));
    return sameOrUnder(t, projects) || sameOrUnder(projects, t) ? { ledger: machineFileFor(env), repo: null, paths: [], count: null, error: 'the machine registry cannot be read' } : null;
  }
  for (const { ledger, repo } of repos) {
    // The typed logs (scripts/kernel/typed-logs.mjs: the ledger's logs table) are append-only history: never swept.
    if (ledger && sameOrUnder(norm(ledger), t) && fs.existsSync(ledger)) return { ledger, repo, paths: [path.basename(ledger)], count: 1 };
  }
  return null;
}

/** artifactHoldOf as one refusal line, or null. */
export const artifactHoldReason = (target, options) => {
  const hold = artifactHoldOf(target, options);
  if (!hold) return null;
  return hold.error ? `${hold.error} (${hold.ledger})`
    : `${hold.count} ledger file(s) of ${hold.ledger} (${hold.paths.join(', ')})`;
};
