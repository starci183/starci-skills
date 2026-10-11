// affected-walk.mjs - follows one changed symbol through the import graph, by name, to the specs that can see it.
//
// The graph is made of module indexes (scripts/lib/module-index.mjs). A symbol `f` of module X is consumed by every module that imports `f` from X by name,
// imports X as a namespace or default and reads `f` through it, re-exports it, or reaches X in a way the walk cannot narrow (a literal import() or
// require(), a path to X that a process is spawned from). A spec that consumes the symbol is selected. Any other module M that consumes it makes every
// declaration of M that uses the import changed, and so every exported name that reaches one of those declarations is demanded in turn (callers of
// callers). Where the walk cannot be exact - a module-level statement of M uses the symbol, or the depth bound is reached - M is a FALLBACK file: the
// caller applies today's file-level rule to it, so nothing is dropped.
import { exportsOf, usersClosure, usesLocal } from '../lib/module-index.mjs';

const keyOf = (file, name) => `${file}\0${name}`;

// Whether a link into the module whose symbol `name` is demanded consumes that symbol.
function reaches(link, name) {
  if (link.kind === 'import') return link.imported === name || link.imported === '*';
  if (link.kind === 'reexport') return link.imported === name || (link.imported === '*' && (link.exported !== null || name !== 'default'));
  return true;
}

const exportedAs = (link, name) => (link.imported === '*' ? (link.exported ?? name) : link.exported);

/** The declarations (names) of a module's index that use what the link brings in for the demanded `name`, and whether a module-level statement does. */
function usersOf(index, link, name) {
  if (link.kind !== 'import') {
    const owner = link.owner === null ? null : index.decls.get(link.owner);
    return { decls: owner ? [owner.name] : [], moduleLevel: link.owner === null };
  }
  const member = link.imported === '*' ? name : null;
  const decls = [...index.decls.values()].filter((decl) => usesLocal(decl, link.local, member)).map((decl) => decl.name);
  return { decls, moduleLevel: usesLocal(index.module, link.local, member) };
}

function selectSpec(walk, link, node, depth) {
  const index = walk.graph.byFile.get(link.from);
  const sees = link.kind !== 'import' || link.imported !== '*' || [...index.decls.values(), index.module].some((uses) => usesLocal(uses, link.local, node.name));
  if (!sees || walk.out.specs.has(link.from)) return;
  const why = depth === 0 ? link.kind : 'caller-chain';
  walk.out.specs.set(link.from, { why, via: node.via });
}

function demand(walk, file, name, node, depth) {
  const key = keyOf(file, name);
  if (walk.seen.has(key)) return;
  walk.seen.add(key);
  walk.out.touched.add(file);
  if (depth + 1 >= walk.maxDepth) fallback(walk, file, `the depth bound ${walk.maxDepth} is reached at ${file}#${name}`);
  else walk.next.push({ file, name, via: [...node.via, `${file}#${name}`] });
}

function fallback(walk, file, why) {
  walk.out.touched.add(file);
  if (!walk.out.fallbacks.has(file)) walk.out.fallbacks.set(file, why);
}

function consumeInModule(walk, link, node, depth) {
  const index = walk.graph.byFile.get(link.from);
  walk.out.touched.add(link.from);
  const users = usersOf(index, link, node.name);
  const reached = usersClosure(index, users.decls);
  const reexportedLocal = link.kind === 'import' ? new Set([link.local]) : new Set();
  for (const alias of exportsOf(index, new Set([...reached, ...reexportedLocal]))) demand(walk, link.from, alias, node, depth);
  if (users.moduleLevel || [...reached].some((name) => usesLocal(index.module, name))) fallback(walk, link.from, `a module-level statement of ${link.from} uses ${node.file}#${node.name}`);
}

function consume(walk, link, node, depth) {
  if (walk.isSpec(link.from)) selectSpec(walk, link, node, depth);
  else if (link.kind === 'reexport') demand(walk, link.from, exportedAs(link, node.name), node, depth);
  else consumeInModule(walk, link, node, depth);
}

/**
 * The reach of symbol `name` of module `file`. `graph` = {byFile: Map file -> module index, importers: Map file -> [link]} (affected-graph.mjs), `isSpec(file)`,
 * `maxDepth` the declared bound of the caller chain. Returns {specs: Map spec file -> {why: import|dynamic|spawn|reexport|caller-chain, via: ['file#name', ...]},
 * fallbacks: Map file -> why, touched: Set of the modules the symbol reaches (the symbol's own module included)}.
 */
export function walkSymbol({ graph, isSpec, file, name, maxDepth }) {
  const out = { specs: new Map(), fallbacks: new Map(), touched: new Set([file]) };
  const walk = { graph, isSpec, maxDepth, out, seen: new Set([keyOf(file, name)]), next: [] };
  let level = [{ file, name, via: [`${file}#${name}`] }];
  for (let depth = 0; level.length; depth += 1) {
    walk.next = [];
    for (const node of level) {
      for (const link of graph.importers.get(node.file) ?? []) if (reaches(link, node.name)) consume(walk, link, node, depth);
    }
    level = walk.next;
  }
  return out;
}
