// git-dir.mjs — a checkout's git directory and the git processes that may hold it, read without running git: the pure
// half of the stale `.git/index.lock` recovery (scripts/api/git/index-lock.mjs indexLock removes the lock;
// scripts/machine/lock-recovery.mjs reads the process table, records the removal and runs the command guard's pre-flight).
import fs from 'node:fs';
import path from 'node:path';
import { pathKey } from './path-key.mjs';

/** git.exe and its helpers (git-remote-https.exe, git-lfs.exe, ...). */
const GIT_IMAGE = /^git(?:-[\w.-]+)?(?:\.exe)?$/i;
/** Whether a process image name is git or one of its helpers. */
export const isGitImage = (name) => GIT_IMAGE.test(String(name ?? ''));
/** `file`'s lstat, or null when it cannot be read. */
export const lockStat = (file) => { try { return fs.lstatSync(file); } catch { return null; } };

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
