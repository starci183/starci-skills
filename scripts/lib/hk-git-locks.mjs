// hk-git-locks.mjs — the housekeeping area `gitlocks`: a stale `.git/index.lock` in a product checkout
// (config.yaml supervisor.repos) is recovered through scripts/lib/git-index-lock.mjs, the one recovery the op
// worker's git shim also runs. Kernel-side git (api commits, settle) does not pass the shim, so this area is
// how the scheduled / low-resource housekeeping run, or the Supervisor by hand
// (`housekeeping.mjs --apply --only gitlocks`), clears a lock nobody's worker is about to touch.
//
//   sweepGitLocks({ apply, now, env, allocation })
//
// allocation.housekeeping.gitIndexLockStaleMs (runtimes.yaml) is the age a lock must pass. A dry run reports
// `would-remove`; --apply removes and records one `git-index-lock-removed` supervisor-ledger event per lock.
import { recoverStaleIndexLock, supervisorLockRecorder, listGitProcesses } from './git-index-lock.mjs';

/** Sweep every product checkout. `repos` and `list` are spec seams. */
export async function sweepGitLocks({ apply = false, now = Date.now(), env = process.env, allocation = null, repos = null, list = listGitProcesses } = {}) {
  const out = { ok: true, freedBytes: 0, deleted: [], skipped: [], errors: [], report: [] };
  const staleMs = Number(allocation?.housekeeping?.gitIndexLockStaleMs ?? allocation?.gitIndexLockStaleMs);
  if (!(staleMs > 0)) { out.ok = false; out.errors.push('modules/models/runtimes.yaml allocation.housekeeping.gitIndexLockStaleMs must declare a positive number of milliseconds'); return out; }
  let targets = repos;
  if (!targets) {
    const { productRepos, supervisorSettings } = await import('../supervisor/home.mjs');
    targets = productRepos(supervisorSettings());
  }
  const record = apply ? await supervisorLockRecorder({ env, by: 'housekeeping' }) : null;
  for (const repo of targets) {
    const r = recoverStaleIndexLock({ repo, staleMs, now, apply, list, record, env });
    if (r.state === 'absent' || r.state === 'fresh') continue;
    out.report.push(r);
    if (r.state === 'removed') { out.deleted.push(r.lock); out.freedBytes += r.bytes ?? 0; } else if (r.state === 'error') out.errors.push(`${r.lock}: ${r.error}`);
    else out.skipped.push({ path: r.lock, reason: r.state });
  }
  out.ok = !out.errors.length;
  return out;
}
