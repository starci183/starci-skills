import test from 'node:test';
import assert from 'node:assert/strict';
import { helperOnceFindings } from '../scripts/checks/check-helper-once.mjs';

// RED15 and RED17: a shared helper has one home (where git may be spawned is scripts/checks/check-layers.mjs).
const run = (files) => helperOnceFindings({ tracked: Object.keys(files), read: (rel) => files[rel] });
const summary = (findings) => findings.map((f) => [f.code, f.path]);

const PATH_KEY = "export const slash = (p) => String(p ?? '').replaceAll('-', '/');\n";

test('a copy of an exported lib helper is flagged, whatever its local names', () => {
  const findings = run({
    'scripts/lib/path-key.mjs': PATH_KEY,
    'scripts/kernel/copy.mjs': "const toSlash = (value) => String(value ?? '').replaceAll('-', '/');\nexport const use = (x) => toSlash(x);\n",
  });
  assert.deepEqual(summary(findings), [['RT_HELPER_REDEFINED', 'scripts/kernel/copy.mjs']]);
  assert.match(findings[0].message, /toSlash repeats slash exported by scripts\/lib\/path-key\.mjs/);
});

test('a function declaration equal to an exported arrow helper is flagged; comments and whitespace do not matter', () => {
  const findings = run({
    'engine/digest.mjs': "import { createHash } from 'node:crypto';\nexport const sha256 = (value) => createHash('sha256').update(value).digest('hex');\n",
    'scripts/work/copy.mjs': "import { createHash } from 'node:crypto';\n// hash\nfunction hashOf(text) {\n  /* the same */ return createHash('sha256')\n    .update(text)\n    .digest('hex');\n}\n",
  });
  assert.deepEqual(summary(findings), [['RT_HELPER_REDEFINED', 'scripts/work/copy.mjs']]);
});

test('a copy with a different body is a different contract and is not flagged', () => {
  assert.deepEqual(run({
    'scripts/lib/path-key.mjs': PATH_KEY,
    'scripts/kernel/other.mjs': "const slash = (value) => String(value ?? '').replaceAll('-', '/').replace(/^x/, '');\nexport const use = (x) => slash(x);\n",
  }), []);
});

test('a helper used only by import is not flagged, nor is the lib that defines it', () => {
  assert.deepEqual(run({
    'scripts/lib/path-key.mjs': PATH_KEY,
    'scripts/kernel/user.mjs': "import { slash } from '../lib/path-key.mjs';\nexport const use = (x) => slash(x);\n",
  }), []);
});

test('two libs exporting one name with different contracts are reported for a rename', () => {
  const findings = run({
    'engine/a.mjs': "export const putBlob = (m, content) => m.db.prepare('INSERT INTO blobs VALUES (?)').run(content);\n",
    'scripts/lib/b.mjs': "export const putBlob = (bytes) => ({ sha: bytes.length, size: bytes.length, stored: true, again: false });\n",
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'RT_HELPER_REDEFINED');
  assert.match(findings[0].message, /putBlob is exported by engine\/a\.mjs and scripts\/lib\/b\.mjs with different contracts: rename one/);
});

test('an api system lib (scripts/api/<system>/lib.mjs) is a helper home: a copy of its export elsewhere is flagged', () => {
  const findings = run({
    'scripts/api/git/lib.mjs': PATH_KEY,
    'scripts/kernel/copy.mjs': "const toSlash = (value) => String(value ?? '').replaceAll('-', '/');\nexport const use = (x) => toSlash(x);\n",
  });
  assert.deepEqual(summary(findings), [['RT_HELPER_REDEFINED', 'scripts/kernel/copy.mjs']]);
});

test('tests and files outside the runtime roots are not scanned', () => {
  assert.deepEqual(run({
    'scripts/lib/path-key.mjs': PATH_KEY,
    'tests/copy.spec.mjs': "const s = (v) => String(v ?? '').replaceAll('-', '/');\nimport { spawnSync } from 'node:child_process';\nspawnSync('git', []);\n",
    'packages/x/copy.mjs': "const s = (v) => String(v ?? '').replaceAll('-', '/');\n",
  }), []);
});

test("a helper bound to its own module's state is not a copy of another module's identical body", () => {
  const files = {
    'scripts/lib/pool.mjs': 'const cache = new Map();\nexport const resetPoolCache = () => { cache.clear(); cache.set("x", 1); cache.delete("y"); };\n',
    'scripts/lib/graph.mjs': 'const cache = new Map();\nexport const resetGraphs = () => { cache.clear(); cache.set("x", 1); cache.delete("y"); };\n',
  };
  assert.deepEqual(run(files).filter((f) => f.code === 'RT_HELPER_REDEFINED'), []);
  // the same body over a module-free value is still a copy
  const copies = {
    'scripts/lib/pool.mjs': 'export const clearAll = (cache) => { cache.clear(); cache.set("x", 1); cache.delete("y"); };\n',
    'scripts/other.mjs': 'const clearAll = (cache) => { cache.clear(); cache.set("x", 1); cache.delete("y"); };\n',
  };
  assert.equal(run(copies).filter((f) => f.code === 'RT_HELPER_REDEFINED').length, 1);
});
