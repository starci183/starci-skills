// spec-cache-tree.mjs - a content id for every file of a checkout that a spec could read: {rel -> id}.
// A tracked file that matches the index is its blob id (git's own content hash, free to read); a tracked file modified in the working tree, an untracked file git does not ignore and a file git ignores but
// a spec imports (a build output) is the sha256 of its bytes; a file deleted from the working tree has no entry. Two checkouts with equal ids for a path hold equal bytes at that path.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../api/git/ls-files.mjs';

const split = (text) => String(text ?? '').split('\0').filter(Boolean);
const bytesId = (file) => { try { return `w:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`; } catch { return null; } };

/** The `git ls-files -s -z` entries as [[rel, blob id]]. */
function indexed(root, deps) {
  const out = (deps.lsFiles ?? lsFiles)(['-s', '-z'], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return split(out.stdout).map((entry) => {
    const tab = entry.indexOf('\t');
    return [entry.slice(tab + 1), entry.slice(0, tab).split(' ')[1]];
  });
}

const listed = (root, deps, flags) => split((deps.lsFiles ?? lsFiles)([...flags, '-z'], { cwd: root, maxBuffer: 256 * 1024 * 1024 }).stdout);

/** {rel -> id} of every tracked and untracked-unignored file under `root`, working-tree bytes winning over the index. */
export function treeIds(root, deps = {}) {
  const ids = new Map(indexed(root, deps));
  for (const rel of listed(root, deps, ['-d'])) ids.delete(rel);
  for (const rel of [...listed(root, deps, ['-m']), ...listed(root, deps, ['--others', '--exclude-standard'])]) {
    const id = bytesId(path.join(root, rel));
    if (id) ids.set(rel, id);
  }
  return ids;
}

/** The id of `rel` under `root` for a file the tree listing does not hold (git-ignored: a build output a spec imports); null when it is not a file. */
export const ignoredFileId = (root, rel) => bytesId(path.join(root, rel));
