// ensure-temp-root.mjs — the temp root exists before a child is started with TEMP/TMP/TMPDIR pointing at it.
import fs from 'node:fs';
import { tempRoot } from '../../../engine/temp-root.mjs';

/** The temp root of `env`, created when it is missing. Throws the filesystem's error when it cannot be made. */
export function ensureTempRoot({ env = process.env } = {}) {
  const root = tempRoot({ env });
  fs.mkdirSync(root, { recursive: true });
  return root;
}
