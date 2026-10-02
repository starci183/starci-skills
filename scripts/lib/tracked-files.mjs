// tracked-files.mjs — the git-tracked source files a check scans, as {rel, text} rows: `git ls-files -z`
// under `root`, filtered by `keep(rel)` and read to text (a vanished file is skipped, not an error).
import fs from 'node:fs';
import path from 'node:path';
import { lsFiles } from '../api/git/ls-files.mjs';

/** Every tracked file under `root` that `keep(rel)` selects: [{rel, text}]. */
export function trackedTextFiles(root, keep, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  const tracked = lsFiles(['-z'], { dir: root, maxBuffer }).stdout.split('\0').filter(Boolean);
  return tracked
    .filter((rel) => keep(rel) && fs.existsSync(path.join(root, rel)))
    .map((rel) => ({ rel, text: fs.readFileSync(path.join(root, rel), 'utf8') }));
}
