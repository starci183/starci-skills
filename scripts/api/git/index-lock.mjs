// index-lock.mjs — the ONE recovery of a stale `.git/index.lock` in a shared product checkout.
//
// Every workflow of a product repo works in one checkout (one shared checkout per product). A git process that
// dies mid-write (a host terminal wipe, a killed worker) leaves `<gitdir>/index.lock` behind, and from then on
// every `git add` / `git commit` in that checkout refuses "Unable to create .../index.lock: File exists" - for
// every workflow at once. One op once settled blocked on
// a 403 KB lock left over with no git process alive; the worker rightly would not delete a shared lock.
//
// indexLock removes such a lock only when all of these hold:
//   - it is a plain file (never a link), older than allocation.housekeeping.gitIndexLockStaleMs (runtimes.yaml);
//   - the host process table was read (a failed probe removes nothing), and no git process may be working on
//     this repository: a git-family process whose command line names this repo (-C, --git-dir, --work-tree) or
//     names no repository at all (its cwd cannot be read, so it may be this repo's) keeps the lock;
//   - the lock is the same file (mtime and size) after the probe as before it.
// The caller reads the process table (`list`) and records a removal (`record`): scripts/machine/lock-recovery.mjs composes
// both, as a `git-index-lock-removed` Supervisor audit event (machine.sqlite sup_events); every other outcome is returned,
// never thrown. Callers: the command guard before an op worker's git command runs (scripts/guards/command-guard.mjs,
// through lock-recovery.mjs preflightIndexLock) and the housekeeping area `gitlocks` (scripts/housekeeping/hk-git-locks.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { gitDirOf, lockStat, processOnRepo } from '../../lib/git-dir.mjs';

const initialLockState = (repo, staleMs, now) => {
  const gitDir = gitDirOf(repo);
  const lock = gitDir ? path.join(gitDir, 'index.lock') : null;
  const out = { repo: path.resolve(String(repo ?? '')), lock, state: 'absent' };
  const before = lock ? lockStat(lock) : null;
  if (!before) return { out, before, result: out };
  out.ageMs = Math.max(0, now - before.mtimeMs);
  out.bytes = before.size;
  if (before.isSymbolicLink() || !before.isFile()) return { out, before, result: { ...out, state: 'not-a-file' } };
  if (!(Number(staleMs) > 0) || out.ageMs < Number(staleMs)) return { out, before, result: { ...out, state: 'fresh' } };
  return { out, before, result: null };
};

const processHoldersOnRepo = (list, repo) => {
  let procs = null;
  try { procs = typeof list === 'function' ? list() : null; } catch { procs = null; }
  return Array.isArray(procs) ? procs.filter((p) => processOnRepo(p, repo) !== 'other') : null;
};

const removeVerifiedLock = ({ lock, out, before, apply, record }) => {
  const after = lockStat(lock);
  if (!after) return { ...out, state: 'absent' };
  if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) return { ...out, state: 'changed' };
  if (!apply) return { ...out, state: 'would-remove' };
  try { fs.unlinkSync(lock); } catch (error) {
    if (error?.code !== 'ENOENT') return { ...out, state: 'error', error: `${error?.code ?? 'ERROR'}: ${error?.message ?? error}` };
  }
  const removed = { ...out, state: 'removed', mtime: new Date(before.mtimeMs).toISOString() };
  if (typeof record === 'function') { try { record(removed); } catch { /* the removal stands without its event */ } }
  return removed;
};

/**
 * Recover `repo`'s stale index lock. `staleMs` is the age a lock must pass (allocation.housekeeping.
 * gitIndexLockStaleMs); `apply` false reports `would-remove` and removes nothing; `list()` is the caller's git-process
 * probe ([{pid, name, commandLine}] or null; none given: probe-failed, nothing removed); `record(result)` is called once
 * for a removal.
 * Returns {repo, lock, state, ageMs?, holders?, error?}; state is one of absent | fresh | not-a-file | probe-failed |
 * held | changed | would-remove | removed | error.
 */
export function indexLock({ repo, staleMs, now = Date.now(), apply = true, list = null, record = null } = {}) {
  const initial = initialLockState(repo, staleMs, now);
  if (initial.result) return initial.result;
  const { out, before } = initial;
  const { lock } = out;
  const holders = processHoldersOnRepo(list, out.repo);
  if (holders === null) return { ...out, state: 'probe-failed' };
  if (holders.length) return { ...out, state: 'held', holders: holders.map((p) => ({ pid: p.pid, name: p.name, commandLine: String(p.commandLine ?? '').slice(0, 200) })) };
  return removeVerifiedLock({ lock, out, before, apply, record });
}
