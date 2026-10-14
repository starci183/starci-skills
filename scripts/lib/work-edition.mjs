// The edition boundary for Work readers: lite keeps workspace identity, brand records and their authored assets.
import fs from 'node:fs';
import path from 'node:path';
import { isLiteProductPath } from './starciwork-boundary.mjs';
import { foldCase } from './path-key.mjs';
import { WORK_DIR_NAME } from './roots.mjs';

const appTemplatesRoot = path.resolve(import.meta.dirname, '..', '..', 'packages', 'hfs', 'templates', 'app');

/** Unrendered Work seeds in this runtime's app skeletons are templates, not product records. */
export function isWorkTemplatePath(file) {
  const [skeleton, work] = foldCase(path.relative(appTemplatesRoot, path.resolve(file))).replaceAll('\\', '/').split('/');
  return (skeleton === 'skeleton' || skeleton === 'skeleton-lite') && work === WORK_DIR_NAME;
}

/** Whether the app owning this Work root declares lite. Missing declarations retain the full reader contract. */
export function isLiteWorkRoot(workRoot) {
  if (!workRoot) return false;
  try {
    const declaration = JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(workRoot)), 'hfs.json'), 'utf8'));
    return declaration?.kind === 'app' && declaration?.edition === 'lite';
  } catch { return false; }
}

/** Whether a reader may open `file`: external files are unaffected; lite Work paths keep workspace.yaml and brand/**. */
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
