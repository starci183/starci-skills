// alias/alias.json is a tree: one root per zone (@workspaces, @grammar, @knowledge, @worktrees,
// @remote, @dynamic), children by path segment, and a node is a definition when it carries
// `resolvesTo`. This module is the one place the tree is flattened to `@root/segment/...` keys, so
// the validator and the generator cannot disagree about what an alias is called.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// `helperWritable` is the registry's own answer to "may the support layer write here": it is the one
// home of the support write set, so scripts/validate-helper.mjs asks alias.json rather than carrying a
// second list of locations a helper may touch.
export const DEF_KEYS = new Set(['params', 'kind', 'resolvesTo', 'scheme', 'bind', 'writers', 'purpose', 'note', 'helperWritable']);

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
  // @tools/<id> is what an operator may call, not read; it comes from resources/tools.json so a Steps cell can
  // name a tool next to the aliases it reads and the same resolver answers both.
  const toolsDoc = JSON.parse(await readFile(path.join(root, 'resources', 'tools.json'), 'utf8'));
  const tools = {};
  for (const [id, tool] of Object.entries(toolsDoc.tools ?? {})) {
    tools[`@tools/${id}`] = { params: [], kind: 'tool', resolvesTo: `resources/tools.json#tools.${id}`, scheme: `tool://${id}`, bind: `mode declared in operator.json → resources.tools; modes: ${Object.keys(tool.modes).join(' | ')}`, writers: [], purpose: tool.purpose, zone: 'tools', support: tool.support };
  }
  return { schemaVersion: raw.schemaVersion, note: raw.note, zones: raw.zones ?? {}, segments: raw.segments ?? {}, aliases: { ...aliases, ...tools }, tree: raw.tree ?? {}, tools };
}

export const baseOf = (aliases, alias) => Object.keys(aliases).filter((k) => alias === k || alias.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
