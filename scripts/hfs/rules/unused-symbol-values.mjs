// Static values used at runtime by catalog consumers. A declaration alone is never a read.
import path from 'node:path';
import { nameText } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';
import { callableValue, propertyInitializers, symbolAt, valuesOf } from './unused-symbol-flow.mjs';

const JSON_CATALOG = /(?:^|\/)(?:messages|locales)\/[^/]+\.json$|\.catalog\.json$/u;

export function callable(state, node) {
  return callableValue(state, node);
}

function bindArgument(state, parameter, argument) {
  if (!parameter || !argument) return;
  const key = state.ts.isIdentifier(parameter.name) ? state.checker.getSymbolAtLocation(parameter.name) : parameter;
  state.arguments.set(key, [...state.arguments.get(key) ?? [], argument]);
}

/** Record the actual arguments of local functions, including imported functions and arrow exports. */
export function argumentBindings(state, sources) {
  state.flowSources = sources;
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

const STATIC_CHOICE_LIMIT = 256;
const STATIC_DEPTH_LIMIT = 64;
const stringChoices = (groups, strict) => strict && groups.some(group => !group.length) ? [] : groups.flat();

/** Expand only a finite product; an unknown span or an excessive product keeps the template opaque. */
function templateStrings(state, node, seen) {
  let choices = [node.head.text];
  for (const span of node.templateSpans) {
    const values = staticStrings(state, span.expression, seen, true);
    if (!values.length || choices.length * values.length > STATIC_CHOICE_LIMIT) return [];
    choices = choices.flatMap(prefix => values.map(value => prefix + value + span.literal.text));
  }
  return choices;
}

/** Follow finite literals only; a broad string or an unbounded dynamic expression gives no evidence. */
export function staticStrings(state, expression, visited = new Set(), strict = false) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node || visited.has(node) || visited.size >= STATIC_DEPTH_LIMIT) return [];
  const seen = new Set([...visited, node]);
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return templateStrings(state, node, seen);
  if (ts.isConditionalExpression(node)) return stringChoices([node.whenTrue, node.whenFalse].map(branch => staticStrings(state, branch, seen, strict)), strict);
  const typed = typeStrings(state, node);
  if (typed.length) return typed;
  const declaration = symbolAt(state, node)?.valueDeclaration;
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return staticStrings(state, declaration.initializer, seen, strict);
  const bound = declaration && ts.isParameter(declaration) ? state.arguments.get(symbolAt(state, node)) ?? [] : [];
  if (bound.length) return stringChoices(bound.map(argument => staticStrings(state, argument, seen, strict)), strict);
  // Tables, tuples, nested maps, for-of and destructured elements resolve to the literals they hold.
  return stringChoices(valuesOf(state, node, visited).map(leaf => leaf === node ? [] : staticStrings(state, leaf, seen, strict)), strict);
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

function initializersAt(state, root, keys) {
  let owners = [root];
  for (const key of keys) {
    const groups = owners.map(owner => propertyInitializers(state, owner, key));
    if (groups.some(group => !group.length)) return [];
    owners = groups.flat();
  }
  return owners;
}

/** Locale siblings belong to the same authored bundle, never to unrelated catalogs with matching keys. */
function localeInitializers(state, initializer) {
  const { ts } = state;
  const keys = [];
  let property = initializer.parent;
  while (property && ts.isPropertyAssignment(property) && ts.isObjectLiteralExpression(property.parent)) {
    const key = nameText(ts, property.name, { numbers: true });
    if (key === null) return [];
    keys.unshift(key);
    const locale = property.parent.parent;
    if (ts.isPropertyAssignment(locale) && /^(?:vi|en)$/u.test(nameText(ts, locale.name) ?? '')
      && ts.isObjectLiteralExpression(locale.parent) && ts.isVariableDeclaration(locale.parent.parent)) {
      const groups = ['vi', 'en'].map(language => initializersAt(state, locale.parent, [language, ...keys]));
      return groups.every(group => group.length) ? groups.flat() : [];
    }
    property = locale;
  }
  return [];
}

function consumeCandidate(state, initializer) {
  const candidate = state.decls.get(initializer.parent);
  if (candidate?.kind !== 'catalog key') return;
  candidate.used = true;
  for (const peer of localeInitializers(state, initializer)) {
    const sibling = state.decls.get(peer.parent);
    if (sibling?.kind === 'catalog key') sibling.used = true;
  }
}

/** A real finite member read consumes the selected authored key and its proven same-bundle locale siblings. */
function typedCatalogRead(state, node) {
  const keys = state.ts.isPropertyAccessExpression(node) ? [node.name.text] : staticStrings(state, node.argumentExpression);
  for (const key of keys) for (const initializer of propertyInitializers(state, node.expression, key)) consumeCandidate(state, initializer);
}

export function jsonCatalogRead(state, node) {
  if (!state.ts.isPropertyAccessExpression(node) && !state.ts.isElementAccessExpression(node)) return;
  typedCatalogRead(state, node);
  const key = catalogObjectPath(state, node);
  if (key !== null) state.catalogReads.add(key.slice(0, -1));
  if (state.ts.isElementAccessExpression(node) && !state.ts.isStringLiteralLike(node.argumentExpression)) {
    const base = catalogObjectPath(state, node.expression);
    if (base !== null) for (const value of staticStrings(state, node.argumentExpression)) state.catalogReads.add(`${base}${value}`);
  }
}
