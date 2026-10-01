import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, isBuiltin } from 'node:module';
import { fileURLToPath } from 'node:url';

// declared-deps — every package the runtime loads in its OWN resolution context is declared in package.json.
// 2026-09 (undeclared-dep-acorn): scripts/checks/check-helper-once.mjs loaded acorn through
// createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js')) — undeclared, it resolved only via the
// host repository's node_modules one level up, and every tree outside the host (land-gate scratch, worker staging)
// died 'Cannot find module acorn'.
//
// Scanned roots: the runtime roots of check-helper-once.mjs (scripts/, engine/, modules/, bin/, ext/). A specifier
// is runtime-bound when Node resolves it inside this tree:
//   - static import/export ... from 'x', side-effect import 'x', dynamic import('x'), import.meta.resolve('x')
//   - require('x') / require.resolve('x') where the binding is createRequire anchored at import.meta or the runtime
//     root (skillRoot, runtimeRoot, ROOT, moduleRoot — plus parameters and variables initialised from one)
//   - createRequire(<runtime anchor>)('x') / .resolve('x')
// A createRequire anchored at a CALLER-SUPPLIED root (repository, root, dir, packageFile, productDir, base) resolves
// inside the TARGET repository by design — the product owns eslint, typescript, playwright, react — and is not a
// runtime dependency. packages/, examples/ and ui/ carry their own manifests; tests/ embeds fixture specifiers.

const ts = createRequire(import.meta.url)('typescript');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]);

// The land gate runs this spec for any change under these roots (land.mjs invariantRootsOf): declared once, here.
export const INVARIANT_ROOTS = ['scripts', 'engine', 'modules', 'bin', 'ext'];
const RUNTIME_NAMES = new Set(['skillRoot', 'runtimeRoot', 'ROOT', 'moduleRoot']);
const IMPORT_META = /\bimport\s*\.\s*meta\b/;

const packageName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
/** Node-resolved bare specifiers only: relative, absolute, #-imports and URI schemes (node:, data:, file:) never hit node_modules. */
const isBare = (spec) =>
  !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('#')
  && !/^[a-zA-Z]:[\\/]/.test(spec) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(spec);
const isLit = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

function runtimeFiles() {
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.mjs')) out.push(r);
    }
  };
  for (const base of INVARIANT_ROOTS) if (fs.existsSync(path.join(root, base))) walk(base);
  return out.sort();
}

/** Does `expr` anchor module resolution inside the runtime tree: import.meta.* or a runtime-root name? */
function anchorIsRuntime(expr, sf, ids) {
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
      // the function's own parameters and locals are its bindings, not the outer anchor of the same name
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
 * The runtime-bound bare specifiers of one .mjs source. Bindings are collected before calls so a `require` used
 * above its declaration still classifies; a `require` never bound to a createRequire counts as runtime-bound.
 */
function runtimeSpecifiers(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
  const ids = new Set(RUNTIME_NAMES);
  const bound = new Map(); // createRequire product name -> 'runtime' | 'external'
  const anchored = (expr) => anchorIsRuntime(expr, sf, ids);
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
      bound.set(n.name.text, anchored(n.initializer.arguments[0]) ? 'runtime' : 'external');
    }
    ts.forEachChild(n, collectBound);
  };
  collectBound(sf);

  const specs = [];
  const pushIf = (n, runtime) => { if (runtime && isLit(n.arguments[0])) specs.push(n.arguments[0].text); };
  const boundKind = (name) => bound.get(name) ?? 'runtime';
  const visit = (n) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && isLit(n.moduleSpecifier)) specs.push(n.moduleSpecifier.text);
    else if (ts.isCallExpression(n)) {
      const e = n.expression;
      if (e.kind === ts.SyntaxKind.ImportKeyword) pushIf(n, true);
      else if (ts.isIdentifier(e) && (bound.has(e.text) || e.text === 'require')) pushIf(n, boundKind(e.text) === 'runtime');
      else if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'createRequire' && e.arguments.length)
        pushIf(n, anchored(e.arguments[0]));
      else if (ts.isPropertyAccessExpression(e) && e.name.text === 'resolve') {
        const inner = e.expression;
        if (inner.getText(sf) === 'import.meta') pushIf(n, true);
        else if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'createRequire' && inner.arguments.length)
          pushIf(n, anchored(inner.arguments[0]));
        else if (ts.isIdentifier(inner) && (bound.has(inner.text) || inner.text === 'require')) pushIf(n, boundKind(inner.text) === 'runtime');
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return specs;
}

test('every runtime-bound bare specifier under scripts/ engine/ modules/ bin/ ext/ is a node: builtin or a declared dependency', () => {
  const violations = [];
  for (const rel of runtimeFiles()) {
    for (const spec of runtimeSpecifiers(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) {
      if (!isBare(spec) || isBuiltin(spec)) continue;
      if (!declared.has(packageName(spec))) violations.push(`${rel}: '${spec}' is not declared in package.json`);
    }
  }
  assert.deepEqual(violations, []);
});

test('check-helper-once.mjs loads acorn in the runtime context, so acorn is declared', () => {
  const rel = 'scripts/checks/check-helper-once.mjs';
  assert.ok(runtimeSpecifiers(rel, fs.readFileSync(path.join(root, rel), 'utf8')).includes('acorn'));
  assert.ok(declared.has('acorn'), "acorn resolves inside the runtime tree: declare it in package.json");
});

test('a callback parameter that shares a runtime-anchored name does not make a caller-rooted require runtime-bound', () => {
  const source = [
    "import { createRequire } from 'node:module';",
    "const runtimeRoot = new URL('.', import.meta.url).pathname;",
    "export const a = () => { const dir = runtimeRoot; return dir; };",
    "export const b = (root) => { const cwd = [root].find((dir) => dir.length) ?? root; return createRequire(cwd + '/package.json').resolve('jest/bin/jest.js'); };",
    "export const c = () => createRequire(import.meta.url).resolve('undeclared-runtime-dep');",
  ].join('\n');
  assert.deepEqual(runtimeSpecifiers('fixture.mjs', source), ['node:module', 'undeclared-runtime-dep']);
});
