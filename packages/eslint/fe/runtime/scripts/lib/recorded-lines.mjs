// recorded-lines.mjs - the one home of the file-size ratchet's arithmetic (R20 HFS_SIZE_GROWTH), shared by the back-end
// and front-end lint canons (each ships a byte copy in its runtime/ bundle, kept by scripts/hfs/sync-runtime.mjs).
import path from 'node:path';
import { runGit } from '../api/git/lib.mjs';

/** The line count of a text; a trailing newline does not open a line. */
export const lineCount = (text) => {
  const lines = String(text).split(/\r?\n/);
  return lines.at(-1) === '' ? lines.length - 1 : lines.length;
};

/** The line count above which a file may not grow: the soft budget when `hardGrowth` holds, else no limit. */
export const hardGrowthLines = ({ soft, hardGrowth }) => (hardGrowth ? soft : Number.POSITIVE_INFINITY);

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
