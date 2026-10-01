// read.mjs - what the tree checks of hfs-check.mjs share: one bounded text read and the shape of a finding.
import fs from 'node:fs';
import path from 'node:path';

/** Files above this size are not read by a tree check (a tracked binary or a generated dump is no source of these laws). */
export const MAX_READ_BYTES = 1024 * 1024;

/** The text of `rel` under `repoRoot`, or null when it is absent, unreadable, over MAX_READ_BYTES or binary. */
export function readText(repoRoot, rel) {
  try {
    const target = path.join(repoRoot, rel);
    if (fs.statSync(target).size > MAX_READ_BYTES) return null;
    const text = fs.readFileSync(target, 'utf8');
    return text.includes('\0') ? null : text;
  } catch {
    return null;
  }
}

/** The JSON of `rel`, or null when it is absent or not JSON. */
export function readJson(repoRoot, rel) {
  const text = readText(repoRoot, rel);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** One error finding of `code` on `file`; `extra` carries the finding's own fields. */
export const found = (code, file, message, extra = {}) => ({ code, level: 'error', path: file, ...extra, message });
