import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { aliasMatches, boundSpecifiers, isDeclared, needsDeclaration, packageName, tsconfigAliases } from './helpers/declared-deps.mjs';
import { gitTrackedUnder, publishSet } from '../scripts/checks/package-clean-test.mjs';
import { withoutGitLocalEnv } from '../scripts/supervisor/land.mjs';
import { TEMPLATES_DIR } from '../packages/hfs/sync/index.mjs';
import { mkdtemp } from './helpers/tmpdir.mjs';

// package-declared-deps - every bare specifier a published package's own TRACKED sources and tests resolve is declared:
//   - in THAT package's manifest (dependencies, devDependencies, peerDependencies or optionalDependencies; its own name
//     resolves to itself; a type-only import also by its @types package), or
//   - by a committed stub the resolution reaches first: a tracked node_modules/<name> in a folder between the file and the
//     package root (the typed lint fixtures carry their own type stubs, packages/eslint/*/fixtures/typed/node_modules), or
//   - by a `paths` alias of the nearest tracked tsconfig.json between the file and the package root.
// What is never scanned is declared, not named: a file inside a tracked node_modules is a resolution target, not a source,
// and a folder a package's code reads as DATA is declared by its reader - DATA_ROOTS below, today the scaffold's
// TEMPLATES_DIR (packages/hfs/sync/index.mjs): those files are an app's sources, judged by the scaffolded app's own lint and
// typecheck (tests/hfs-scaffold-app.spec.mjs, scripts/checks/release-app-installs.mjs). A folder called fixtures or templates
// anywhere else is scanned like any source.
// 2026-10-01: @starci/test-world 1.0.0 shipped needing an undeclared @nestjs/platform-express; a hoisted node_modules hid
// it. Nest loads that driver dynamically, so this scan alone would not have caught it - the clean-install proof
// (tests/package-clean-test.spec.mjs) does - but every import the source does name is held here, without an install.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// The land gate runs this spec for any change under these roots (land.mjs invariantRootsOf): declared once, here.
export const INVARIANT_ROOTS = ['packages'];

/** The folders a package's own code reads as data, each declared by its reader. */
const DATA_ROOTS = Object.freeze([TEMPLATES_DIR]);
const CODE = /\.(?:[cm]?[jt]sx?)$/;
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const inside = (file, dir) => { const rel = path.relative(dir, file); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/** The undeclared bare specifiers of the package at `dir` (a git work tree): ['<file>: <spec>']. */
function undeclaredImports(dir, { dataRoots = DATA_ROOTS } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const declared = new Set([manifest.name, ...DEP_KEYS.flatMap((key) => Object.keys(manifest[key] ?? {}))]);
  const tracked = gitTrackedUnder(dir);
  assert.ok(tracked, `${dir} is a git work tree`);
  const trackedSet = new Set(tracked);
  // the committed stubs: '<folder>/node_modules/<name>' for every tracked file under a node_modules
  const stubs = new Set(tracked.filter((f) => f.split('/').includes('node_modules')).map((f) => {
    const at = f.lastIndexOf('node_modules/'), rest = f.slice(at + 'node_modules/'.length).split('/');
    return `${f.slice(0, at)}node_modules/${rest[0].startsWith('@') ? rest.slice(0, 2).join('/') : rest[0]}`;
  }));
  const ancestors = (rel) => { const out = []; for (let d = path.posix.dirname(rel); ; d = path.posix.dirname(d)) { out.push(d === '.' ? '' : `${d}/`); if (d === '.') return out; } };
  const aliasCache = new Map();
  const aliasesOf = (rel) => {
    const config = ancestors(rel).map((d) => `${d}tsconfig.json`).find((f) => trackedSet.has(f));
    if (!config) return [];
    if (!aliasCache.has(config)) aliasCache.set(config, tsconfigAliases(path.join(dir, config)));
    return aliasCache.get(config);
  };
  const out = [];
  for (const rel of tracked) {
    if (!CODE.test(rel) || rel.split('/').includes('node_modules')) continue;
    if (dataRoots.some((data) => inside(path.join(dir, rel), data))) continue;
    for (const bound of boundSpecifiers(rel, fs.readFileSync(path.join(dir, rel), 'utf8'))) {
      if (!needsDeclaration(bound.spec) || isDeclared(bound, declared)) continue;
      if (ancestors(rel).some((d) => stubs.has(`${d}node_modules/${packageName(bound.spec)}`))) continue;
      if (aliasesOf(rel).some((pattern) => aliasMatches(pattern, bound.spec))) continue;
      out.push(`${rel}: '${bound.spec}'`);
    }
  }
  return [...new Set(out)];
}

test('every published package declares every bare specifier its tracked sources and tests resolve', () => {
  const set = publishSet(root);
  assert.ok(set.length >= 9, `the publish set is read from canon-pins.yaml: ${JSON.stringify(set)}`);
  const violations = set.flatMap(({ name, dir }) => undeclaredImports(path.join(root, dir)).map((v) => `${name} (${dir}/package.json does not declare it) ${v}`));
  assert.deepEqual(violations, []);
});

test('every declared data root exists and no scanned source of its package imports from it', () => {
  for (const data of DATA_ROOTS) {
    assert.ok(fs.statSync(data).isDirectory(), data);
    const pkg = publishSet(root).find(({ dir }) => inside(data, path.join(root, dir)));
    assert.ok(pkg, `${data} lies inside a published package`);
    const base = path.join(root, pkg.dir);
    for (const rel of gitTrackedUnder(base).filter((f) => CODE.test(f) && !f.split('/').includes('node_modules') && !inside(path.join(base, f), data))) {
      for (const { spec } of boundSpecifiers(rel, fs.readFileSync(path.join(base, rel), 'utf8'))) {
        if (spec.startsWith('.')) assert.ok(!inside(path.resolve(base, path.dirname(rel), spec), data), `${pkg.dir}/${rel} imports ${spec} from the data root`);
      }
    }
  }
});

const gitIn = (dir, ...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: withoutGitLocalEnv(), windowsHide: true }); assert.equal(r.status, 0, r.stderr); };
/** A git work tree package from `files` (all tracked); `untracked` files are written but not added. */
function fixturePackage(t, files, untracked = {}) {
  const dir = mkdtemp(t, 'starci-pkg-deps-');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  gitIn(dir, 'init', '-q');
  for (const [rel, text] of Object.entries(files)) write(rel, text);
  gitIn(dir, 'add', '-f', ...Object.keys(files));
  for (const [rel, text] of Object.entries(untracked)) write(rel, text);
  return dir;
}

test('a package fixture that imports an undeclared module is caught; declared, own-name, @types, stub and alias imports are not', (t) => {
  const dir = fixturePackage(t, {
    'package.json': JSON.stringify({ name: '@fixture/pkg', dependencies: { yaml: '2.0.0' }, devDependencies: { '@types/typed-only': '1.0.0' }, peerDependencies: { eslint: '>=9' } }),
    'src/index.mjs': "import YAML from 'yaml';\nimport { readFileSync } from 'node:fs';\nimport self from '@fixture/pkg/sub';\nexport { YAML, readFileSync, self };\n",
    'src/kind.ts': "import type { Shape } from 'typed-only';\nexport type K = Shape;\n",
    // the app's own prettier: a createRequire rooted at the caller's repository resolves there, not in the package
    'src/format.cjs': "const { createRequire } = require('node:module');\nexports.load = (repo) => createRequire(repo + '/package.json')('prettier');\nexports.lint = () => require('eslint');\n",
    'test/index.test.mjs': "import test from 'node:test';\nimport express from '@nestjs/platform-express';\ntest('x', () => express);\n",
    // a typed lint fixture: its committed stub and its tsconfig alias declare what it imports
    'lint/typed/tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@modules/*': ['./src/modules/*'] } } }),
    'lint/typed/node_modules/@nestjs/common/index.d.ts': 'export declare function Injectable(): ClassDecorator;\n',
    'lint/typed/src/a.service.ts': "import { Injectable } from '@nestjs/common';\nimport { Clock } from '@modules/platform';\nexport { Injectable, Clock };\n",
    // the stub and the alias reach only the files under their folder
    'src/b.service.ts': "import { Injectable } from '@nestjs/common';\nimport { Clock } from '@modules/platform';\nexport { Injectable, Clock };\n",
  }, {
    // untracked: an install or a scratch file is never a source
    'scratch/local.mjs': "import 'left-pad';\n",
  });
  assert.deepEqual(undeclaredImports(dir, { dataRoots: [] }).sort(), [
    "src/b.service.ts: '@modules/platform'",
    "src/b.service.ts: '@nestjs/common'",
    "test/index.test.mjs: '@nestjs/platform-express'",
  ]);
});

test('a folder is skipped only when a reader declares it as data, never for its name', (t) => {
  const dir = fixturePackage(t, {
    'package.json': JSON.stringify({ name: 'p' }),
    'fixtures/app.mjs': "import 'undeclared-in-fixtures';\n",
    'templates/main.ts': "import 'undeclared-in-templates';\n",
    'skeleton/main.ts': "import 'read-as-data';\n",
  });
  assert.deepEqual(undeclaredImports(dir, { dataRoots: [] }).sort(), ["fixtures/app.mjs: 'undeclared-in-fixtures'", "skeleton/main.ts: 'read-as-data'", "templates/main.ts: 'undeclared-in-templates'"]);
  assert.deepEqual(undeclaredImports(dir, { dataRoots: [path.join(dir, 'skeleton')] }).sort(), ["fixtures/app.mjs: 'undeclared-in-fixtures'", "templates/main.ts: 'undeclared-in-templates'"]);
});

test('a type-only import is not covered by an @types package of another name, and a value import never by @types', (t) => {
  const dir = fixturePackage(t, {
    'package.json': JSON.stringify({ name: 'p', devDependencies: { '@types/node': '22.0.0', '@types/jest__globals': '1.0.0' } }),
    'a.ts': "import type { X } from '@jest/globals';\nimport type { Y } from 'pg';\nimport { z } from 'node-fetch';\nexport type T = X | Y | typeof z;\n",
  });
  assert.deepEqual(undeclaredImports(dir, { dataRoots: [] }), ["a.ts: 'pg'", "a.ts: 'node-fetch'"]);
});
