// recorded-lines.mjs - the line count a file had at a git revision (git show <ref>:<file>): the recorded size a
// size-growth rule compares the working file with.
import path from 'node:path';
import { runGit } from './lib.mjs';
import { lineCount } from '../../lib/line-count.mjs';

/**
 * The line count of a file at a git revision, or null when the file did not exist there or git is absent.
 *
 * @param {string} filename - Absolute path of the file.
 * @param {string} ref - The revision, `HEAD` by default (the parent of the commit being made).
 * @returns {number | null} The recorded line count.
 */
export const recordedLines = (filename, ref = 'HEAD') => {
  const r = runGit(['show', `${ref}:./${path.basename(filename)}`], { dir: path.dirname(filename), maxBuffer: 64 * 1024 * 1024 });
  // no repository, no such revision, or a new file: all mean there is no recorded size to compare with
  if (r.error || r.status !== 0) return null;
  return lineCount(r.stdout);
};
