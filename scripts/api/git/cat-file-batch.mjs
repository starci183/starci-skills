// scripts/api/git/cat-file-batch.mjs - `git cat-file --batch` in `cwd`, `input` (a Buffer of object names, one per line) on stdin: the raw output as a Buffer.
import { BATCH_MAX_BUFFER, runGit } from './lib.mjs';

/** `git cat-file --batch` over the object names in `input` (a Buffer, one per line), as one spawn result whose stdout is a Buffer. */
export const catFileBatch = (input, { cwd }) => runGit(['cat-file', '--batch'], { cwd, input, encoding: 'buffer', maxBuffer: BATCH_MAX_BUFFER });
