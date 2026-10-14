// Trace the value an assertion consumes, including parameters of invoked test helpers.
import { astChildren, expressionReach, nodeName, resolvedExpression, sourceIndex } from './coverage-ast.mjs';
import { invocation, scopedWalk, testHelper } from './coverage-evaluation.mjs';

function returnedExpressions(context, target) {
  if (target.node.body.type !== 'BlockStatement') return [{ index: target.index, node: target.node.body }];
  const out = [];
  scopedWalk(context, target.index, target.node.body, (index, node) => {
    if (node.type === 'ReturnStatement') { if (node.argument) out.push({ index, node: node.argument }); return false; }
    return node.type !== 'CallExpression';
  });
  return out;
}

function callDependencies(context, current, { helpersOnly, code }) {
  const target = resolvedExpression(context, current.index, current.node.callee);
  if (!['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(target.node?.type)) return builtinDependencies(current);
  if (current.stack.has(target.node)) return [];
  const stack = new Set(current.stack).add(target.node);
  if (testHelper(target.index)) return returnedDependencies(context, invocation(context, current.index, current.node), stack);
  if (helpersOnly) return [];
  const reached = expressionReach(context, sourceIndex(context, target.index.file), target.node);
  const emitsCode = reached.get(target.index.file)?.some((node) => node.type === 'Literal' && typeof node.value === 'string' && node.value.includes(code));
  if (code && !emitsCode) return returnedDependencies(context, invocation(context, current.index, current.node), stack);
  return [...reached].flatMap(([file, nodes]) => nodes.map((node) => ({
    index: sourceIndex(context, file), node, stack, terminal: true,
  })));
}

function returnedDependencies(context, target, stack) {
  return [target, ...returnedExpressions(context, target)].map((entry) => ({ ...entry, stack }));
}

function builtinDependencies(current) {
  const out = astChildren(current.node).map((node) => ({ ...current, node }));
  if (!['map', 'filter', 'some', 'every', 'find'].includes(nodeName(current.node.callee.property))) return out;
  for (const argument of current.node.arguments) {
    if (['ArrowFunctionExpression', 'FunctionExpression'].includes(argument.type)) out.push({ ...current, node: argument.body });
  }
  return out;
}

function appendPending(pending, entries) {
  for (const entry of entries) pending.push(entry);
}

function resultDependencies(context, current, options) {
  if (current.terminal) return [];
  const resolved = resolvedExpression(context, current.index, current.node);
  if (resolved.node !== current.node && resolved.node) return [{ ...current, ...resolved }];
  if (current.node.type === 'CallExpression') return callDependencies(context, current, options);
  if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(current.node.type)) return [];
  return astChildren(current.node).map((child) => ({ ...current, node: child }));
}

export function resultReach(context, index, node, { helpersOnly = false, code } = {}) {
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
    appendPending(pending, resultDependencies(context, current, { helpersOnly, code }));
  }
  return out;
}
