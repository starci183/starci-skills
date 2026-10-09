#!/usr/bin/env node
// check-spec-cache-key.mjs - SPEC_CACHE_KEY_BLIND (part of `npm run check`; self-check spec-cache-key).
//   runs in the check stage; --json prints the findings as JSON
//
// A reused spec result is only as good as its key. This builds a tiny checkout for EVERY input class the affected selector knows - the import closure (static, dynamic, require, spawned entry), the data readers
// (a named file, a file named beside its folder, a sibling folder, a named folder, a named tree), each generated output and each data root of modules/supervisor/affected-tests.yaml, the widened tiers and the runner
// (node version, preload, lockfile) - changes ONE file of the class and requires the key to change; it also requires a change to an unrelated file to leave a narrow key alone. A class whose change leaves the key
// unchanged is a blind spot: a stale green would be reused for it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { walkFiles } from '../lib/walk.mjs';
import { createKeyer } from '../supervisor/spec-cache-key.mjs';

export const CODE = 'SPEC_CACHE_KEY_BLIND';
const SPEC = 'tests/s.spec.mjs';
const PRELOADS = ['tests/setup/pre.mjs'];
const BASE_FILES = { [SPEC]: "import './dep.mjs';\n", 'tests/dep.mjs': 'export const dep = 1;\n', 'tests/setup/pre.mjs': 'export {};\n', 'tests/other.mjs': 'export const other = 1;\n', 'scripts/other.mjs': 'export const other = 1;\n', 'package.json': '{}\n' };
const quoted = (part) => `'${part}'`;
const READ = (...parts) => `import fs from 'node:fs';\nfs.readFileSync(${parts.map(quoted).join(', ')});\n`;

/** The ids of every file below `dir` ({rel -> sha256}), like the tree listing the real keyer reads from git. */
function idsOf(dir) {
  const ids = new Map();
  for (const abs of walkFiles(dir)) ids.set(path.relative(dir, abs).split(path.sep).join('/'), crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
  return ids;
}

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

/** The key of SPEC over `files` (before) and over `files` with `change` applied (after): [before, after]. */
function keysAround({ files, change, makeKeyer, generated, nodeVersion = 'v0.0.0' }) {
  const dir = makeTempDir('starci-spec-cache-key-');
  try {
    write(dir, { ...BASE_FILES, ...files });
    const keyOf = () => makeKeyer({ root: dir, preloads: PRELOADS, generated, ids: idsOf(dir), nodeVersion }).keyOf(SPEC).key;
    const before = keyOf();
    write(dir, change);
    return [before, keyOf()];
  } finally {
    safeRemove(dir, { hold: () => null });
  }
}

/** The input classes: {name, files, change, same?}. `same` marks a change that must NOT move the key. */
export function inputClasses({ generated, dataRoots }) {
  const classes = [
    { name: 'the spec file itself', files: {}, change: { [SPEC]: "import './dep.mjs';\n// edited\n" } },
    { name: 'a static import, three deep', files: { [SPEC]: "import '../scripts/b.mjs';\n", 'scripts/b.mjs': "import './c.mjs';\n", 'scripts/c.mjs': "import './d.mjs';\n", 'scripts/d.mjs': 'export const d = 1;\n' }, change: { 'scripts/d.mjs': 'export const d = 2;\n' } },
    { name: 'a re-export', files: { [SPEC]: "export * from '../scripts/b.mjs';\n", 'scripts/b.mjs': 'export const b = 1;\n' }, change: { 'scripts/b.mjs': 'export const b = 2;\n' } },
    { name: 'a literal dynamic import', files: { [SPEC]: "await import('../scripts/b.mjs');\n", 'scripts/b.mjs': 'export const b = 1;\n' }, change: { 'scripts/b.mjs': 'export const b = 2;\n' } },
    { name: 'a literal require', files: { [SPEC]: "const b = require('../scripts/b.cjs');\n", 'scripts/b.cjs': 'module.exports = 1;\n' }, change: { 'scripts/b.cjs': 'module.exports = 2;\n' } },
    { name: 'a runtime entry the spec spawns', files: { [SPEC]: "const entry = ['scripts', 'e.mjs'];\n", 'scripts/e.mjs': 'export const e = 1;\n' }, change: { 'scripts/e.mjs': 'export const e = 2;\n' } },
    { name: 'a data file named by its path', files: { [SPEC]: READ('modules/x/rows.yaml'), 'modules/x/rows.yaml': 'a: 1\n' }, change: { 'modules/x/rows.yaml': 'a: 2\n' } },
    { name: 'a data file named beside its folder', files: { [SPEC]: READ('modules', 'sub', 'rows.yaml'), 'modules/sub/rows.yaml': 'a: 1\n' }, change: { 'modules/sub/rows.yaml': 'a: 2\n' } },
    { name: 'a data file read by a module of the closure', files: { [SPEC]: "import '../scripts/reader.mjs';\n", 'scripts/reader.mjs': READ('knowledge', 'sub', 'rows.yaml'), 'knowledge/sub/rows.yaml': 'a: 1\n' }, change: { 'knowledge/sub/rows.yaml': 'a: 2\n' } },
    { name: 'a code file read as text', files: { [SPEC]: READ('scripts/target.mjs'), 'scripts/target.mjs': 'export const t = 1;\n' }, change: { 'scripts/target.mjs': 'export const t = 2;\n' } },
    { name: 'a sibling folder', files: { [SPEC]: READ('./fixtures'), 'tests/fixtures/f.json': '1\n' }, change: { 'tests/fixtures/f.json': '2\n' } },
    { name: 'a named folder', files: { [SPEC]: READ('modules/cli/commands'), 'modules/cli/commands/a.yaml': 'a: 1\n' }, change: { 'modules/cli/commands/a.yaml': 'a: 2\n' } },
    { name: 'a named tree of data', files: { [SPEC]: READ('packages/tree/be'), 'packages/tree/be/x.ts': 'export {};\n' }, change: { 'packages/tree/be/x.ts': 'export {};\n// edited\n' } },
    { name: 'the CLI the spec starts (runtime tier): any runtime file', files: { [SPEC]: READ('packages/cli/bin/starci.mjs'), 'packages/cli/bin/starci.mjs': 'export {};\n' }, change: { 'scripts/other.mjs': 'export const other = 2;\n' } },
    { name: 'a scan of tests/ (tree tier): any file', files: { [SPEC]: "import fs from 'node:fs';\nfs.readdirSync('tests');\n" }, change: { 'tests/other.mjs': 'export const other = 2;\n' } },
    { name: 'the preload files of the runner', files: {}, change: { 'tests/setup/pre.mjs': 'export const pre = 2;\n' } },
    { name: 'the lockfile of the dependencies', files: { 'package-lock.json': '{}\n' }, change: { 'package-lock.json': '{"x":1}\n' } },
    { name: 'a file no spec uses (must NOT move a narrow key)', files: {}, change: { 'scripts/other.mjs': 'export const other = 2;\n', 'tests/other.mjs': 'export const other = 3;\n' }, same: true },
    { name: 'the tests/ files of a runtime-tier spec (must NOT move its key)', files: { [SPEC]: READ('packages/cli/bin/starci.mjs'), 'packages/cli/bin/starci.mjs': 'export {};\n' }, change: { 'tests/other.mjs': 'export const other = 3;\n' }, same: true },
  ];
  for (const entry of generated) {
    const output = entry.output.endsWith('/') ? `${entry.output}x.txt` : entry.output;
    classes.push({ name: `the generated output ${entry.output} of ${entry.generator}`, files: { [SPEC]: `import '../${entry.generator}';\n`, [entry.generator]: 'export {};\n', [output]: '1\n' }, change: { [output]: '2\n' } });
  }
  for (const root of dataRoots) {
    classes.push({ name: `a data file under the data root ${root}/`, files: { [SPEC]: READ(root, 'k', 'rows.yaml'), [`${root}/k/rows.yaml`]: 'a: 1\n' }, change: { [`${root}/k/rows.yaml`]: 'a: 2\n' } });
  }
  return classes;
}

/** The findings over the key of `makeKeyer` (the real one by default) for every input class, plus the node version. */
export function keyCoverageFindings({ makeKeyer = createKeyer, policy = readModuleJson('modules', 'supervisor', 'affected-tests.yaml') } = {}) {
  const generated = policy.generated ?? [];
  const findings = [];
  for (const entry of inputClasses({ generated, dataRoots: policy.dataRoots ?? [] })) {
    const [before, after] = keysAround({ ...entry, makeKeyer, generated });
    if ((before === after) !== Boolean(entry.same)) findings.push({ code: CODE, path: 'scripts/supervisor/spec-cache-key.mjs', message: entry.same ? `the key moved for ${entry.name}` : `the key does not move when ${entry.name} changes: a stale green would be reused` });
  }
  const dir = makeTempDir('starci-spec-cache-key-');
  try {
    write(dir, BASE_FILES);
    const keyAt = (nodeVersion) => makeKeyer({ root: dir, preloads: PRELOADS, generated, ids: idsOf(dir), nodeVersion }).keyOf(SPEC).key;
    if (keyAt('v1.0.0') === keyAt('v2.0.0')) findings.push({ code: CODE, path: 'scripts/supervisor/spec-cache-key.mjs', message: 'the key does not move with the node version' });
  } finally {
    safeRemove(dir, { hold: () => null });
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings(keyCoverageFindings(), 'OK: the spec cache key moves with every input class the affected selector knows.'));
