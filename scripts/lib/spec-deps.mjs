// spec-deps.mjs - which specs depend on a changed file, by IMPORT, not by name.
//
// A spec depends on a module when the module is reachable from the spec through relative imports (static `import`,
// `export ... from`, dynamic `import('...')` with a literal, and `require('...')`), followed transitively inside the
// repository. The land gate runs those specs at land time, so a clash between two lanes (one lane changes a module that
// another lane's spec relies on) is caught before main moves, not at the final full run.
//
// Pure: reads files, starts nothing. The imports are read with the TypeScript scanner (ts.preProcessFile), so an import
// shown inside a string or a comment is never followed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isMain } from './is-main.mjs';
import { walkFiles } from './walk.mjs';

let typescript = null;
const ts = () => (typescript ??= createRequire(import.meta.url)('typescript'));

const EXTENSIONS = ['', '.mjs', '.js', '.cjs', '.ts', '.mts', '.cts', '.json', '/index.mjs', '/index.js'];
const posix = (p) => p.split(path.sep).join('/');

/** Repository-relative paths of the files `file` (absolute) imports relatively, resolved to existing files. */
export function relativeImportsOf(root, file, readFile = (f) => fs.readFileSync(f, 'utf8')) {
  let text;
  try { text = readFile(file); } catch { return []; }
  const info = ts().preProcessFile(text, true, true);
  const out = [];
  for (const { fileName } of info.importedFiles) {
    if (!fileName.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), fileName);
    const hit = EXTENSIONS.map((ext) => base + ext).find((candidate) => {
      try { return fs.statSync(candidate).isFile(); } catch { return false; }
    });
    if (hit && !path.relative(root, hit).startsWith('..')) out.push(posix(path.relative(root, hit)));
  }
  return out;
}

/** Every repository file reachable from `entry` (repository-relative) through relative imports, the entry included. */
export function reachableFrom(root, entry, { cache = new Map(), readFile } = {}) {
  const seen = new Set();
  const stack = [posix(entry)];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let next = cache.get(rel);
    if (!next) { next = relativeImportsOf(root, path.join(root, rel), readFile); cache.set(rel, next); }
    for (const dep of next) if (!seen.has(dep)) stack.push(dep);
  }
  return seen;
}

/**
 * The specs (repository-relative paths) whose import graph reaches any changed file. `specs` is the list of spec paths to
 * consider; `changed` the repository-relative changed files. A changed spec selects itself.
 */
export function specsDependingOn(root, changed, specs, { readFile } = {}) {
  const wanted = new Set(changed.map(posix));
  const cache = new Map();
  return specs.filter((spec) => {
    for (const file of reachableFrom(root, spec, { cache, readFile })) if (wanted.has(file)) return true;
    return false;
  });
}

// CLI: node scripts/lib/spec-deps.mjs <root> <changed-file>... -> prints the dependent spec paths, one per line.
if (isMain(import.meta.url)) {
  const [root, ...changed] = process.argv.slice(2);
  const specs = walkFiles(path.join(root, 'tests'), { sorted: true, filter: (name) => name.endsWith('.spec.mjs'), exclude: (name) => name === 'node_modules' })
    .map((file) => path.relative(root, file).split(path.sep).join('/'));
  for (const spec of specsDependingOn(path.resolve(root), changed, specs)) console.log(spec);
}
