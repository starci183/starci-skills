import path from 'node:path';
import { allowsFile } from '../allows.mjs';
import { relativePath, unwrapExpression } from './typescript.mjs';
import { accessName, sourceLocation } from '../../lib/ts-ast.mjs';

const PROCESS_MODULES = new Set(['process', 'node:process']);
const PROCESS_GLOBAL = new Set(['process']);
const GLOBAL_HOLDERS = new Set(['globalThis', 'global']);
const REFLECT_GLOBAL = new Set(['Reflect']);

function bindingName(ts, element) {
  const name = element.propertyName ?? element.name;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression) ? name.expression.text : null;
}

/** A global name is not a same-named local variable or parameter. */
function isGlobalName(ts, checker, node, names) {
  if (!ts.isIdentifier(node) || !names.has(node.text)) return false;
  const declarations = checker?.getSymbolAtLocation(node)?.getDeclarations() ?? [];
  return declarations.every(declaration => declaration.getSourceFile().isDeclarationFile);
}

function recordProcessBindings(ts, clause, add, report) {
  if (clause?.name) add(clause.name);
  const bindings = clause?.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) add(bindings.name);
  if (!bindings || !ts.isNamedImports(bindings)) return;
  for (const element of bindings.elements) {
    const name = (element.propertyName ?? element.name).text;
    if (name === 'env') report(element);
    else if (name === 'default') add(element.name);
  }
}

function processImportSymbols(ts, checker, sourceFile, report) {
  const imports = new Set();
  const add = name => {
    const symbol = checker.getSymbolAtLocation(name);
    if (symbol) imports.add(symbol);
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)
      || !PROCESS_MODULES.has(statement.moduleSpecifier.text)) continue;
    recordProcessBindings(ts, statement.importClause, add, report);
  }
  return imports;
}

/** Process bindings are resolved by symbol, so a nested parameter cannot masquerade as an imported process. */
function processAccess(ts, checker, sourceFile, report) {
  const imports = processImportSymbols(ts, checker, sourceFile, report);
  const isProcess = expression => {
    const node = unwrapExpression(ts, expression);
    if (!node) return false;
    if (ts.isIdentifier(node)) return imports.has(checker.getSymbolAtLocation(node))
      || isGlobalName(ts, checker, node, PROCESS_GLOBAL);
    return accessName(ts, node) === 'process'
      && isGlobalName(ts, checker, node.expression, GLOBAL_HOLDERS);
  };
  return node => {
    if (accessName(ts, node) === 'env' && isProcess(node.expression)) report(node);
    if (ts.isVariableDeclaration(node) && node.initializer && isProcess(node.initializer) && ts.isObjectBindingPattern(node.name)
      && node.name.elements.some(element => bindingName(ts, element) === 'env')) report(node);
    if (ts.isCallExpression(node) && accessName(ts, node.expression) === 'get'
      && isGlobalName(ts, checker, node.expression.expression, REFLECT_GLOBAL)
      && isProcess(node.arguments[0]) && node.arguments[1] && ts.isStringLiteralLike(node.arguments[1]) && node.arguments[1].text === 'env') report(node);
  };
}

/** The declaration, rather than the caller's name, identifies EnvSource readers and configuration helpers. */
function appEnvironmentCall(config, ts, checker, call) {
  const declaration = checker.getResolvedSignature(call)?.declaration;
  if (!declaration) return false;
  const relative = relativePath(config.root, declaration.getSourceFile().fileName);
  if (ts.isMethodDeclaration(declaration) && ts.isClassDeclaration(declaration.parent) && declaration.parent.name?.text === 'EnvSource') {
    return config.hfs.tierOf(relative) === 'platform' && path.posix.basename(config.hfs.ownerOf(relative)?.root ?? '') === 'config';
  }
  if (!ts.isFunctionDeclaration(declaration) && !ts.isArrowFunction(declaration) && !ts.isFunctionExpression(declaration)) return false;
  return allowsFile(config.hfs, relative)?.entry === '<app>.env.ts'
    || (path.posix.basename(relative).endsWith('.config.ts') && config.hfs.slotOf(relative) !== null);
}

/** Composition groups and options consume parsed options; only the app's matching env role and main read them. */
export function checkApplicationEnvironment(config, context, sourceFile, fileName, violations) {
  const role = allowsFile(config.hfs, relativePath(config.root, fileName));
  if (role?.allowed && (role.entry === 'main.ts' || role.entry === '<app>.env.ts')) return;
  const { ts } = context;
  const checker = context.checkerFor(fileName);
  const report = node => violations.push({
    ruleId: 'BE_APP_COMPOSITION_ONLY',
    path: relativePath(config.root, fileName),
    ...sourceLocation(sourceFile, node),
    message: "Application environment reads live in main.ts or the matching <app>.env.ts. Options files and compose/<area>.ts receive the typed result of read<App>Env(env: EnvSource).",
  });
  const checkProcess = processAccess(ts, checker, sourceFile, report);
  const visit = node => {
    checkProcess(node);
    if (ts.isCallExpression(node) && appEnvironmentCall(config, ts, checker, node)) report(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}
