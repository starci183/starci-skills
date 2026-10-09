import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { needsDeclaration, packageName, runtimeSpecifiers, sourceFiles } from '../helpers/declared-deps.mjs';

// declared-deps — every package the runtime loads in its OWN resolution context is declared in package.json.
// 2026-09 (undeclared-dep-acorn): scripts/checks/check-helper-once.mjs loaded acorn through
// createRequire(path.join(skillRoot, 'packages', 'node_modules', 'x.js')) — undeclared, it resolved only via the
// host repository's node_modules one level up, and every tree outside the host (land-gate scratch, worker staging)
// died 'Cannot find module acorn'.
//
// Scanned roots: the runtime roots of check-helper-once.mjs (scripts/, engine/, modules/, bin/, ext/); the scanner and what
// counts as runtime-bound are tests/helpers/declared-deps.mjs. packages/ carry their own manifests
// (tests/gates/package-declared-deps.spec.mjs); examples/ and ui/ carry theirs; tests/ embeds fixture specifiers.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]);

// The land gate runs this spec for any change under these roots (land.mjs invariantRootsOf): declared once, here.
export const INVARIANT_ROOTS = ['scripts', 'engine', 'modules', 'bin', 'ext'];

function runtimeFiles() {
  return INVARIANT_ROOTS.filter((base) => fs.existsSync(path.join(root, base)))
    .flatMap((base) => sourceFiles(path.join(root, base), { include: (name) => name.endsWith('.mjs') }).map((rel) => `${base}/${rel}`)).sort();
}

test('every runtime-bound bare specifier under scripts/ engine/ modules/ bin/ ext/ is a node: builtin or a declared dependency', () => {
  const violations = [];
  for (const rel of runtimeFiles()) {
    for (const spec of runtimeSpecifiers(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) {
      if (!needsDeclaration(spec)) continue;
      if (!declared.has(packageName(spec))) violations.push(`${rel}: '${spec}' is not declared in package.json`);
    }
  }
  assert.deepEqual(violations, []);
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
