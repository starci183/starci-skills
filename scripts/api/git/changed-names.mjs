// scripts/api/git/changed-names.mjs - `git diff --name-only --no-renames --diff-filter=<filter> <base>` in `cwd`: the changed paths.
import { BATCH_MAX_BUFFER, runGit } from './lib.mjs';

/** The paths `git diff --name-only` reports against `base` for the status letters in `filter` (for example 'MD'), as one spawn result. */
export const changedNames = (base, filter, { cwd }) => runGit(['diff', '--name-only', '--no-renames', `--diff-filter=${filter}`, base], { cwd, maxBuffer: BATCH_MAX_BUFFER });
