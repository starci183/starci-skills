// scripts/api/git/diff-all.mjs - `git diff -U0 --no-color --no-renames <base>` in `cwd`: the diff of every changed tracked file in one process,
// where `test affected` asked once per file (scripts/supervisor/affected-git-batch.mjs).
import { BATCH_MAX_BUFFER, runGit } from './lib.mjs';

export const diffAll = (base, { cwd }) => runGit(['diff', '-U0', '--no-color', '--no-renames', base], { cwd, maxBuffer: BATCH_MAX_BUFFER });
