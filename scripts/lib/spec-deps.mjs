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
function relativeImportsOf(root, file, readFile = (f) => fs.readFileSync(f, 'utf8')) {
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
  // A runtime entry a file starts as a process (`path.join(ROOT, 'scripts', 'kernel', 'cli.mjs')`, 'scripts/x/y.mjs') is a
  // dependency too: the spec exercises that entry and everything it imports.
  for (const rel of spawnedEntriesOf(text)) if (fs.existsSync(path.join(root, rel))) out.push(rel);
  return out;
}

const ENTRY_ROOTS = '(?:scripts|engine|bin)';
/** Repository-relative runtime .mjs paths `text` names as a string ('scripts/a/b.mjs') or as path segments ('scripts', 'a', 'b.mjs'). */
function spawnedEntriesOf(text) {
  const out = new Set();
  for (const m of text.matchAll(new RegExp(`['"\`](${ENTRY_ROOTS}/[\\w./-]+\\.mjs)['"\`]`, 'g'))) out.add(m[1]);
  for (const m of text.matchAll(new RegExp(`['"\`](${ENTRY_ROOTS})['"\`]((?:\\s*,\\s*['"\`][\\w.-]+['"\`])+)`, 'g'))) {
    const parts = [m[1], ...[...m[2].matchAll(/['"`]([\w.-]+)['"`]/g)].map((p) => p[1])];
    if (parts.at(-1).endsWith('.mjs')) out.add(parts.join('/'));
  }
  return [...out];
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

const QUOTED_PATH = /['"`]((?:examples|packages|knowledge|modules)\/[\w./@-]+?)\/?['"`]/g;
const QUOTED_SEGMENTS = /['"`](examples|packages|knowledge|modules)['"`]((?:\s*,\s*['"`][\w.@-]+['"`])+)/g;
const QUOTED_WORD = /['"`]([\w.@-]+)['"`]/g;
/**
 * The repository trees a test names as DATA (a path string `'packages/hfs/templates'` or path segments `'examples', 'ecommerce-app', 'be'`): a spec that reads
 * a template tree or an example app depends on every file below it, though it imports none of them.
 */
export function dataRefsOf(text) {
  const out = new Set();
  for (const m of text.matchAll(QUOTED_PATH)) out.add(m[1]);
  for (const m of text.matchAll(QUOTED_SEGMENTS)) out.add([m[1], ...[...m[2].matchAll(QUOTED_WORD)].map((p) => p[1])].join('/'));
  return [...out];
}

/**
 * The specs (repository-relative paths) whose import graph reaches any changed file. `specs` is the list of spec paths to
 * consider; `changed` the repository-relative changed files. A changed spec selects itself.
 */
export function specsDependingOn(root, changed, specs, { readFile } = {}) {
  const wanted = new Set(changed.map(posix));
  const cache = new Map();
  return specs.filter((spec) => {
    const reached = reachableFrom(root, spec, { cache, readFile });
    for (const file of reached) if (wanted.has(file)) return true;
    // data trees named by the spec and by its test helpers (tests/**): every changed file below one of them selects the spec
    for (const file of reached) {
      if (!file.startsWith('tests/')) continue;
      let text;
      try { text = (readFile ?? ((p) => fs.readFileSync(p, 'utf8')))(path.join(root, file)); } catch { continue; }
      for (const ref of dataRefsOf(text)) for (const changedFile of wanted) if (changedFile === ref || changedFile.startsWith(ref + '/')) return true;
    }
    return false;
  });
}

// Internal entry: spawned by scripts/supervisor/land.mjs; not invoked directly.
// Args: <root> <changed-file>... -> prints the dependent spec paths, one per line.
// Stdin mode accepts `-` in place of changed-file arguments.
// `-` reads the changed files from stdin, one per line: a large change (a tree move) exceeds the Windows command line
// (about 32K characters), where passing them as arguments fails before node starts.
if (isMain(import.meta.url)) {
  const [root, ...args] = process.argv.slice(2);
  const changed = args.includes('-')
    ? [...args.filter((a) => a !== '-'), ...fs.readFileSync(0, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)]
    : args;
  const specs = walkFiles(path.join(root, 'tests'), { sorted: true, filter: (name) => name.endsWith('.spec.mjs'), exclude: (name) => name === 'node_modules' })
    .map((file) => path.relative(root, file).split(path.sep).join('/'));
  for (const spec of specsDependingOn(path.resolve(root), changed, specs)) console.log(spec);
}
