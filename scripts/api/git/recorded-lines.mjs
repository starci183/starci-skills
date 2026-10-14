// recorded-lines.mjs - the line count a file had at a git revision (git show <ref>:<file>): the recorded size a
// size-growth rule compares the working file with.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { runGit } from './lib.mjs';
import { mergeBase } from './merge-base.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { lineCount } from '../../lib/line-count.mjs';

const ok = (result) => !result.error && result.status === 0;
const normalized = (text) => text.replaceAll('\r\n', '\n');
const pathKey = (value) => process.platform === 'win32' ? value.toLowerCase() : value;

/** A commit hook exports an index; HEAD applies only to a staged file whose lint text is that index's text. */
function lintingIndex(dir, name, source) {
  if (!process.env.GIT_INDEX_FILE || typeof source !== 'string') return false;
  const options = { dir, env: withoutGitLocalEnv(process.env), maxBuffer: 64 * 1024 * 1024 };
  const index = runGit(['rev-parse', '--path-format=absolute', '--git-path', 'index'], options);
  const root = runGit(['rev-parse', '--show-toplevel'], options);
  if (!ok(index) || !ok(root)) return false;
  // The hook's relative index path is relative to the repository root even after xargs changes to be/ or fe/.
  const hookIndex = path.resolve(root.stdout.trim(), process.env.GIT_INDEX_FILE);
  if (pathKey(path.dirname(hookIndex)) !== pathKey(path.dirname(path.resolve(index.stdout.trim())))) return false;
  const stagedOptions = { ...options, env: { ...options.env, GIT_INDEX_FILE: hookIndex } };
  const changed = runGit(['diff', '--cached', '--relative', '--name-only', '-z', '--', `./${name}`], stagedOptions);
  if (!ok(changed) || !changed.stdout.split('\0').includes(name)) return false;
  const staged = runGit(['show', `:./${name}`], stagedOptions);
  return ok(staged) && normalized(staged.stdout) === normalized(source);
}

function recordedRef(dir, name, source) {
  if (lintingIndex(dir, name, source)) return 'HEAD';
  const base = process.env.STARCI_BASE_REF;
  for (const ref of base ? [base] : ['origin/main', 'main']) {
    const sha = mergeBase(dir, 'HEAD', ref);
    if (sha) return sha;
  }
  return null;
}

/**
 * The line count at the branch's merge base, null for a confirmed new file, or `unavailable` for unreadable history.
 * Only lint text matching a changed file in a commit hook's index is compared with HEAD. Explicit revision strings
 * remain supported for callers that request a particular revision rather than the lint baseline.
 *
 * @param {string} filename - Absolute path of the file.
 * @param {object | string} options - `{ source }` from ESLint, or an explicit revision.
 * @returns {number | null | 'unavailable'} The recorded line count or the reason it cannot be compared.
 */
export const recordedLines = (filename, options = {}) => {
  const absolute = path.resolve(filename);
  let dir = path.dirname(absolute);
  while (!existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  const name = path.relative(dir, absolute).split(path.sep).join('/');
  const ref = typeof options === 'string' ? options : recordedRef(dir, name, options.source);
  if (!ref) return 'unavailable';
  const gitOptions = { dir, maxBuffer: 64 * 1024 * 1024 };
  const files = runGit(['ls-tree', '--name-only', '-z', ref, '--', `./${name}`], gitOptions);
  if (!ok(files)) return 'unavailable';
  if (!files.stdout.split('\0').includes(name)) return null;
  const recorded = runGit(['show', `${ref}:./${name}`], gitOptions);
  return ok(recorded) ? lineCount(recorded.stdout) : 'unavailable';
};
