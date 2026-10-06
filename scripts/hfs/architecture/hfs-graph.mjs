import { canonical } from './config.mjs';
import { relativePath } from './typescript.mjs';

/**
 * The file and owner graph the HFS architecture checks share. Every production source file the TypeScript context
 * loaded becomes a node classified by the slot manifest (config.hfs is the resolver of scripts/hfs/slots.mjs);
 * every import, re-export and type-only import between two of them becomes an edge. Nothing here judges: the checks
 * in tiers.mjs, reachability.mjs, dead-exports.mjs, required-files.mjs and clones.mjs read it.
 *
 *   graph.profile            'be' | 'fe'
 *   graph.resolver           the slot resolver (config.hfs)
 *   graph.files              Map<rel, {abs, rel, slot, status, tier, owner, sourceFile}>   owner: {slot, root, bindings} | null
 *   graph.edges              [{from, to, runtime, line, column, specifier, reexport, edge}]  (rel paths, both in graph.files)
 *   graph.unit(rel)          the owner unit key ("<slot>:<root>") of a file: its owner, else its slot instance
 *   graph.ownerRoots         Map<unitKey, {slot, root, tier}> of every owner instance that holds a graph file
 *   graph.abs(file)          the repository-relative path of an absolute file the graph holds, else null
 */
// Every production source file the TypeScript context loaded, as a graph.files node keyed by its repository-relative path.
const collectFiles = (config, context, resolver) => {
  const files = new Map();
  const absolute = new Map();
  for (const sourceFile of context.files) {
    const file = canonical(sourceFile.fileName);
    const rel = relativePath(config.root, file);
    if (rel.startsWith('..')) continue;
    const classified = resolver.classifyPath(rel);
    files.set(rel, {
      abs: file,
      rel,
      slot: classified.slot ?? null,
      status: classified.status,
      tier: classified.slot ? resolver.tierOf(rel) : null,
      owner: classified.slot ? resolver.ownerOf(rel) : null,
      sourceFile,
    });
    absolute.set(file, rel);
  }
  return { files, absolute };
};

// Every import, re-export and type-only import between two graphed files, as rel-path edges.
const collectEdges = (context, absolute) => {
  const edges = [];
  for (const [file, list] of context.edges) {
    const from = absolute.get(file);
    if (!from) continue;
    for (const edge of list) {
      const to = absolute.get(edge.to);
      if (!to || to === from) continue;
      edges.push({ from, to, runtime: edge.runtime, line: edge.line, column: edge.column, specifier: edge.specifier, reexport: Boolean(edge.reexport), edge });
    }
  }
  return edges;
};

export function buildHfsGraph(config, context) {
  const resolver = config.hfs;
  const { files, absolute } = collectFiles(config, context, resolver);
  const edges = collectEdges(context, absolute);
  const unit = rel => {
    const node = files.get(rel);
    if (!node) return null;
    if (node.owner) return `${node.owner.slot}:${node.owner.root}`;
    const classified = resolver.classifyPath(rel);
    return classified.slot ? `${classified.slot}:${classified.root}` : null;
  };
  const ownerRoots = new Map();
  for (const node of files.values()) if (node.owner) {
    const key = `${node.owner.slot}:${node.owner.root}`;
    if (!ownerRoots.has(key)) ownerRoots.set(key, { slot: node.owner.slot, root: node.owner.root, tier: resolver.slot(node.owner.slot).tier });
  }
  return { profile: resolver.repo.profile, resolver, files, edges, unit, ownerRoots, abs: file => absolute.get(file) ?? null };
}
