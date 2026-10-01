// git-index-lock.mjs — the ONE recovery of a stale `.git/index.lock` in a shared product checkout.
//
// Every workflow of a product repo works in one checkout (nivo-backend, starci-next, ...). A git process that
// dies mid-write (a host terminal wipe, a killed worker) leaves `<gitdir>/index.lock` behind, and from then on
// every `git add` / `git commit` in that checkout refuses "Unable to create .../index.lock: File exists" - for
// every workflow at once. starci-next sn-subscription backend.implement a20 (2026-09-26 01:10) settled blocked on
// a 403 KB lock from 01:01:34 with no git process alive; the worker rightly would not delete a shared lock.
//
// recoverStaleIndexLock removes such a lock only when all of these hold:
//   - it is a plain file (never a link), older than allocation.housekeeping.gitIndexLockStaleMs (runtimes.yaml);
//   - the host process table was read (a failed probe removes nothing), and no git process may be working on
//     this repository: a git-family process whose command line names this repo (-C, --git-dir, --work-tree) or
//     names no repository at all (its cwd cannot be read, so it may be this repo's) keeps the lock;
//   - the lock is the same file (mtime and size) after the probe as before it.
// A removal is recorded as a `git-index-lock-removed` Supervisor audit event (machine.sqlite sup_events) (the caller passes
// `record`); every other outcome is returned, never thrown. Callers: the command guard before an op worker's git
// command runs (scripts/guards/command-guard.mjs) and the housekeeping area `gitlocks` (scripts/housekeeping/housekeeping.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { pathKey } from '../../lib/path-key.mjs';
import { listHostProcesses } from '../process/process-list.mjs';

export const LOCK_EVENT = 'git-index-lock-removed';
/** git.exe and its helpers (git-remote-https.exe, git-lfs.exe, ...). */
const GIT_IMAGE = /^git(?:-[\w.-]+)?(?:\.exe)?$/i;
const lockStat = (file) => { try { return fs.lstatSync(file); } catch { return null; } };

/** The git dir of the checkout at `repo`: `.git` itself, or the `gitdir:` a worktree's `.git` file names. Null when none. */
export function gitDirOf(repo) {
  const dotGit = path.join(path.resolve(repo), '.git');
  let st;
  try { st = fs.lstatSync(dotGit); } catch { return null; }
  if (st.isDirectory()) return dotGit;
  if (!st.isFile()) return null;
  try {
    const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'));
    return m ? path.resolve(path.dirname(dotGit), m[1].trim()) : null;
  } catch { return null; }
}

/** The checkout `start` is in: the nearest directory at or above it holding `.git`, or null. */
export function checkoutOf(start) {
  for (let dir = path.resolve(String(start ?? '.')); ; dir = path.dirname(dir)) {
    if (lockStat(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return null;
  }
}

/** Git-family processes on this host: [{pid, name, commandLine}], or null when the probe failed. */
export function listGitProcesses({ platform = process.platform, run } = {}) {
  const rows = listHostProcesses({ where: "Name LIKE 'git%'", run, platform, timeoutMs: 30000 });
  return rows ? rows.map((p) => ({ pid: p.pid, name: String(p.name ?? ''), commandLine: p.cmd })).filter((p) => GIT_IMAGE.test(p.name)) : null;
}

/** Command-line words, double quotes grouping (Windows command lines quote paths with spaces). */
const words = (line) => [...String(line ?? '').matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);

/** The repositories a git command line names by -C, --git-dir or --work-tree (as given, unresolved). */
export function reposNamed(commandLine) {
  const w = words(commandLine), out = [];
  for (let i = 0; i < w.length; i += 1) {
    if (w[i] === '-C' || w[i] === '--git-dir' || w[i] === '--work-tree') { if (w[i + 1]) out.push(w[i + 1]); i += 1; continue; }
    const m = /^--(?:git-dir|work-tree)=(.+)$/.exec(w[i]);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Whether one git process may hold `repo`'s index: 'this' (it names the repo or a path inside it), 'other'
 * (every repository it names is elsewhere) or 'unknown' (it names none; its cwd may be this repo).
 */
export function processOnRepo(proc, repo) {
  const named = reposNamed(proc?.commandLine);
  if (!named.length) return 'unknown';
  const key = pathKey(path.resolve(repo));
  const hit = named.some((p) => { const k = pathKey(path.resolve(p)); return k === key || k.startsWith(`${key}/`) || key.startsWith(`${k}/`); });
  return hit ? 'this' : 'other';
}

/**
 * Recover `repo`'s stale index lock. `staleMs` is the age a lock must pass (allocation.housekeeping.
 * gitIndexLockStaleMs); `apply` false reports `would-remove` and removes nothing; `list` is the process probe;
 * `record(result)` is called once for a removal. A spec run (NODE_TEST_CONTEXT) never reads the host process table.
 * Returns {repo, lock, state, ageMs?, holders?, error?}; state is one of absent | fresh | not-a-file | probe-failed |
 * held | changed | would-remove | removed | error.
 */
export function recoverStaleIndexLock({ repo, staleMs, now = Date.now(), apply = true, list = listGitProcesses, record = null, env = process.env } = {}) {
  const gitDir = gitDirOf(repo);
  const lock = gitDir ? path.join(gitDir, 'index.lock') : null;
  const out = { repo: path.resolve(String(repo ?? '')), lock, state: 'absent' };
  const before = lock ? lockStat(lock) : null;
  if (!before) return out;
  out.ageMs = Math.max(0, now - before.mtimeMs);
  out.bytes = before.size;
  if (before.isSymbolicLink() || !before.isFile()) return { ...out, state: 'not-a-file' };
  if (!(Number(staleMs) > 0) || out.ageMs < Number(staleMs)) return { ...out, state: 'fresh' };
  if (env.NODE_TEST_CONTEXT && list === listGitProcesses) return { ...out, state: 'probe-failed', error: 'test context: the host process table is never read' };
  let procs;
  try { procs = list(); } catch { procs = null; }
  if (!Array.isArray(procs)) return { ...out, state: 'probe-failed' };
  const holders = procs.filter((p) => processOnRepo(p, out.repo) !== 'other');
  if (holders.length) return { ...out, state: 'held', holders: holders.map((p) => ({ pid: p.pid, name: p.name, commandLine: String(p.commandLine ?? '').slice(0, 200) })) };
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
}

/** `record` for recoverStaleIndexLock: one Supervisor audit event (machine.sqlite sup_events) per removal, naming who removed it. */
export async function supervisorLockRecorder({ env = process.env, by, jobId = null, workflowId = null } = {}) {
  const { withSupervisor, supervisorEvent } = await import('../../machine/home.mjs');
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
    const { allocationMs } = await import('../../../engine/config.mjs');
    const staleMs = allocationMs('housekeeping.gitIndexLockStaleMs');
    if (now - st.mtimeMs < staleMs) return null;
    const record = await supervisorLockRecorder({ env, by: 'command-guard', jobId: guard?.jobId ?? null, workflowId: guard?.workflowId ?? null });
    const result = recoverStaleIndexLock({ repo, staleMs, now, list, record, env });
    const age = `${Math.round((result.ageMs ?? 0) / 60000)} min`;
    if (result.state === 'removed') say(`starci guard: removed a stale ${result.lock} (${age} old, no git process on this repository); recorded as ${LOCK_EVENT}.`);
    else if (result.state === 'held') say(`starci guard: ${result.lock} is ${age} old but a git process may still hold it (${result.holders.map((h) => h.pid).join(', ')}); left in place - retry shortly, never delete it by hand.`);
    else if (result.state !== 'fresh' && result.state !== 'absent') say(`starci guard: ${result.lock} is ${age} old and was left in place (${result.state}${result.error ? `: ${result.error}` : ''}).`);
    return result;
  } catch (error) {
    say(`starci guard: index-lock check error (${error?.message ?? error}); running git anyway`);
    return null;
  }
}
