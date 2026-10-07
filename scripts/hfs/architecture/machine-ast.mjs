import path from 'node:path';
import { canonical } from './config.mjs';
import { hasAnyFlag, sourceLocation } from '../../lib/ts-ast.mjs';

const HELPER_DEPTH = 4;

const checkerOf = (env, sourceFile) => env.context.checkerFor(sourceFile.fileName);

function aliased(env, checker, symbol) {
  const { ts } = env;
  const seen = new Set();
  let current = symbol;
  while (current && hasAnyFlag(current.flags, ts.SymbolFlags.Alias) && !seen.has(current)) {
    seen.add(current);
    let target;
    try { target = checker.getAliasedSymbol(current); } catch { break; }
    if (!target || target === current || !(target.declarations?.length)) break;
    current = target;
  }
  return current;
}

function symbolAt(env, checker, node) {
  const { ts } = env;
  if (!node) return null;
  if (ts.isShorthandPropertyAssignment(node.parent ?? {}) && node.parent.name === node) return checker.getShorthandAssignmentValueSymbol(node.parent) ?? null;
  return checker.getSymbolAtLocation(node) ?? null;
}

/** {name, module} when `target` is bound directly by an import specifier, default import or namespace import, else null. */
function ownImportBinding(env, checker, target) {
  const { ts } = env;
  const declaration = symbolAt(env, checker, target)?.declarations?.[0];
  if (!declaration) return null;
  if (ts.isImportSpecifier(declaration)) return { name: (declaration.propertyName ?? declaration.name).text, module: declaration.parent.parent.parent.moduleSpecifier.text };
  if (ts.isImportClause(declaration)) return { name: 'default', module: declaration.parent.moduleSpecifier.text };
  if (ts.isNamespaceImport(declaration)) return { name: '*', module: declaration.parent.parent.moduleSpecifier.text };
  return null;
}

/** {name, module} when `node` (identifier, or namespace.member) is bound by an import from a module specifier, else null. */
function importBinding(env, checker, node) {
  const { ts } = env;
  if (ts.isIdentifier(node)) return ownImportBinding(env, checker, node);
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const namespace = ownImportBinding(env, checker, node.expression);
    return namespace?.name === '*' ? { name: node.name.text, module: namespace.module } : null;
  }
  return null;
}

function isImportOf(env, checker, node, name, moduleName) {
  const binding = importBinding(env, checker, node);
  return Boolean(binding) && binding.name === name && binding.module === moduleName;
}

/** The declarations `node` resolves to through aliases. */
const declarationsOf = (env, checker, node) => aliased(env, checker, symbolAt(env, checker, node))?.declarations ?? [];

/** The repository-relative graph path of the file declaring `declaration`, or null when it is outside the program. */
const graphPath = (env, declaration) => env.graph.abs(canonical(declaration.getSourceFile().fileName));

const graphFile = (env, rel) => env.graph.files.get(rel) ?? null;

/** The capability (owner) root, slot and tier of a declaration, or null. */
function ownerOfDeclaration(env, declaration) {
  const rel = graphPath(env, declaration);
  const file = rel ? graphFile(env, rel) : null;
  return file?.owner ? { rel, root: file.owner.root, slot: file.owner.slot, tier: file.tier, name: path.posix.basename(file.owner.root) } : null;
}

/** The string a node evaluates to: a literal, or a const whose type is a string literal. */
function stringValue(env, checker, node) {
  const { ts } = env;
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  let type;
  try { type = checker.getTypeAtLocation(node); } catch { return null; }
  if (type?.isStringLiteral?.()) return type.value;
  const declaration = declarationsOf(env, checker, ts.isPropertyAccessExpression(node) ? node.name : node)[0];
  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) return stringValue(env, checker, declaration.initializer);
  return null;
}

function walk(env, node, visit) {
  const step = child => {
    if (visit(child) === false) return;
    env.ts.forEachChild(child, step);
  };
  step(node);
}

const decorators = (env, node) => (env.ts.canHaveDecorators?.(node) ? env.ts.getDecorators(node) ?? [] : []);
const isExported = (env, node) => hasAnyFlag(env.ts.getCombinedModifierFlags?.(node), env.ts.ModifierFlags.Export);

function propertyNameText(env, name) {
  if (!name) return null;
  if (env.ts.isIdentifier(name) || env.ts.isStringLiteralLike(name)) return name.text;
  return null;
}

/** The object literal properties of `literal` by static name. */
const propertyOf = (env, literal, key) => literal.properties
  .find(property => (env.ts.isPropertyAssignment(property) || env.ts.isShorthandPropertyAssignment(property)) && propertyNameText(env, property.name) === key);

const valueOfProperty = (env, property) => (env.ts.isPropertyAssignment(property) ? property.initializer : property.name);

const at = (env, rel, sourceFile, node, extra = {}) => ({ path: rel, ...sourceLocation(sourceFile, node), ...extra });

/** The app root file of an app (apps/<name>/src/app.module.ts), or null when the program does not hold it. */
const appRoot = (env, name) => graphFile(env, `apps/${name}/src/app.module.ts`);

/** The body a call or a spread identifier resolves to when it is a function or a const declared in a file of the program (not a package), else null. */
function helperBodyOf(env, checker, node) {
  const { ts } = env;
  const target = ts.isCallExpression(node) ? node.expression : node;
  for (const declaration of declarationsOf(env, checker, ts.isPropertyAccessExpression(target) ? target.name : target)) {
    if (!graphPath(env, declaration)) continue;
    if (ts.isFunctionDeclaration(declaration) && declaration.body) return { declaration, body: declaration.body };
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return { declaration, body: declaration.initializer };
  }
  return null;
}

/** The provider entry of an object literal that provides `name` imported from `moduleName`, or null. */
function providerEntry(env, search, checker, literal, anchor) {
  const provide = propertyOf(env, literal, 'provide');
  if (!provide || !isImportOf(env, checker, valueOfProperty(env, provide), search.name, search.moduleName)) return null;
  const use = propertyOf(env, literal, 'useClass');
  return { node: anchor ?? literal, useClass: use ? valueOfProperty(env, use) : null, checker };
}

/** The expression that may reference a helper: the argument of a spread, or the call itself. */
function helperReferenceOf(ts, node) {
  if (ts.isSpreadElement(node)) return node.expression;
  return ts.isCallExpression(node) ? node : null;
}

function followHelper(env, search, checker, node, anchor, depth) {
  const reference = helperReferenceOf(env.ts, node);
  if (!reference || depth >= HELPER_DEPTH) return;
  const helper = helperBodyOf(env, checker, reference);
  if (!helper || search.seen.has(helper.declaration)) return;
  search.seen.add(helper.declaration);
  scanProviders(env, search, helper.body, anchor ?? node, depth + 1);
}

function scanProviders(env, search, root, anchor, depth) {
  const checker = checkerOf(env, root.getSourceFile());
  walk(env, root, node => {
    if (!env.ts.isObjectLiteralExpression(node)) {
      followHelper(env, search, checker, node, anchor, depth);
      return;
    }
    const entry = providerEntry(env, search, checker, node, anchor);
    if (entry) search.found.push(entry);
  });
}

/**
 * The `{ provide: <token>, ... }` provider literals of `file` whose token is `name` imported from `moduleName`, in source order.
 * A call or a spread of a function or a const declared in another file of the program is followed (to a depth of four), so a
 * helper that builds the `APP_GUARD` or `APP_FILTER` entries outside the app root file is read too: the entry's `node` is then the
 * call or spread inside the app root (where the entry is provided), its `useClass` and `checker` those of the helper's file.
 */
function providersOf(env, file, name, moduleName) {
  const search = { name, moduleName, found: [], seen: new Set() };
  scanProviders(env, search, file.sourceFile, null, 0);
  return search.found.sort((a, b) => a.node.getStart() - b.node.getStart());
}

/**
 * The small TypeScript reading kit the R33/R38/R39/R41/R45/R84/R86 machine checks share (connection-map, sql-owner,
 * register-once, error-masked, default-deny-app-guard, entrypoint-only-in-apps, error-home). Everything is decided by
 * the checker and by where a declaration lives (the HFS graph), never by a variable name: a framework symbol is
 * recognised by the package it is imported from, a capability class by the file that declares it.
 */
export function machineKit({ context, graph }) {
  const env = { ts: context.ts, context, graph };
  const bound = operation => (...args) => operation(env, ...args);
  return {
    ts: env.ts,
    resolver: graph.resolver,
    providersOf: bound(providersOf),
    checkerOf: bound(checkerOf),
    aliased: bound(aliased),
    symbolAt: bound(symbolAt),
    importBinding: bound(importBinding),
    isImportOf: bound(isImportOf),
    declarationsOf: bound(declarationsOf),
    graphPath: bound(graphPath),
    graphFile: bound(graphFile),
    ownerOfDeclaration: bound(ownerOfDeclaration),
    stringValue: bound(stringValue),
    walk: bound(walk),
    decorators: bound(decorators),
    isExported: bound(isExported),
    propertyNameText: bound(propertyNameText),
    propertyOf: bound(propertyOf),
    valueOfProperty: bound(valueOfProperty),
    at: bound(at),
    appRoot: bound(appRoot),
  };
}

export const upperSnake = name => name.replaceAll('-', '_').toUpperCase();
export const pascal = name => name.split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
