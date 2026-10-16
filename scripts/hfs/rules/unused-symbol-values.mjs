// Static values used at runtime by catalog consumers. A declaration alone is never a read.
import path from 'node:path';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';
import { symbolAt, valuesOf } from './unused-symbol-flow.mjs';

const JSON_CATALOG = /(?:^|\/)(?:messages|locales)\/[^/]+\.json$|\.catalog\.json$/u;

function callable(state, node) {
  const declaration = symbolAt(state, node)?.valueDeclaration;
  if (declaration && state.ts.isVariableDeclaration(declaration)) return unwrap(state.ts, declaration.initializer);
  return declaration;
}

function bindArgument(state, parameter, argument) {
  if (!parameter || !argument) return;
  const key = state.ts.isIdentifier(parameter.name) ? state.checker.getSymbolAtLocation(parameter.name) : parameter;
  state.arguments.set(key, [...state.arguments.get(key) ?? [], argument]);
}

/** Record the actual arguments of local functions, including imported functions and arrow exports. */
export function argumentBindings(state, sources) {
  for (const source of sources.values()) {
    const visit = node => {
      if (state.ts.isCallExpression(node)) {
        const target = callable(state, node.expression);
        for (const [index, parameter] of (target?.parameters ?? []).entries()) bindArgument(state, parameter, node.arguments[index]);
      } else if (state.ts.isJsxSelfClosingElement(node) || state.ts.isJsxOpeningElement(node)) {
        // A component's props parameter receives the attribute list of every element that renders it.
        bindArgument(state, callable(state, node.tagName)?.parameters?.[0], node.attributes);
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
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return staticStrings(state, declaration.initializer, seen);
  const bound = declaration && ts.isParameter(declaration) ? state.arguments.get(symbolAt(state, node)) ?? [] : [];
  if (bound.length) return bound.flatMap(argument => staticStrings(state, argument, seen));
  // Tables, tuples, nested maps, for-of and destructured elements resolve to the literals they hold.
  return valuesOf(state, node, visited).flatMap(leaf => leaf === node ? [] : staticStrings(state, leaf, seen));
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
  if (state.ts.isElementAccessExpression(node) && !state.ts.isStringLiteralLike(node.argumentExpression)) {
    const base = catalogObjectPath(state, node.expression);
    if (base !== null) for (const value of staticStrings(state, node.argumentExpression)) state.catalogReads.add(`${base}${value}`);
  }
}
