import fs from 'node:fs';
import path from 'node:path';
import { isInside, slash } from '../architecture/config.mjs';

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
export const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const pathKey = file => slash(path.resolve(file));

export function exact(value, keys, label) {
  if (!plain(value)) throw Error(`${label} must be an object.`);
  const unexpected = Object.keys(value).filter(name => !keys.includes(name));
  if (unexpected.length) throw Error(`${label} has unsupported fields: ${unexpected.join(', ')}.`);
}

export const missingContract = (name, label, schema) => `package.json#starci.codePatterns.${name} is not declared: the repository owes its ${label} (${schema}) - the target contract is missing, not the checker`;

export function repositoryRelative(value, label, { allowDot = false } = {}) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)
    || value !== path.posix.normalize(value) || value.split('/').includes('..') || (!allowDot && value === '.')) throw Error(`${label} must be a normalized repository-relative path.`);
  return value;
}

/** Resolve a repository-relative path whose every ancestor up to the realpath root is inside it and no link. */
export function repositoryPath(root, relative, label, { kind = 'file', allowDot = false } = {}) {
  repositoryRelative(relative, label, { allowDot });
  const absolute = path.resolve(root, relative);
  for (let cursor = absolute; cursor !== root; cursor = path.dirname(cursor)) {
    if (!isInside(root, cursor)) throw Error(`${label} leaves the repository: ${relative}`);
    let stat;
    try { stat = fs.lstatSync(cursor); } catch { throw Error(`${label} does not exist: ${relative}`); }
    if (stat.isSymbolicLink()) throw Error(`${label} cannot redirect through a link: ${relative}`);
  }
  const stat = fs.lstatSync(absolute);
  if (kind === 'file' ? !stat.isFile() : !stat.isDirectory()) throw Error(`${label} is not a regular ${kind}: ${relative}`);
  return absolute;
}

const OUTPUT_OPTIONS = new Set(['configFilePath', 'outDir', 'declarationDir', 'tsBuildInfoFile']);

/** Compiler options that decide a source's meaning; output locations do not. */
export function compilerIdentity(options) {
  const stable = value => Array.isArray(value) ? value.map(stable) : plain(value)
    ? Object.fromEntries(Object.keys(value).sort().filter(name => !OUTPUT_OPTIONS.has(name)).map(name => [name, stable(value[name])])) : value;
  return JSON.stringify(stable(options));
}

/** The one compatible TypeScript project whose root files own `absolute`. */
export function projectBinding(context, absolute) {
  const owners = context.projects.filter(project => project.program.getRootFileNames().some(file => pathKey(file) === pathKey(absolute)));
  if (!owners.length) throw Error(`Source has no owning TypeScript project: ${absolute}`);
  if (new Set(owners.map(project => compilerIdentity(project.options))).size !== 1) throw Error(`Source has conflicting TypeScript project meaning: ${absolute}`);
  const project = owners[0], source = project.program.getSourceFile(absolute);
  if (!source || project.program.getSyntacticDiagnostics(source).length) throw Error(`Source is unavailable or syntactically invalid: ${absolute}`);
  return { source, checker: project.program.getTypeChecker(), program: project.program };
}

/** Located findings, deduplicated; `unavailable` ones are errors, the rest violations. */
export function issueSink(root, result) {
  const seen = new Set();
  return (source, ruleId, node, message, unavailable = false) => {
    const relative = slash(path.relative(root, source.fileName)), point = source.getLineAndCharacterOfPosition(node.getStart(source));
    const id = `${relative}:${node.pos}:${ruleId}:${message}`;
    if (seen.has(id)) return;
    seen.add(id);
    (unavailable ? result.errors : result.violations).push({ ruleId, path: relative, line: point.line + 1, column: point.character + 1, message });
  };
}

const wrapper = (ts, node) => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
  || ts.isNonNullExpression(node) || ts.isSatisfiesExpression?.(node);

/** Strip parentheses, type assertions, non-null and satisfies. */
export function unwrap(ts, node) {
  while (node && wrapper(ts, node)) node = node.expression;
  return node;
}

/** unwrap, also through await: the value an expression settles to. */
export function unwrapValue(ts, node) {
  while (node && (wrapper(ts, node) || ts.isAwaitExpression(node))) node = node.expression;
  return node;
}

export function unalias(ts, checker, symbol) {
  const seen = new Set();
  while (symbol && symbol.flags & ts.SymbolFlags.Alias && !seen.has(symbol)) { seen.add(symbol); symbol = checker.getAliasedSymbol(symbol); }
  return symbol;
}

export const symbolAt = (ts, checker, node) => node ? unalias(ts, checker, checker.getSymbolAtLocation(node)) : null;

export function propertyName(ts, node) {
  return ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : null;
}

export function moduleSpecifier(ts, declaration) {
  for (let node = declaration; node; node = node.parent) if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) return node.moduleSpecifier.text;
  return null;
}

/** `{module, name}` of a named or namespace import an expression reads, else null. */
export function importedBinding(ts, checker, input) {
  const node = unwrapValue(ts, input);
  if (ts.isPropertyAccessExpression(node)) {
    const namespace = (checker.getSymbolAtLocation(node.expression)?.declarations ?? []).find(item => ts.isNamespaceImport(item));
    return namespace ? { module: moduleSpecifier(ts, namespace), name: node.name.text } : null;
  }
  if (!ts.isIdentifier(node)) return null;
  const declaration = (checker.getSymbolAtLocation(node)?.declarations ?? []).find(item => ts.isImportSpecifier(item));
  return declaration ? { module: moduleSpecifier(ts, declaration), name: declaration.propertyName?.text ?? declaration.name.text } : null;
}

export function exportedIdentity(ts, checker, source, name) {
  const module = checker.getSymbolAtLocation(source);
  const exported = module && checker.getExportsOfModule(module).find(item => item.name === name);
  return exported && unalias(ts, checker, exported);
}

export function identityInProgram(ts, binding, item) {
  const source = binding.program.getSourceFile(item.absolute);
  return source && exportedIdentity(ts, binding.checker, source, item.export);
}

export function declaredType(checker, symbol) {
  try { return checker.getDeclaredTypeOfSymbol(symbol); } catch { return null; }
}

export function extendsIdentity(type, identity, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  if (type.getSymbol?.() === identity || type.aliasSymbol === identity) return true;
  return (type.getBaseTypes?.() ?? []).some(base => extendsIdentity(base, identity, seen));
}

function assignmentTargetsIdentity(ts, checker, input, identity) {
  const node = unwrapValue(ts, input);
  if (ts.isIdentifier(node)) return symbolAt(ts, checker, node) === identity;
  if (ts.isArrayLiteralExpression(node)) return node.elements.some(item => assignmentTargetsIdentity(ts, checker, item, identity));
  if (ts.isObjectLiteralExpression(node)) return node.properties.some(item => {
    if (ts.isShorthandPropertyAssignment(item)) return symbolAt(ts, checker, item.name) === identity;
    if (ts.isPropertyAssignment(item)) return assignmentTargetsIdentity(ts, checker, item.initializer, identity);
    if (ts.isSpreadAssignment(item)) return assignmentTargetsIdentity(ts, checker, item.expression, identity);
    return false;
  });
  return false;
}

/** Whether `scope` assigns or increments `identity` before offset `before`. */
export function assignedBefore(ts, checker, scope, identity, before) {
  let assigned = false;
  const visit = node => {
    if (assigned || node.pos >= before) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment && assignmentTargetsIdentity(ts, checker, node.left, identity)) { assigned = true; return; }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && symbolAt(ts, checker, node.operand) === identity) { assigned = true; return; }
    ts.forEachChild(node, visit);
  };
  visit(scope); return assigned;
}

/** Whether `input` is `origin`, directly or through const aliases, unassigned in `scope` before use. */
export function unchangedOrigin(ts, checker, input, origin, scope, before, seen = new Set()) {
  const node = unwrapValue(ts, input);
  if (!node) return false;
  const identity = symbolAt(ts, checker, node);
  if (identity === origin) return !assignedBefore(ts, checker, scope, origin, before);
  if (!ts.isIdentifier(node) || !identity || seen.has(identity)) return false;
  seen.add(identity);
  const declaration = identity.valueDeclaration;
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer
    || !(ts.getCombinedNodeFlags(declaration.parent) & ts.NodeFlags.Const)
    || assignedBefore(ts, checker, scope, identity, before)) return false;
  return unchangedOrigin(ts, checker, declaration.initializer, origin, scope, declaration.initializer.pos, seen);
}
