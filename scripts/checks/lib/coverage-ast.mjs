// Cached authored-source trees shared by proof and routing evidence checks.
import path from 'node:path';
import { createRequire } from 'node:module';
import { skillRoot } from '../../../engine/runtime-root.mjs';

const acorn = createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js'))('acorn');
const caches = new WeakMap();
export const nodeName = (node) => node?.name ?? node?.value;
export const astChildren = (node) => Object.values(node ?? {}).flatMap((value) => Array.isArray(value) ? value : [value])
  .filter((value) => value && typeof value === 'object' && typeof value.type === 'string');

export function astNodes(node) {
  const out = [];
  const pending = node ? [node] : [];
  while (pending.length) {
    const next = pending.pop();
    out.push(next);
    for (const child of astChildren(next)) pending.push(child);
  }
  return out;
}

/** A published package carries a byte copy of runtime files under runtime/ (sync-runtime.mjs); an import of the copy is an import of its original. */
const BUNDLED_COPY = /^packages\/(?:hfs|eslint\/(?:be|fe))\/runtime\//;

export function sourcePath(files, file, source) {
  if (typeof source !== 'string' || !source.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), source));
  const candidates = [base, `${base}.mjs`, `${base}/index.mjs`];
  return [...candidates, ...candidates.map((candidate) => candidate.replace(BUNDLED_COPY, ''))].find((candidate) => files.has(candidate)) ?? null;
}

function importsOf(tree, file, files) {
  const imports = new Map();
  for (const entry of tree?.body ?? []) {
    if (entry.type !== 'ImportDeclaration') continue;
    for (const specifier of entry.specifiers) imports.set(specifier.local.name, {
      source: entry.source.value, file: sourcePath(files, file, entry.source.value),
      name: nodeName(specifier.imported) ?? 'default', namespace: specifier.type === 'ImportNamespaceSpecifier',
    });
  }
  return imports;
}

function bindingsOf(tree) {
  const bindings = new Map();
  for (const node of astNodes(tree)) {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') bindings.set(node.id.name, node.init);
    if (node.type === 'FunctionDeclaration' && node.id) bindings.set(node.id.name, node);
  }
  return bindings;
}

function constantsOf(tree) {
  const declarations = new Map();
  for (const node of astNodes(tree)) {
    if (node.type !== 'VariableDeclaration') continue;
    for (const entry of node.declarations) {
      if (entry.id.type !== 'Identifier') continue;
      const name = entry.id.name;
      declarations.set(name, !declarations.has(name) && node.kind === 'const');
    }
  }
  for (const name of shadowedConstants(tree)) declarations.set(name, false);
  return new Set([...declarations].filter(([, constant]) => constant).map(([name]) => name));
}

function shadowedConstants(tree) {
  const names = new Set();
  const owners = constantOwners(tree);
  for (const node of astNodes(tree)) {
    const patterns = [...node.params ?? []];
    if (node.type === 'CatchClause') patterns.push(node.param);
    if (node.type === 'VariableDeclarator' && node.id.type !== 'Identifier') patterns.push(node.id);
    for (const identifier of patterns.flatMap(astNodes).filter(entry => entry.type === 'Identifier')) {
      const owner = owners.get(identifier.name);
      if (owner && node.start >= owner.start && node.end <= owner.end) names.add(identifier.name);
    }
  }
  return names;
}

function constantOwners(tree) {
  const nodes = astNodes(tree);
  const functions = nodes.filter(node => Array.isArray(node.params));
  const owners = new Map();
  for (const node of nodes.filter(entry => entry.type === 'VariableDeclarator' && entry.id.type === 'Identifier')) {
    const enclosing = functions.filter(fn => fn.start <= node.start && fn.end >= node.end);
    enclosing.sort((a, b) => (a.end - a.start) - (b.end - b.start));
    owners.set(node.id.name, enclosing[0] ?? tree);
  }
  return owners;
}

function exportsOf(tree) {
  const exports = new Map();
  for (const node of tree?.body ?? []) {
    if (node.type === 'ExportDefaultDeclaration') exports.set('default', node.declaration);
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration?.id) exports.set(node.declaration.id.name, node.declaration);
    for (const declaration of node.declaration?.declarations ?? []) exports.set(nodeName(declaration.id), declaration.init);
    for (const specifier of node.specifiers ?? []) exports.set(nodeName(specifier.exported), { type: 'Identifier', name: nodeName(specifier.local) });
  }
  return exports;
}

export function sourceIndex(context, file) {
  let cache = caches.get(context.files);
  if (!cache) { cache = new Map(); caches.set(context.files, cache); }
  const text = String(context.files.get(file) ?? '');
  const previous = cache.get(file);
  if (previous?.text === text) return previous;
  let tree;
  try { tree = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); } catch { tree = null; }
  const index = { file, text, tree, imports: importsOf(tree, file, context.files), bindings: bindingsOf(tree), constants: constantsOf(tree), exports: exportsOf(tree), reaches: new WeakMap() };
  cache.set(file, index);
  return index;
}

/** Resolve a local constant or import, preserving the module that owns its expression. */
export function resolvedExpression(context, index, node, seen = new Set()) {
  if (node?.type === 'MemberExpression' && (!node.computed || node.property.type === 'Literal')) {
    const object = resolvedExpression(context, index, node.object, seen);
    const property = object.node?.properties?.find((entry) => nodeName(entry.key) === nodeName(node.property));
    if (property) return resolvedExpression(context, object.index, property.value, seen);
  }
  if (node?.type !== 'Identifier') return { index, node };
  const local = index.locals?.get(node.name);
  if (local && local.node !== node) return resolvedExpression(context, local.index, local.node, seen);
  const key = `${index.file}:${node.name}`;
  if (seen.has(key)) return { index, node };
  seen.add(key);
  const imported = index.imports.get(node.name);
  if (imported?.file) {
    const target = sourceIndex(context, imported.file);
    return resolvedExpression(context, target, target.exports.get(imported.name), seen);
  }
  return resolvedExpression(context, index, index.bindings.get(node.name) ?? node, seen);
}

export function objectProperties(context, index, node) {
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node?.type !== 'ObjectExpression') return [];
  return resolved.node.properties.filter((entry) => entry.type === 'Property').map((entry) => ({
    name: nodeName(entry.key), node: entry.value, index: resolved.index,
  }));
}

export const propertyOf = (context, index, node, name) => objectProperties(context, index, node).find((entry) => entry.name === name);

export function staticValues(context, index, node) {
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node?.type === 'Literal') return [resolved.node.value];
  if (resolved.node?.type !== 'ArrayExpression') return [];
  return resolved.node.elements.flatMap((entry) => {
    const element = entry?.type === 'SpreadElement' ? entry.argument : entry;
    return staticValues(context, resolved.index, element);
  });
}

function reachableChildren(context, current) {
  const invokesCallback = ['CallExpression', 'NewExpression'].includes(current.node.type);
  const children = astChildren(current.node).filter((node) => invokesCallback
    || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type))
    .map((node) => ({ index: current.index, node }));
  if (!['Identifier', 'MemberExpression'].includes(current.node.type)) return children;
  const resolved = resolvedExpression(context, current.index, current.node);
  if (resolved.node === current.node || !resolved.node) return children;
  return current.node.type === 'MemberExpression' ? [resolved] : [resolved, ...children];
}

/** Modules reached through an invoked helper or an assertion's result expression. */
export function expressionReach(context, index, node) {
  const previous = index.locals ? null : node && index.reaches.get(node);
  if (previous?.sources.every((source) => context.files.get(source.file) === source.text)) return previous.reached;
  const out = new Map();
  const seen = new Set();
  const pending = node ? [{ index, node }] : [];
  while (pending.length) {
    const current = pending.pop();
    const key = [current.index.file, current.node.type, current.node.start, current.node.end, current.node.name ?? ''].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    const nodes = out.get(current.index.file) ?? [];
    nodes.push(current.node);
    out.set(current.index.file, nodes);
    for (const child of reachableChildren(context, current)) pending.push(child);
  }
  if (node && !index.locals) index.reaches.set(node, { reached: out, sources: [...out.keys()].map((file) => sourceIndex(context, file)) });
  return out;
}
