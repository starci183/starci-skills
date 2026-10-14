// Static values used at runtime by catalog consumers. A declaration alone is never a read.
import path from 'node:path';

const JSON_CATALOG = /(?:^|\/)(?:messages|locales)\/[^/]+\.json$|\.catalog\.json$/u;

const unwrap = (ts, node) => node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) ? unwrap(ts, node.expression) : node;
const symbolAt = (state, node) => {
  const symbol = state.checker.getSymbolAtLocation(node);
  return symbol?.flags === state.ts.SymbolFlags.Alias ? state.checker.getAliasedSymbol(symbol) : symbol;
};
const nameOf = (ts, node) => node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : null;

function callable(state, node) {
  const declaration = symbolAt(state, node)?.valueDeclaration;
  if (declaration && state.ts.isVariableDeclaration(declaration)) return unwrap(state.ts, declaration.initializer);
  return declaration;
}

/** Record the actual arguments of local functions, including imported functions and arrow exports. */
export function argumentBindings(state, sources) {
  for (const source of sources.values()) {
    const visit = node => {
      if (state.ts.isCallExpression(node)) {
        const target = callable(state, node.expression);
        for (const [index, parameter] of (target?.parameters ?? []).entries()) {
          const argument = node.arguments[index];
          if (!argument) continue;
          const symbol = state.checker.getSymbolAtLocation(parameter.name);
          const argumentsOf = state.arguments.get(symbol) ?? [];
          argumentsOf.push(argument);
          state.arguments.set(symbol, argumentsOf);
        }
      }
      state.ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

function typeStrings(state, node) {
  const type = state.checker.getTypeAtLocation(node);
  const types = type.isUnion() ? type.types : [type];
  return types.length && types.every(part => part.isStringLiteral()) ? types.map(part => part.value) : [];
}

function mappedProperty(state, node, seen) {
  const { ts } = state;
  if (!ts.isPropertyAccessExpression(node) || !ts.isIdentifier(node.expression)) return [];
  const parameter = symbolAt(state, node.expression)?.valueDeclaration;
  if (!parameter || !ts.isParameter(parameter)) return [];
  const callback = parameter.parent;
  const call = callback.parent;
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'map') return [];
  const declaration = symbolAt(state, call.expression.expression)?.valueDeclaration;
  const list = unwrap(ts, declaration?.initializer);
  if (!list || !ts.isArrayLiteralExpression(list)) return [];
  return list.elements.flatMap(element => {
    const item = unwrap(ts, element);
    if (!ts.isObjectLiteralExpression(item)) return [];
    const property = item.properties.find(entry => ts.isPropertyAssignment(entry) && nameOf(ts, entry.name) === node.name.text);
    return property ? staticStrings(state, property.initializer, seen) : [];
  });
}

/** Follow finite literals only; a broad string or an unbounded dynamic expression gives no evidence. */
export function staticStrings(state, expression, visited = new Set()) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node || visited.has(node)) return [];
  const seen = new Set([...visited, node]);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) return [...staticStrings(state, node.whenTrue, seen), ...staticStrings(state, node.whenFalse, seen)];
  const typed = typeStrings(state, node);
  if (typed.length) return typed;
  const declaration = symbolAt(state, node)?.valueDeclaration;
  if (declaration && ts.isVariableDeclaration(declaration)) return staticStrings(state, declaration.initializer, seen);
  if (declaration && ts.isParameter(declaration)) return (state.arguments.get(symbolAt(state, node)) ?? []).flatMap(argument => staticStrings(state, argument, seen));
  return mappedProperty(state, node, seen);
}

/** JSON imports are catalog owners; their runtime member reads survive named aliases and re-exports. */
export function jsonCatalogBindings(state, sources, files) {
  const tracked = new Set(files);
  for (const source of sources.values()) for (const statement of source.statements) {
    if (!state.ts.isImportDeclaration(statement) || !statement.importClause?.name) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier?.endsWith('.json')) continue;
    const target = state.resolveModule(specifier, source.fileName)?.resolvedFileName;
    if (!target) continue;
    const relative = path.relative(state.repoRoot, target).replaceAll('\\', '/');
    if (!tracked.has(relative) || !JSON_CATALOG.test(relative)) continue;
    state.catalogObjects.set(state.checker.getSymbolAtLocation(statement.importClause.name), '');
  }
}

function catalogObjectPath(state, expression, seen = new Set()) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node || seen.has(node)) return null;
  seen.add(node);
  if (ts.isPropertyAccessExpression(node)) {
    const prefix = catalogObjectPath(state, node.expression, seen);
    return prefix === null ? null : `${prefix}${node.name.text}.`;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    const prefix = catalogObjectPath(state, node.expression, seen);
    return prefix === null ? null : `${prefix}${node.argumentExpression.text}.`;
  }
  const direct = state.catalogObjects.get(state.checker.getSymbolAtLocation(node));
  if (direct !== undefined) return direct;
  const declaration = symbolAt(state, node)?.valueDeclaration;
  return declaration && ts.isVariableDeclaration(declaration) ? catalogObjectPath(state, declaration.initializer, seen) : null;
}

export function jsonCatalogRead(state, node) {
  if (!state.ts.isPropertyAccessExpression(node) && !state.ts.isElementAccessExpression(node)) return;
  const key = catalogObjectPath(state, node);
  if (key !== null) state.catalogReads.add(key.slice(0, -1));
}
