import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundSpecifiers, isDeclared, needsDeclaration, sourceFiles } from './helpers/declared-deps.mjs';
import { publishSet } from '../scripts/checks/package-clean-test.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

// package-declared-deps - every bare specifier a published package's own sources and tests resolve is declared in THAT
// package's manifest (dependencies, devDependencies, peerDependencies or optionalDependencies; its own name resolves to
// itself). The publish set is scripts/checks/package-clean-test.mjs publishSet (the starci pins of canon-pins.yaml).
// 2026-10-01: @starci/test-world 1.0.0 shipped needing an undeclared @nestjs/platform-express; a hoisted node_modules hid
// it. Nest loads that driver dynamically, so this scan alone would not have caught it - the clean-install proof
// (tests/package-clean-test.spec.mjs) does - but every import the source does name is held here, without an install.
// A `fixtures` folder (sources a rule test lints) and a `templates` folder (files `hfs scaffold` writes into an app) are
// data: their imports resolve in the app that receives them, never in the package, so they are not scanned.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The land gate runs this spec for any change under these roots (land.mjs invariantRootsOf): declared once, here.
export const INVARIANT_ROOTS = ['packages'];

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const DATA_DIRS = new Set(['node_modules', 'dist', 'fixtures', 'templates']);
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** The undeclared bare specifiers of the package at `dir`: ['<file>: <spec>']. */
function undeclaredImports(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const declared = new Set([manifest.name, ...DEP_KEYS.flatMap((key) => Object.keys(manifest[key] ?? {}))]);
  const out = [];
  for (const rel of sourceFiles(dir, { include: (name) => CODE.test(name), skipDir: (name) => DATA_DIRS.has(name) })) {
    for (const bound of boundSpecifiers(rel, fs.readFileSync(path.join(dir, rel), 'utf8'))) {
      if (needsDeclaration(bound.spec) && !isDeclared(bound, declared)) out.push(`${rel}: '${bound.spec}'`);
    }
  }
  return [...new Set(out)];
}

test('every published package declares every bare specifier its sources and tests resolve', () => {
  const set = publishSet(root);
  assert.ok(set.length >= 9, `the publish set is read from canon-pins.yaml: ${JSON.stringify(set)}`);
  const violations = set.flatMap(({ name, dir }) => undeclaredImports(path.join(root, dir)).map((v) => `${name} (${dir}/package.json does not declare it) ${v}`));
  assert.deepEqual(violations, []);
});

test('a package fixture that imports an undeclared module is caught, a declared or own-name or @types-covered one is not', (t) => {
  const dir = mkdtemp(t, 'starci-pkg-deps-');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  write('package.json', JSON.stringify({ name: '@fixture/pkg', dependencies: { yaml: '2.0.0' }, devDependencies: { '@types/typed-only': '1.0.0' }, peerDependencies: { eslint: '>=9' } }));
  write('src/index.mjs', [
    "import YAML from 'yaml';",
    "import { readFileSync } from 'node:fs';",
    "import self from '@fixture/pkg/sub';",
    "export { YAML, readFileSync, self };",
  ].join('\n'));
  write('src/kind.ts', "import type { Shape } from 'typed-only';\nexport type K = Shape;\n");
  // the app's own prettier: a createRequire rooted at the caller's repository resolves there, not in the package
  write('src/format.cjs', "const { createRequire } = require('node:module');\nexports.load = (repo) => createRequire(repo + '/package.json')('prettier');\nexports.lint = () => require('eslint');\n");
  write('test/index.test.mjs', "import test from 'node:test';\nimport express from '@nestjs/platform-express';\ntest('x', () => express);\n");
  write('fixtures/linted.ts', "import { Injectable } from '@nestjs/common';\nexport { Injectable };\n");
  write('templates/app/main.ts', "import { NestFactory } from '@nestjs/core';\nexport { NestFactory };\n");
  assert.deepEqual(undeclaredImports(dir), ["test/index.test.mjs: '@nestjs/platform-express'"]);
});

test('a type-only import is not covered by an @types package of another name, and a value import never by @types', (t) => {
  const dir = mkdtemp(t, 'starci-pkg-deps-');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'p', devDependencies: { '@types/node': '22.0.0', '@types/jest__globals': '1.0.0' } }));
  fs.writeFileSync(path.join(dir, 'a.ts'), "import type { X } from '@jest/globals';\nimport type { Y } from 'pg';\nimport { z } from 'node-fetch';\nexport type T = X | Y | typeof z;\n");
  assert.deepEqual(undeclaredImports(dir), ["a.ts: 'pg'", "a.ts: 'node-fetch'"]);
});
