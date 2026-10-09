// engine-loaded.mjs — the files the long-lived engine process loads, derived from the import graph of the entries modules/kernel/revision-scope.yaml
// declares (`engineEntries`): everything reachable through static and literal dynamic imports. A process the engine only spawns is not loaded by it.
import { globExpression } from '../lib/glob.mjs';
import { buildGraph, readModules } from './affected-graph.mjs';

/** The engine entries that exist in the tree at `root` and the set of files reachable from them: {entries, loaded}. */
export function engineLoadedSet(root, doc) {
  const modules = readModules(root);
  const files = modules.map((m) => m.file);
  const entries = doc.engineEntries.flatMap((entry) => files.filter((file) => globExpression(entry).test(file)));
  const { importers } = buildGraph({ root, modules });
  const forward = new Map();
  for (const links of importers.values()) {
    for (const link of links.filter((l) => l.kind !== 'spawn')) forward.set(link.from, [...(forward.get(link.from) ?? []), link.target]);
  }
  const loaded = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (loaded.has(file)) continue;
    loaded.add(file);
    stack.push(...(forward.get(file) ?? []));
  }
  return { entries, loaded };
}

/** A predicate over the engine-loaded set, which is derived from the import graph the first time a file is asked about. */
export function engineLoadedPredicate(root, doc) {
  let loaded = null;
  return (file) => {
    loaded ??= engineLoadedSet(root, doc).loaded;
    return loaded.has(file);
  };
}
