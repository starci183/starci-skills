import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { sha256 } from '../../engine/digest.mjs';
import { pathKey } from '../../scripts/lib/path-key.mjs';

/** Hash exact bytes through the canonical digest owner without text normalization. */
export { sha256 as hash };
/** Compare resolved paths with the host's case rules; the key alone does not establish file custody. */
export const canonical = pathKey;
/** Require a regular file and link-free, nonredirected ancestry before a raw read. */
export function regular(file) {
  const resolved = path.resolve(file);
  let cursor = resolved;
  while (true) {
    const stat = fs.lstatSync(cursor);
    assert(!stat.isSymbolicLink(), `Linked path: ${cursor}`);
    assert.equal(canonical(fs.realpathSync.native(cursor)), canonical(cursor), `Redirected path: ${cursor}`);
    const parent = path.dirname(cursor);
    if (cursor === parent) break;
    cursor = parent;
  }
  assert(fs.lstatSync(resolved).isFile(), `Regular file required: ${resolved}`);
  return resolved;
}
/** Pin the actual regular file's absolute path, raw SHA256 and byte length; refuse links and directories. */
export function row(file) {
  const bytes = fs.readFileSync(regular(file));
  return { path: path.resolve(file), sha256: sha256(bytes), bytes: bytes.length };
}
/** Write and pin a JSON receipt in the caller's owned run directory; the caller supplies directory custody and file names. */
export function save(dir, name, value) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  return row(file);
}
