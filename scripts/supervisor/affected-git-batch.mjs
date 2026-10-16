// affected-git-batch.mjs - the git answers `test affected` asks per changed file, fetched with a few git processes instead of one per file.
// On a large diff (a release against the previous tag) the per-file `git diff -- <file>` and `git show <base>:<file>` calls were thousands of
// process spawns, tens of minutes on Windows before the first spec ran. The answers below are the same bytes, read once per (root, base).
import { spawnSync } from 'node:child_process';

const MAX_BUFFER = 1024 * 1024 * 1024;
const caches = new Map();

const git = (root, args, input) => spawnSync('git', args, { cwd: root, input, encoding: input === undefined ? 'utf8' : 'buffer', maxBuffer: MAX_BUFFER, windowsHide: true });

/** The `-U0` diff text of every changed tracked file against `base`, by repository path (renames not detected, like a single-file diff). */
function loadDiffs(root, base) {
  const diffs = new Map();
  const result = git(root, ['diff', '-U0', '--no-color', '--no-renames', base]);
  if (result.status !== 0 || result.error) return null;
  for (const chunk of String(result.stdout).split(/^(?=diff --git )/m)) {
    const header = /^diff --git a\/(.+?) b\/(.+)\r?\n/.exec(chunk);
    if (header) diffs.set(header[2], chunk);
  }
  return diffs;
}

/** `git cat-file --batch` over `base:<path>` for every changed path: the base text by path (absent for a path the base lacks). */
function loadBaseTexts(root, base) {
  const names = git(root, ['diff', '--name-only', '--no-renames', '--diff-filter=MD', base]);
  if (names.status !== 0 || names.error) return null;
  const paths = String(names.stdout).split(/\r?\n/).filter(Boolean);
  const result = git(root, ['cat-file', '--batch'], Buffer.from(paths.map((p) => `${base}:${p}\n`).join('')));
  if (result.status !== 0 || result.error) return null;
  const out = result.stdout;
  const texts = new Map();
  let at = 0;
  for (const p of paths) {
    const end = out.indexOf(0x0a, at);
    if (end < 0) break;
    const header = out.toString('utf8', at, end);
    at = end + 1;
    const found = /^[0-9a-f]+ blob (\d+)$/.exec(header);
    if (!found) continue;
    const size = Number(found[1]);
    texts.set(p, out.toString('utf8', at, at + size));
    at += size + 1;
  }
  return texts;
}

const cacheOf = (root, base) => {
  const key = `${root}\n${base}`;
  if (!caches.has(key)) caches.set(key, { diffs: undefined, texts: undefined });
  return caches.get(key);
};

/** `{status, stdout}` like the diff verb for `-U0 base -- file`: the file's diff ('' when unchanged), or null when git cannot answer in batch. */
export function batchedDiff(root, base, file) {
  const cache = cacheOf(root, base);
  if (cache.diffs === undefined) cache.diffs = loadDiffs(root, base);
  if (!cache.diffs) return null;
  return { status: 0, stdout: cache.diffs.get(file) ?? '' };
}

/** `{status, stdout}` like the show verb for `base:file`, a failing status for a path the base lacks, or null when git cannot answer in batch. */
export function batchedBaseText(root, base, file) {
  const cache = cacheOf(root, base);
  if (cache.texts === undefined) cache.texts = loadBaseTexts(root, base);
  if (!cache.texts) return null;
  return cache.texts.has(file) ? { status: 0, stdout: cache.texts.get(file) } : { status: 128, stdout: '' };
}
