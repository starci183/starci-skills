// Translators of R280: which catalog namespace a `t(...)` call reads, followed through destructuring and props.
import { nameText } from '../../lib/ts-ast.mjs';
import { unwrapCatalogExpression as unwrap } from '../../lib/ts-analysis.mjs';
import { callable, staticStrings } from './unused-symbol-values.mjs';
import { returnedExpressions, symbolAt, valuesOf } from './unused-symbol-flow.mjs';

const TRANSLATOR_NAME = /^(?:t|translate)$/u;

function translationFactories(ts, source) {
  const factories = new Set(['useTranslations', 'getTranslations']);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !/^(?:next-intl|next-intl\/server)$/u.test(statement.moduleSpecifier.text)) continue;
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const element of named.elements) {
      if (factories.has((element.propertyName ?? element.name).text)) factories.add(element.name.text);
    }
  }
  return factories;
}

function translatorNamespace(state, initializer, factories) {
  const { ts } = state;
  let init = unwrap(ts, initializer);
  if (init && ts.isAwaitExpression(init)) init = unwrap(ts, init.expression);
  if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression) || !factories.has(init.expression.text)) return null;
  let first = init.arguments[0];
  if (first && ts.isObjectLiteralExpression(first)) first = first.properties.find(property => nameText(ts, property.name, { numbers: true }) === 'namespace')?.initializer;
  return first ? staticStrings(state, first) : [''];
}

/** `Promise.all([...])` and a plain array literal hand each element to the binding at the same index. */
function translatorList(ts, initializer) {
  let list = unwrap(ts, initializer);
  if (list && ts.isAwaitExpression(list)) list = unwrap(ts, list.expression);
  if (list && ts.isCallExpression(list) && ts.isPropertyAccessExpression(list.expression) && list.expression.name.text === 'all') list = unwrap(ts, list.arguments[0]);
  return list && ts.isArrayLiteralExpression(list) ? list.elements : [];
}

const isFunction = (ts, node) => Boolean(node) && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node));

/** A function whose result is a call on a bound translator with its own first parameter is that translator. */
function forwardedNamespaces(state, fn) {
  const { ts, checker } = state;
  const parameter = fn.parameters[0];
  if (!parameter || !ts.isIdentifier(parameter.name)) return [];
  const own = checker.getSymbolAtLocation(parameter.name);
  return returnedExpressions(ts, fn).flatMap(expression => {
    const call = unwrap(ts, expression);
    const first = call && ts.isCallExpression(call) ? unwrap(ts, call.arguments[0]) : null;
    if (!first || !ts.isIdentifier(first) || checker.getSymbolAtLocation(first) !== own) return [];
    return receiverNamespaces(state, call.expression);
  });
}

/** useCallback(fn, deps) and useMemo(() => fn, deps) are the function fn. */
function transparentFunction(state, expression) {
  const { ts } = state;
  const node = unwrap(ts, expression);
  if (!node || !ts.isCallExpression(node)) return node;
  const name = leafName(ts, node.expression);
  const inner = /^(?:useCallback|useMemo)$/u.test(name) ? unwrap(ts, node.arguments[0]) : null;
  if (!inner) return node;
  if (name === 'useCallback') return inner;
  if (!isFunction(ts, inner)) return node;
  return returnedExpressions(ts, inner).map(returned => unwrap(ts, returned)).find(candidate => isFunction(ts, candidate)) ?? node;
}

/** A hook returns such a forwarding function, bare or wrapped in useCallback or useMemo. */
function hookNamespaces(state, hook) {
  const { ts } = state;
  return returnedExpressions(ts, hook).flatMap(expression => {
    const inner = transparentFunction(state, expression);
    return isFunction(ts, inner) ? forwardedNamespaces(state, inner) : [];
  });
}

function wrapperNamespaces(state, initializer) {
  const { ts } = state;
  let init = transparentFunction(state, initializer);
  if (init && ts.isAwaitExpression(init)) init = unwrap(ts, init.expression);
  if (isFunction(ts, init)) return forwardedNamespaces(state, init);
  const target = init && ts.isCallExpression(init) ? callable(state, init.expression) : null;
  return isFunction(ts, target) ? hookNamespaces(state, target) : [];
}

function bindTranslator(state, name, initializer, factories) {
  const { ts, checker } = state;
  if (ts.isIdentifier(name)) {
    const namespaces = translatorNamespace(state, initializer, factories) ?? wrapperNamespaces(state, initializer);
    if (namespaces?.length) state.translators.set(checker.getSymbolAtLocation(name), namespaces);
  } else if (ts.isArrayBindingPattern(name)) {
    const elements = translatorList(ts, initializer);
    name.elements.forEach((element, index) => { if (ts.isBindingElement(element) && elements[index]) bindTranslator(state, element.name, elements[index], factories); });
  }
}

/** Wrappers depend on translators bound in other modules, so bind until nothing new appears. */
export function translationBindings(state, sources) {
  const factories = new Map([...sources.values()].map(source => [source, translationFactories(state.ts, source)]));
  for (let pass = 0, size = -1; pass < 4 && size !== state.translators.size; pass++) {
    size = state.translators.size;
    for (const source of sources.values()) {
      const visit = node => {
        if (state.ts.isVariableDeclaration(node) && node.initializer) bindTranslator(state, node.name, node.initializer, factories.get(source));
        state.ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
}

/** Namespaces of the translators a receiver can be: declared here, or handed in through arguments and props. */
function receiverNamespaces(state, receiver) {
  const { ts, checker } = state;
  const direct = state.translators.get(checker.getSymbolAtLocation(receiver));
  if (direct !== undefined) return direct;
  return valuesOf(state, receiver).flatMap(leaf => ts.isIdentifier(leaf) ? state.translators.get(checker.getSymbolAtLocation(leaf)) ?? [] : []);
}

function handedIn(state, receiver) {
  const { ts } = state;
  let root = receiver;
  while (ts.isPropertyAccessExpression(root)) root = root.expression;
  const declaration = ts.isIdentifier(root) ? symbolAt(state, root)?.valueDeclaration : null;
  return Boolean(declaration) && (ts.isParameter(declaration) || ts.isBindingElement(declaration));
}

function leafName(ts, node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return ts.isIdentifier(node) ? node.text : '';
}

/**
 * Namespaces read by a call of `callee`; `null` stands for a translator handed in whose namespace cannot be followed
 * (R106 reads such a key by its leaf), and no result means the call is no catalog read.
 */
export function catalogNamespace(state, callee) {
  const { ts } = state;
  let receiver = callee;
  if (ts.isPropertyAccessExpression(callee) && /^(?:rich|raw|markup)$/u.test(callee.name.text)) receiver = callee.expression;
  const resolved = receiverNamespaces(state, receiver);
  if (resolved.length) return resolved;
  if (TRANSLATOR_NAME.test(leafName(ts, receiver)) && handedIn(state, receiver)) return [null];
  if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'get') {
    const owner = callee.expression;
    const name = nameText(ts, ts.isPropertyAccessExpression(owner) ? owner.name : owner, { numbers: true }) ?? '';
    if (/message|catalog/iu.test(name)) return [''];
  }
  if (ts.isIdentifier(callee) && TRANSLATOR_NAME.test(callee.text)) return [''];
  return [];
}
