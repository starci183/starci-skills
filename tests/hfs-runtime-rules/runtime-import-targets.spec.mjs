import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSlotManifest, RUNTIME_MANIFEST_FILE } from '../../scripts/hfs/slots.mjs';
import { runtimeCheck } from '../../scripts/hfs/runtime-check.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });

function fixture(t, files, untracked = {}, indexed = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-import-targets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = { 'hfs.json': '{"hfs":1,"kind":"runtime","project":"starci"}\n', ...files };
  for (const [rel, text] of Object.entries({ ...source, ...untracked })) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return runtimeCheck({ repoRoot: root, root: ROOT, files: [...Object.keys(source), ...indexed], tree: false, base: null, drift: [], manifest: MANIFEST });
}

const importFindings = (result) => result.findings.filter((f) => ['RT_TIER_DIRECTION', 'RT_API_SHAPE', 'ARCH_OWNER_CYCLE'].includes(f.code));

test('both runtime owner checks refuse missing static, re-export, dynamic and require targets', (t) => {
  const result = fixture(t, {
    'scripts/api/git/show.mjs': [
      "import './missing.mjs';",
      "export { read } from '../../lib/missing.mjs';",
      "const load = () => import('./dynamic.mjs');",
      "const other = require('./required.cjs');",
      'export function show() { return load; }',
      '',
    ].join('\n'),
  });
  for (const code of ['RT_TIER_DIRECTION', 'RT_API_SHAPE']) {
    const found = result.findings.filter((f) => f.code === code && /missing internal target/.test(f.message));
    assert.deepEqual(found.map((f) => f.line), [1, 2, 3, 4]);
    assert.ok(found.every((f) => f.path === 'scripts/api/git/show.mjs' && f.column > 0));
    assert.match(found[0].message, /scripts\/api\/git\/missing\.mjs/);
  }
});

test('known owner edges still check tiers and API crossings', (t) => {
  const result = fixture(t, {
    'scripts/api/git/show.mjs': "import '../node/run.mjs';\nexport function show() {}\n",
    'scripts/api/node/run.mjs': 'export function run() {}\n',
    'scripts/lib/value.mjs': "import '../kernel/value.mjs';\n",
    'scripts/kernel/value.mjs': 'export const value = 1;\n',
  });
  assert.ok(result.findings.some((f) => f.code === 'RT_API_SHAPE' && /an api system never imports another/.test(f.message)));
  assert.ok(result.findings.some((f) => f.code === 'RT_TIER_DIRECTION' && f.path === 'scripts/lib/value.mjs'));
  assert.ok(importFindings(result).every((f) => !/missing internal target/.test(f.message)));
});

test('a tracked name whose actual file is missing cannot manufacture a resolved target', (t) => {
  const result = fixture(t, {
    'scripts/api/git/show.mjs': "import './absent.mjs';\nexport function show() {}\n",
  }, {}, ['scripts/api/git/absent.mjs']);
  for (const code of ['RT_TIER_DIRECTION', 'RT_API_SHAPE']) {
    assert.ok(result.findings.some((f) => f.code === code && /missing internal target.*absent\.mjs/.test(f.message)));
  }
});

test('an existing empty ignored generated module is not a missing tracked owner edge', (t) => {
  const result = fixture(t, {
    'scripts/kernel/value.mjs': "import '../../packages/hfs/runtime/empty.mjs';\nexport const value = 1;\n",
  }, { 'packages/hfs/runtime/empty.mjs': '' });
  assert.deepEqual(importFindings(result), []);
});

test('node builtins and external package specifiers are not internal missing targets', (t) => {
  const result = fixture(t, {
    'scripts/kernel/value.mjs': "import path from 'node:path';\nimport value from 'external-fixture';\nexport { value };\n",
  });
  assert.deepEqual(importFindings(result), []);
});
