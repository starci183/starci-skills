// undeclared-names.mjs — scope analysis over a parsed module: every identifier a source reads or writes resolves to a
// declaration, import, parameter or a declared global, or it is reported. The TypeScript `ts` is the caller's already-resolved
// compiler (see scripts/hfs/runtime-rules/source-ast.mjs); nothing here loads a package. Pure.
//   undeclaredNames(ts, source)   [{name, line, column}] of the identifiers of a parsed SourceFile that resolve to nothing
//
// Scopes: the module, every function (parameters, `arguments`, `var`), every block, loop head, catch clause and class.
// `export {x} from './y.mjs'` binds nothing locally. `typeof x` never reports (the guard is the point). A function handed to a
// browser-driver call (page.evaluate and its siblings) also sees the browser globals, since its body runs in the page.
import { hasFlag } from './ts-ast.mjs';

const words = (text) => Object.freeze(new Set(text.split(/\s+/).filter(Boolean)));

/** The ECMAScript and Node globals of an ES module (no `require`, `module`, `exports`, `__dirname`: a module has none). */
const MODULE_GLOBALS = words(`undefined NaN Infinity globalThis eval isNaN isFinite parseInt parseFloat encodeURI encodeURIComponent
  decodeURI decodeURIComponent escape unescape Object Function Array String Number Boolean Symbol BigInt Math Date RegExp JSON Intl Reflect
  Proxy Promise Map Set WeakMap WeakSet WeakRef FinalizationRegistry Error EvalError RangeError ReferenceError SyntaxError TypeError
  URIError AggregateError ArrayBuffer SharedArrayBuffer DataView Atomics Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array
  Int32Array Uint32Array Float32Array Float64Array BigInt64Array BigUint64Array Iterator WebAssembly
  process console Buffer global setTimeout clearTimeout setInterval clearInterval setImmediate clearImmediate queueMicrotask
  structuredClone URL URLSearchParams TextEncoder TextDecoder AbortController AbortSignal Event EventTarget fetch Headers Request
  Response FormData Blob File performance atob btoa BroadcastChannel MessageChannel MessagePort MessageEvent crypto navigator
  ReadableStream WritableStream TransformStream CompressionStream DecompressionStream DOMException WebSocket CustomEvent`);

/** What a function that runs inside a page (an argument of page.evaluate and its siblings) may read besides the module globals. */
const BROWSER_GLOBALS = words(`window document self location history screen localStorage sessionStorage getComputedStyle matchMedia
  requestAnimationFrame cancelAnimationFrame requestIdleCallback Node Element HTMLElement SVGElement Document DocumentFragment ShadowRoot
  NodeFilter Range Selection CSS CSSStyleSheet DOMParser XMLSerializer MutationObserver ResizeObserver IntersectionObserver Image
  FontFace Text Comment innerWidth innerHeight devicePixelRatio scrollX scrollY pageXOffset pageYOffset alert confirm prompt
  HTMLInputElement HTMLImageElement HTMLCanvasElement HTMLAnchorElement HTMLButtonElement HTMLTextAreaElement HTMLSelectElement`);

/** The call names whose function arguments run inside a browser page. */
const PAGE_CALLS = words('evaluate evaluateHandle evaluateOnNewDocument $eval $$eval waitForFunction addInitScript addScriptTag exposeFunction');

/** The identifier names a binding name (an identifier or a destructuring pattern) declares. */
function bindingNames(t, name, into = []) {
  if (t.isIdentifier(name)) into.push(name.text);
  else if (t.isObjectBindingPattern(name) || t.isArrayBindingPattern(name)) {
    for (const element of name.elements) if (t.isBindingElement(element)) bindingNames(t, element.name, into);
  }
  return into;
}

const isFunctionLike = (t, node) => t.isFunctionDeclaration(node) || t.isFunctionExpression(node) || t.isArrowFunction(node)
  || t.isMethodDeclaration(node) || t.isConstructorDeclaration(node) || t.isGetAccessorDeclaration(node) || t.isSetAccessorDeclaration(node);

const isBlockScoped = (t, list) => hasFlag(list.flags, t.NodeFlags.Let) || hasFlag(list.flags, t.NodeFlags.Const);

/** Every `var` name declared anywhere inside `node` without crossing into a nested function or class. */
function varNames(t, node, into) {
  if (isFunctionLike(t, node) || t.isClassLike(node)) return into;
  if (t.isVariableDeclarationList(node) && !isBlockScoped(t, node)) for (const d of node.declarations) bindingNames(t, d.name, into);
  t.forEachChild(node, (child) => { varNames(t, child, into); });
  return into;
}

function importNames(t, statement, into) {
  const clause = statement.importClause;
  if (clause?.name) into.push(clause.name.text);
  const bindings = clause?.namedBindings;
  if (bindings && t.isNamespaceImport(bindings)) into.push(bindings.name.text);
  else if (bindings) for (const element of bindings.elements) into.push(element.name.text);
}

/** The names the statements of one scope declare lexically: let/const, classes, functions, imports. */
function lexicalNames(t, statements) {
  const names = [];
  for (const statement of statements) {
    if (t.isVariableStatement(statement) && isBlockScoped(t, statement.declarationList)) for (const d of statement.declarationList.declarations) bindingNames(t, d.name, names);
    else if ((t.isClassDeclaration(statement) || t.isFunctionDeclaration(statement)) && statement.name) names.push(statement.name.text);
    else if (t.isImportDeclaration(statement)) importNames(t, statement, names);
    else if (t.isLabeledStatement(statement)) names.push(...lexicalNames(t, [statement.statement]));
  }
  return names;
}

class Scope {
  constructor(parent, { page = false } = {}) { this.parent = parent; this.names = new Set(); this.page = page || Boolean(parent?.page); }

  declare(names) { for (const name of names) this.names.add(name); }

  has(name) {
    for (let scope = this; scope; scope = scope.parent) if (scope.names.has(name)) return true;
    return MODULE_GLOBALS.has(name) || (this.page && BROWSER_GLOBALS.has(name));
  }
}

/** Whether `node` (an identifier) names a binding being declared or a property being named, not a value being read. */
function isNameOnly(t, node) {
  const parent = node.parent;
  if (!parent) return false;
  if (t.isPropertyAccessExpression(parent) || t.isQualifiedName(parent)) return parent.name === node;
  if (t.isPropertyAssignment(parent) || t.isMethodDeclaration(parent) || t.isPropertyDeclaration(parent) || t.isGetAccessorDeclaration(parent) || t.isSetAccessorDeclaration(parent)) return parent.name === node;
  if (t.isBindingElement(parent)) return parent.name === node || parent.propertyName === node;
  if (t.isVariableDeclaration(parent) || t.isParameter(parent) || t.isClassDeclaration(parent) || t.isClassExpression(parent) || t.isFunctionDeclaration(parent) || t.isFunctionExpression(parent)) return parent.name === node;
  if (t.isImportClause(parent) || t.isImportSpecifier(parent) || t.isNamespaceImport(parent) || t.isNamespaceExport(parent)) return true;
  if (t.isExportSpecifier(parent)) return Boolean(parent.parent.parent.moduleSpecifier) || parent.name === node && Boolean(parent.propertyName);
  if (t.isLabeledStatement(parent) || t.isBreakOrContinueStatement(parent)) return parent.label === node;
  if (t.isMetaProperty(parent)) return true;
  return false;
}

/**
 * The identifiers passed as an argument to a browser-page call (`page.evaluate(measure, arg)` names `measure`). A function
 * handed to a call that assembles the page script (`page.evaluate(pageScript(measure, [visible, tagOf]))`) runs in the page too,
 * so the identifiers an argument call or array literal carries count as well.
 */
export function pageCallNames(t, source) {
  const names = new Set();
  const collect = (argument) => {
    if (t.isIdentifier(argument)) names.add(argument.text);
    else if (t.isCallExpression(argument)) for (const inner of argument.arguments) collect(inner);
    else if (t.isArrayLiteralExpression(argument)) for (const inner of argument.elements) collect(inner);
  };
  const visit = (node) => {
    if (t.isCallExpression(node) && t.isPropertyAccessExpression(node.expression) && PAGE_CALLS.has(node.expression.name.text)) for (const argument of node.arguments) collect(argument);
    t.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

const hasModifier = (t, statement, kind) => Boolean(statement.modifiers?.some((modifier) => modifier.kind === kind));

/** Records the relative named and default imports of `statement` into `imports` (local name -> {specifier, name}). */
function addImportLinks(t, statement, imports) {
  const specifier = statement.moduleSpecifier.text;
  const clause = statement.importClause;
  if (clause?.name) imports.set(clause.name.text, { specifier, name: 'default' });
  if (clause?.namedBindings && t.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) imports.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text });
  }
}

/** Records the names of an `export { ... }` or `export { ... } from` statement into `exports`. */
function addExportListLinks(t, statement, exports) {
  const specifier = statement.moduleSpecifier?.text;
  for (const element of statement.exportClause.elements) {
    const from = (element.propertyName ?? element.name).text;
    exports.set(element.name.text, specifier ? { specifier, name: from } : { local: from });
  }
}

/** Records the names a declaration carrying an `export` modifier exports into `exports`. */
function addDeclarationExports(t, statement, exports) {
  const names = t.isVariableStatement(statement) ? statement.declarationList.declarations.flatMap((d) => bindingNames(t, d.name)) : [statement.name?.text].filter(Boolean);
  const isDefault = hasModifier(t, statement, t.SyntaxKind.DefaultKeyword);
  for (const name of names) exports.set(isDefault ? 'default' : name, { local: name });
}

/**
 * How a module links to others: `imports` maps a local name to {specifier, name} for each relative named or default import,
 * `exports` maps an exported name to {local} (declared here) or {specifier, name} (re-exported from another module).
 */
export function moduleLinks(t, source) {
  const imports = new Map();
  const exports = new Map();
  for (const statement of source.statements) {
    if (t.isImportDeclaration(statement) && t.isStringLiteral(statement.moduleSpecifier)) addImportLinks(t, statement, imports);
    else if (t.isExportDeclaration(statement) && statement.exportClause && t.isNamedExports(statement.exportClause)) addExportListLinks(t, statement, exports);
    else if (hasModifier(t, statement, t.SyntaxKind.ExportKeyword)) addDeclarationExports(t, statement, exports);
  }
  return { imports, exports };
}

/**
 * The {name, line, column} of every identifier of the parsed module `source` that resolves to no declaration, import or global.
 * `pageFunctions` names functions of this module that run in a browser page because another module hands them to page.evaluate.
 */
export function undeclaredNames(t, source, { pageFunctions = new Set() } = {}) {
  const found = [];
  const pageNames = new Set([...pageCallNames(t, source), ...pageFunctions]);
  const report = (node) => {
    const at = source.getLineAndCharacterOfPosition(node.getStart(source));
    found.push({ name: node.text, line: at.line + 1, column: at.character + 1 });
  };
  const inPageCall = (node) => t.isCallExpression(node.parent) && node.parent.arguments.includes(node)
    && t.isPropertyAccessExpression(node.parent.expression) && PAGE_CALLS.has(node.parent.expression.name.text);

  function visitFunction(node, scope) {
    const own = new Scope(scope, { page: inPageCall(node) || (node.name && pageNames.has(node.name.text)) });
    if (t.isFunctionExpression(node) && node.name) own.declare([node.name.text]);
    if (!t.isArrowFunction(node)) own.declare(['arguments']);
    for (const parameter of node.parameters) own.declare(bindingNames(t, parameter.name));
    if (node.body && t.isBlock(node.body)) own.declare([...varNames(t, node.body, []), ...lexicalNames(t, node.body.statements)]);
    for (const parameter of node.parameters) visit(parameter, own);
    if (node.body && t.isBlock(node.body)) node.body.statements.forEach((statement) => visit(statement, own));
    else if (node.body) visit(node.body, own);
  }

  function visitClass(node, scope) {
    const own = new Scope(scope);
    if (t.isClassExpression(node) && node.name) own.declare([node.name.text]);
    for (const clause of node.heritageClauses ?? []) visit(clause, own);
    for (const member of node.members) visit(member, own);
  }

  function visitBlockLike(statements, node, scope) {
    const own = new Scope(scope);
    own.declare(lexicalNames(t, statements));
    t.forEachChild(node, (child) => { visit(child, own); });
  }

  function visitStaticBlock(node, scope) {
    const own = new Scope(scope);
    own.declare([...varNames(t, node.body, []), ...lexicalNames(t, node.body.statements)]);
    node.body.statements.forEach((statement) => visit(statement, own));
    return undefined;
  }

  function visitLoop(node, scope) {
    const own = new Scope(scope);
    const head = node.initializer;
    if (head && t.isVariableDeclarationList(head) && isBlockScoped(t, head)) own.declare(head.declarations.flatMap((d) => bindingNames(t, d.name)));
    t.forEachChild(node, (child) => { visit(child, own); });
    return undefined;
  }

  function visitCatch(node, scope) {
    const own = new Scope(scope);
    if (node.variableDeclaration) own.declare(bindingNames(t, node.variableDeclaration.name));
    t.forEachChild(node, (child) => { visit(child, own); });
    return undefined;
  }

  function visit(node, scope) {
    if (isFunctionLike(t, node)) return visitFunction(node, scope);
    if (t.isClassLike(node)) return visitClass(node, scope);
    if (t.isBlock(node) || t.isModuleBlock(node)) return visitBlockLike(node.statements, node, scope);
    if (t.isCaseBlock(node)) return visitBlockLike(node.clauses.flatMap((clause) => [...clause.statements]), node, scope);
    if (t.isClassStaticBlockDeclaration(node)) return visitStaticBlock(node, scope);
    if (t.isForStatement(node) || t.isForInStatement(node) || t.isForOfStatement(node)) return visitLoop(node, scope);
    if (t.isCatchClause(node)) return visitCatch(node, scope);
    if (t.isTypeOfExpression(node) && t.isIdentifier(node.expression)) return undefined;
    if (t.isIdentifier(node)) {
      if (!isNameOnly(t, node) && !scope.has(node.text)) report(node);
      return undefined;
    }
    t.forEachChild(node, (child) => { visit(child, scope); });
    return undefined;
  }

  const module = new Scope(null);
  module.declare([...varNames(t, source, []), ...lexicalNames(t, source.statements)]);
  source.statements.forEach((statement) => visit(statement, module));
  return found;
}
