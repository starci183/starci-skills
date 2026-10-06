// lock-recovery.mjs — the compositions around the ONE stale `.git/index.lock` recovery (scripts/api/git/index-lock.mjs
// indexLock): the git-process probe over the host's process table (scripts/api/process/process-list.mjs), the Supervisor
// audit event a removal records, and the command guard's pre-flight (scripts/guards/command-guard.mjs). The housekeeping
// area `gitlocks` (scripts/housekeeping/hk-git-locks.mjs) uses the probe and the recorder too.
import path from 'node:path';
import { checkoutOf, gitDirOf, isGitImage, lockStat } from '../lib/git-dir.mjs';
import { indexLock } from '../api/git/index-lock.mjs';
import { processList } from '../api/process/process-list.mjs';
import { isSpecRun } from '../lib/env.mjs';

export const LOCK_EVENT = 'git-index-lock-removed';

/** Git-family processes on this host: [{pid, name, commandLine}], or null when the probe failed. A spec run (NODE_TEST_CONTEXT) never reads the host process table. */
export function listGitProcesses({ platform = process.platform, run, env = process.env } = {}) {
  if (isSpecRun(env)) return null;
  const rows = processList({ where: "Name LIKE 'git%'", run, platform, timeoutMs: 30000 });
  return rows ? rows.map((p) => ({ pid: p.pid, name: String(p.name ?? ''), commandLine: p.cmd })).filter((p) => isGitImage(p.name)) : null;
}

/** `record` for api/git/index-lock.mjs indexLock: one Supervisor audit event (machine.sqlite sup_events) per removal, naming who removed it. */
export async function supervisorLockRecorder({ env = process.env, by, jobId = null, workflowId = null } = {}) {
  const { withSupervisor, supervisorEvent } = await import('./home.mjs');
  return (result) => withSupervisor((m) => supervisorEvent(m, { entityType: 'repo', entityId: result.repo, kind: LOCK_EVENT,
    payload: { lock: result.lock, ageMs: Math.round(result.ageMs), bytes: result.bytes, mtime: result.mtime, by, jobId, workflowId } }), { env });
}

/**
 * The command guard's git pre-flight (scripts/guards/command-guard.mjs): when the checkout `cwd` is in holds an index
 * lock older than the declared window, try the recovery once and say what happened on stderr. Costs one stat when no
 * lock stands. Never throws: the command runs either way.
 */
export async function preflightIndexLock({ cwd = process.cwd(), guard = null, env = process.env, say = () => {}, now = Date.now(), list = listGitProcesses } = {}) {
  try {
    const repo = checkoutOf(cwd);
    const gitDir = repo ? gitDirOf(repo) : null;
    const st = gitDir ? lockStat(path.join(gitDir, 'index.lock')) : null;
    if (!st) return null;
    const { allocationMs } = await import('../../engine/config.mjs');
    const staleMs = allocationMs('housekeeping.gitIndexLockStaleMs');
    if (now - st.mtimeMs < staleMs) return null;
    const record = await supervisorLockRecorder({ env, by: 'command-guard', jobId: guard?.jobId ?? null, workflowId: guard?.workflowId ?? null });
    const result = indexLock({ repo, staleMs, now, list, record });
    const age = `${Math.round((result.ageMs ?? 0) / 60000)} min`;
    if (result.state === 'removed') say(`starci guard: removed a stale ${result.lock} (${age} old, no git process on this repository); recorded as ${LOCK_EVENT}.`);
    else if (result.state === 'held') say(`starci guard: ${result.lock} is ${age} old but a git process may still hold it (${result.holders.map((h) => h.pid).join(', ')}); left in place - retry shortly, never delete it by hand.`);
    else if (result.state !== 'fresh' && result.state !== 'absent') {
      const error = result.error ? `: ${result.error}` : '';
      say(`starci guard: ${result.lock} is ${age} old and was left in place (${result.state}${error}).`);
    }
    return result;
  } catch (error) {
    say(`starci guard: index-lock check error (${error?.message ?? error}); running git anyway`);
    return null;
  }
}
