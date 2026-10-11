// tracked-sources.mjs — the tracked files of the runtime at a root that a scan's scope admits, as {relativePath: text}.
import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../../api/git/ls-files.mjs';
import { gitOutputOf } from '../../lib/git.mjs';

/** The tracked files at `root` that `inScope` admits; a file a lane holds deleted is skipped. */
export function trackedSources(root, inScope) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split(String.fromCodePoint(0)).filter(Boolean);
  const files = {};
  for (const rel of tracked.filter((candidate) => inScope(candidate))) {
    try { files[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* a lane may hold an uncommitted deletion */ }
  }
  return files;
}
