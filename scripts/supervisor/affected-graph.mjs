// affected-graph.mjs - the module graph a symbol-level selection walks: every `.mjs` module of the repository, indexed, with the links between them.
//
// A link is one way module `from` reaches module `target`: `import` (a named, default or namespace binding), `reexport`, `dynamic` (a literal import() or
// require()) and `spawn` (a runtime entry path the module starts as a process, the same strings spec-deps.mjs follows). `owner` is the declaration the
// link sits in, or null for a module-level statement. Only relative specifiers resolve inside the repository; a package specifier is no link. A generated
// module (the CLI catalog) names handler paths as data: the verb rule of land-cli-specs.mjs is the rule for that edge, so it has no dynamic or spawn link.
import fs from 'node:fs';
import path from 'node:path';
import { indexModule } from '../lib/module-index.mjs';
import { resolveRelative } from '../lib/spec-deps.mjs';
import { walkFiles } from '../lib/walk.mjs';

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.runtime', 'examples', 'docs']);
const GENERATED_MODULE = /\.generated\.mjs$/;
const GENERATED_COPY = /^packages\/[^/]+(\/[^/]+)?\/runtime\//;
const posix = (file) => String(file).replaceAll(path.sep, '/');

/** [{file, text}] for every `.mjs` module below `root` (repository-relative posix `file`): no node_modules, no example app, no generated runtime copy of a package. */
export function readModules(root) {
  return walkFiles(root, { sorted: true, filter: (name) => name.endsWith('.mjs'), exclude: (name) => SKIPPED_DIRS.has(name) })
    .map((abs) => posix(path.relative(root, abs)))
    .filter((file) => !GENERATED_COPY.test(file))
    .map((file) => ({ file, text: readText(path.join(root, file)) }));
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function linksOf({ file, index, resolve }) {
  const links = [];
  const add = (source, link) => {
    const target = source === null ? null : resolve(file, source);
    if (target) links.push({ from: file, target, ...link });
  };
  for (const [local, binding] of index.imports) add(binding.source, { kind: 'import', imported: binding.imported, local });
  for (const entry of index.reexports) add(entry.source, { kind: 'reexport', imported: entry.imported, exported: entry.exported });
  if (GENERATED_MODULE.test(file)) return links;
  const owned = [...[...index.decls.values()].map((decl) => [decl.name, decl]), [null, index.module]];
  for (const [owner, uses] of owned) {
    for (const dynamic of uses.dynamics) add(dynamic.source, { kind: 'dynamic', owner });
    for (const spawned of uses.spawns) add(`./${path.posix.relative(path.posix.dirname(file), spawned)}`, { kind: 'spawn', owner });
  }
  return links;
}

/** The graph of `modules` ([{file, text}]): {byFile: Map file -> module index (a module that does not parse has none), importers: Map target file -> [link]}. */
export function buildGraph({ root, modules }) {
  const known = new Set(modules.map((entry) => entry.file));
  const resolve = (file, source) => resolveRelative(root, path.join(root, file), source, (candidate) => known.has(posix(path.relative(root, candidate))));
  const byFile = new Map();
  const importers = new Map();
  for (const { file, text } of modules) {
    const index = indexModule(text);
    if (!index) continue;
    byFile.set(file, index);
    for (const link of linksOf({ file, index, resolve })) importers.set(link.target, [...(importers.get(link.target) ?? []), link]);
  }
  return { byFile, importers };
}
