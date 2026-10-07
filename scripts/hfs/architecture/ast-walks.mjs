// ast-walks.mjs - AST walks the architecture checkers share (moved out of typescript.mjs, which keeps the program loading and module resolution).
import { canonical, isInside } from './config.mjs';
import { isConstVariable, sourceLocation } from '../../lib/ts-ast.mjs';
import { UNPROVEN_FRAMEWORK, isUnshadowedCommonJsRequire, relativePath, unwrapExpression } from './typescript.mjs';

/** `expression` unwrapped by the caller's own predicate set (a predicate absent on an older ts reads as never). */
export function unwrapEach(ts, expression, predicates) {
  let current = expression;
  while (current && predicates.some((predicate) => predicate?.(current))) current = current.expression;
  return current;
}

/** `value` with every TS alias hop resolved (a re-exported import reads as its target symbol). */
export function normalizedSymbolValue(ts, checker, value = null) {
  let symbol = value;
  const seen = new Set();
  while (symbol && (symbol.flags & ts.SymbolFlags.Alias) && !seen.has(symbol)) {
    seen.add(symbol);
    const target = checker.getAliasedSymbol(symbol);
    if (!target || target === symbol) break;
    symbol = target;
  }
  return symbol;
}

/** The symbol `node` names, aliases resolved. */
export function normalizedSymbol(ts, checker, node) {
  return normalizedSymbolValue(ts, checker, checker?.getSymbolAtLocation(node) ?? null);
}

/** The identifier or member-name node an expression selects through unwrapExpression, or null. */
export function selectedNode(ts, expression) {
  expression = unwrapExpression(ts, expression);
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) return expression.name;
  if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression;
  return null;
}

/**
 * The symbol `node` ultimately evaluates to: its own symbol, followed through a single `const` variable
 * initializer (and so on). `unselected: 'null'` answers null when `node` selects no name at all.
 */
export function valueSymbol(ts, checker, node, seen = new Set(), { unselected = 'node' } = {}) {
  const selected = selectedNode(ts, node);
  if (!selected && unselected === 'null') return null;
  const symbol = normalizedSymbol(ts, checker, selected ?? node);
  if (!symbol || seen.has(symbol)) return symbol;
  seen.add(symbol);
  const declarations = symbol.getDeclarations?.() ?? [];
  if (declarations.length === 1 && ts.isVariableDeclaration(declarations[0]) && declarations[0].initializer
    && isConstVariable(ts, declarations[0])) {
    return valueSymbol(ts, checker, declarations[0].initializer, seen, { unselected });
  }
  return symbol;
}

/**
 * The expressions `declaration` returns: its body when it is an expression-bodied arrow/function, else every
 * `return`'s argument without descending into nested functions. `functionLike` overrides which node kinds bound
 * that descent (default the four callable declaration kinds; pass `ts.isFunctionLike` for the wider set).
 */
export function returnedExpressions(ts, declaration, { functionLike = null } = {}) {
  const boundary = functionLike ?? ((node) => ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
    || ts.isArrowFunction(node) || ts.isFunctionExpression(node));
  if ((ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration)) && !ts.isBlock(declaration.body)) return [declaration.body];
  const body = boundary(declaration) ? declaration.body : null;
  if (!body || !ts.isBlock(body)) return [];
  const returned = [];
  const visit = (node) => {
    if (node !== body && boundary(node)) return;
    if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
    else ts.forEachChild(node, visit);
  };
  visit(body);
  return returned;
}

/** A node's decorators across TS versions (ts.getDecorators, else the legacy `decorators` property). */
export function nodeDecorators(ts, node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : node.decorators ?? [];
}

/** One finding row: rule id, root-relative path, node position and message, plus rule extras. */
export function violation(config, sourceFile, node, ruleId, message, extra = {}) {
  return { ruleId, path: relativePath(config.root, sourceFile.fileName), ...sourceLocation(sourceFile, node), message, ...extra };
}

/** Whether `match` holds for `node` or a descendant (the walk stops at the first match). */
export function anyDescendant(ts, node, match) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (match(current)) { found = true; return; }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/**
 * The framework kinds `expression` can produce: `directOf(ts, checker, {symbol, selected, targets})` maps a
 * selected node's symbols to a kind (default `targets.get(symbol)`); `shorthandOf` (when set) also resolves
 * shorthand-property declarations and descends property assignments; `newExpression` descends `new X()` callees.
 */
const addKinds = (target, source) => { for (const kind of source) target.add(kind); };

const kindsFromReturns = (ts, checker, declaration, targets, options) => {
  const kinds = new Set();
  for (const returned of returnedExpressions(ts, declaration)) addKinds(kinds, tracedFrameworkKinds(ts, checker, returned, targets, options));
  return kinds;
};

const kindsFromDeclaration = (ts, checker, declaration, targets, options, shorthandOf) => {
  const kinds = new Set();
  if (ts.isVariableDeclaration(declaration) && declaration.initializer)
    addKinds(kinds, tracedFrameworkKinds(ts, checker, declaration.initializer, targets, options));
  if (shorthandOf && ts.isShorthandPropertyAssignment(declaration)) {
    const target = normalizedSymbolValue(ts, checker, checker.getShorthandAssignmentValueSymbol?.(declaration));
    const kind = shorthandOf(ts, checker, target, targets);
    if (kind) kinds.add(kind);
  }
  if (shorthandOf && ts.isPropertyAssignment(declaration))
    addKinds(kinds, tracedFrameworkKinds(ts, checker, declaration.initializer, targets, options));
  addKinds(kinds, kindsFromReturns(ts, checker, declaration, targets, options));
  return kinds;
};

const kindsFromSymbol = (ts, checker, symbol, targets, seen, options) => {
  const nextSeen = new Set(seen).add(symbol);
  const declarationOptions = { ...options, seen: nextSeen };
  const kinds = new Set();
  for (const declaration of symbol.getDeclarations?.() ?? [])
    addKinds(kinds, kindsFromDeclaration(ts, checker, declaration, targets, declarationOptions, options.shorthandOf));
  return kinds;
};

const defaultDirectOf = (ts, checker, { symbol, targets }) => targets.get(symbol) ?? null;

export function tracedFrameworkKinds(ts, checker, expression, targets,
  { seen = new Set(), depth = 0, directOf = null, shorthandOf = null, newExpression = false } = {}) {
  if (!expression) return new Set();
  if (depth > 10) return new Set([UNPROVEN_FRAMEWORK]);
  const unwrapped = unwrapExpression(ts, expression);
  const selected = selectedNode(ts, unwrapped);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const direct = symbol ? (directOf ?? defaultDirectOf)(ts, checker, { symbol, selected, targets }) : null;
  if (direct) return new Set([direct]);
  const options = { depth: depth + 1, directOf, shorthandOf, newExpression };
  if (ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) return kindsFromReturns(ts, checker, unwrapped, targets, { ...options, seen });
  if (ts.isCallExpression(unwrapped)) {
    const kinds = tracedFrameworkKinds(ts, checker, unwrapped.expression, targets, { ...options, seen });
    if (kinds.size) return kinds;
  }
  if (newExpression && ts.isNewExpression(unwrapped))
    return tracedFrameworkKinds(ts, checker, unwrapped.expression, targets, { ...options, seen });
  if (!symbol || seen.has(symbol)) return new Set();
  return kindsFromSymbol(ts, checker, symbol, targets, seen, options);
}

/** 'unproven framework' | 'multiple framework' | the one kind | null, for a decorator whose expression constructs. */
export function constructedDecoratorKind(ts, checker, decorator, targets, traceOpts = {}) {
  const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  const kinds = tracedFrameworkKinds(ts, checker, callee, targets, traceOpts);
  if (kinds.has(UNPROVEN_FRAMEWORK)) return 'unproven framework';
  if (kinds.size === 1) return [...kinds][0];
  return kinds.size ? 'multiple framework' : null;
}

/** The target a decorator resolves to through a `let`/`var` alias's single initializer, or null. */
export function mutableDecoratorKind(ts, checker, decorator, targets) {
  const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  const selected = selectedNode(ts, callee);
  const symbol = selected ? normalizedSymbol(ts, checker, selected) : null;
  const declarations = symbol?.getDeclarations?.() ?? [];
  if (declarations.length !== 1 || !ts.isVariableDeclaration(declarations[0]) || !declarations[0].initializer
    || isConstVariable(ts, declarations[0])) return null;
  return targets.get(valueSymbol(ts, checker, declarations[0].initializer)) ?? null;
}

/** The callee expression of a decorator (the called expression of `@x(...)`, else the expression itself). */
export function decoratorCallee(ts, decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
}

/**
 * The module `statement` (import, export-from or import-equals) statically binds: its specifier text, the
 * module's symbol and its exported symbols by name (aliases resolved); `symbol` is null when the module does
 * not resolve. Null when the statement names no static specifier.
 */
export function moduleExportsOf(ts, checker, statement) {
  let moduleSpecifier = null;
  if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    && statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)) moduleSpecifier = statement.moduleSpecifier;
  let importEquals = null;
  if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)
    && statement.moduleReference.expression && ts.isStringLiteralLike(statement.moduleReference.expression)) importEquals = statement.moduleReference.expression;
  const specifierNode = moduleSpecifier ?? importEquals;
  const specifier = specifierNode?.text;
  if (specifier == null) return null;
  const symbol = checker.getSymbolAtLocation(specifierNode) ?? null;
  const exports = new Map((symbol ? checker.getExportsOfModule(symbol) : []).map(item => [item.getName(), normalizedSymbolValue(ts, checker, item)]));
  return { specifierNode, specifier, symbol, exports };
}

/**
 * The program source files a framework-target scan of `checker` judges: every file in `localFiles`, plus (when
 * `root` is given) declaration files inside the root but outside node_modules. Null when no program of the
 * context owns the checker.
 */
export function programSourcesOf(context, checker, localFiles, { root = null } = {}) {
  const program = context.programs.find(candidate => candidate.getTypeChecker() === checker) ?? null;
  if (!program) return null;
  return program.getSourceFiles().filter(sourceFile => localFiles.has(canonical(sourceFile.fileName))
    || (root && sourceFile.isDeclarationFile && isInside(root, sourceFile.fileName)
      && !sourceFile.fileName.replaceAll('\\', '/').includes('/node_modules/')));
}

/**
 * The CommonJS require() caveat every framework scan reports: each `require('<specifier>')` `accepted` pushes
 * `${filePath} uses a CommonJS <label ?? specifier> <detail>` (the import-shape reasoning cannot prove that binding).
 */
export function commonJsRequireReasons(ts, checker, sourceFile, accepted, reasons, filePath, detail) {
  const label = arguments[7] ?? null;
  const visit = node => {
    if (ts.isCallExpression(node) && isUnshadowedCommonJsRequire(ts, checker, node.expression)
      && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]) && accepted(node.arguments[0].text)) {
      reasons.push(`${filePath} uses a CommonJS ${label ?? node.arguments[0].text} ${detail}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}
