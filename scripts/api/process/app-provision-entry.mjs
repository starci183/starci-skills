import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from '../../../engine/digest.mjs';

const ENTRY = 'be/dist/apps/cli/src/main.js';

/** Inspect the fixed native CLI entry and require the exact accepted bytes before private process input opens. */
export function appProvisionEntry(repoRoot, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash ?? '')) throw new Error('APP_ACCESS_BUILD_IDENTITY_REQUIRED');
  const root = fs.realpathSync(repoRoot), entry = path.join(root, ENTRY);
  let current = root;
  for (const part of ENTRY.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('APP_ACCESS_LINK_REFUSED');
  }
  if (!fs.statSync(entry).isFile()) throw new Error('APP_ACCESS_BUILD_UNAVAILABLE');
  const actual = sha256File(entry);
  if (actual !== expectedHash) throw new Error('APP_ACCESS_BUILD_DRIFT');
  return { entry: ENTRY, sha256: actual };
}
