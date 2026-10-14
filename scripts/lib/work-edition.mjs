// The edition boundary for Work readers: lite keeps only brand records and their authored assets.
import fs from 'node:fs';
import path from 'node:path';
import { isLiteProductPath } from './starciwork-boundary.mjs';

/** Whether the app owning this Work root declares lite. Missing declarations retain the full reader contract. */
export function isLiteWorkRoot(workRoot) {
  if (!workRoot) return false;
  try {
    const declaration = JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(workRoot)), 'hfs.json'), 'utf8'));
    return declaration?.kind === 'app' && declaration?.edition === 'lite';
  } catch { return false; }
}

/** Whether a reader may open `file`: external files are unaffected, while lite Work paths are brand-only. */
export function workPathAllowed(workRoot, file, { dir = false } = {}) {
  if (!isLiteWorkRoot(workRoot)) return true;
  const rel = path.relative(path.resolve(workRoot), path.resolve(file)).replaceAll('\\', '/');
  if (rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) return true;
  return !rel || isLiteProductPath(rel, { dir });
}

/** Every forbidden entry directly below a lite Work root, including empty directories. Never read their contents. */
export function liteWorkForbiddenPaths(workRoot) {
  if (!isLiteWorkRoot(workRoot)) return [];
  let entries;
  try { entries = fs.readdirSync(workRoot, { withFileTypes: true }); } catch { return []; }
  return entries.filter(entry => !isLiteProductPath(entry.name, { dir: entry.isDirectory() }))
    .map(entry => path.join(workRoot, entry.name));
}
