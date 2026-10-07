// What the same-tree consistency rules of check-work-consistency.mjs share: the runtime root, the list reading of a
// record field and the repo-relative spelling of a record's file.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const isList = value => (Array.isArray(value) && value) || (value == null || value === '' ? [] : [value]);

/** `file` relative to the runtime root, with forward slashes. */
export const fromRoot = file => path.relative(repoRoot, file).replaceAll('\\', '/');

export const shownFile = rec => fromRoot(path.join(rec.dir, 'index.yaml'));
