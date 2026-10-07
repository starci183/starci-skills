// make-temp-dir.mjs — a fresh temporary directory under the temp root (engine/temp-root.mjs tempRoot).
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../../../engine/temp-root.mjs';

/** A new directory `<prefix><random>` under `parent` (default tempRoot()), which is created when it is missing. */
export function makeTempDir(prefix, { env = process.env, parent = undefined } = {}) {
  const root = parent ?? tempRoot({ env });
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
}
