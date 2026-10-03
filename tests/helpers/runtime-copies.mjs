// runtime-copies.mjs - regenerates the packages' git-ignored runtime/ copies (scripts/hfs/sync-runtime.mjs) when they
// drift or are absent, so a spec or helper that reads them works in a fresh checkout. `node --test` preloads do the
// same in-process through tests/setup/runtime-copies.mjs (npm test's --import, and the land gate's spec runner).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * `starci release sync-runtime` in `dir`, but only when its --check reports drift: the copies stay on disk
 * untouched when they are already fresh. Returns the exit status (0 when the copies are what the generator writes).
 */
export function ensureRuntimeCopies({ dir = root } = {}) {
  const script = path.join(dir, 'scripts', 'hfs', 'sync-runtime.mjs');
  if (!fs.existsSync(script)) return 0;
  const check = spawnSync(process.execPath, [script, '--check'], { cwd: dir });
  if (check.status === 0) return 0;
  const r = spawnSync(process.execPath, [script], { cwd: dir });
  return r.status ?? 1;
}
