// Value flow for R280: the expressions an identifier, property or destructured element can hold,
// followed through variables, parameters (state.arguments), array callbacks, for-of and literal tables.
import { nameText as nameOf } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';
import { excludesNull, ownerProperty, propertiesOf, propertyValues, writesTarget } from './unused-symbol-properties.mjs';

const ARRAY_CALLBACK = /^(?:map|flatMap|forEach|filter|find|some|every)$/u;

/** A forwarded parameter must retain its value, including in a conditional guard. */
export function writesBinding(state, node, symbol) {
  return writesTarget(state, node, target => state.ts.isIdentifier(target) && state.checker.getSymbolAtLocation(target) === symbol);
}

export const symbolAt = (state, node) => {
  const symbol = state.ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
    ? state.checker.getShorthandAssignmentValueSymbol(node.parent) : state.checker.getSymbolAtLocation(node);
  return symbol?.flags === state.ts.SymbolFlags.Alias ? state.checker.getAliasedSymbol(symbol) : symbol;
};

/** Only a declared, unmodified class method or readonly field supplies instance-member provenance. */
function classMemberValue(state, declaration) {
  const { ts } = state;
  if (!declaration || !ts.isClassLike(declaration.parent)) return null;
  const field = ts.isPropertyDeclaration(declaration);
  if (!ts.isMethodDeclaration(declaration) && (!field || !declaration.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ReadonlyKeyword))) return null;
  const mutations = state.memberMutations ??= new Map();
  if (!mutations.has(declaration)) mutations.set(declaration, [...(state.flowSources?.values() ?? [declaration.getSourceFile()])]
    .some(source => writesTarget(state, source, target => symbolAt(state, target)?.valueDeclaration === declaration)));
  if (mutations.get(declaration)) return null;
  return field ? unwrap(ts, declaration.initializer) : declaration;
}

/** Local callable declarations and supported class fields share the same declaration resolution. */
export function callableValue(state, node) {
  const declaration = symbolAt(state, node)?.valueDeclaration;
  if (!declaration) return null;
  if (state.ts.isVariableDeclaration(declaration)) return unwrap(state.ts, declaration.initializer);
  return state.ts.isClassLike(declaration.parent) ? classMemberValue(state, declaration) : declaration;
}

/** Selected initializers retain their declaration identity for exact catalog consumption. */
export function propertyInitializers(state, expression, name) {
  return propertiesOf(state, valuesOf(state, expression), name, new Set(), valuesOf);
}

function tableOwnerValues(state, owner, literal, seen) {
  const { ts } = state;
  if (ts.isArrayLiteralExpression(owner)) return [...owner.elements];
  if (!ts.isObjectLiteralExpression(owner)) return [];
  if (literal !== null) return propertyValues(state, owner, literal, seen, valuesOf);
  // A dynamic selection from a table with spread or computed members has unknown provenance.
  if (owner.properties.some(entry => !ts.isPropertyAssignment(entry) || nameOf(ts, entry.name, { numbers: true }) === null)) return [];
  return owner.properties.map(entry => entry.initializer);
}

/** A literal table key selects its property; a dynamic key admits only a completely known table. */
function tableValues(state, node, seen) {
  const literal = nameOf(state.ts, node.argumentExpression, { identifiers: false, numbers: true });
  const groups = valuesOf(state, node.expression, seen).map(owner => tableOwnerValues(state, owner, literal, seen));
  return groups.length && groups.every(group => group.length) ? groups.flat() : [];
}

const resolveAll = (state, nodes, seen) => nodes.flatMap(node => valuesOf(state, node, seen));

function elementsOf(state, expression, seen) {
  const owners = valuesOf(state, expression, seen);
  if (owners.some(owner => !state.ts.isArrayLiteralExpression(owner))) return [];
  return owners.flatMap(owner => [...owner.elements]);
}

const parameterKey = (state, declaration) => state.ts.isIdentifier(declaration.name)
  ? state.checker.getSymbolAtLocation(declaration.name) : declaration;

/** A recognized array callback binds its first parameter even when its collection values are unknown. */
function arrayCallbackSource(state, declaration) {
  const { ts } = state;
  const callback = declaration.parent;
  const call = callback.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== callback || callback.parameters[0] !== declaration) return null;
  const expression = call.expression;
  return ts.isPropertyAccessExpression(expression) && ARRAY_CALLBACK.test(expression.name.text) ? expression.expression : null;
}

function parameterValues(state, declaration, seen) {
  const collection = arrayCallbackSource(state, declaration);
  if (collection) return resolveAll(state, elementsOf(state, collection, seen), seen);
  return resolveAll(state, state.arguments.get(parameterKey(state, declaration)) ?? [], seen);
}

function declarationEvidence(state, declaration) {
  if (!declaration) return false;
  if (state.ts.isParameter(declaration))
    return state.arguments.has(parameterKey(state, declaration)) || arrayCallbackSource(state, declaration) !== null;
  if (!state.ts.isVariableDeclaration(declaration)) return false;
  const loop = declaration.parent?.parent;
  return Boolean(declaration.initializer) || Boolean(loop && state.ts.isForOfStatement(loop));
}

/** Separate unbound generic receivers from receivers whose observed producers failed namespace resolution. */
export function receiverBinding(state, expression) {
  const { ts } = state;
  let root = unwrap(ts, expression);
  while (root && (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root))) root = unwrap(ts, root.expression);
  const declaration = root && ts.isIdentifier(root) ? symbolAt(state, root)?.valueDeclaration : null;
  const handedIn = Boolean(declaration) && (ts.isParameter(declaration) || ts.isBindingElement(declaration));
  let owner = declaration;
  while (owner && ts.isBindingElement(owner)) owner = owner.parent?.parent;
  return { handedIn, observed: declarationEvidence(state, owner) };
}

function bindingValues(state, declaration, seen) {
  const { ts } = state;
  const pattern = declaration.parent;
  if (declaration.dotDotDotToken) return [];
  const owners = declarationValues(state, pattern.parent, seen);
  if (ts.isObjectBindingPattern(pattern)) {
    const name = nameOf(ts, declaration.propertyName ?? declaration.name);
    return resolveAll(state, propertiesOf(state, owners, name, seen, valuesOf), seen);
  }
  const index = pattern.elements.indexOf(declaration);
  if (owners.some(owner => !ts.isArrayLiteralExpression(owner) || !owner.elements[index])) return [];
  return resolveAll(state, owners.map(owner => owner.elements[index]), seen);
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

/** Resolve local function and memo callback returns; an unknown call remains its own leaf. */
function callValues(state, node, seen) {
  const { ts } = state;
  const target = callableValue(state, node.expression);
  const memo = ts.isIdentifier(node.expression) && node.expression.text === 'useMemo' ? unwrap(ts, node.arguments[0]) : null;
  const fn = memo ?? target;
  return fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn))
    ? resolveAll(state, returnedExpressions(ts, fn), seen) : [node];
}

const unionMembers = type => {
  if (!type) return [];
  return type.isUnion() ? type.types : [type];
};

/** The object literals the program builds for a declared object type: those the checker types by that interface or alias. */
function literalsByType(state) {
  const { ts, checker } = state;
  if (state.typedLiterals) return state.typedLiterals;
  const index = new Map();
  const visit = node => {
    if (ts.isObjectLiteralExpression(node)) {
      const type = checker.getContextualType(node);
      const owners = unionMembers(type);
      for (const owner of owners) {
        const symbol = owner.aliasSymbol ?? owner.symbol;
        if (symbol) index.set(symbol, [...index.get(symbol) ?? [], node]);
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const source of state.flowSources?.values() ?? []) visit(source);
  state.typedLiterals = index;
  return index;
}

/** A property declared `readonly` on an interface or type literal cannot be reassigned, so only the object literals typed by it write it. */
const readonlyDeclaration = (ts, symbol, name) => {
  const member = symbol.members?.get(name) ?? symbol.declarations?.flatMap(declaration => ts.isTypeAliasDeclaration(declaration) ? [declaration.type] : [])
    .find(type => ts.isTypeLiteralNode(type))?.symbol?.members?.get(name);
  return Boolean(member?.declarations?.length) && member.declarations.every(declaration => ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly);
};

/**
 * What a read of `owner.name` can hold when the owner is a value of a declared object type and the property is `readonly`: the initializers
 * of that property in every object literal the program types by that declaration, in a typed table of constants. Any owner type that is not
 * such a declaration, or a literal whose property comes from an unknown source, leaves the read unresolved.
 */
function typedPropertyValues(state, node) {
  const { ts, checker } = state;
  const owner = checker.getNonNullableType(checker.getTypeAtLocation(node.expression));
  const owners = owner.isUnion() ? owner.types : [owner];
  const values = [];
  for (const type of owners) {
    const symbol = type.aliasSymbol ?? type.symbol;
    const literals = symbol ? literalsByType(state).get(symbol) : null;
    if (!literals?.length || !readonlyDeclaration(ts, symbol, node.name.text)) return [];
    for (const literal of literals) {
      const property = ownerProperty(state, literal, node.name.text, new Set(), valuesOf);
      if (property === null) return [];
      values.push(...property.values);
    }
  }
  return values;
}

const isNullish = (ts, node) => node.kind === ts.SyntaxKind.NullKeyword || ts.isIdentifier(node) && node.text === 'undefined';

/** Leaf expressions `expression` may evaluate to. A translator variable and any unresolvable expression is its own leaf. */
export function valuesOf(state, expression, visited = new Set()) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node) return [];
  if (visited.has(node)) return [node];
  const seen = new Set([...visited, node]);
  const orLeaf = values => values.length ? values : [node];
  const narrowed = values => orLeaf(excludesNull(state, node) ? values.filter(value => value.kind !== ts.SyntaxKind.NullKeyword) : values);
  if (ts.isConditionalExpression(node)) return [...valuesOf(state, node.whenTrue, seen), ...valuesOf(state, node.whenFalse, seen)];
  // `a ?? b` and `a || b` hold either operand.
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind))
    return [...valuesOf(state, node.left, seen), ...valuesOf(state, node.right, seen)];
  if (ts.isCallExpression(node)) return orLeaf(callValues(state, node, seen));
  if (ts.isPropertyAccessExpression(node)) {
    const member = classMemberValue(state, symbolAt(state, node)?.valueDeclaration);
    if (member) return [member];
  }
  if (ts.isPropertyAccessExpression(node)) {
    // Reading a property of null or undefined throws, so a nullish branch of the owner holds no value of the property.
    const owners = valuesOf(state, node.expression, seen).filter(owner => !isNullish(ts, owner));
    const known = resolveAll(state, propertiesOf(state, owners, node.name.text, seen, valuesOf), seen);
    return narrowed(known.length ? known : resolveAll(state, typedPropertyValues(state, node), seen));
  }
  if (ts.isElementAccessExpression(node)) return orLeaf(resolveAll(state, tableValues(state, node, seen), seen));
  if (!ts.isIdentifier(node)) return [node];
  const symbol = symbolAt(state, node);
  if (!symbol?.valueDeclaration || state.translators.has(symbol)) return [node];
  const values = declarationValues(state, symbol.valueDeclaration, seen);
  return narrowed(values);
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
