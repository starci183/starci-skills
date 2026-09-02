// alias/alias.json is a tree: one root per zone (@workspaces, @grammar, @knowledge, @worktrees,
// @remote, @dynamic), children by path segment, and a node is a definition when it carries
// `resolvesTo`. This module is the one place the tree is flattened to `@root/segment/...` keys, so
// the validator and the generator cannot disagree about what an alias is called.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const DEF_KEYS = new Set(['params', 'kind', 'resolvesTo', 'scheme', 'bind', 'writers', 'purpose', 'note']);

export async function loadAliasRegistry(root) {
  const raw = JSON.parse(await readFile(path.join(root, 'alias', 'alias.json'), 'utf8'));
  const aliases = {};
  const walk = (node, prefix, zone) => {
    if (node.resolvesTo !== undefined) aliases[prefix] = { ...Object.fromEntries(Object.entries(node).filter(([k]) => DEF_KEYS.has(k))), zone };
    for (const [key, child] of Object.entries(node)) {
      if (DEF_KEYS.has(key) || typeof child !== 'object' || child === null || Array.isArray(child)) continue;
      walk(child, `${prefix}/${key}`, zone);
    }
  };
  for (const [rootKey, node] of Object.entries(raw.tree ?? {})) walk(node, rootKey, rootKey.slice(1));
  return { schemaVersion: raw.schemaVersion, note: raw.note, zones: raw.zones ?? {}, segments: raw.segments ?? {}, aliases, tree: raw.tree ?? {} };
}

export const baseOf = (aliases, alias) => Object.keys(aliases).filter((k) => alias === k || alias.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
