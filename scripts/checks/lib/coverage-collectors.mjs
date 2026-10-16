// Producers of returned arrays include writes through aliases and invoked parameters.
import { astChildren, astNodes, nodeName, resolvedExpression, sourceIndex, sourcePath } from './coverage-ast.mjs';
import { bindPattern, declareBindings, evaluate, invocation, localScope, UNKNOWN } from './coverage-evaluation.mjs';
import { returnedExpressions } from './coverage-results.mjs';

const callable = (node) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
const callbackMethods = new Set(['forEach', 'map', 'filter', 'some', 'every', 'find']);

function facadeTarget(context, index, name, visited = new Set()) {
  const key = `${index.file}#${name}`;
  if (visited.has(key)) return null;
  visited.add(key);
  const entry = index.tree?.body.find(item => item.type === 'ExportNamedDeclaration' && item.source
    && item.specifiers.some(specifier => nodeName(specifier.exported) === name));
  const file = entry && sourcePath(context.files, index.file, entry.source.value);
  if (!file) return null;
  const next = sourceIndex(context, file);
  const specifier = entry.specifiers.find(item => nodeName(item.exported) === name);
  const local = nodeName(specifier.local);
  const resolved = resolvedExpression(context, next, next.exports.get(local));
  return callable(resolved.node) ? resolved : facadeTarget(context, next, local, visited);
}

/** Resolve named relative facades only while tracing a consumed emitted value. */
export function collectorFacadeInvocation(context, index, node) {
  const imported = index.imports.get(node.callee.name);
  if (!imported?.file || index.locals?.has(node.callee.name)) return null;
  const target = facadeTarget(context, sourceIndex(context, imported.file), imported.name);
  if (!target) return null;
  const scope = localScope(index);
  scope.locals.set(node.callee.name, target);
  return invocation(context, scope, node);
}

function sameCollector(context, index, node, collector) {
  return resolvedExpression(context, index, node).node === collector;
}

function consumesCollectors(context, index, node, collectors) {
  const pending = [{ index, node }];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current.node || seen.has(current.node)) continue;
    seen.add(current.node);
    const resolved = resolvedExpression(context, current.index, current.node);
    if (collectors.has(resolved.node)) return true;
    if (resolved.node !== current.node && (!callable(resolved.node) || current.index.locals?.has(current.node.name))) pending.push(resolved);
    for (const child of astChildren(current.node)) pending.push({ index: current.index, node: child });
  }
  return false;
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
    } else if (!callbackMethods.has(nodeName(node.callee.property))) state.unsafe = true;
  }
  const target = invocation(context, index, node) ?? invokedCallback(context, index, node);
  if (target && !stack.has(target.node) && consumesCollectors(context, target.index, target.node, new Set([state.collector]))) {
    walk(context, localScope(target.index), target.node.body, state, new Set(stack).add(target.node));
  }
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
  if (node.type === 'VariableDeclaration') declareBindings(context, index, node);
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
    { index, node: node.right });
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
  const owned = new Set(astNodes(target.node.body).filter(node => node.type === 'ArrayExpression'));
  if (!owned.size) return [];
  const collectors = new Set();
  const seen = new Set();
  for (const entry of returns) returnedCollectors(context, entry, owned, collectors, seen);
  const out = [];
  for (const collector of collectors) {
    const state = { collector, writes: [], unsafe: false };
    walk(context, localScope(target.index), target.node.body, state, new Set([target.node]));
    if (!state.unsafe) out.push({ index: target.index, node: collector }, ...state.writes);
  }
  return out;
}

function returnedCollectors(context, entry, owned, collectors, seen) {
  const { index, node } = resolvedExpression(context, entry.index, entry.node);
  if (!node || seen.has(node) || callable(node)) return;
  seen.add(node);
  if (owned.has(node)) collectors.add(node);
  if (node.type === 'CallExpression') {
    const argumentsContainCollector = node.arguments.some(argument => astNodes(argument)
      .some(child => owned.has(resolvedExpression(context, index, child).node)));
    const target = invocation(context, index, node);
    if (target) {
      if (target.index.file !== index.file && !argumentsContainCollector) return;
      for (const returned of returnedExpressions(context, target)) returnedCollectors(context, returned, owned, collectors, seen);
    } else if (['map', 'filter'].includes(nodeName(node.callee.property))) {
      returnedCollectors(context, { index, node: node.callee.object }, owned, collectors, seen);
    }
    return;
  }
  for (const child of astChildren(node)) returnedCollectors(context, { index, node: child }, owned, collectors, seen);
}
