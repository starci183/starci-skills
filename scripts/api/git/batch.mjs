// scripts/api/git/batch.mjs - the three git calls `test affected` batches (scripts/supervisor/affected-git-batch.mjs): the whole -U0 diff
// against a base, the changed names, and `git cat-file --batch`. One process each where a per-file call was one process per changed file.
import { runGit } from './lib.mjs';

const MAX_BUFFER = 1024 * 1024 * 1024;

/** `git diff -U0 --no-color --no-renames <base>` in `cwd`: the diff of every changed tracked file, as text. */
export const diffAll = (base, { cwd }) => runGit(['diff', '-U0', '--no-color', '--no-renames', base], { cwd, maxBuffer: MAX_BUFFER });

/** `git diff --name-only --no-renames --diff-filter=<filter> <base>` in `cwd`. */
export const changedNames = (base, filter, { cwd }) => runGit(['diff', '--name-only', '--no-renames', `--diff-filter=${filter}`, base], { cwd, maxBuffer: MAX_BUFFER });

/** `git cat-file --batch` in `cwd`, `input` (a Buffer of object names, one per line) on stdin: the raw batch output as a Buffer. */
export const catFileBatch = (input, { cwd }) => runGit(['cat-file', '--batch'], { cwd, input, encoding: 'buffer', maxBuffer: MAX_BUFFER });
