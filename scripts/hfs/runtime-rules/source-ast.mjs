// source-ast.mjs - the syntax-tree reading the runtime rules share (scripts/hfs/runtime-check.mjs): one TypeScript parse
// per runtime source file, never a text grep. Pure: every function takes a source text and returns facts about it.
//   parseSource(text, file)       the TypeScript SourceFile (JS script kind for .mjs/.cjs/.js)
//   moduleRefs(source)            every import/export-from/require()/import() of a string specifier: [{module, line}]
//   relativeImports(source)       the relative specifiers among them: [{specifier, line, column}]
//   localBindings(source)         every name the file declares (variables, functions, classes, parameters, imports)
//   declaredNames(source)         the names the file declares at any depth as a function, class or variable (RT_RETIRED_PRESENT)
//   exportedNames(source)         the names the module exports (export function/const/class, export {a as b}, default)
import { createRequire } from 'node:module';

let typescript = null;
/** The TypeScript compiler, loaded once from the runtime's own dependencies. */
export const ts = () => (typescript ??= createRequire(import.meta.url)('typescript'));

const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);

/** `node` is a string literal naming an fs module specifier ('fs', 'node:fs', 'fs/promises', 'node:fs/promises'). */
const fsSpecifier = (t, node) => Boolean(node && t.isStringLiteralLike(node) && FS_MODULES.has(node.text));

/** `node` is a `require('fs' | 'node:fs' | 'fs/promises' | 'node:fs/promises')` call. */
const fsRequireCall = (t, node) => node && t.isCallExpression(node) && t.isIdentifier(node.expression) && node.expression.text === 'require' && fsSpecifier(t, node.arguments[0]);

/**
 * The fs bindings a parsed source declares: `{ namespaces, members }`. `namespaces` holds the local names bound to
 * a whole fs module - a default or namespace import, a `promises` named import, `const fs = require('fs')`.
 * `members` is a Map(local name -> imported name) of named imports `wanted` accepts, plus the names of a
 * `const {x} = require('fs')` destructure unless `destructuredRequires` is false.
 */
export function fsBindings(source, wanted, { destructuredRequires = true } = {}) {
  const t = ts();
  const namespaces = new Set();
  const members = new Map();
  const bind = (node) => {
    if (t.isImportDeclaration(node) && fsSpecifier(t, node.moduleSpecifier)) {
      const c = node.importClause;
      if (c?.name) namespaces.add(c.name.text);
      const b = c?.namedBindings;
      if (b && t.isNamespaceImport(b)) namespaces.add(b.name.text);
      if (b && t.isNamedImports(b)) for (const el of b.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (imported === 'promises') namespaces.add(el.name.text);
        else if (wanted(imported)) members.set(el.name.text, imported);
      }
    }
    if (t.isVariableDeclaration(node) && node.initializer && fsRequireCall(t, node.initializer)) {
      if (t.isIdentifier(node.name)) namespaces.add(node.name.text);
      else if (destructuredRequires && t.isObjectBindingPattern(node.name)) for (const el of node.name.elements) {
        const imported = el.propertyName && t.isIdentifier(el.propertyName) ? el.propertyName.text : t.isIdentifier(el.name) ? el.name.text : null;
        if (imported && wanted(imported) && t.isIdentifier(el.name)) members.set(el.name.text, imported);
      }
    }
    t.forEachChild(node, bind);
  };
  bind(source);
  return { namespaces, members };
}

/** The fs member `callee` (a property access: `fs.X`, `fs.promises.X`) reaches through `namespaces`, or null. */
export const fsMemberAccess = (t, callee, namespaces, wanted) => {
  if (!t.isPropertyAccessExpression(callee) || !wanted(callee.name.text)) return null;
  const target = callee.expression;
  if (t.isIdentifier(target) && namespaces.has(target.text)) return callee.name.text;
  if (t.isPropertyAccessExpression(target) && target.name.text === 'promises' && t.isIdentifier(target.expression) && namespaces.has(target.expression.text)) return callee.name.text;
  return null;
};

/** The SourceFile of `text`; `.ts` files parse as TypeScript, everything else as JavaScript. */
export function parseSource(text, file = 'x.mjs') {
  const t = ts();
  return t.createSourceFile(file, String(text), t.ScriptTarget.Latest, true, /\.ts$/.test(file) ? t.ScriptKind.TS : t.ScriptKind.JS);
}

/** The 1-based line of `node` in `source`. */
export const lineOf = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** Every module reference of a parsed file: static imports, re-exports, require('x') and import('x') with a string specifier. */
export function moduleRefs(source) {
  const t = ts();
  const out = [];
  const visit = (node) => {
    if ((t.isImportDeclaration(node) || t.isExportDeclaration(node)) && node.moduleSpecifier && t.isStringLiteralLike(node.moduleSpecifier)) {
      out.push({ module: node.moduleSpecifier.text, line: lineOf(source, node), column: source.getLineAndCharacterOfPosition(node.getStart(source)).character + 1 });
    } else if (t.isCallExpression(node) && node.arguments.length && t.isStringLiteralLike(node.arguments[0])) {
      const callee = node.expression;
      if ((t.isIdentifier(callee) && callee.text === 'require') || callee.kind === t.SyntaxKind.ImportKeyword) {
        out.push({ module: node.arguments[0].text, line: lineOf(source, node), column: source.getLineAndCharacterOfPosition(node.getStart(source)).character + 1 });
      }
    }
    t.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** The relative module references (`./x.mjs`, `../y.mjs`) of a parsed file. */
export const relativeImports = (source) => moduleRefs(source).filter((ref) => ref.module.startsWith('.')).map((ref) => ({ specifier: ref.module, line: ref.line, column: ref.column }));

/** Every local name a parsed file binds: variable and parameter names (destructuring included), functions, classes, imports. */
export function localBindings(source) {
  const t = ts();
  const names = new Set();
  const bindName = (name) => {
    if (!name) return;
    if (t.isIdentifier(name)) names.add(name.text);
    else if (t.isObjectBindingPattern(name) || t.isArrayBindingPattern(name)) for (const el of name.elements) if (!t.isOmittedExpression(el)) bindName(el.name);
  };
  const visit = (node) => {
    if (t.isVariableDeclaration(node) || t.isParameter(node)) bindName(node.name);
    else if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node) || t.isFunctionExpression(node) || t.isClassExpression(node)) && node.name) names.add(node.name.text);
    else if (t.isImportClause(node) && node.name) names.add(node.name.text);
    else if (t.isNamespaceImport(node) || t.isImportSpecifier(node)) names.add(node.name.text);
    t.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** The names a parsed file declares as a function, a class or a variable, at any depth, with their lines. */
export function declaredNames(source) {
  const t = ts();
  const out = [];
  const visit = (node) => {
    if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) && node.name) out.push({ name: node.name.text, line: lineOf(source, node) });
    else if (t.isVariableDeclaration(node) && t.isIdentifier(node.name)) out.push({ name: node.name.text, line: lineOf(source, node) });
    t.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** The names a parsed module exports, each with whether it is a function (declaration or an arrow/function initializer). */
export function exportedNames(source) {
  const t = ts();
  const out = [];
  const exported = (node) => (t.canHaveModifiers?.(node) ? t.getModifiers(node) : node.modifiers)?.some((m) => m.kind === t.SyntaxKind.ExportKeyword);
  const isDefault = (node) => (t.canHaveModifiers?.(node) ? t.getModifiers(node) : node.modifiers)?.some((m) => m.kind === t.SyntaxKind.DefaultKeyword);
  for (const node of source.statements) {
    if (t.isFunctionDeclaration(node) && exported(node)) out.push({ name: isDefault(node) ? 'default' : node.name?.text ?? 'default', fn: true, line: lineOf(source, node) });
    else if (t.isClassDeclaration(node) && exported(node)) out.push({ name: isDefault(node) ? 'default' : node.name?.text ?? 'default', fn: false, line: lineOf(source, node) });
    else if (t.isVariableStatement(node) && exported(node)) {
      for (const d of node.declarationList.declarations) {
        if (!t.isIdentifier(d.name)) { out.push({ name: '<pattern>', fn: false, line: lineOf(source, d) }); continue; }
        const init = d.initializer;
        out.push({ name: d.name.text, fn: Boolean(init && (t.isArrowFunction(init) || t.isFunctionExpression(init))), line: lineOf(source, d) });
      }
    } else if (t.isExportDeclaration(node)) {
      if (!node.exportClause) out.push({ name: '*', fn: false, line: lineOf(source, node) });
      else if (t.isNamedExports(node.exportClause)) for (const el of node.exportClause.elements) out.push({ name: el.name.text, fn: false, line: lineOf(source, el), reexport: true });
      else out.push({ name: node.exportClause.name.text, fn: false, line: lineOf(source, node) });
    } else if (t.isExportAssignment(node)) out.push({ name: 'default', fn: false, line: lineOf(source, node) });
  }
  return out;
}
