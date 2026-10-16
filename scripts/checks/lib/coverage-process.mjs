// A Node subprocess contributes evidence only through its consumed result.
import path from 'node:path';
import { expressionReach, nodeName, resolvedExpression, sourceIndex } from './coverage-ast.mjs';

function importedCall(index, node, source, name) {
  const callee = node?.callee;
  if (!callee) return false;
  const local = callee.name ?? callee.object?.name;
  if (index.locals?.has(local) || index.bindings.has(local)) return false;
  const imported = index.imports.get(local);
  return imported?.source === source && (imported.name === name
    || (['*', 'default'].includes(imported.name) && nodeName(callee.property) === name));
}

function scriptPath(context, index, node, seen = new Set()) {
  if (!node || seen.has(node)) return null;
  const next = new Set(seen).add(node);
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node !== node) return scriptPath(context, resolved.index, resolved.node, next);
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (importedCall(index, node, 'node:url', 'fileURLToPath')) return scriptPath(context, index, node.arguments[0], next);
  return moduleUrlPath(index, node);
}

function moduleUrlPath(index, node) {
  if (node.type !== 'NewExpression' || node.callee.name !== 'URL') return null;
  if (index.bindings.has('URL') || index.locals?.has('URL')) return null;
  const [relative, base] = node.arguments;
  if (relative?.type !== 'Literal' || typeof relative.value !== 'string'
    || base?.type !== 'MemberExpression' || nodeName(base.property) !== 'url' || base.object.type !== 'MetaProperty') return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(index.file), relative.value));
}

function entryReach(context, file) {
  const source = sourceIndex(context, file);
  const reached = new Map();
  for (const statement of source.tree?.body ?? []) {
    if (!['ExpressionStatement', 'IfStatement', 'TryStatement'].includes(statement.type)) continue;
    for (const [target, nodes] of expressionReach(context, source, statement)) {
      reached.set(target, [...reached.get(target) ?? [], ...nodes]);
    }
  }
  return reached;
}

export function subprocessReach(context, index, node) {
  if (!importedCall(index, node, 'node:child_process', 'spawnSync')) return null;
  const executable = resolvedExpression(context, index, node.arguments[0]).node;
  if (executable?.type !== 'MemberExpression' || executable.object.name !== 'process'
    || nodeName(executable.property) !== 'execPath' || index.bindings.has('process') || index.locals?.has('process')) return null;
  const args = resolvedExpression(context, index, node.arguments[1]);
  if (args.node?.type !== 'ArrayExpression') return null;
  const file = scriptPath(context, args.index, args.node.elements[0]);
  if (!file || file.startsWith('-') || !context.files.has(file)) return null;
  return entryReach(context, file);
}
