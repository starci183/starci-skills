/**
 * Runtime contract resolution for ordinary agent/CLI execution.
 *
 * All workflows/ops/schemas/knowledge/specifications/profiles JSON consumed at
 * runtime must come from `.dist` (after `node scripts/ensure-build.mjs`).
 * Authored trees under the skill root remain for maintenance/build tooling only.
 *
 * Build coordination: if a `.mjs` module must execute from `.dist` (colocated
 * with compiled JSON), list its skill-relative path in `scripts/runtime-modules.txt`
 * so the build copies those modules into `.dist`. Prefer `distPath` / `readDistJson`
 * from source modules when only JSON needs to move.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const skillRoot = path.basename(moduleRoot) === '.dist' ? path.dirname(moduleRoot) : moduleRoot;
export const distRoot = path.join(skillRoot, '.dist');

/** Absolute path under `.dist`. Parts are joined; rejects absolute or escaping segments. */
export function distPath(...parts) {
  const relative = parts.flatMap(part => String(part).split(/[\\/]/)).filter(Boolean);
  if (!relative.length || relative.some(seg => seg === '..' || path.isAbsolute(seg))) {
    throw Error('distPath requires relative segments under .dist');
  }
  return path.join(distRoot, ...relative);
}

/**
 * Fail closed when `.dist` is missing. Does not prove freshness; run
 * `node scripts/ensure-build.mjs` from the skill directory before execution.
 */
export function requireDist() {
  if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) {
    throw Error(
      'Missing .dist runtime contracts. Run `node scripts/ensure-build.mjs` from the skill directory and retry.'
    );
  }
  if (fs.lstatSync(distRoot).isSymbolicLink()) {
    throw Error('.dist cannot be a symlink');
  }
  return distRoot;
}

/** Read and parse a JSON file from `.dist` after requireDist(). */
export function readDistJson(...parts) {
  requireDist();
  return JSON.parse(fs.readFileSync(distPath(...parts), 'utf8'));
}
