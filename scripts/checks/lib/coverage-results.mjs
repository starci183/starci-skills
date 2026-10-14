// Trace the value an assertion consumes, including parameters of invoked test helpers.
import { astChildren, expressionReach, nodeName, resolvedExpression, sourceIndex } from './coverage-ast.mjs';
import { invocation, scopedWalk, testHelper } from './coverage-evaluation.mjs';

export function returnedExpressions(context, target) {
  if (target.node.body.type !== 'BlockStatement') return [{ index: target.index, node: target.node.body }];
  const out = [];
  scopedWalk(context, target.index, target.node.body, (index, node) => {
    if (node.type === 'ReturnStatement') { if (node.argument) out.push({ index, node: node.argument }); return false; }
    return node.type !== 'CallExpression';
  });
  return out;
}

function callDependencies(context, current, helpersOnly) {
  const target = invocation(context, current.index, current.node);
  if (!target) return builtinDependencies(current);
  if (current.stack.has(target.node)) return [];
  const stack = new Set(current.stack).add(target.node);
  if (testHelper(target.index)) return [target, ...returnedExpressions(context, target)].map((entry) => ({ ...entry, stack }));
  if (helpersOnly) return [];
  return [...expressionReach(context, target.index, target.node)].flatMap(([file, nodes]) => nodes.map((node) => ({
    index: file === target.index.file ? target.index : sourceIndex(context, file), node, stack, terminal: true,
  })));
}

function builtinDependencies(current) {
  const out = astChildren(current.node).map((node) => ({ ...current, node }));
  if (!['map', 'filter', 'some', 'every', 'find'].includes(nodeName(current.node.callee.property))) return out;
  for (const argument of current.node.arguments) {
    if (['ArrowFunctionExpression', 'FunctionExpression'].includes(argument.type)) out.push({ ...current, node: argument.body });
  }
  return out;
}

function resultDependencies(context, current, helpersOnly) {
  if (current.terminal) return [];
  const resolved = resolvedExpression(context, current.index, current.node);
  if (resolved.node !== current.node && resolved.node) return [{ ...current, ...resolved }];
  if (current.node.type === 'CallExpression') return callDependencies(context, current, helpersOnly);
  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(current.node.type)) return [];
  return astChildren(current.node).map((child) => ({ ...current, node: child }));
}

export function resultReach(context, index, node, { helpersOnly = false } = {}) {
  const out = new Map();
  const pending = node ? [{ index, node, stack: new Set() }] : [];
  const seen = new WeakMap();
  while (pending.length) {
    const current = pending.pop();
    const scopes = seen.get(current.node) ?? new Set();
    if (scopes.has(current.index)) continue;
    scopes.add(current.index);
    seen.set(current.node, scopes);
    const nodes = out.get(current.index.file) ?? [];
    nodes.push(current.node);
    out.set(current.index.file, nodes);
    for (const dependency of resultDependencies(context, current, helpersOnly)) pending.push(dependency);
  }
  return out;
}
