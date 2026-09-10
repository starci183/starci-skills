import fs from 'node:fs';
import path from 'node:path';
import { assertInside } from './paths.mjs';

/**
 * Publish a complete file map into `.dist` via staging.
 * Failed builds must not leave a partial “current” bundle.
 *
 * @param {string} skillRoot
 * @param {Map<string, Buffer>} files relative posix paths → bytes
 * @param {{ check?: boolean }} [options]
 */
export function publishDist(skillRoot, files, { check = false } = {}) {
  const dist = path.join(skillRoot, '.dist');
  const staging = path.join(skillRoot, '.dist.staging');
  const previous = path.join(skillRoot, '.dist.previous');
  const stale = [];

  for (const relative of files.keys()) {
    if (relative.includes('\\') || relative.split('/').includes('..') || path.isAbsolute(relative)) {
      throw Error(`Unsafe dist relative path: ${relative}`);
    }
  }

  if (check) {
    if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) throw Error('dist cannot be a symlink');
    const existing = listOwnedFiles(dist);
    for (const relative of existing) {
      if (!files.has(relative)) stale.push(relative);
    }
    for (const [relative, bytes] of files) {
      const file = path.join(dist, relative);
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) stale.push(relative);
    }
    return { ok: stale.length === 0, stale: [...new Set(stale)].sort((a, b) => a.localeCompare(b)), files: files.size };
  }

  rmPath(staging);
  fs.mkdirSync(staging, { recursive: true });
  if (fs.lstatSync(staging).isSymbolicLink()) throw Error('staging cannot be a symlink');

  for (const [relative, bytes] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
    const file = path.join(staging, relative);
    let cursor = staging;
    for (const segment of relative.split('/')) {
      cursor = path.join(cursor, segment);
      if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
        throw Error('Build target cannot be a symlink');
      }
    }
    assertInside(staging, file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }

  // Verify staging completeness before swapping.
  for (const [relative, bytes] of files) {
    const file = path.join(staging, relative);
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(Buffer.from(bytes))) {
      rmPath(staging);
      throw Error(`Staging verification failed for ${relative}`);
    }
  }

  rmPath(previous);
  if (fs.existsSync(dist)) {
    if (fs.lstatSync(dist).isSymbolicLink()) throw Error('dist cannot be a symlink');
    fs.renameSync(dist, previous);
  }
  try {
    fs.renameSync(staging, dist);
  } catch (error) {
    if (fs.existsSync(previous) && !fs.existsSync(dist)) {
      try { fs.renameSync(previous, dist); } catch { /* best-effort restore */ }
    }
    rmPath(staging);
    throw error;
  }
  rmPath(previous);
  rmPath(staging);
  return { ok: true, stale: [], files: files.size };
}

function listOwnedFiles(distRoot) {
  const out = [];
  if (!fs.existsSync(distRoot)) return out;
  if (fs.lstatSync(distRoot).isSymbolicLink()) throw Error('dist cannot be a symlink');
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Build target cannot be a symlink: ${file}`);
      if (entry.isDirectory()) visit(file);
      else out.push(path.relative(distRoot, file).replaceAll('\\', '/'));
    }
  };
  visit(distRoot);
  return out.sort((a, b) => a.localeCompare(b));
}

function rmPath(target) {
  if (!fs.existsSync(target)) return;
  if (fs.lstatSync(target).isSymbolicLink()) throw Error(`Refusing to remove symlink: ${target}`);
  fs.rmSync(target, { recursive: true, force: false });
}
