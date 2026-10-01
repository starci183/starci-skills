// declared-deps.mjs - the bare-specifier scanner behind tests/declared-deps.spec.mjs (the runtime root manifest) and
// tests/package-declared-deps.spec.mjs (each published package's own manifest).
//
// A specifier is bound to the scanned tree when Node resolves it from there:
//   - static import/export ... from 'x', side-effect import 'x', dynamic import('x'), import.meta.resolve('x')
//   - require('x') / require.resolve('x') where the binding is a plain CommonJS require, or createRequire anchored at
//     import.meta, __filename/__dirname or the runtime root (skillRoot, runtimeRoot, ROOT, moduleRoot - plus parameters and
//     variables initialised from one)
//   - createRequire(<anchor>)('x') / .resolve('x')
// A createRequire anchored at a CALLER-SUPPLIED root (repository, root, dir, packageFile, productDir, base) resolves inside
// the TARGET repository by design - the product owns eslint, typescript, playwright, react, prettier - and is not a
// dependency of the scanned tree. TypeScript sources (.ts/.tsx/.mts/.cts) are parsed the same way; a type-only import
// (`import type`) is satisfied by the package or by its @types/ package.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, isBuiltin } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');

const ANCHOR_NAMES = Object.freeze(['skillRoot', 'runtimeRoot', 'ROOT', 'moduleRoot', '__dirname', '__filename']);
const IMPORT_META = /\bimport\s*\.\s*meta\b/;
const SCRIPT_KIND = { '.ts': ts.ScriptKind.TS, '.mts': ts.ScriptKind.TS, '.cts': ts.ScriptKind.TS, '.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX };

export const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
/** Node-resolved bare specifiers only: relative, absolute, #-imports and URI schemes (node:, data:, file:) never hit node_modules. */
export const isBare = (spec) =>
  !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('#')
  && !/^[a-zA-Z]:[\\/]/.test(spec) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(spec);
/** A specifier that must be declared: bare and not a Node builtin. */
export const needsDeclaration = (spec) => isBare(spec) && !isBuiltin(spec);
const isLit = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

/** The files under `base` (absolute) whose name `include` accepts, skipping every folder `skipDir` names; posix paths relative to `base`. */
export function sourceFiles(base, { include, skipDir = (name) => name === 'node_modules' }) {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!skipDir(e.name)) walk(r); }
      else if (e.isFile() && include(e.name)) out.push(r);
    }
  };
  walk('');
  return out.sort();
}

/** Does `expr` anchor module resolution inside the scanned tree: import.meta.* or an anchor name? */
function anchorIsOwn(expr, sf, ids) {
  if (IMPORT_META.test(expr.getText(sf))) return true;
  // A name counts only where it refers to the anchor: a parameter of a function inside `expr` shadows it (gate.mjs
  // `[root, ...].find((dir) => ...)` reads its own `dir`, not the runtime `dir` another function declares), and a
  // property name (`x.dir`, `{dir: v}`) is not a reference.
  let hit = false;
  const visit = (n, shadowed) => {
    if (hit) return;
    if (ts.isIdentifier(n)) { if (ids.has(n.text) && !shadowed.has(n.text)) hit = true; return; }
    let inner = shadowed;
    if (ts.isFunctionLike(n)) {
      inner = new Set(shadowed);
      for (const p of n.parameters ?? []) if (ts.isIdentifier(p.name)) inner.add(p.name.text);
      const locals = (m) => { if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name)) inner.add(m.name.text); ts.forEachChild(m, locals); };
      if (n.body) locals(n.body);
    }
    if (ts.isPropertyAccessExpression(n)) { visit(n.expression, inner); return; }
    if (ts.isPropertyAssignment(n)) { visit(n.initializer, inner); return; }
    ts.forEachChild(n, (child) => visit(child, inner));
  };
  visit(expr, new Set());
  return hit;
}

/**
 * The specifiers one source resolves in its own context: [{spec, typeOnly}]. Bindings are collected before calls so a
 * `require` used above its declaration still classifies; a `require` never bound to a createRequire counts as own.
 */
export function boundSpecifiers(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, SCRIPT_KIND[path.extname(rel)] ?? ts.ScriptKind.JS);
  const ids = new Set(ANCHOR_NAMES);
  const bound = new Map(); // createRequire product name -> 'own' | 'external'
  const anchored = (expr) => anchorIsOwn(expr, sf, ids);
  for (let grew = true; grew;) {
    grew = false;
    const visit = (n) => {
      const name = (ts.isVariableDeclaration(n) || ts.isParameter(n)) && ts.isIdentifier(n.name) && n.initializer ? n.name.text : null;
      if (name && !ids.has(name) && anchored(n.initializer)) { ids.add(name); grew = true; }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const collectBound = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && ts.isIdentifier(n.initializer.expression) && n.initializer.expression.text === 'createRequire' && n.initializer.arguments.length) {
      bound.set(n.name.text, anchored(n.initializer.arguments[0]) ? 'own' : 'external');
    }
    ts.forEachChild(n, collectBound);
  };
  collectBound(sf);

  const specs = [];
  const pushIf = (n, own) => { if (own && isLit(n.arguments[0])) specs.push({ spec: n.arguments[0].text, typeOnly: false }); };
  const boundKind = (name) => bound.get(name) ?? 'own';
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && isLit(n.moduleSpecifier)) {
      const clause = n.importClause;
      const typeOnly = Boolean(clause?.isTypeOnly || (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.length && clause.namedBindings.elements.every((e) => e.isTypeOnly)));
      specs.push({ spec: n.moduleSpecifier.text, typeOnly });
    } else if (ts.isExportDeclaration(n) && isLit(n.moduleSpecifier)) specs.push({ spec: n.moduleSpecifier.text, typeOnly: Boolean(n.isTypeOnly) });
    else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && isLit(n.argument.literal)) specs.push({ spec: n.argument.literal.text, typeOnly: true });
    else if (ts.isCallExpression(n)) {
      const e = n.expression;
      if (e.kind === ts.SyntaxKind.ImportKeyword) pushIf(n, true);
      else if (ts.isIdentifier(e) && (bound.has(e.text) || e.text === 'require')) pushIf(n, boundKind(e.text) === 'own');
      else if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'createRequire' && e.arguments.length)
        pushIf(n, anchored(e.arguments[0]));
      else if (ts.isPropertyAccessExpression(e) && e.name.text === 'resolve') {
        const inner = e.expression;
        if (inner.getText(sf) === 'import.meta') pushIf(n, true);
        else if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'createRequire' && inner.arguments.length)
          pushIf(n, anchored(inner.arguments[0]));
        else if (ts.isIdentifier(inner) && (bound.has(inner.text) || inner.text === 'require')) pushIf(n, boundKind(inner.text) === 'own');
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return specs;
}

/** The specifier strings of boundSpecifiers. */
export const runtimeSpecifiers = (rel, text) => boundSpecifiers(rel, text).map((s) => s.spec);

/** Whether `declared` (a Set of package names) covers one bound specifier: the package, or its @types/ package for a type-only import. */
export function isDeclared({ spec, typeOnly }, declared) {
  const name = packageName(spec);
  if (declared.has(name)) return true;
  return typeOnly && declared.has(`@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`);
}
