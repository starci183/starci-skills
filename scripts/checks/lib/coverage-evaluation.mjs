// Evaluate finite authored test tables without executing their source.
import { astChildren, nodeName, resolvedExpression } from './coverage-ast.mjs';

export const UNKNOWN = Symbol('unknown authored expression');
const callable = (node) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
export const testHelper = (index) => index.file.startsWith('tests/') || index.file.endsWith('.spec.mjs');
export const localScope = (index) => ({ ...index, locals: new Map(index.locals ?? []) });
const valueExpression = (index, value) => ({ index, node: { type: 'Literal', value } });

function patternParts(context, pattern, expression) {
  const resolved = resolvedExpression(context, expression.index, expression.node);
  if (pattern.type === 'ArrayPattern') return pattern.elements.map((part, position) => ({
    pattern: part, expression: { index: resolved.index, node: resolved.node?.elements?.[position] }, position,
  }));
  return pattern.properties.map((property) => ({
    pattern: property.value, expression: { index: resolved.index,
      node: resolved.node?.properties?.find((entry) => nodeName(entry.key) === nodeName(property.key))?.value },
    position: nodeName(property.key),
  }));
}

export function bindPattern(context, index, pattern, expression) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') { index.locals.set(pattern.name, expression); return; }
  if (pattern.type === 'AssignmentPattern') {
    const value = evaluate(context, expression.index, expression.node);
    bindPattern(context, index, pattern.left, value === undefined ? { index, node: pattern.right } : expression);
    return;
  }
  if (!['ArrayPattern', 'ObjectPattern'].includes(pattern.type)) return;
  const value = evaluate(context, expression.index, expression.node);
  for (const part of patternParts(context, pattern, expression)) {
    const entry = part.expression.node ? part.expression : valueExpression(index, value?.[part.position] ?? UNKNOWN);
    bindPattern(context, index, part.pattern, entry);
  }
}

export function invocation(context, index, call) {
  const target = resolvedExpression(context, index, call.callee);
  if (!callable(target.node)) return null;
  const scope = localScope(target.index);
  target.node.params.forEach((parameter, position) => bindPattern(context, scope, parameter,
    { index, node: call.arguments[position] }));
  return { index: scope, node: target.node };
}

function binaryValue(operator, left, right) {
  if (left === UNKNOWN || right === UNKNOWN) return UNKNOWN;
  if (operator === '+') return left + right;
  if (['===', '=='].includes(operator)) return left === right;
  if (['!==', '!='].includes(operator)) return left !== right;
  if (operator === '>') return left > right;
  if (operator === '>=') return left >= right;
  return UNKNOWN;
}

function objectValue(context, index, node, seen) {
  const out = {};
  for (const property of node.properties) {
    const value = evaluate(context, index, property.value ?? property.argument, seen);
    if (property.type === 'SpreadElement') { if (value !== UNKNOWN) Object.assign(out, value); }
    else out[nodeName(property.key)] = value;
  }
  return out;
}

function mappedValue(context, index, call, values, seen) {
  if (!Array.isArray(values)) return UNKNOWN;
  const callback = resolvedExpression(context, index, call.arguments[0]);
  if (!callable(callback.node)) return UNKNOWN;
  const results = values.map((value, position) => {
    const scope = localScope(callback.index);
    callback.node.params.forEach((parameter, parameterIndex) => bindPattern(context, scope, parameter,
      valueExpression(index, parameterIndex === 0 ? value : position)));
    return functionValue(context, scope, callback.node, seen);
  });
  if (nodeName(call.callee.property) === 'map') return results;
  if (results.includes(UNKNOWN)) return UNKNOWN;
  return values.filter((_value, position) => results[position]);
}

function builtinValue(context, index, call, seen) {
  const callee = call.callee;
  if (callee.type !== 'MemberExpression') return UNKNOWN;
  const name = nodeName(callee.property);
  const argument = evaluate(context, index, call.arguments[0], seen);
  if (callee.object.name === 'Object' && name === 'entries' && argument !== UNKNOWN && argument) return Object.entries(argument);
  if (callee.object.name === 'Object' && name === 'fromEntries' && Array.isArray(argument)) {
    return argument.every((entry) => Array.isArray(entry) && entry.length >= 2) ? Object.fromEntries(argument) : UNKNOWN;
  }
  const receiver = evaluate(context, index, callee.object, seen);
  if (['map', 'filter'].includes(name)) return mappedValue(context, index, call, receiver, seen);
  if (name === 'includes' && Array.isArray(receiver) && argument !== UNKNOWN) return receiver.includes(argument);
  return UNKNOWN;
}

function functionValue(context, index, node, seen) {
  if (node.body.type !== 'BlockStatement') return evaluate(context, index, node.body, seen);
  const scope = localScope(index);
  for (const statement of node.body.body) {
    if (statement.type === 'VariableDeclaration') declareBindings(context, scope, statement);
    if (statement.type === 'ReturnStatement') return evaluate(context, scope, statement.argument, seen);
  }
  return UNKNOWN;
}

function complexValue(context, index, node, seen) {
  if (node.type === 'ObjectExpression') return objectValue(context, index, node, seen);
  if (node.type === 'BinaryExpression') return binaryValue(node.operator,
    evaluate(context, index, node.left, seen), evaluate(context, index, node.right, seen));
  if (node.type === 'ConditionalExpression') {
    const condition = evaluate(context, index, node.test, seen);
    if (condition === UNKNOWN) return UNKNOWN;
    return evaluate(context, index, condition ? node.consequent : node.alternate, seen);
  }
  if (node.type === 'CallExpression') {
    const target = invocation(context, index, node);
    return target && testHelper(target.index) ? functionValue(context, target.index, target.node, seen) : builtinValue(context, index, node, seen);
  }
  return UNKNOWN;
}

export function evaluate(context, index, node, seen = new Set()) {
  if (!node) return undefined;
  if (seen.has(node)) return UNKNOWN;
  const next = new Set(seen).add(node);
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node !== node) return evaluate(context, resolved.index, resolved.node, next);
  switch (node.type) {
    case 'Literal': return node.value;
    case 'ArrayExpression': return arrayValue(context, index, node, next);
    case 'TemplateLiteral': return templateValue(context, index, node, next);
    case 'UnaryExpression': return unaryValue(context, index, node, next);
    case 'MemberExpression': return memberValue(context, index, node, next);
    default: return complexValue(context, index, node, next);
  }
}

function arrayValue(context, index, node, seen) {
  return node.elements.flatMap((entry) => entry?.type === 'SpreadElement'
    ? spreadValues(evaluate(context, index, entry.argument, seen)) : [evaluate(context, index, entry, seen)]);
}

function unaryValue(context, index, node, seen) {
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const value = evaluate(context, index, node.argument, seen);
    return value === UNKNOWN ? UNKNOWN : !value;
  }
  return UNKNOWN;
}

function memberValue(context, index, node, seen) {
  const object = evaluate(context, index, node.object, seen);
  if (object === UNKNOWN) return UNKNOWN;
  const property = node.computed ? evaluate(context, index, node.property, seen) : nodeName(node.property);
  return object?.[property] ?? UNKNOWN;
}

const spreadValues = (value) => Array.isArray(value) ? value : [UNKNOWN];
function templateValue(context, index, node, seen) {
  const values = node.expressions.map((expression) => evaluate(context, index, expression, seen));
  if (values.includes(UNKNOWN)) return UNKNOWN;
  return node.quasis.map((part, position) => part.value.cooked + (values[position] ?? '')).join('');
}

export function declareBindings(context, index, node) {
  for (const declaration of node.declarations) bindPattern(context, index, declaration.id,
    { index: localScope(index), node: declaration.init });
}

function iterableExpressions(context, index, node) {
  const resolved = resolvedExpression(context, index, node);
  if (resolved.node?.type !== 'ArrayExpression') return [];
  return resolved.node.elements.flatMap((entry) => entry?.type === 'SpreadElement'
    ? iterableExpressions(context, resolved.index, entry.argument) : [{ index: resolved.index, node: entry }]);
}

function loopIterations(context, index, node) {
  const values = evaluate(context, index, node.right);
  if (!Array.isArray(values)) return [];
  const pattern = node.left.declarations?.[0]?.id ?? node.left;
  const elements = iterableExpressions(context, index, node.right);
  return values.map((value, position) => {
    const scope = localScope(index);
    const element = elements[position];
    bindPattern(context, scope, pattern, element?.node ? element : valueExpression(index, value));
    let edition = ['lite', 'full'].includes(value) ? value : null;
    if (typeof value === 'boolean' && ['lite', 'full'].includes(pattern.name)) edition = value ? pattern.name : ['lite', 'full'].find((name) => name !== pattern.name);
    return { index: scope, edition };
  });
}

/** Lexical declarations and finite loops are visited in execution order; unused functions stay opaque. */
export function scopedWalk(context, index, node, visit, edition = null, stack = new Set()) {
  if (!node || callable(node)) return;
  if (node.type === 'Program' || node.type === 'BlockStatement') {
    const scope = localScope(index);
    for (const statement of node.body) scopedWalk(context, scope, statement, visit, edition, stack);
    return;
  }
  if (node.type === 'VariableDeclaration') declareBindings(context, index, node);
  if (visit(index, node, edition) === false) return;
  if (node.type === 'ForOfStatement') {
    for (const iteration of loopIterations(context, index, node)) scopedWalk(context, iteration.index, node.body, visit, iteration.edition ?? edition, stack);
    return;
  }
  if (node.type === 'IfStatement') { walkBranch(context, index, node, visit, edition, stack); return; }
  if (node.type === 'CallExpression') walkInvocation(context, index, node, visit, edition, stack);
  for (const child of astChildren(node)) scopedWalk(context, index, child, visit, edition, stack);
}

function walkBranch(context, index, node, visit, edition, stack) {
  const condition = evaluate(context, index, node.test);
  if (condition === UNKNOWN) {
    scopedWalk(context, localScope(index), node.consequent, visit, edition, stack);
    scopedWalk(context, localScope(index), node.alternate, visit, edition, stack);
  } else scopedWalk(context, index, condition ? node.consequent : node.alternate, visit, edition, stack);
}

function walkInvocation(context, index, node, visit, edition, stack) {
  const target = invocation(context, index, node);
  if (!target || !testHelper(target.index) || stack.has(target.node)) return;
  scopedWalk(context, target.index, target.node.body, visit, edition, new Set(stack).add(target.node));
}
