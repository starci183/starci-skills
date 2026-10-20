// git-hooks-dir.mjs - whether a checkout's hooks folder holds installed hooks. The one judgement read by `starci npm ci` and
// `starci npm install` (scripts/machine/npm-hooks.mjs, which runs the app's hook installer when it fails) and by the HFS check
// HFS_HOOKS_NOT_INSTALLED (scripts/hfs/architecture/hfs.mjs). husky's `.husky/_` is generated per checkout: a linked worktree or
// an install whose lifecycle scripts were ignored has none, or only the runtime's own wrapped hooks, so git runs no pre-commit gate.
import fs from 'node:fs';
import path from 'node:path';

/** husky's generated hooks folder; every hook file in it sources the dispatcher `h`, which runs the tracked `.husky/<hook>`. */
const HUSKY_GENERATED = /^\.husky\/_\/?$/u;
const HUSKY_DISPATCHER = 'h';

/**
 * The state of the hooks folder `hooksPath` (a core.hooksPath value, relative to the checkout `root` or absolute):
 * `{ state, dir }` with state `installed`, `missing` (no such folder), `empty` (no hook file; for husky's `.husky/_`, no
 * dispatcher `h`) or `unreadable` (with `error`).
 */
export function hooksDirState(root, hooksPath) {
  const value = String(hooksPath ?? '').trim().replaceAll('\\', '/');
  const dir = path.resolve(root, value);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return { state: 'missing', dir };
    return { state: 'unreadable', dir, error: String(error?.message ?? error) };
  }
  const files = entries.filter((entry) => entry.isFile() && entry.name !== '.gitignore').map((entry) => entry.name);
  const installed = HUSKY_GENERATED.test(value) ? files.includes(HUSKY_DISPATCHER) : files.length > 0;
  return { state: installed ? 'installed' : 'empty', dir };
}
