// Producers of returned arrays include writes through aliases and invoked parameters.
import { astChildren, nodeName, resolvedExpression } from './coverage-ast.mjs';
import { bindPattern, evaluate, invocation, localScope, UNKNOWN } from './coverage-evaluation.mjs';

const callable = (node) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
const callbackMethods = new Set(['forEach', 'map', 'filter', 'some', 'every', 'find']);

function sameCollector(context, index, node, collector) {
  return resolvedExpression(context, index, node).node === collector;
}

function invokedCallback(context, index, node) {
  const method = nodeName(node.callee.property);
  const promise = node.type === 'NewExpression' && node.callee.name === 'Promise'
    && !index.bindings.has('Promise') && !index.locals?.has('Promise') && !index.imports.has('Promise');
  const array = resolvedExpression(context, index, node.callee.object).node;
  if (!promise && !(array?.type === 'ArrayExpression' && array.elements.length && callbackMethods.has(method))) return null;
  const callback = resolvedExpression(context, index, node.arguments[0]);
  if (!callable(callback.node)) return null;
  const scope = localScope(callback.index);
  for (const parameter of callback.node.params) bindPattern(context, scope, parameter,
    { index: scope, node: { type: 'Literal', value: UNKNOWN } });
  return { index: scope, node: callback.node };
}

function visitCall(context, index, node, state, stack) {
  const receiver = node.callee.type === 'MemberExpression' && node.callee.object;
  if (receiver && sameCollector(context, index, receiver, state.collector)) {
    if (nodeName(node.callee.property) === 'push') {
      for (const argument of node.arguments) state.writes.push({ index: localScope(index), node: argument });
    } else state.unsafe = true;
  }
  const target = invocation(context, index, node) ?? invokedCallback(context, index, node);
  if (target && !stack.has(target.node)) {
    walk(context, localScope(target.index), target.node.body, state, new Set(stack).add(target.node));
  }
}

function declare(context, index, node) {
  for (const entry of node.declarations) bindPattern(context, index, entry.id,
    { index: localScope(index), node: entry.init });
}

function assignment(context, index, node, state) {
  const left = node.left ?? node.argument;
  const receiver = left.type === 'MemberExpression' ? left.object : left;
  if (sameCollector(context, index, receiver, state.collector)) state.unsafe = true;
  if (left.type === 'Identifier' && node.type === 'AssignmentExpression') bindPattern(context, index, left,
    { index: localScope(index), node: node.right });
}

function walk(context, index, node, state, stack) {
  if (!node || callable(node)) return false;
  if (node.type === 'BlockStatement') return walkBlock(context, index, node, state, stack);
  if (node.type === 'VariableDeclaration') declare(context, index, node);
  if (node.type === 'IfStatement') return walkBranch(context, index, node, state, stack);
  if (node.type === 'ForOfStatement') return walkLoop(context, index, node, state, stack);
  if (['AssignmentExpression', 'UpdateExpression'].includes(node.type)) assignment(context, index, node, state);
  if (['CallExpression', 'NewExpression'].includes(node.type)) visitCall(context, index, node, state, stack);
  for (const child of astChildren(node)) walk(context, index, child, state, stack);
  return ['ReturnStatement', 'ThrowStatement'].includes(node.type);
}

function walkBlock(context, index, node, state, stack) {
  const scope = localScope(index);
  for (const statement of node.body) if (walk(context, scope, statement, state, stack)) return true;
  return false;
}

function walkLoop(context, index, node, state, stack) {
  const values = evaluate(context, index, node.right);
  if (Array.isArray(values) && values.length === 0) return false;
  const scope = localScope(index);
  bindPattern(context, scope, node.left.declarations?.[0]?.id ?? node.left,
    { index: scope, node: { type: 'Literal', value: UNKNOWN } });
  walk(context, scope, node.body, state, stack);
  return false;
}

function walkBranch(context, index, node, state, stack) {
  const condition = evaluate(context, index, node.test);
  if (condition === UNKNOWN) {
    const consequent = walk(context, localScope(index), node.consequent, state, stack);
    const alternate = walk(context, localScope(index), node.alternate, state, stack);
    return consequent && alternate;
  }
  return walk(context, index, condition ? node.consequent : node.alternate, state, stack);
}

/** Only writes to the exact returned array count; unused callbacks and other arrays stay opaque. */
export function collectorExpressions(context, target, returns) {
  const collectors = new Set(returns.map((entry) => resolvedExpression(context, entry.index, entry.node).node)
    .filter((node) => node?.type === 'ArrayExpression'));
  const out = [];
  for (const collector of collectors) {
    const state = { collector, writes: [], unsafe: false };
    walk(context, localScope(target.index), target.node.body, state, new Set([target.node]));
    if (!state.unsafe) out.push(...state.writes);
  }
  return out;
}
