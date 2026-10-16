// Value flow for R280: the expressions an identifier, property or destructured element can hold,
// followed through variables, parameters (state.arguments), array callbacks, for-of and literal tables.
import { nameText as nameOf } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';

const ARRAY_CALLBACK = /^(?:map|flatMap|forEach|filter|find|some|every)$/u;

export const symbolAt = (state, node) => {
  const symbol = state.checker.getSymbolAtLocation(node);
  return symbol?.flags === state.ts.SymbolFlags.Alias ? state.checker.getAliasedSymbol(symbol) : symbol;
};

/** The expression bound to `name` in an object literal or a JSX attribute list. */
function propertyValues(state, owner, name) {
  const { ts } = state;
  if (ts.isObjectLiteralExpression(owner)) return owner.properties.filter(entry => ts.isPropertyAssignment(entry) && nameOf(ts, entry.name) === name).map(entry => entry.initializer);
  if (!ts.isJsxAttributes(owner)) return [];
  const attributes = owner.properties.filter(entry => ts.isJsxAttribute(entry) && entry.name.text === name && entry.initializer);
  return attributes.map(entry => ts.isJsxExpression(entry.initializer) ? entry.initializer.expression : entry.initializer).filter(Boolean);
}

/** `TABLE[key]`: the entry of a literal key, else every value of the table (any of them can be read). */
function tableValues(state, node, seen) {
  const { ts } = state;
  const literal = ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
  return valuesOf(state, node.expression, seen).flatMap(owner => {
    if (ts.isArrayLiteralExpression(owner)) return [...owner.elements];
    if (!ts.isObjectLiteralExpression(owner)) return [];
    if (literal !== null) return propertyValues(state, owner, literal);
    return owner.properties.filter(entry => ts.isPropertyAssignment(entry)).map(entry => entry.initializer);
  });
}

const resolveAll = (state, nodes, seen) => nodes.flatMap(node => valuesOf(state, node, seen));

function elementsOf(state, expression, seen) {
  return valuesOf(state, expression, seen).flatMap(owner => state.ts.isArrayLiteralExpression(owner) ? [...owner.elements] : []);
}

function parameterValues(state, declaration, seen) {
  const { ts } = state;
  const callback = declaration.parent;
  const call = callback.parent;
  if (ts.isCallExpression(call) && call.arguments[0] === callback && callback.parameters[0] === declaration
    && ts.isPropertyAccessExpression(call.expression) && ARRAY_CALLBACK.test(call.expression.name.text)) {
    return resolveAll(state, elementsOf(state, call.expression.expression, seen), seen);
  }
  const key = ts.isIdentifier(declaration.name) ? state.checker.getSymbolAtLocation(declaration.name) : declaration;
  return resolveAll(state, state.arguments.get(key) ?? [], seen);
}

function bindingValues(state, declaration, seen) {
  const { ts } = state;
  const pattern = declaration.parent;
  if (declaration.dotDotDotToken) return [];
  const owners = declarationValues(state, pattern.parent, seen);
  if (ts.isObjectBindingPattern(pattern)) {
    const name = nameOf(ts, declaration.propertyName ?? declaration.name);
    return resolveAll(state, owners.flatMap(owner => propertyValues(state, owner, name)), seen);
  }
  const index = pattern.elements.indexOf(declaration);
  return resolveAll(state, owners.flatMap(owner => ts.isArrayLiteralExpression(owner) && owner.elements[index] ? [owner.elements[index]] : []), seen);
}

function declarationValues(state, declaration, seen) {
  const { ts } = state;
  if (ts.isParameter(declaration)) return parameterValues(state, declaration, seen);
  if (ts.isBindingElement(declaration)) return bindingValues(state, declaration, seen);
  if (!ts.isVariableDeclaration(declaration)) return [];
  const loop = declaration.parent?.parent;
  if (loop && ts.isForOfStatement(loop)) return resolveAll(state, elementsOf(state, loop.expression, seen), seen);
  return declaration.initializer ? valuesOf(state, declaration.initializer, seen) : [];
}

/** Leaf expressions `expression` may evaluate to. A translator variable and any unresolvable expression is its own leaf. */
export function valuesOf(state, expression, visited = new Set()) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node || visited.has(node)) return [];
  const seen = new Set([...visited, node]);
  if (ts.isConditionalExpression(node)) return [...valuesOf(state, node.whenTrue, seen), ...valuesOf(state, node.whenFalse, seen)];
  if (ts.isPropertyAccessExpression(node)) return resolveAll(state, valuesOf(state, node.expression, seen).flatMap(owner => propertyValues(state, owner, node.name.text)), seen);
  if (ts.isElementAccessExpression(node)) return resolveAll(state, tableValues(state, node, seen), seen);
  if (!ts.isIdentifier(node)) return [node];
  const symbol = symbolAt(state, node);
  if (!symbol?.valueDeclaration || state.translators.has(symbol)) return [node];
  return declarationValues(state, symbol.valueDeclaration, seen);
}

/** The expressions a function returns: its expression body, or the operand of each return outside nested functions. */
export function returnedExpressions(ts, fn) {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const found = [];
  const visit = node => {
    if (ts.isReturnStatement(node) && node.expression) found.push(node.expression);
    if (!ts.isFunctionLike(node)) ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return found;
}
